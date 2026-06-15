import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7.5 4C5.5 4 4 5.5 4 7.5C4 13 8 17 12 21C16 17 20 13 20 7.5C20 5.5 18.5 4 16.5 4C14.5 4 13 5.5 12 7.5C11 5.5 9.5 4 7.5 4ZM7.5 6C8.5 6 9.5 6.5 10 7.5C10.5 6.5 11.5 6 12.5 6C14.5 6 16 7.5 16 9.5C16 13 13 16 12 18.5C11 16 8 13 8 9.5C8 7.5 9.5 6 7.5 6Z" opacity="0.3"/>
            <path d="M12 2C7.03 2 3 6.03 3 11C3 16.55 7.03 21 12 21C16.97 21 21 16.55 21 11C21 6.03 16.97 2 12 2M8 18C6.9 18 6 17.1 6 16C6 14.9 6.9 14 8 14C9.1 14 10 14.9 10 16C10 17.1 9.1 18 8 18M16 18C14.9 18 14 17.1 14 16C14 14.9 14.9 14 16 14C17.1 14 18 14.9 18 16C18 17.1 17.1 18 16 18" fill="currentColor"/>
          </svg>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">XRAYAPP</h1>
          <p className="text-slate-500 font-medium mt-1">Hệ thống hỗ trợ chẩn đoán bệnh lý phổi từ ảnh X-quang ngực</p>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Chẩn đoán (Upload) - RED */}
        <Link href="/upload" className="group block p-6 rounded-2xl bg-red-50 border border-red-100 shadow-sm hover:shadow-xl hover:border-red-300 hover:bg-red-100 transition-all duration-300">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 rounded-xl bg-red-100 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors duration-300">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-800 group-hover:text-red-700 transition-colors">Chẩn đoán</span>
          </div>
          <p className="text-slate-600 pl-[3.25rem]">Tải ảnh X-quang lên để hệ thống AI phân tích và phát hiện bệnh lý.</p>
        </Link>

        {/* Card 2: Tư vấn AI (Chatbot) - BLUE */}
        <Link href="/chatbot" className="group block p-6 rounded-2xl bg-blue-50 border border-blue-100 shadow-sm hover:shadow-xl hover:border-blue-300 hover:bg-blue-100 transition-all duration-300">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 rounded-xl bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-800 group-hover:text-blue-700 transition-colors">Tư vấn AI</span>
          </div>
          <p className="text-slate-600 pl-[3.25rem]">Trò chuyện với trợ lý ảo chuyên gia để tìm hiểu thêm về các bệnh lý.</p>
        </Link>

        {/* Card 3: Lịch sử - GREEN */}
        <Link href="/history" className="group block p-6 rounded-2xl bg-green-50 border border-green-100 shadow-sm hover:shadow-xl hover:border-green-300 hover:bg-green-100 transition-all duration-300">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 rounded-xl bg-green-100 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors duration-300">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-800 group-hover:text-green-700 transition-colors">Lịch sử</span>
          </div>
          <p className="text-slate-600 pl-[3.25rem]">Xem lại danh sách các ảnh đã tải lên và kết quả chẩn đoán trước đó.</p>
        </Link>

        {/* Card 4: Hướng dẫn - ORANGE */}
        <Link href="/guide" className="group block p-6 rounded-2xl bg-orange-50 border border-orange-100 shadow-sm hover:shadow-xl hover:border-orange-300 hover:bg-orange-100 transition-all duration-300">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 rounded-xl bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors duration-300">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-800 group-hover:text-orange-700 transition-colors">Hướng dẫn</span>
          </div>
          <p className="text-slate-600 pl-[3.25rem]">Tìm hiểu cách sử dụng hệ thống và các lưu ý quan trọng.</p>
        </Link>
      </div>
    </div>
  );
}