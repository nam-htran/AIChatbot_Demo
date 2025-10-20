from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import io
from dotenv import load_dotenv
from openai import OpenAI
import base64
import pandas as pd

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key=os.getenv("OPENROUTER_API_KEY"),
)

def encode_image_to_base64(content: bytes):
    return base64.b64encode(content).decode('utf-8')

SYSTEM_PROMPT = """
    You are a helpful assistant that always returns **well-formatted Markdown**.
    - Use headings (###) for sections
    - Use bullet points (-) for lists
    - Use tables (| column | column |) for structured data
    - Use code blocks for any structured output
    - Do not write plain paragraphs without markdown
    - Be concise and clear
    
    Please return your response in **Markdown** only:
    - Use headings (###) for sections
    - Use bullet points (-)
    - Use tables for structured data
    - Use code blocks for examples
    Example output:

    ### Key Observations
    - Small Sample Size: Count = 5. Be careful drawing conclusions.
    - High Variability: Std = 39059.21, mean = 21769.8. Values vary widely.

    ### Possible Issues
    | Issue             | Description |
    |------------------|------------|
    | Outliers          | Max = 91234, Min = 123 |
    | Data Entry Errors | Some values may be typos |

    ### Summary
    Data may contain errors or outliers. Further cleaning needed.
"""


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), prompt: str = Form(None), history: str = Form(None)):
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    history_data = []
    try: 
        history_data = eval(history)
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for mess in history_data:
            messages.append({"role": mess["role"], "content": mess["content"]})
    except:
        pass

    if file:
        content = await file.read()
        content_type = file.content_type.lower()
      
        if content_type.startswith("image/"):
            base64_image = encode_image_to_base64(content)
            data_url = f"data:{content_type};base64,{base64_image}"
            response = client.chat.completions.create(
                model=os.getenv("MODEL_NAME"),
                messages=[
                    {"role": "user", 
                    "content": [
                        {"type": 'text', 'text': prompt},
                        {"type": "image_url", 
                        "image_url": 
                            {"url": data_url}}
                        ]
                    },
                ]
            )
            return {"response": response.choices[0].message.content}
    
        elif content_type == "text/csv" or file.filename.endswith(".csv"):
            df = pd.read_csv(io.StringIO(content.decode('utf-8')))
            summary = df.describe().to_string()
            summary += "\n\nColumns:\n" + ", ".join(df.columns[:10])
            response = client.chat.completions.create(
                model=os.getenv("MODEL_NAME"),
                messages=[
                    {"role": "user", 
                    "content": f"{prompt}\nThe following is a summary of the CSV data:\n{summary}\nProvide insights based on this data."}
                ]
            )
            return {"response": response.choices[0].message.content}
        
        elif len(content) < 10 * 1024 * 1024: 
            return {"response": "Limited file in 10MB above"}
        else:
            return {"response": "Unsupported file type"}
        
    else:
        messages.append({"role": "user", "content": prompt})
        response = client.chat.completions.create(
            model=os.getenv("MODEL_NAME"),
            messages=[
                {'content': messages}
            ]
        )
        return {"response": response.choices[0].message.content}
