'use client'

import { useState } from 'react';
import axios from 'axios';
import { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from "rehype-raw";




export default function HomePage() {
  const [message, setMessage] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ role: string; content: string }>>([]);
  
  const END_POINT_CHAT = 'http://localhost:8000/api/chat';
  const END_POINT_UPLOAD = 'http://localhost:8000/api/upload';

  const fileInputRef = useRef<HTMLInputElement | null>(null);


  const handleSend = async () => {
    if (!file && !message) {return setError("Please enter a message.");}
    setLoading(true);
    setError(null);
    setReply(null);
    try {
      const data = new FormData();
      if (file) {data.append('file', file);}
        data.append('history', JSON.stringify(history));
        data.append('prompt', message || '');

        setHistory((prev) => [
          ...prev,
          { role: "user", content: message || "" }
        ]);

        const response = await axios.post(END_POINT_UPLOAD, data, {
          headers: { 'Content-Type': 'multipart/form-data'},
          timeout: 120000,
          maxContentLength: 10 * 1024 * 1024
        });

        setHistory((prev) => [
          ...prev,
          { role: 'assistant', content: response.data.response }
        ])

        setMessage(null)
        setReply(response.data.response);
        }
      catch (err) {
        if (axios.isAxiosError(err) && err.code === 'ECONNABORTED') {
          setError("Request timed out. Please try again with a smaller file or message.");
        } else {
          setError("Error communicating with server.");
        }
      }
    finally {
      setLoading(false);
    } 
  }
   
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  }

  return (
    <main className="flex flex-col items-center min-h-screen bg-gray-50">
      <div className="w-full bg-white rounded-2xl p-6 shadow-md">
        <h1 className="text-3xl font-bold text-center mb-4">AI Chatbot</h1>

      <div className="flex-1 w-full overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50 h-[70vh]">
        {history.length === 0 && (
          <p className="text-gray-400 text-center">No messages yet</p>
        )}
        {history.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-4 p-3 rounded-lg ${
              msg.role === "user"
                ? "bg-blue-100 text-blue-800 self-end"
                : "bg-green-100 text-green-800 self-start"
            }`}
          >
            <strong>{msg.role === "user" ? "You:" : "AI:"}</strong>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                p: ({children}) => <p className="mb-2 text-gray-800 text-base">{children}</p>,
                h3: ({children}) => <h3 className="text-xl font-bold mt-4">{children}</h3>,
                li: ({children}) => <li className="ml-4 list-disc">{children}</li>,
                table: ({children}) => <table className="table-auto border-collapse border border-gray-300">{children}</table>,
                code: ({children}) => <code className="bg-gray-100 p-1 rounded">{children}</code>,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        ))}
        {loading && (
          <p className="text-gray-400 italic text-center">Processing...</p>
        )}
      </div>

        <div className="flex items-center gap-3 pb-2">
          <input
            ref={fileInputRef}
            id="file-upload"
            type="file"
            accept=".csv,image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <label
            htmlFor="file-upload"
            className="bg-gray-200 px-4 py-2 rounded cursor-pointer hover:bg-gray-300 transition"
          >
            {file ? `Choosing: ${file.name}` : "Upload CSV or image"}
          </label>

          {file && (
            <button
              onClick={() => {
                setFile(null)
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }}}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Delete
            </button>
          )}
        </div>
        {file && <p className="text-sm text-gray-600 mb-2">📎 {file.name}</p>}

        <textarea
          className="w-full border rounded-md p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
          rows={3}
          value={message || ''}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Insert your message here..."
        />

        <button
          onClick={handleSend}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {loading ? 'Processing...' : 'Send'}
        </button>

        {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}
      </div>
    </main>
  )
}