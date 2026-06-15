"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavTabs() {
  const pathname = usePathname();
  
  const tabs = [
    { 
      href: '/upload', 
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      text: 'Chẩn đoán' 
    },
    {
      href: '/val-compare',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5h-1a2 2 0 00-2 2v1m0 0H7a2 2 0 00-2 2v1m3-3h8m0 0h1a2 2 0 012 2v1m-3-3v8m0 0v1a2 2 0 01-2 2h-1m3-3h-8m0 0H7a2 2 0 01-2-2v-1m3 3V8" /></svg>,
      text: 'Đối chiếu Val'
    },
    { 
      href: '/chatbot', 
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
      text: 'Tư vấn AI' 
    },
    { 
      href: '/history', 
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      text: 'Lịch sử' 
    },
    { 
      href: '/guide', 
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
      text: 'Hướng dẫn' 
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`
              relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 group overflow-hidden
              ${isActive 
                ? 'text-blue-600 bg-blue-50 shadow-sm ring-1 ring-blue-100' 
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }
            `}
          >
            {/* Active Indicator Background */}
            {isActive && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-white opacity-50" />
            )}
            
            {/* Hover Effect Background */}
            <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Content */}
            <span className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
              {tab.icon}
            </span>
            <span className="relative z-10">{tab.text}</span>
            
            {/* Bottom Active Line */}
            {isActive && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-full" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
