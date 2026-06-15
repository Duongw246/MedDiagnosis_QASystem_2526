import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NavTabs } from './components/NavTabs';
import { Disclaimer } from './components/Disclaimer';
import Link from 'next/link';
import { UploadProvider } from '@/context/UploadContext';
import { ValCompareProvider } from '@/context/ValCompareContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'XRAYAPP - Hệ thống hỗ trợ chẩn đoán bệnh lý phổi',
  description: 'Web hỗ trợ chẩn đoán bệnh lý phổi từ ảnh X-quang ngực',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={inter.className + ' bg-slate-50 min-h-screen'}>
        <nav className="sticky top-0 z-50 bg-gradient-to-r from-teal-100/90 to-cyan-100/90 backdrop-blur-md border-b border-teal-300 shadow-md transition-all duration-300">
          <div className="max-w-[98%] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-20">
              {/* Logo and Brand */}
              <Link href="/" className="flex items-center group">
                <div className="flex-shrink-0 flex items-center gap-4 cursor-pointer">
                  <div className="relative w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 group-hover:shadow-blue-300 transition-all duration-300 group-hover:scale-105">
                    <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7.5 4C5.5 4 4 5.5 4 7.5C4 13 8 17 12 21C16 17 20 13 20 7.5C20 5.5 18.5 4 16.5 4C14.5 4 13 5.5 12 7.5C11 5.5 9.5 4 7.5 4ZM7.5 6C8.5 6 9.5 6.5 10 7.5C10.5 6.5 11.5 6 12.5 6C14.5 6 16 7.5 16 9.5C16 13 13 16 12 18.5C11 16 8 13 8 9.5C8 7.5 9.5 6 7.5 6Z" opacity="0.3"/>
                      <path d="M12 2C7.03 2 3 6.03 3 11C3 16.55 7.03 21 12 21C16.97 21 21 16.55 21 11C21 6.03 16.97 2 12 2M8 18C6.9 18 6 17.1 6 16C6 14.9 6.9 14 8 14C9.1 14 10 14.9 10 16C10 17.1 9.1 18 8 18M16 18C14.9 18 14 17.1 14 16C14 14.9 14.9 14 16 14C17.1 14 18 14.9 18 16C18 17.1 17.1 18 16 18" fill="currentColor"/>
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">XRAYAPP</h1>
                    <p className="text-[10px] text-gray-500 font-medium tracking-wide uppercase max-w-[200px] leading-tight">Hệ thống hỗ trợ chẩn đoán bệnh lý phổi từ ảnh X-quang ngực</p>
                  </div>
                </div>
              </Link>
              
              {/* Navigation Links */}
              <div className="flex items-center">
                <NavTabs />
              </div>
            </div>
          </div>
        </nav>
        <UploadProvider>
          <ValCompareProvider>
            <main className="max-w-[98%] mx-auto px-6 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {children}
            </main>
          </ValCompareProvider>
        </UploadProvider>
        <footer className="mt-auto py-8 bg-gradient-to-r from-teal-100 to-cyan-100 border-t border-teal-300">
          <div className="max-w-[98%] mx-auto px-6 text-center">
            <p className="text-sm text-gray-600 font-medium">© 2025 XRAYAPP - Hệ thống hỗ trợ chẩn đoán bệnh lý phổi từ ảnh X-quang ngực</p>
          </div>
        </footer>

        {/* Fixed Corner Disclaimer */}
        <Disclaimer />
      </body>
    </html>
  );
}
