"use client";
import { useState } from 'react';

export function Disclaimer() {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out ${isExpanded ? 'max-w-sm' : 'max-w-[50px]'}`}>
      <div className={`bg-white/90 backdrop-blur-md border border-yellow-200 shadow-2xl rounded-xl overflow-hidden transition-all duration-300 ${isExpanded ? 'p-4' : 'p-2'}`}>
        <div className="flex items-start gap-3">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 bg-yellow-100 rounded-full shrink-0 hover:bg-yellow-200 transition-colors cursor-pointer group relative"
            title={isExpanded ? "Thu gọn" : "Mở rộng khuyến cáo"}
          >
            <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {!isExpanded && (
              <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                Xem khuyến cáo
              </span>
            )}
          </button>
          
          <div className={`transition-all duration-300 origin-left ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>
            <div className="flex justify-between items-start">
              <p className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-1">Khuyến cáo</p>
              <button 
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1 p-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed min-w-[200px]">
              Kết quả chẩn đoán do AI thực hiện chỉ mang tính chất tham khảo. Vui lòng tham khảo ý kiến của bác sĩ chuyên khoa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
