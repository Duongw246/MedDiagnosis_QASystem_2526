"use client";
import { useState, useEffect, useCallback } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { apiRequest, approveHistoryItem } from "@/lib/api";

type ImageStatus = 'approved' | 'pending';
type FilterType = 'all' | 'disease' | 'normal';

interface Detection {
  class: string;
  confidence: number;
}

interface HistoryItem {
  id: string;
  date: string;
  filename: string;
  result: string;
  detections: Detection[];
  original_image: string | null;
  detected_image: string | null;
  status: ImageStatus;
}

export default function HistoryPage() {
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const [activeTab, setActiveTab] = useState<ImageStatus>('pending');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showOriginalImage, setShowOriginalImage] = useState<Set<string>>(new Set());
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomTitle, setZoomTitle] = useState<string>('');
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'all' | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Load data from API
  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiRequest<HistoryItem[]>("/history", {
        backendUrl: BACKEND_URL,
        cache: "no-store",
        fallbackError: "Không thể tải lịch sử",
      });
      setHistoryData(data);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  }, [BACKEND_URL]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Filter data
  const getFilteredData = () => {
    let filtered = historyData.filter(item => item.status === activeTab);
    
    if (filterType === 'disease') {
      filtered = filtered.filter(item => item.detections.length > 0);
    } else if (filterType === 'normal') {
      filtered = filtered.filter(item => item.detections.length === 0);
    }
    
    return filtered;
  };

  const filteredData = getFilteredData();

  // Approve item
  const approveItem = async (id: string) => {
    try {
      await approveHistoryItem(id, BACKEND_URL);
      setHistoryData(prev => prev.map(item => item.id === id ? { ...item, status: 'approved' } : item));
      fetchHistory();
    } catch (error) {
      console.error("Error approving item:", error);
    }
  };

  // Delete item
  const deleteItem = (id: string) => {
    setDeleteTarget('single');
    setDeleteItemId(id);
    setDeleteModalOpen(true);
  };

  // Delete all in current tab
  const deleteAllInTab = () => {
    if (filteredData.length === 0) return;
    setDeleteTarget('all');
    setDeleteModalOpen(true);
  };

  // Confirm Delete Action
  const confirmDelete = async () => {
    try {
      if (deleteTarget === 'single' && deleteItemId) {
        await fetch(`${BACKEND_URL}/history/${deleteItemId}`, {
          method: 'DELETE'
        });
      } else if (deleteTarget === 'all') {
        await fetch(`${BACKEND_URL}/history?status=${activeTab}`, {
          method: 'DELETE'
        });
      }
      fetchHistory(); // Refresh data
    } catch (error) {
      console.error("Error deleting item:", error);
    }
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    setDeleteItemId(null);
  };

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
        setShowOriginalImage(prevShow => {
          const newShowSet = new Set(prevShow);
          newShowSet.delete(id);
          return newShowSet;
        });
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Toggle original image
  const toggleOriginalImage = (id: string) => {
    setShowOriginalImage(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const convertImageUrlToDataUrl = async (imageUrl: string | null): Promise<string | null> => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("data:")) return imageUrl;

    try {
      const res = await fetch(imageUrl, { mode: "cors", cache: "no-store" });
      if (!res.ok) return null;
      const blob = await res.blob();

      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Cannot convert image blob to data URL"));
          }
        };
        reader.onerror = () => reject(new Error("Cannot read image blob"));
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // Generate PDF for individual item
  const generatePDF = async (item: HistoryItem) => {
    const [originalImageForPdf, detectedImageForPdf] = await Promise.all([
      convertImageUrlToDataUrl(item.original_image),
      convertImageUrlToDataUrl(item.detected_image),
    ]);

    const reportDiv = document.createElement('div');
    reportDiv.style.position = 'absolute';
    reportDiv.style.left = '-9999px';
    reportDiv.style.top = '0';
    reportDiv.style.width = '210mm';
    reportDiv.style.minHeight = '297mm';
    reportDiv.style.padding = '20mm';
    reportDiv.style.backgroundColor = '#ffffff';
    reportDiv.style.color = '#000000';
    reportDiv.style.fontFamily = 'Arial, sans-serif';
    reportDiv.style.boxSizing = 'border-box';
    reportDiv.style.borderColor = '#e5e7eb';

    const now = new Date();

    reportDiv.innerHTML = `
      <style>
        * { color: inherit !important; background-color: inherit !important; border-color: inherit !important; }
      </style>
      <div style="text-align: center; background: #ef4444; color: #ffffff; padding: 30px; margin: -20px -20px 30px -20px;">
        <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff;">BÁO CÁO KẾT QUẢ PHÁT HIỆN BỆNH</h1>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #ffffff;">Phân tích X-quang phổi bằng AI</p>
      </div>

      <div style="margin-bottom: 15px; padding: 12px; background: #f9fafb; border-radius: 8px;">
        <p style="margin: 3px 0; color: #374151; font-size: 11px;"><strong>Ngày tạo:</strong> ${item.date}</p>
        <p style="margin: 3px 0; color: #374151; font-size: 11px;"><strong>Tên tệp:</strong> ${item.filename}</p>
        <p style="margin: 3px 0; color: #374151; font-size: 11px;"><strong>Model:</strong> YOLOv12s Small</p>
        <p style="margin: 3px 0; color: #374151; font-size: 11px;"><strong>Trạng thái:</strong> ${item.status === 'approved' ? 'Đã duyệt' : 'Chưa duyệt'}</p>
      </div>

      <div style="margin-bottom: 15px;">
        <h2 style="color: #3b82f6; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 8px;">KẾT QUẢ TỔNG QUAN</h2>
        <p style="margin: 5px 0; color: #374151; font-size: 11px;"><strong>Tổng số vùng phát hiện:</strong> ${item.detections.length}</p>
        <p style="margin: 5px 0; color: #374151; font-size: 11px;">${item.result || 'Không có kết quả'}</p>
      </div>

      ${originalImageForPdf || detectedImageForPdf ? `
      <div style="margin-bottom: 20px; page-break-inside: avoid;">
        <h2 style="color: #3b82f6; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 12px;">ẢNH X-QUANG</h2>
        <div style="display: flex; gap: 15px; justify-content: center; align-items: flex-start; flex-wrap: wrap;">
          ${originalImageForPdf ? `
          <div style="flex: 1; min-width: 250px; max-width: 400px; text-align: center;">
            <p style="font-weight: bold; color: #374151; font-size: 12px; margin-bottom: 8px;">Ảnh gốc</p>
            <img src="${originalImageForPdf}" style="width: 100%; height: auto; max-height: 350px; object-fit: contain; border: 2px solid #e5e7eb; border-radius: 8px;" />
          </div>
          ` : ''}
          ${detectedImageForPdf ? `
          <div style="flex: 1; min-width: 250px; max-width: 400px; text-align: center;">
            <p style="font-weight: bold; color: #374151; font-size: 12px; margin-bottom: 8px;">Kết quả phát hiện</p>
            <img src="${detectedImageForPdf}" style="width: 100%; height: auto; max-height: 350px; object-fit: contain; border: 2px solid #e5e7eb; border-radius: 8px;" />
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${item.detections.length > 0 ? `
      <div style="margin-bottom: 15px; page-break-before: auto; page-break-inside: avoid;">
        <h2 style="color: #3b82f6; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 8px;">CHI TIẾT CÁC VÙNG PHÁT HIỆN</h2>
        ${item.detections.map((detection, index) => {
          const confidencePercent = (detection.confidence * 100).toFixed(1);
          const barColor = detection.confidence >= 0.8 ? '#22c55e' : detection.confidence >= 0.5 ? '#eab308' : '#ef4444';
          const barWidth = detection.confidence * 100;

          return `
            <div style="margin: 10px 0; padding: 10px; background: #f9fafb; border-left: 4px solid ${barColor}; border-radius: 4px;">
              <p style="margin: 0 0 6px 0; font-weight: bold; color: #1f2937; font-size: 13px;">${index + 1}. ${detection.class}</p>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #6b7280; font-size: 11px;">Độ tin cậy: ${confidencePercent}%</span>
                <div style="flex: 1; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
                  <div style="width: ${barWidth}%; height: 100%; background: ${barColor};"></div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      ` : ''}

      <div style="margin-bottom: 15px; page-break-before: auto;">
        <h2 style="color: #9333ea; font-size: 16px; border-bottom: 2px solid #9333ea; padding-bottom: 5px; margin-bottom: 8px;">GIẢI THÍCH VỀ ĐỘ TIN CẬY</h2>
        <div style="margin-top: 10px; color: #374151; line-height: 1.6; font-size: 11px;">
          <p style="margin: 5px 0;">Độ tin cậy (Confidence Score) là chỉ số đánh giá mức độ chắc chắn của AI khi phát hiện vùng bất thường trên ảnh X-quang. Giá trị từ 0% đến 100%:</p>
          <ul style="margin: 8px 0; padding-left: 20px;">
            <li style="margin: 3px 0;"><strong style="color: #22c55e;">80-100% (Cao):</strong> AI rất chắc chắn về kết quả phát hiện</li>
            <li style="margin: 3px 0;"><strong style="color: #eab308;">50-79% (Trung bình):</strong> AI tương đối chắc chắn, cần xác nhận thêm</li>
            <li style="margin: 3px 0;"><strong style="color: #ef4444;">Dưới 50% (Thấp):</strong> AI không chắc chắn, cần kiểm tra kỹ hơn</li>
          </ul>
          <p style="margin: 5px 0;"><em>Lưu ý: Độ tin cậy cao không đồng nghĩa với chẩn đoán chính xác 100%.</em></p>
        </div>
      </div>

      <div style="background: #fef3c7; border: 2px solid #fbbf24; border-radius: 8px; padding: 15px; margin-top: 20px; page-break-inside: avoid;">
        <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 14px;">⚠️ LƯU Ý QUAN TRỌNG</h3>
        <p style="color: #92400e; margin: 3px 0; line-height: 1.5; font-size: 10px;">
          Kết quả này được tạo bởi hệ thống AI và chỉ mang tính chất tham khảo.
        </p>
        <p style="color: #92400e; margin: 3px 0; line-height: 1.5; font-size: 10px;">
          Đây <strong>KHÔNG</strong> phải là chẩn đoán y khoa chính thức. Vui lòng tham khảo ý kiến của bác sĩ chuyên khoa để có chẩn đoán và điều trị chính xác.
        </p>
      </div>

      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 10px;">
        <p>Hệ thống phát hiện bệnh từ ảnh X-quang - Powered by YOLOv12s</p>
      </div>
    `;

    document.body.appendChild(reportDiv);

    try {
      const canvas = await html2canvas(reportDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: reportDiv.scrollWidth,
        height: reportDiv.scrollHeight
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      const totalPages = Math.ceil(imgHeight / pdfHeight);

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();
        const startY = -(pdfHeight * i);
        pdf.addImage(imgData, 'JPEG', 0, startY, imgWidth, imgHeight, undefined, 'FAST');
      }

      const fileName = `Bao_cao_${item.filename.replace(/\.[^/.]+$/, '')}_${now.getTime()}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Có lỗi khi tạo PDF. Vui lòng thử lại!');
    } finally {
      document.body.removeChild(reportDiv);
    }
  };


  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13.5 8H12V13L16.28 15.54L17 14.33L13.5 12.25V8M13 3C8.03 3 4 7.03 4 12H1L4.96 16.03L9 12H6C6 8.13 9.13 5 13 5C16.87 5 20 8.13 20 12C20 15.87 16.87 19 13 19C11.07 19 9.32 18.21 8.06 16.94L6.64 18.36C8.27 20 10.5 21 13 21C17.97 21 22 16.97 22 12C22 7.03 17.97 3 13 3Z"/>
              </svg>
              Lịch sử phân tích
            </h1>
            <p className="text-sm text-gray-500 mt-1">Quản lý và xem lại các kết quả phân tích</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
              Tổng: <span className="font-bold text-green-600">{historyData.length}</span> kết quả
            </div>
            {filteredData.length > 0 && (
              <button
                onClick={deleteAllInTab}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg transition-all border border-red-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                </svg>
                Xóa tất cả
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 font-bold text-xl rounded-t-lg transition-all duration-200 ${
                activeTab === 'pending'
                  ? 'bg-white text-orange-600 border-b-2 border-orange-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z"/>
                </svg>
                Chưa duyệt
                <span className={`px-2 py-0.5 rounded-full text-sm font-bold ${
                  activeTab === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {historyData.filter(item => item.status === 'pending').length}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`px-6 py-3 font-bold text-xl rounded-t-lg transition-all duration-200 ${
                activeTab === 'approved'
                  ? 'bg-white text-green-600 border-b-2 border-green-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 7L9 19L3.5 13.5L4.91 12.09L9 16.17L19.59 5.59L21 7Z"/>
                </svg>
                Đã duyệt
                <span className={`px-2 py-0.5 rounded-full text-sm font-bold ${
                  activeTab === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {historyData.filter(item => item.status === 'approved').length}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6 flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">Bộ lọc:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tất cả ({historyData.filter(item => item.status === activeTab).length})
            </button>
            <button
              onClick={() => setFilterType('disease')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                filterType === 'disease'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Có bệnh ({historyData.filter(item => item.status === activeTab && item.detections.length > 0).length})
            </button>
            <button
              onClick={() => setFilterType('normal')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                filterType === 'normal'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Không có bệnh ({historyData.filter(item => item.status === activeTab && item.detections.length === 0).length})
            </button>
          </div>
        </div>

        {/* History List */}
        {filteredData.length > 0 ? (
          <div className="max-h-[700px] overflow-y-auto space-y-3 pr-2">
            {filteredData.map((item) => (
              <div key={item.id} className="border border-blue-200 rounded-xl overflow-hidden shadow-sm bg-white">
                {/* Item Header */}
                <div 
                  className="p-4 bg-gradient-to-r from-blue-50 to-green-50 cursor-pointer hover:from-blue-100 hover:to-green-100 transition-all"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded">{item.date}</span>
                        <p className="font-semibold text-gray-800 text-sm">{item.filename}</p>
                      </div>
                      <p className="text-gray-600 text-sm">
                        {item.result === "Không phát hiện bệnh lý" ? "Không phát hiện bất thường" : item.result}
                      </p>
                      {item.detections && item.detections.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-blue-600 font-semibold">
                            {item.detections.length} vùng phát hiện
                          </span>
                          {item.detections.slice(0, 3).map((det, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                              {det.class}
                            </span>
                          ))}
                          {item.detections.length > 3 && (
                            <span className="text-xs text-gray-500">+{item.detections.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                    <button className="ml-4 p-2 hover:bg-white/50 rounded-lg transition-all">
                      <svg 
                        className={`w-5 h-5 text-blue-600 transition-transform duration-300 ${expandedItems.has(item.id) ? 'rotate-180' : ''}`}
                        fill="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedItems.has(item.id) && (
                  <div className="p-4 bg-white border-t border-blue-100 animate-in slide-in-from-top duration-300">
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Left: Detection Details */}
                      <div className="flex-1">
                        {item.detections && item.detections.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19M16.5,16.25L9.75,9.5L11,8.25L16.5,13.75L16.5,16.25M7.41,10.41L6,9L8.25,6.75L9.66,8.16L7.41,10.41M16.5,9.75L11,4.25L12.41,2.84L18,8.43L16.5,9.75Z"/>
                              </svg>
                              Chi tiết phát hiện:
                            </h4>
                            <div className="space-y-2">
                              {item.detections.map((detection, dIdx) => (
                                <div key={dIdx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                  <span className="text-xs font-semibold text-gray-600 w-8">#{dIdx + 1}</span>
                                  <span className="flex-1 text-sm font-medium text-gray-800">{detection.class}</span>
                                  <div className="flex items-center gap-2 flex-1">
                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full transition-all ${
                                          detection.confidence >= 0.8 ? 'bg-green-500' : 
                                          detection.confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        style={{width: `${detection.confidence * 100}%`}}
                                      />
                                    </div>
                                    <span className="text-sm font-bold text-gray-700 w-12 text-right">
                                      {(detection.confidence * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Detected Image */}
                      {!showOriginalImage.has(item.id) && item.detected_image && (
                        <div className="w-full md:w-1/3">
                          <h5 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z"/>
                            </svg>
                            Kết quả phát hiện
                          </h5>
                          <img 
                            src={item.detected_image} 
                            alt="Detected" 
                            className="w-full rounded-lg border-2 border-blue-200 cursor-pointer hover:border-blue-400 transition-all shadow-sm"
                            onClick={() => {
                              setZoomImage(item.detected_image);
                              setZoomTitle(`${item.filename} - Kết quả phát hiện`);
                              setZoomScale(1);
                              setPosition({ x: 0, y: 0 });
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-4 grid grid-cols-4 gap-3">
                      {/* Compare Button */}
                      {item.detected_image && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOriginalImage(item.id);
                          }}
                          className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 border border-blue-200"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M21,17H7V3H21M21,1H7A2,2 0 0,0 5,3V17A2,2 0 0,0 7,19H21A2,2 0 0,0 23,17V3A2,2 0 0,0 21,1M3,5H1V21A2,2 0 0,0 3,23H19V21H3M15.96,10.29L13.21,13.83L11.25,11.47L8.5,15H19.5L15.96,10.29Z"/>
                          </svg>
                          {showOriginalImage.has(item.id) ? 'Thu gọn' : 'So sánh'}
                        </button>
                      )}
                      
                      {/* PDF Export Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          generatePDF(item);
                        }}
                        className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 border border-green-200"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        </svg>
                        Xuất PDF
                      </button>
                      
                      {/* Approval Button */}
                      {activeTab === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            approveItem(item.id);
                          }}
                          className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 border border-purple-200"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z"/>
                          </svg>
                          Phê duyệt
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(item.id);
                        }}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 border border-red-200"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                        </svg>
                        Xóa
                      </button>
                    </div>

                    {/* Comparison View */}
                    {showOriginalImage.has(item.id) && item.detected_image && (
                      <div className="grid grid-cols-2 gap-4 mt-4 animate-in fade-in duration-300">
                        <div className="space-y-2">
                          <h5 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19,19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M13.96,12.29L11.21,15.83L9.25,13.47L6.5,17H17.5L13.96,12.29Z"/>
                            </svg>
                            Ảnh gốc
                          </h5>
                          <img 
                            src={item.original_image || ''} 
                            alt="Original" 
                            className="w-full rounded-lg border-2 border-gray-200 cursor-pointer hover:border-green-400 transition-all"
                            onClick={() => {
                              setZoomImage(item.original_image);
                              setZoomTitle(`${item.filename} - Ảnh gốc`);
                              setZoomScale(1);
                              setPosition({ x: 0, y: 0 });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <h5 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z"/>
                            </svg>
                            Kết quả phát hiện
                          </h5>
                          <img 
                            src={item.detected_image} 
                            alt="Detected" 
                            className="w-full rounded-lg border-2 border-blue-200 cursor-pointer hover:border-blue-400 transition-all"
                            onClick={() => {
                              setZoomImage(item.detected_image);
                              setZoomTitle(`${item.filename} - Kết quả phát hiện`);
                              setZoomScale(1);
                              setPosition({ x: 0, y: 0 });
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13.5 8H12V13L16.28 15.54L17 14.33L13.5 12.25V8M13 3C8.03 3 4 7.03 4 12H1L4.96 16.03L9 12H6C6 8.13 9.13 5 13 5C16.87 5 20 8.13 20 12C20 15.87 16.87 19 13 19C11.07 19 9.32 18.21 8.06 16.94L6.64 18.36C8.27 20 10.5 21 13 21C17.97 21 22 16.97 22 12C22 7.03 17.97 3 13 3Z"/>
            </svg>
            <p className="text-gray-500 text-lg">Không có kết quả nào</p>
            <p className="text-gray-400 text-sm mt-2">Hãy thử thay đổi bộ lọc hoặc chọn tab khác</p>
          </div>
        )}
      </div>

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
          onClick={() => {
            setZoomImage(null);
            setZoomScale(1);
            setPosition({ x: 0, y: 0 });
          }}
        >
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h3 className="text-white text-xl font-bold">{zoomTitle}</h3>
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <span>Zoom: {Math.round(zoomScale * 100)}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomScale(1);
                    setPosition({ x: 0, y: 0 });
                  }}
                  className="text-white hover:text-blue-400 transition-colors px-3 py-2 rounded-lg hover:bg-white/10 text-sm font-semibold"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    setZoomImage(null);
                    setZoomScale(1);
                    setPosition({ x: 0, y: 0 });
                  }}
                  className="text-white hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-white/10"
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"/>
                  </svg>
                </button>
              </div>
            </div>
            <div 
              className="flex-1 flex items-center justify-center overflow-hidden"
              onWheel={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setZoomScale(prev => Math.max(0.5, Math.min(5, prev + delta)));
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDragging(true);
                setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
              }}
              onMouseMove={(e) => {
                if (isDragging) {
                  setPosition({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y
                  });
                }
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
            >
              <img
                src={zoomImage}
                alt={zoomTitle}
                className="rounded-lg shadow-2xl select-none"
                style={{ 
                  transform: `scale(${zoomScale}) translate(${position.x / zoomScale}px, ${position.y / zoomScale}px)`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  cursor: isDragging ? 'grabbing' : zoomScale > 1 ? 'grab' : 'default',
                  transition: isDragging ? 'none' : 'transform 0.2s'
                }}
                onClick={(e) => e.stopPropagation()}
                draggable={false}
              />
            </div>
            <p className="text-white/70 text-sm text-center mt-4">
              Cuộn chuột để phóng to/thu nhỏ • Kéo ảnh để di chuyển • Click bên ngoài để đóng
            </p>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100 animate-scaleIn">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {deleteTarget === 'all' ? 'Xóa tất cả?' : 'Xóa kết quả này?'}
              </h3>
              <p className="text-gray-500 mb-6">
                {deleteTarget === 'all' 
                  ? `Bạn có chắc chắn muốn xóa tất cả ${filteredData.length} kết quả trong danh sách ${activeTab === 'pending' ? 'chưa duyệt' : 'đã duyệt'}? Hành động này không thể hoàn tác.`
                  : 'Bạn có chắc chắn muốn xóa kết quả phân tích này? Hành động này không thể hoàn tác.'}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all hover:scale-105 active:scale-95"
                >
                  {deleteTarget === 'all' ? 'Xóa tất cả' : 'Xóa ngay'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
