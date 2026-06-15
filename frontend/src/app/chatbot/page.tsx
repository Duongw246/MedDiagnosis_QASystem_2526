"use client";
import { useState, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiRequest } from "@/lib/api";

function formatChatbotAnswer(text: string): string {
  if (!text) return "";

  // Clean common Markdown artifacts (LLMs sometimes output bare '**' lines).
  let processed = text.replace(/^\s*\*\*\s*$/gm, "");
  // Remove standalone numbered artifacts like "**1." on their own line.
  processed = processed.replace(/^\s*\*\*\s*\d+\s*\.\s*$/gm, "");
  processed = processed.replace(/^\s*\*\*\d+\s*\.\s*$/gm, "");
  processed = processed.replace(/\n{3,}/g, "\n\n");

  // Normalize broken headers like "Định nghĩa:**" -> "**Định nghĩa:**"
  // Also bold plain headers "Bệnh: ..." -> "**Bệnh:** ..."
  const headers = [
    "Bệnh",
    "Định nghĩa",
    "Nguyên nhân",
    "Triệu chứng",
    "Biện pháp phòng ngừa",
    "Biện pháp phòng tránh",
    "Nguồn",
  ];
  const headerAlt = headers.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

  // Bracketed at line start
  processed = processed.replace(new RegExp(`^\\s*\\[\\s*(${headerAlt})\\s*\\]\\s*:\\s*\\*\\*\\s*`, "gim"), "**$1:** ");
  processed = processed.replace(new RegExp(`^\\s*\\[\\s*(${headerAlt})\\s*\\]\\s*:\\s*`, "gim"), "**$1:** ");

  // Plain at line start
  processed = processed.replace(new RegExp(`^\\s*(${headerAlt})\\s*:\\s*\\*\\*\\s*`, "gim"), "**$1:** ");
  processed = processed.replace(new RegExp(`^\\s*(${headerAlt})\\s*:\\s*`, "gim"), "**$1:** ");

  // Numbered at line start: "1. Định nghĩa:" -> "**Định nghĩa:**"
  processed = processed.replace(new RegExp(`^\\s*\\d+\\s*\\.\\s*(${headerAlt})\\s*:\\s*\\*\\*\\s*`, "gim"), "**$1:** ");
  processed = processed.replace(new RegExp(`^\\s*\\d+\\s*\\.\\s*(${headerAlt})\\s*:\\s*`, "gim"), "**$1:** ");

  // Mid-paragraph (rare but happens)
  processed = processed.replace(
    new RegExp(`\\b(${headerAlt})\\s*:\\s*\\*\\*\\s*`, "gi"),
    (match, header, offset, whole) => {
      const before = offset >= 2 ? whole.slice(offset - 2, offset) : "";
      if (before === "**") return match; // already bolded
      return `**${header}:** `;
    }
  );

  const patterns: RegExp[] = [
    // Insert paragraph breaks before canonical headers only.
    /(\s*)(###\s*Bệnh\s*:)/gi,
    /(\s*)(\*\*\s*Bệnh\s*:\s*\*\*)/gi,
    /(\s*)(\*\*\s*Định nghĩa\s*:\s*\*\*)/gi,
    /(\s*)(\*\*\s*Nguyên nhân\s*:\s*\*\*)/gi,
    /(\s*)(\*\*\s*Triệu chứng\s*:\s*\*\*)/gi,
    /(\s*)(\*\*\s*Biện pháp phòng ngừa\s*:\s*\*\*)/gi,
    /(\s*)(\*\*\s*Biện pháp phòng tránh\s*:\s*\*\*)/gi,
    /(\s*)(\*\*\s*Nguồn\s*:\s*\*\*)/gi,
  ];

  for (const p of patterns) {
    processed = processed.replace(p, (_m, _ws, marker) => `\n\n${marker}`);
  }

  processed = processed.replace(/\n{3,}/g, "\n\n").trim();
  return processed;
}

function maybeFormatChatbotAnswer(text: string): string {
  // Only format when it looks like a structured medical answer.
  const looksStructured = /(\[\s*Bệnh\s*\]\s*:|Bệnh\s*:|\[\s*Định nghĩa\s*\]\s*:|Định nghĩa\s*:|Nguyên nhân\s*:|Triệu chứng\s*:|Biện pháp phòng|Nguồn\s*:)/i.test(text);
  return looksStructured ? formatChatbotAnswer(text) : text;
}

interface ConsultationDetection {
  class: string;
  confidence: number;
}

interface ConsultationContextData {
  originalImage?: string | null;
  detectedImage?: string | null;
  diagnosisResult?: string | null;
  detections?: ConsultationDetection[];
}

export default function ChatbotPage() {
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const [messages, setMessages] = useState<{ user: string; bot: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Chatbot config
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash-lite");
  const [apiKey, setApiKey] = useState("");
  const [pineconeApiKey, setPineconeApiKey] = useState("");
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Consultation Context
  const [consultationContext, setConsultationContext] = useState<ConsultationContextData | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isContextExpanded, setIsContextExpanded] = useState(false);

  useEffect(() => {
    const context = localStorage.getItem('consultationContext');
    if (context) {
      setConsultationContext(JSON.parse(context) as ConsultationContextData);
      // Auto expand when new context is loaded
      setIsContextExpanded(true);
    }
  }, []);

  // Export History
  const handleExportHistory = () => {
    if (messages.length === 0) return;
    
    const historyText = messages.map(msg => 
      `User: ${msg.user}\nBot: ${msg.bot}\n-------------------`
    ).join('\n\n');
    
    const blob = new Blob([historyText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Clear History
  const handleClearHistory = () => {
    setShowDeleteConfirm(true);
  };

  const confirmClearHistory = () => {
    setMessages([]);
    setShowDeleteConfirm(false);
  };

  async function handleSend(text?: string) {
    const question = text || input;
    if (!question.trim()) return;

    const recentConversationHistory = messages
      .filter((msg) => msg.user.trim() || msg.bot.trim())
      .slice(-10)
      .map((msg) => ({ user: msg.user, bot: msg.bot }));
    
    if (!text) setInput("");
    setLoading(true);
    
    // Add user message immediately
    setMessages(prev => [...prev, { user: question, bot: "" }]);

    try {
      const data = await apiRequest<{ answer?: string }>("/chat", {
        backendUrl: BACKEND_URL,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: question,
          temperature,
          max_tokens: maxTokens,
          model: selectedModel,
          api_key: apiKey,
          pinecone_api_key: pineconeApiKey,
          conversation_history: recentConversationHistory,
        }),
        fallbackError: "Không thể lấy phản hồi từ chatbot",
      });
      
      // Update the last message with bot response
      setMessages(prev => {
        const newMsgs = [...prev];
        const lastMsg = newMsgs[newMsgs.length - 1];
        if (lastMsg) {
          lastMsg.bot = maybeFormatChatbotAnswer(data.answer || "Hiện tại chúng tôi chưa thể trả lời câu hỏi của bạn");
        }
        return newMsgs;
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Lỗi kết nối server!";
      setMessages(prev => {
        const newMsgs = [...prev];
        const lastMsg = newMsgs[newMsgs.length - 1];
        if (lastMsg) {
          lastMsg.bot = errorMessage;
        }
        return newMsgs;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex gap-6">
      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`fixed top-32 z-50 transition-all duration-500 ease-out ${
          sidebarOpen ? 'left-80' : 'left-0'
        }`}
      >
        <div className={`
          flex items-center justify-center w-8 h-16
          bg-white/90 backdrop-blur-md shadow-[4px_0_24px_rgba(59,130,246,0.25)]
          border-y border-r border-blue-200
          rounded-r-2xl cursor-pointer
          group hover:w-10 hover:bg-blue-50 transition-all duration-300
        `}>
          <div className="relative w-5 h-5 text-blue-500 group-hover:text-blue-700 transition-colors duration-300">
            {sidebarOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        </div>
      </button>

      {/* Sidebar Config */}
      <aside className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-80 bg-white/95 backdrop-blur-xl shadow-2xl border-r border-blue-100/50 p-8 space-y-8 overflow-y-auto z-40 transition-all duration-500 ease-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 pb-3 border-b-2 border-blue-200">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11.03L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11.03L19.5,12L19.43,12.97L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.35 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z"/></svg>
            Cấu hình Chatbot
          </h3>
          
          <div className="space-y-6">
            {/* Model Selection */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              </select>
            </div>

            {/* API Key */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Gemini API Key (Optional)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Nhập API Key..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1.5">Để trống để dùng key trong backend/.env</p>
            </div>

            {/* Pinecone API Key */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Pinecone API Key (Optional)
              </label>
              <input
                type="password"
                value={pineconeApiKey}
                onChange={(e) => setPineconeApiKey(e.target.value)}
                placeholder="Nhập Pinecone API Key..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1.5">Bắt buộc cho RAG; để trống sẽ dùng backend/.env</p>
            </div>

            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Temperature
                </label>
                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {temperature.toFixed(1)}
                </span>
              </div>
              <div className="relative w-full h-6 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="absolute w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer z-20 opacity-0"
                />
                <div className="w-full h-2 bg-gray-200 rounded-lg overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                    style={{ width: `${temperature * 100}%` }}
                  ></div>
                </div>
                <div 
                  className="absolute h-5 w-5 bg-white border-2 border-blue-500 rounded-full shadow-md z-10 pointer-events-none transition-all duration-75"
                  style={{ left: `calc(${temperature * 100}% - 10px)` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Độ sáng tạo của câu trả lời</p>
            </div>

            {/* Max Tokens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Max Tokens
                </label>
                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {maxTokens}
                </span>
              </div>
              <div className="relative w-full h-6 flex items-center">
                <input
                  type="range"
                  min="128"
                  max="2048"
                  step="128"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="absolute w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer z-20 opacity-0"
                />
                <div className="w-full h-2 bg-gray-200 rounded-lg overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                    style={{ width: `${(maxTokens / 2048) * 100}%` }}
                  ></div>
                </div>
                <div 
                  className="absolute h-5 w-5 bg-white border-2 border-blue-500 rounded-full shadow-md z-10 pointer-events-none transition-all duration-75"
                  style={{ left: `calc(${(maxTokens / 2048) * 100}% - 10px)` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Độ dài tối đa của câu trả lời</p>
            </div>

            {/* History Actions */}
            <div className="pt-4 border-t border-blue-100 space-y-3">
              <button
                onClick={handleExportHistory}
                disabled={messages.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M14,2H6C4.89,2 4,2.89 4,4V20C4,21.11 4.89,22 6,22H18C19.11,22 20,21.11 20,20V8L14,2M18,20H6V4H13V9H18V20M16,11V18.1L13.9,16L11.1,18.8L8.3,16L6.2,18.1L11.1,23L16,18.1Z"/></svg>
                <span className="text-sm font-semibold">Xuất lịch sử chat</span>
              </button>
              
              <button
                onClick={handleClearHistory}
                disabled={messages.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
                <span className="text-sm font-semibold">Xoá lịch sử</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 top-16 bg-black/30 backdrop-blur-sm z-30 transition-all duration-500 animate-in fade-in"
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
              Xoá lịch sử chat?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Hành động này không thể hoàn tác. Toàn bộ cuộc trò chuyện hiện tại sẽ bị xoá vĩnh viễn.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Huỷ bỏ
              </button>
              <button
                onClick={confirmClearHistory}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
              >
                Xoá ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-500 relative z-40 ${
        sidebarOpen ? 'ml-80' : 'ml-0'
      }`}>
        <div className="bg-gradient-to-br from-white via-blue-50/30 to-white rounded-3xl shadow-2xl border border-blue-100/50 p-6 h-[calc(100vh-5rem)] flex flex-col backdrop-blur-sm">
          {/* Header with gradient */}
          <div className="mb-4 pb-4 border-b-2 border-gradient-to-r from-blue-200 via-blue-300 to-blue-200">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent flex items-center gap-3">
              <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-xl">
                <div className="absolute inset-0 bg-white/20 rounded-xl animate-pulse"></div>
                <svg className="w-6 h-6 text-white relative z-10" fill="currentColor" viewBox="0 0 24 24"><path d="M17.5 14.33C18.29 14.33 19.13 14.41 20 14.57V16.07C19.38 15.91 18.54 15.83 17.5 15.83C15.6 15.83 14.11 16.16 13 16.82V15.13C14.17 14.6 15.67 14.33 17.5 14.33M13 12.46C14.29 11.93 15.79 11.67 17.5 11.67C18.29 11.67 19.13 11.74 20 11.9V13.4C19.38 13.24 18.54 13.16 17.5 13.16C15.6 13.16 14.11 13.5 13 14.15M17.5 10.5C15.6 10.5 14.11 10.82 13 11.5V9.84C14.23 9.28 15.73 9 17.5 9C18.29 9 19.13 9.08 20 9.23V10.78C19.26 10.59 18.41 10.5 17.5 10.5M21 18.5V7C19.96 6.67 18.79 6.5 17.5 6.5C15.45 6.5 13.62 7 12 8V19.5C13.62 18.5 15.45 18 17.5 18C18.69 18 19.86 18.16 21 18.5M17.5 4.5C19.85 4.5 21.69 5 23 6V20.56C23 20.68 22.95 20.8 22.84 20.91C22.73 21 22.61 21.08 22.5 21.08C22.39 21.08 22.31 21.06 22.25 21.03C20.97 20.34 19.38 20 17.5 20C15.45 20 13.62 20.5 12 21.5C10.66 20.5 8.83 20 6.5 20C4.84 20 3.25 20.36 1.75 21.07C1.72 21.08 1.68 21.08 1.63 21.1C1.59 21.11 1.55 21.12 1.5 21.12C1.39 21.12 1.27 21.08 1.16 21C1.05 20.89 1 20.78 1 20.65V6C2.34 5 4.18 4.5 6.5 4.5C8.83 4.5 10.66 5 12 6C13.34 5 15.17 4.5 17.5 4.5Z"/></svg>
              </div>
              <div>
                <div className="text-4xl font-bold tracking-tight">Chatbot tư vấn bệnh lý phổi</div>
                <p className="text-xs text-gray-600 font-medium mt-0.5">💬 Hỏi đáp về các vấn đề liên quan đến phổi</p>
              </div>
            </h1>
          </div>
          
          {/* Floating Consultation Context */}
          {consultationContext && (
            <div className={`absolute top-24 right-6 z-30 transition-all duration-300 ease-in-out ${
              isContextExpanded ? 'w-[600px]' : 'w-auto'
            }`}>
              {isContextExpanded ? (
                <div className="bg-white border border-blue-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-white p-3 border-b border-blue-100 flex items-center justify-between cursor-pointer" onClick={() => setIsContextExpanded(false)}>
                    <h3 className="font-bold text-blue-800 flex items-center gap-2 text-sm">
                      <div className="p-1 bg-blue-100 rounded-lg">
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.89 20.1 3 19 3M19 19H5V5H19V19M10 17H8L13 9V13H15L10 21V17Z"/></svg>
                      </div>
                      Hồ sơ chẩn đoán
                    </h3>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsContextExpanded(false);
                        }}
                        className="p-1.5 hover:bg-blue-50 text-blue-400 hover:text-blue-600 rounded-lg transition-colors"
                        title="Thu nhỏ"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setConsultationContext(null);
                          localStorage.removeItem('consultationContext');
                        }}
                        className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                        title="Đóng hồ sơ"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-4 grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
                    {/* Images Section */}
                    <div className="col-span-2 flex gap-4">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Ảnh gốc
                        </p>
                        <div 
                          className="relative group cursor-zoom-in overflow-hidden rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all"
                          onClick={() => setSelectedImage(consultationContext.originalImage)}
                        >
                          <img src={consultationContext.originalImage} className="w-full h-32 object-cover transition-transform duration-500 group-hover:scale-110" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Phát hiện
                        </p>
                        <div 
                          className="relative group cursor-zoom-in overflow-hidden rounded-lg border border-blue-200 shadow-sm hover:shadow-md transition-all"
                          onClick={() => setSelectedImage(consultationContext.detectedImage)}
                        >
                          <img src={consultationContext.detectedImage} className="w-full h-32 object-cover transition-transform duration-500 group-hover:scale-110" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Result Section */}
                    <div className="col-span-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Chi tiết chẩn đoán
                      </p>
                      <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 shadow-inner">
                        {consultationContext.detections && consultationContext.detections.length > 0 ? (
                          <div className="space-y-2">
                            {consultationContext.detections.map((det: ConsultationDetection, idx: number) => (
                              <div key={idx} className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
                                <span className="font-bold text-gray-800 text-sm">{det.class}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${
                                        det.confidence > 0.8 ? 'bg-red-500' : 
                                        det.confidence > 0.5 ? 'bg-orange-500' : 'bg-yellow-500'
                                      }`}
                                      style={{ width: `${det.confidence * 100}%` }}
                                    ></div>
                                  </div>
                                  <span className={`text-xs font-bold ${
                                    det.confidence > 0.8 ? 'text-red-600' : 
                                    det.confidence > 0.5 ? 'text-orange-600' : 'text-yellow-600'
                                  }`}>
                                    {(det.confidence * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="prose prose-sm max-w-none text-gray-700 text-xs">
                            <div className="whitespace-pre-wrap font-mono leading-relaxed">
                              {consultationContext.diagnosisResult}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsContextExpanded(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all transform hover:scale-105 animate-in fade-in slide-in-from-right-4"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.89 20.1 3 19 3M19 19H5V5H19V19M10 17H8L13 9V13H15L10 21V17Z"/></svg>
                  <span>Hồ sơ chẩn đoán</span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                </button>
              )}
            </div>
          )}
          
          {/* Messages Area - Scrollable */}
          <div className="flex-1 overflow-y-auto mb-6 space-y-5 px-2 py-2">
            {messages.length === 0 && !consultationContext && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50 rounded-3xl p-12 text-center shadow-lg border border-blue-100">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-xl transform hover:scale-110 transition-transform duration-300">
                    <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.5 14.33C18.29 14.33 19.13 14.41 20 14.57V16.07C19.38 15.91 18.54 15.83 17.5 15.83C15.6 15.83 14.11 16.16 13 16.82V15.13C14.17 14.6 15.67 14.33 17.5 14.33M13 12.46C14.29 11.93 15.79 11.67 17.5 11.67C18.29 11.67 19.13 11.74 20 11.9V13.4C19.38 13.24 18.54 13.16 17.5 13.16C15.6 13.16 14.11 13.5 13 14.15M17.5 10.5C15.6 10.5 14.11 10.82 13 11.5V9.84C14.23 9.28 15.73 9 17.5 9C18.29 9 19.13 9.08 20 9.23V10.78C19.26 10.59 18.41 10.5 17.5 10.5M21 18.5V7C19.96 6.67 18.79 6.5 17.5 6.5C15.45 6.5 13.62 7 12 8V19.5C13.62 18.5 15.45 18 17.5 18C18.69 18 19.86 18.16 21 18.5M17.5 4.5C19.85 4.5 21.69 5 23 6V20.56C23 20.68 22.95 20.8 22.84 20.91C22.73 21 22.61 21.08 22.5 21.08C22.39 21.08 22.31 21.06 22.25 21.03C20.97 20.34 19.38 20 17.5 20C15.45 20 13.62 20.5 12 21.5C10.66 20.5 8.83 20 6.5 20C4.84 20 3.25 20.36 1.75 21.07C1.72 21.08 1.68 21.08 1.63 21.1C1.59 21.11 1.55 21.12 1.5 21.12C1.39 21.12 1.27 21.08 1.16 21C1.05 20.89 1 20.78 1 20.65V6C2.34 5 4.18 4.5 6.5 4.5C8.83 4.5 10.66 5 12 6C13.34 5 15.17 4.5 17.5 4.5Z"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Xin chào! 👋</h3>
                  <p className="text-gray-600 mb-4 max-w-md mx-auto leading-relaxed text-sm">Tôi là trợ lý AI chuyên về bệnh lý phổi. Hãy đặt câu hỏi để được tư vấn.</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-2xl mx-auto">
                    <div 
                      onClick={() => handleSend("Tràn dịch màng phổi là gì?")}
                      className="bg-white rounded-xl px-4 py-2 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border border-blue-200 hover:border-blue-400 hover:scale-105 group"
                    >
                      <p className="text-xs text-gray-700 group-hover:text-blue-600 font-medium">💡 Tràn dịch màng phổi là gì?</p>
                    </div>
                    <div 
                      onClick={() => handleSend("Cách phòng ngừa tràn dịch màng phổi?")}
                      className="bg-white rounded-xl px-4 py-2 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border border-blue-200 hover:border-blue-400 hover:scale-105 group"
                    >
                      <p className="text-xs text-gray-700 group-hover:text-blue-600 font-medium">💡 Cách phòng ngừa tràn dịch màng phổi?</p>
                    </div>
                    <div 
                      onClick={() => handleSend("Triệu chứng của tràn dịch màng phổi?")}
                      className="bg-white rounded-xl px-4 py-2 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border border-blue-200 hover:border-blue-400 hover:scale-105 group"
                    >
                      <p className="text-xs text-gray-700 group-hover:text-blue-600 font-medium">💡 Triệu chứng của tràn dịch màng phổi?</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* User Message */}
                <div className="flex justify-end items-end gap-3">
                  <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white px-6 py-4 rounded-3xl rounded-br-md max-w-[75%] shadow-xl hover:shadow-2xl transition-shadow duration-300">
                    <p className="leading-relaxed">{msg.user}</p>
                  </div>
                  <div className="w-9 h-9 bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg border-2 border-white">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12C14.21 12 16 10.21 16 8S14.21 4 12 4 8 5.79 8 8 9.79 12 12 12M12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z"/></svg>
                  </div>
                </div>
                {/* Bot Message */}
                {msg.bot && (
                <div className="flex justify-start items-end gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg border-2 border-white">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.5 14.33C18.29 14.33 19.13 14.41 20 14.57V16.07C19.38 15.91 18.54 15.83 17.5 15.83C15.6 15.83 14.11 16.16 13 16.82V15.13C14.17 14.6 15.67 14.33 17.5 14.33M13 12.46C14.29 11.93 15.79 11.67 17.5 11.67C18.29 11.67 19.13 11.74 20 11.9V13.4C19.38 13.24 18.54 13.16 17.5 13.16C15.6 13.16 14.11 13.5 13 14.15M17.5 10.5C15.6 10.5 14.11 10.82 13 11.5V9.84C14.23 9.28 15.73 9 17.5 9C18.29 9 19.13 9.08 20 9.23V10.78C19.26 10.59 18.41 10.5 17.5 10.5M21 18.5V7C19.96 6.67 18.79 6.5 17.5 6.5C15.45 6.5 13.62 7 12 8V19.5C13.62 18.5 15.45 18 17.5 18C18.69 18 19.86 18.16 21 18.5M17.5 4.5C19.85 4.5 21.69 5 23 6V20.56C23 20.68 22.95 20.8 22.84 20.91C22.73 21 22.61 21.08 22.5 21.08C22.39 21.08 22.31 21.06 22.25 21.03C20.97 20.34 19.38 20 17.5 20C15.45 20 13.62 20.5 12 21.5C10.66 20.5 8.83 20 6.5 20C4.84 20 3.25 20.36 1.75 21.07C1.72 21.08 1.68 21.08 1.63 21.1C1.59 21.11 1.55 21.12 1.5 21.12C1.39 21.12 1.27 21.08 1.16 21C1.05 20.89 1 20.78 1 20.65V6C2.34 5 4.18 4.5 6.5 4.5C8.83 4.5 10.66 5 12 6C13.34 5 15.17 4.5 17.5 4.5Z"/></svg>
                  </div>
                  <div className="bg-gradient-to-br from-white to-blue-50/30 text-gray-800 px-6 py-4 rounded-3xl rounded-bl-md max-w-[75%] shadow-xl hover:shadow-2xl transition-shadow duration-300 border-2 border-blue-100">
                    <div className="prose prose-blue max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-a:text-blue-600">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.bot}</ReactMarkdown>
                    </div>
                  </div>
                </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start items-end gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg border-2 border-white">
                  <svg className="w-5 h-5 text-white animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M17.5 14.33C18.29 14.33 19.13 14.41 20 14.57V16.07C19.38 15.91 18.54 15.83 17.5 15.83C15.6 15.83 14.11 16.16 13 16.82V15.13C14.17 14.6 15.67 14.33 17.5 14.33M13 12.46C14.29 11.93 15.79 11.67 17.5 11.67C18.29 11.67 19.13 11.74 20 11.9V13.4C19.38 13.24 18.54 13.16 17.5 13.16C15.6 13.16 14.11 13.5 13 14.15M17.5 10.5C15.6 10.5 14.11 10.82 13 11.5V9.84C14.23 9.28 15.73 9 17.5 9C18.29 9 19.13 9.08 20 9.23V10.78C19.26 10.59 18.41 10.5 17.5 10.5M21 18.5V7C19.96 6.67 18.79 6.5 17.5 6.5C15.45 6.5 13.62 7 12 8V19.5C13.62 18.5 15.45 18 17.5 18C18.69 18 19.86 18.16 21 18.5M17.5 4.5C19.85 4.5 21.69 5 23 6V20.56C23 20.68 22.95 20.8 22.84 20.91C22.73 21 22.61 21.08 22.5 21.08C22.39 21.08 22.31 21.06 22.25 21.03C20.97 20.34 19.38 20 17.5 20C15.45 20 13.62 20.5 12 21.5C10.66 20.5 8.83 20 6.5 20C4.84 20 3.25 20.36 1.75 21.07C1.72 21.08 1.68 21.08 1.63 21.1C1.59 21.11 1.55 21.12 1.5 21.12C1.39 21.12 1.27 21.08 1.16 21C1.05 20.89 1 20.78 1 20.65V6C2.34 5 4.18 4.5 6.5 4.5C8.83 4.5 10.66 5 12 6C13.34 5 15.17 4.5 17.5 4.5Z"/></svg>
                </div>
                <div className="bg-gradient-to-br from-white to-blue-50/30 text-gray-600 px-6 py-4 rounded-3xl rounded-bl-md shadow-xl border-2 border-blue-100 flex items-center gap-4">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full animate-bounce shadow-sm" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2.5 h-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full animate-bounce shadow-sm" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2.5 h-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full animate-bounce shadow-sm" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm font-medium">Đang suy nghĩ...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area - Fixed at Bottom */}
          <div className="flex gap-4 pt-6 border-t-2 border-gradient-to-r from-transparent via-blue-200 to-transparent">
            <div className="flex-1 relative group">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="💬 Nhập câu hỏi của bạn..."
                className="w-full px-6 py-4 pr-14 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-md focus:shadow-xl bg-white group-hover:border-blue-300"
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2M20 16H6L4 18V4H20V16Z"/></svg>
              </div>
            </div>
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="px-10 py-4 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 text-white font-bold rounded-2xl hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3 hover:scale-105 active:scale-95 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              <svg className="w-6 h-6 relative z-10" fill="currentColor" viewBox="0 0 24 24"><path d="M2 21L23 12L2 3V10L17 12L2 14V21Z"/></svg>
              <span className="relative z-10">Gửi</span>
            </button>
          </div>
        </div>
      </div>
      {/* Image Zoom Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm transition-all duration-300"
          onClick={() => setSelectedImage(null)}
        >
          {/* Toolbar */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
            <a 
              href={selectedImage} 
              download={`xray-image-${Date.now()}.png`}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              onClick={(e) => e.stopPropagation()}
              title="Tải ảnh xuống"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </a>
            <button 
              className="p-2 bg-white/10 hover:bg-red-500/80 text-white rounded-full transition-colors"
              onClick={() => setSelectedImage(null)}
              title="Đóng"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div 
            className="relative max-w-[95vw] max-h-[95vh] overflow-hidden rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={selectedImage} 
              className="max-w-full max-h-[90vh] object-contain" 
              alt="Zoomed view" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
