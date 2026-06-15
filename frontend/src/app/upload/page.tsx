"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { useUploadContext } from "@/context/UploadContext";
import { apiRequest, approveHistoryItem, fetchAvailableModels } from "@/lib/api";

interface Detection {
  class: string;
  confidence: number;
}

interface BatchResult {
  id?: number | string;
  filename: string;
  result: string;
  detections: Detection[];
  original_image: string | null;
  detected_image: string | null;
}

type BatchFilterType = "all" | "disease" | "normal";

export default function UploadPage() {
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const MAX_ZIP_SIZE_MB = 100;
  const MAX_ZIP_SIZE_BYTES = MAX_ZIP_SIZE_MB * 1024 * 1024;
  const ALLOWED_BATCH_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"];
  const router = useRouter();
  
  // Use context instead of local state for persistence across tab switches
  const {
    uploadMode, setUploadMode,
    selectedFile, setSelectedFile,
    previewUrl, setPreviewUrl,
    detectedImageUrl, setDetectedImageUrl,
    selectedZip, setSelectedZip,
    result, setResult,
    detections, setDetections,
    predictionTime, setPredictionTime,
    lastDetectionId, setLastDetectionId,
    batchResults, setBatchResults,
    confidence, setConfidence,
    iou, setIou,
    maxDetections, setMaxDetections,
    selectedModel, setSelectedModel
  } = useUploadContext();
  
  const [loading, setLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Toast (bottom-left)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    const fetchWeightList = async () => {
      try {
        const models = await fetchAvailableModels(BACKEND_URL);
        setAvailableModels(models);
      } catch {
      }
    };

    fetchWeightList();
  }, [BACKEND_URL]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    };
  }, []);
  
  // Batch result expand states (local UI state - not persisted)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [showOriginalImage, setShowOriginalImage] = useState<Set<number>>(new Set());
  const [batchFilterType, setBatchFilterType] = useState<BatchFilterType>("all");

  const diseaseBatchCount = useMemo(
    () => batchResults.filter((item) => item.detections.length > 0).length,
    [batchResults]
  );
  const normalBatchCount = useMemo(
    () => batchResults.filter((item) => item.detections.length === 0).length,
    [batchResults]
  );
  const filteredBatchResults = useMemo(() => {
    if (batchFilterType === "disease") {
      return batchResults.filter((item) => item.detections.length > 0);
    }
    if (batchFilterType === "normal") {
      return batchResults.filter((item) => item.detections.length === 0);
    }
    return batchResults;
  }, [batchFilterType, batchResults]);

  useEffect(() => {
    setExpandedItems(new Set());
    setShowOriginalImage(new Set());
  }, [batchFilterType]);
  
  // Sidebar state (local UI state)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Image zoom modal states
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomTitle, setZoomTitle] = useState<string>('');
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Hàm tạo PDF báo cáo cho batch item
  const generateBatchPDF = async (item: BatchResult) => {
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
        <p style="margin: 3px 0; color: #374151; font-size: 11px;"><strong>Ngày tạo:</strong> ${now.toLocaleString('vi-VN')}</p>
        <p style="margin: 3px 0; color: #374151; font-size: 11px;"><strong>Tên file:</strong> ${item.filename}</p>
        <p style="margin: 3px 0; color: #374151; font-size: 11px;"><strong>Model:</strong> YOLOv12s Small</p>
      </div>
      
      <div style="margin-bottom: 15px;">
        <h2 style="color: #3b82f6; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 8px;">KẾT QUẢ TỔNG QUAN</h2>
        <p style="margin: 5px 0; color: #374151; font-size: 11px;"><strong>Tổng số vùng phát hiện:</strong> ${item.detections.length}</p>
        <p style="margin: 5px 0; color: #374151; font-size: 11px;">${item.result}</p>
      </div>
      
      ${item.original_image || item.detected_image ? `
      <div style="margin-bottom: 20px; page-break-inside: avoid;">
        <h2 style="color: #3b82f6; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 12px;">ẢNH X-QUANG</h2>
        <div style="display: flex; gap: 15px; justify-content: center; align-items: flex-start; flex-wrap: wrap;">
          ${item.original_image ? `
          <div style="flex: 1; min-width: 250px; max-width: 400px; text-align: center;">
            <p style="font-weight: bold; color: #374151; font-size: 12px; margin-bottom: 8px;">Ảnh gốc</p>
            <img src="${item.original_image}" style="width: 100%; height: auto; max-height: 350px; object-fit: contain; border: 2px solid #e5e7eb; border-radius: 8px;" />
          </div>
          ` : ''}
          ${item.detected_image ? `
          <div style="flex: 1; min-width: 250px; max-width: 400px; text-align: center;">
            <p style="font-weight: bold; color: #374151; font-size: 12px; margin-bottom: 8px;">Kết quả phát hiện</p>
            <img src="${item.detected_image}" style="width: 100%; height: auto; max-height: 350px; object-fit: contain; border: 2px solid #e5e7eb; border-radius: 8px;" />
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}
      
      ${item.detections.length > 0 ? `
      <div style="margin-bottom: 15px; page-break-before: auto; page-break-inside: avoid;">
        <h2 style="color: #3b82f6; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 8px;">CHI TIẾT CÁC VÙNG PHÁT HIỆN</h2>
        ${item.detections.map((detection, i) => {
          const confidencePercent = (detection.confidence * 100).toFixed(1);
          const barColor = detection.confidence >= 0.8 ? '#22c55e' : detection.confidence >= 0.5 ? '#eab308' : '#ef4444';
          const barWidth = detection.confidence * 100;
          
          return `
            <div style="margin: 10px 0; padding: 10px; background: #f9fafb; border-left: 4px solid ${barColor}; border-radius: 4px;">
              <p style="margin: 0 0 6px 0; font-weight: bold; color: #1f2937; font-size: 13px;">${i + 1}. ${detection.class}</p>
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
      
      <div style="background: #fef3c7; border: 2px solid #fbbf24; border-radius: 8px; padding: 15px; margin-top: 20px; page-break-inside: avoid;">
        <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 14px;">⚠️ LƯU Ý QUAN TRỌNG</h3>
        <p style="color: #92400e; margin: 3px 0; line-height: 1.5; font-size: 10px;">
          Kết quả này được tạo bởi hệ thống AI và chỉ mang tính chất tham khảo.
        </p>
        <p style="color: #92400e; margin: 3px 0; line-height: 1.5; font-size: 10px;">
          Đây <strong>KHÔNG</strong> phải là chẩn đoán y khoa chính thức. Vui lòng tham khảo ý kiến của bác sĩ chuyên khoa.
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

  // Hàm tạo PDF báo cáo cho single mode
  const generatePDF = async () => {
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
        <p style="margin: 3px 0; color: #374151; font-size: 11px;"><strong>Ngày tạo:</strong> ${now.toLocaleString('vi-VN')}</p>
        <p style="margin: 3px 0; color: #374151; font-size: 11px;"><strong>Model:</strong> YOLOv12s Small</p>
        <p style="margin: 3px 0; color: #374151; font-size: 11px;"><strong>Thời gian dự đoán:</strong> ${predictionTime.toFixed(2)}s</p>
      </div>
      
      <div style="margin-bottom: 15px;">
        <h2 style="color: #3b82f6; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 8px;">KẾT QUẢ TỔNG QUAN</h2>
        <p style="margin: 5px 0; color: #374151; font-size: 11px;"><strong>Tổng số vùng phát hiện:</strong> ${detections.length}</p>
        <p style="margin: 5px 0; color: #374151; font-size: 11px;">${result || 'Không có kết quả'}</p>
      </div>
      
      ${previewUrl || detectedImageUrl ? `
      <div style="margin-bottom: 20px; page-break-inside: avoid;">
        <h2 style="color: #3b82f6; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 12px;">ẢNH X-QUANG</h2>
        <div style="display: flex; gap: 15px; justify-content: center; align-items: flex-start; flex-wrap: wrap;">
          ${previewUrl ? `
          <div style="flex: 1; min-width: 250px; max-width: 400px; text-align: center;">
            <p style="font-weight: bold; color: #374151; font-size: 12px; margin-bottom: 8px;">Ảnh gốc</p>
            <img src="${previewUrl}" style="width: 100%; height: auto; max-height: 350px; object-fit: contain; border: 2px solid #e5e7eb; border-radius: 8px;" />
          </div>
          ` : ''}
          ${detectedImageUrl ? `
          <div style="flex: 1; min-width: 250px; max-width: 400px; text-align: center;">
            <p style="font-weight: bold; color: #374151; font-size: 12px; margin-bottom: 8px;">Kết quả phát hiện</p>
            <img src="${detectedImageUrl}" style="width: 100%; height: auto; max-height: 350px; object-fit: contain; border: 2px solid #e5e7eb; border-radius: 8px;" />
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}
      
      ${detections.length > 0 ? `
      <div style="margin-bottom: 15px; page-break-before: auto; page-break-inside: avoid;">
        <h2 style="color: #3b82f6; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 8px;">CHI TIẾT CÁC VÙNG PHÁT HIỆN</h2>
        ${detections.map((detection, index) => {
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
      
      const fileName = `Bao_cao_phat_hien_${now.getTime()}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Có lỗi khi tạo PDF. Vui lòng thử lại!');
    } finally {
      document.body.removeChild(reportDiv);
    }
  };



  // Toggle expand/collapse for batch result item
  const toggleExpand = (index: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
        // Also hide original image when collapsing
        setShowOriginalImage(prevShow => {
          const newShowSet = new Set(prevShow);
          newShowSet.delete(index);
          return newShowSet;
        });
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Toggle show/hide original image
  const toggleOriginalImage = (index: number) => {
    setShowOriginalImage(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (file && !file.type.startsWith("image/")) {
      showToast("Tệp không hợp lệ! vui lòng chọn tệp ảnh để thực hiện chẩn đoán.", "error");
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
    setResult(null);
    setDetections([]);
    setPredictionTime(0);
    setDetectedImageUrl(null);
    setLastDetectionId(null);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  }

  async function handleZipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (file && file.size > MAX_ZIP_SIZE_BYTES) {
      showToast(`Tệp ZIP vượt quá ${MAX_ZIP_SIZE_MB}MB. Vui lòng chọn tệp nhỏ hơn hoặc bằng ${MAX_ZIP_SIZE_MB}MB.`, "error");
      setSelectedZip(null);
      setBatchResults([]);
      e.target.value = "";
      return;
    }

    if (file) {
      try {
        const zip = await JSZip.loadAsync(file);
        const invalidFiles: string[] = [];

        zip.forEach((relativePath, zipEntry) => {
          if (zipEntry.dir) {
            return;
          }
          const lowerPath = relativePath.toLowerCase();
          const isValidImage = ALLOWED_BATCH_IMAGE_EXTENSIONS.some((ext) => lowerPath.endsWith(ext));
          if (!isValidImage) {
            invalidFiles.push(relativePath);
          }
        });

        if (invalidFiles.length > 0) {
          const previewList = invalidFiles.slice(0, 5).join(", ");
          const moreCount = invalidFiles.length - 5;
          const suffix = moreCount > 0 ? `, ... và ${moreCount} tệp khác` : "";
          showToast(`ZIP chứa tệp không đúng định dạng ảnh: ${previewList}${suffix}. Chỉ chấp nhận PNG/JPG/JPEG.`, "error");
          setSelectedZip(null);
          setBatchResults([]);
          e.target.value = "";
          return;
        }
      } catch {
        showToast("Tệp ZIP không hợp lệ hoặc bị lỗi. Vui lòng chọn tệp ZIP khác.", "error");
        setSelectedZip(null);
        setBatchResults([]);
        e.target.value = "";
        return;
      }
    }

    setSelectedZip(file);
    setBatchResults([]);
  }

  function clearBatchSelection() {
    setSelectedZip(null);
    setBatchResults([]);
    setBatchFilterType("all");
    setExpandedItems(new Set());
    setShowOriginalImage(new Set());
    if (zipInputRef.current) {
      zipInputRef.current.value = "";
    }
  }

  function switchToSingleMode() {
    clearBatchSelection();
    setUploadMode('single');
  }

  async function handleUpload() {
    if (uploadMode === 'single') {
      setLoading(true);
      setResult(null);
      setDetections([]);
      setPredictionTime(0);
      setDetectedImageUrl(null);
      setLastDetectionId(null);
      const formData = new FormData();
      if (selectedFile) {
        formData.append("file", selectedFile);
      }
      formData.append("confidence", confidence.toString());
      formData.append("iou", iou.toString());
      formData.append("max_det", maxDetections.toString());
      formData.append("model", selectedModel);
      
      const startTime = performance.now();
      
      try {
        const data = await apiRequest<{
          id?: number | string;
          result?: string;
          detections?: Detection[];
          detected_image?: string | null;
        }>("/analyze", {
          backendUrl: BACKEND_URL,
          method: "POST",
          body: formData,
          fallbackError: "Lỗi khi gửi ảnh lên server!",
        });
        
        const endTime = performance.now();
        setPredictionTime((endTime - startTime) / 1000); // Convert to seconds
        
        setResult(data.result || "Không có kết quả");
        setDetections(data.detections || []);
        setLastDetectionId(typeof data.id === 'number' ? data.id : null);
        // Nếu backend trả về ảnh đã phát hiện (dưới dạng base64 hoặc URL)
        if (data.detected_image) {
          setDetectedImageUrl(data.detected_image);
        }
        
        // Backend now handles saving to history automatically
      } catch (err) {
        setResult(err instanceof Error ? err.message : "Lỗi khi gửi ảnh lên server!");
      } finally {
        setLoading(false);
      }
    } else {
      // Batch mode - upload ZIP
      if (!selectedZip) {
        showToast('Vui lòng chọn file ZIP trước khi bắt đầu phân tích.', 'error');
        return;
      }
      if (selectedZip.size > MAX_ZIP_SIZE_BYTES) {
        showToast(`Tệp ZIP vượt quá ${MAX_ZIP_SIZE_MB}MB. Vui lòng chọn tệp nhỏ hơn hoặc bằng ${MAX_ZIP_SIZE_MB}MB.`, 'error');
        return;
      }
      setLoading(true);
      setBatchResults([]);
      setBatchFilterType("all");
      setExpandedItems(new Set());
      setShowOriginalImage(new Set());
      showToast('Đang phân tích hàng loạt...', 'info');
      const formData = new FormData();
      formData.append("file", selectedZip);
      formData.append("confidence", confidence.toString());
      formData.append("iou", iou.toString());
      formData.append("max_det", maxDetections.toString());
      formData.append("model", selectedModel);
      try {
        const data = await apiRequest<{ results?: BatchResult[] }>("/analyze_batch", {
          backendUrl: BACKEND_URL,
          method: "POST",
          body: formData,
          fallbackError: "Lỗi khi phân tích file ZIP",
        });

        setBatchResults(data.results || []);
        
        // Backend now handles saving to history automatically
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Lỗi khi gửi file ZIP lên server!";
        showToast(msg, "error");
        setBatchResults([{
          filename: "Error", 
          result: msg,
          detections: [],
          original_image: null,
          detected_image: null
        }]);
      } finally {
        setLoading(false);
      }
    }
  }

  const handleApprove = async (id: number | string | null | undefined, missingIdMessage: string) => {
    if (id === undefined || id === null || id === 'temp_id') {
      showToast(missingIdMessage, 'error');
      return;
    }

    try {
      await approveHistoryItem(id, BACKEND_URL);
      showToast('Ảnh đã được phê duyệt', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Phê duyệt thất bại: không kết nối được backend.', 'error');
    }
  };

  return (
    <div className="relative flex gap-6">
      {toast && (
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 pointer-events-none"
          aria-live="polite"
        >
          <div
            className={
              "pointer-events-auto flex items-start gap-4 px-6 py-5 rounded-2xl shadow-2xl max-w-lg w-full mx-4 border-2 animate-slide-down " +
              (toast.type === "success"
                ? "bg-green-50 border-green-400 text-green-800"
                : toast.type === "error"
                  ? "bg-red-50 border-red-400 text-red-800"
                  : "bg-blue-50 border-blue-400 text-blue-800")
            }
            role="status"
          >
            {/* Icon */}
            <div className={
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center " +
              (toast.type === "success" ? "bg-green-500" : toast.type === "error" ? "bg-red-500" : "bg-blue-500")
            }>
              {toast.type === "success" && (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {toast.type === "error" && (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              )}
              {toast.type === "info" && (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            {/* Message */}
            <div className="flex-1 pt-1.5 text-base font-semibold leading-snug">{toast.message}</div>
            {/* Close */}
            <button
              onClick={() => setToast(null)}
              className={
                "flex-shrink-0 mt-0.5 rounded-full p-1 hover:bg-black/10 transition-colors " +
                (toast.type === "error" ? "text-red-500 hover:text-red-700" : toast.type === "success" ? "text-green-500 hover:text-green-700" : "text-blue-500 hover:text-blue-700")
              }
              aria-label="Đóng"
              type="button"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        </div>
      )}

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
      <aside className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-80 bg-white/95 backdrop-blur-xl shadow-2xl border-r border-red-100/50 p-8 space-y-8 overflow-y-auto z-40 transition-all duration-500 ease-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 pb-3 border-b-2 border-red-200">
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11.03L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11.03L19.5,12L19.43,12.97L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.35 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z"/></svg>
            Cấu hình YOLO
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
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                {selectedModel && !availableModels.includes(selectedModel) && (
                  <option value={selectedModel}>{selectedModel} (đang chọn)</option>
                )}
                {availableModels.length === 0 ? (
                  <option value={selectedModel || ""}>Không tìm thấy weight .pt</option>
                ) : (
                  availableModels.map((modelName) => (
                    <option key={modelName} value={modelName}>
                      {modelName}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Confidence */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Confidence
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={confidence}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0 && val <= 1) {
                      setConfidence(val);
                    }
                  }}
                  className="w-16 text-sm font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="relative w-full h-6 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={confidence}
                  onChange={(e) => setConfidence(parseFloat(e.target.value))}
                  className="absolute w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer z-20 opacity-0"
                />
                <div className="w-full h-2 bg-gray-200 rounded-lg overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-400 to-red-600"
                    style={{ width: `${confidence * 100}%` }}
                  ></div>
                </div>
                <div 
                  className="absolute h-5 w-5 bg-white border-2 border-red-500 rounded-full shadow-md z-10 pointer-events-none transition-all duration-75"
                  style={{ left: `calc(${confidence * 100}% - 10px)` }}
                ></div>
              </div>
            </div>

            {/* IoU Threshold */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  IoU Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={iou}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0 && val <= 1) {
                      setIou(val);
                    }
                  }}
                  className="w-16 text-sm font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="relative w-full h-6 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={iou}
                  onChange={(e) => setIou(parseFloat(e.target.value))}
                  className="absolute w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer z-20 opacity-0"
                />
                <div className="w-full h-2 bg-gray-200 rounded-lg overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-400 to-red-600"
                    style={{ width: `${iou * 100}%` }}
                  ></div>
                </div>
                <div 
                  className="absolute h-5 w-5 bg-white border-2 border-red-500 rounded-full shadow-md z-10 pointer-events-none transition-all duration-75"
                  style={{ left: `calc(${iou * 100}% - 10px)` }}
                ></div>
              </div>
            </div>

            {/* Max Detections */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Max Detections
                </label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  step="1"
                  value={maxDetections}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 1 && val <= 300) {
                      setMaxDetections(val);
                    }
                  }}
                  className="w-16 text-sm font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="relative w-full h-6 flex items-center">
                <input
                  type="range"
                  min="1"
                  max="300"
                  step="1"
                  value={maxDetections}
                  onChange={(e) => setMaxDetections(parseInt(e.target.value))}
                  className="absolute w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer z-20 opacity-0"
                />
                <div className="w-full h-2 bg-gray-200 rounded-lg overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-400 to-red-600"
                    style={{ width: `${(maxDetections / 300) * 100}%` }}
                  ></div>
                </div>
                <div 
                  className="absolute h-5 w-5 bg-white border-2 border-red-500 rounded-full shadow-md z-10 pointer-events-none transition-all duration-75"
                  style={{ left: `calc(${(maxDetections / 300) * 100}% - 10px)` }}
                ></div>
              </div>
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

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-500 relative z-40 ${
        sidebarOpen ? 'ml-80' : 'ml-0'
      }`}>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-6">
          <h1 className="text-5xl font-bold text-red-500 flex items-center gap-2">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M19 19H5V5H19V19M13.96 12.29L11.21 15.83L9.25 13.47L6.5 17H17.5L13.96 12.29Z"/></svg>
            Phát hiện bệnh từ ảnh X-quang
          </h1>

        {/* Upload Mode Selector - Ẩn khi đã có ảnh được chọn */}
        {!selectedFile && !selectedZip && (
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => {
                setUploadMode('single');
                setSelectedZip(null);
                setBatchResults([]);
              }}
              className={`flex-1 px-6 py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                uploadMode === 'single'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200 scale-105'
                  : 'bg-white text-slate-600 border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              <div className={`p-2 rounded-lg ${uploadMode === 'single' ? 'bg-white/20' : 'bg-slate-100'}`}>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M19 19H5V5H19V19M13.96 12.29L11.21 15.83L9.25 13.47L6.5 17H17.5L13.96 12.29Z"/></svg>
              </div>
              Tải lên 1 ảnh
            </button>
            <button
              onClick={() => {
                setUploadMode('batch');
                setSelectedFile(null);
                setPreviewUrl(null);
                setResult(null);
                setDetectedImageUrl(null);
              }}
              className={`flex-1 px-6 py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                uploadMode === 'batch'
                  ? 'bg-gradient-to-r from-lime-500 to-lime-600 text-white shadow-lg shadow-lime-200 scale-105'
                  : 'bg-white text-slate-600 border-2 border-slate-100 hover:border-lime-200 hover:bg-lime-50 hover:text-lime-600'
              }`}
            >
              <div className={`p-2 rounded-lg ${uploadMode === 'batch' ? 'bg-white/20' : 'bg-slate-100'}`}>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6H12L10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6M20 18H4V6H9.17L11.17 8H20V18M18 12H16V14H14V16H16V14H18V12M6 12H14V14H6V12Z"/></svg>
              </div>
              Tải lên file ZIP
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          {uploadMode === 'single' ? (
            <>
              {/* Chỉ hiển thị input khi chưa có ảnh */}
              {!previewUrl && (
                <div className="mb-8">
                  <label 
                    className="relative flex flex-col items-center justify-center w-full h-96 border-3 border-dashed border-blue-300 rounded-3xl bg-gradient-to-b from-blue-50/50 to-white hover:bg-blue-50 transition-all duration-300 cursor-pointer group overflow-hidden"
                  >
                    {/* Grid Pattern Background */}
                    <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none" 
                      style={{ 
                        backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)', 
                        backgroundSize: '20px 20px' 
                      }}
                    ></div>
                    
                    {/* Animated Pulse Circle */}
                    <div className="absolute w-64 h-64 bg-blue-400/10 rounded-full blur-3xl animate-pulse group-hover:bg-blue-400/20 transition-all"></div>

                    <div className="relative z-10 flex flex-col items-center text-center p-6">
                      {/* Icon Container */}
                      <div className="w-24 h-24 mb-6 bg-white rounded-full shadow-lg shadow-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-12 h-12 text-blue-500 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {/* Scan Line Animation */}
                        <div className="absolute w-full h-1 bg-blue-400/50 top-0 animate-[scan_2s_ease-in-out_infinite] opacity-0 group-hover:opacity-100"></div>
                      </div>

                      <h3 className="text-2xl font-bold text-slate-700 mb-2 group-hover:text-blue-600 transition-colors">
                        Tải ảnh X-quang lên
                      </h3>
                      <p className="text-slate-500 mb-6 max-w-sm">
                        Kéo thả hoặc click để chọn ảnh X-quang ngực cần chẩn đoán.
                        <br/>
                        <span className="text-xs text-slate-400 mt-2 block">Hỗ trợ: JPG, PNG, JPEG</span>
                      </p>

                      <div className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold shadow-md shadow-blue-200 group-hover:bg-blue-700 group-hover:shadow-blue-300 transition-all flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Chọn ảnh từ máy
                      </div>
                    </div>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </label>
                </div>
              )}
              {previewUrl && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Ảnh gốc */}
                  <div className="border-2 border-gray-300 rounded-lg p-2">
                    <p className="text-sm font-semibold text-gray-700 mb-2 text-center">Ảnh gốc</p>
                    <img
                      src={previewUrl}
                      alt="Original"
                      className="w-full h-auto rounded-lg shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => {
                        setZoomImage(previewUrl);
                        setZoomTitle('Ảnh gốc');
                        setZoomScale(1);
                        setPosition({ x: 0, y: 0 });
                      }}
                    />
                  </div>
                  {/* Ảnh đã phát hiện */}
                  <div className="border-2 border-red-300 rounded-lg p-2">
                    <p className="text-sm font-semibold text-gray-700 mb-2 text-center">Ảnh phát hiện</p>
                    {detectedImageUrl ? (
                      <img
                        src={detectedImageUrl}
                        alt="Detected"
                        className="w-full h-auto rounded-lg shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          setZoomImage(detectedImageUrl);
                          setZoomTitle('Ảnh phát hiện');
                          setZoomScale(1);
                          setPosition({ x: 0, y: 0 });
                        }}
                      />
                    ) : (
                      <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                        <div className="text-center">
                          <svg className="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M19 19H5V5H19V19M13.96 12.29L11.21 15.83L9.25 13.47L6.5 17H17.5L13.96 12.29Z"/>
                          </svg>
                          <p className="text-sm">Chưa phát hiện</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Buttons */}
              <div className="grid grid-cols-4 gap-3">
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || loading}
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-lg hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4V2A10 10 0 0 0 2 12H4A8 8 0 0 1 12 4Z"/></svg>
                      Đang phân tích...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9.5 3A6.5 6.5 0 0 1 16 9.5C16 11.11 15.41 12.59 14.44 13.73L14.71 14H15.5L20.5 19L19 20.5L14 15.5V14.71L13.73 14.44C12.59 15.41 11.11 16 9.5 16A6.5 6.5 0 0 1 3 9.5A6.5 6.5 0 0 1 9.5 3M9.5 5C7 5 5 7 5 9.5C5 12 7 14 9.5 14C12 14 14 12 14 9.5C14 7 12 5 9.5 5Z"/></svg>
                      Phân tích
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setDetectedImageUrl(null);
                    setResult(null);
                    setLastDetectionId(null);
                  }}
                  disabled={!selectedFile}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>
                  Ảnh khác
                </button>
                
                <button
                  onClick={generatePDF}
                  disabled={!detectedImageUrl}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>
                  Xuất PDF
                </button>
                
                <button
                  onClick={() => handleApprove(lastDetectionId, 'Không tìm thấy ID của kết quả để phê duyệt. Hãy phân tích lại ảnh.')}
                  disabled={!detectedImageUrl || !lastDetectionId}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold rounded-lg hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M21 7L9 19L3.5 13.5L4.91 12.09L9 16.17L19.59 5.59L21 7Z"/></svg>
                  Phê duyệt
                </button>

                <button
                  onClick={() => {
                    if (previewUrl && detectedImageUrl && result) {
                      const contextData = {
                        originalImage: previewUrl,
                        detectedImage: detectedImageUrl,
                        diagnosisResult: result,
                        detections: detections
                      };
                      localStorage.setItem('consultationContext', JSON.stringify(contextData));
                      router.push('/chatbot');
                    }
                  }}
                  disabled={!detectedImageUrl}
                  className="col-span-4 mt-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-lg rounded-xl hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-200 transition-all duration-200 flex items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-4"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2M20 16H6L4 18V4H20V16M13.5 10.5C13.5 11.3 12.8 12 12 12S10.5 11.3 10.5 10.5 11.2 9 12 9 13.5 9.7 13.5 10.5M17 10.5C17 11.3 16.3 12 15.5 12S14 11.3 14 10.5 14.7 9 15.5 9 17 9.7 17 10.5M8.5 10.5C8.5 11.3 7.8 12 7 12S5.5 11.3 5.5 10.5 6.2 9 7 9 8.5 9.7 8.5 10.5Z"/></svg>
                  Tư vấn Chatbot về kết quả này
                </button>
              </div>
              
              {result && (
                <div className="mt-6 space-y-4">
                  {/* Header Card */}
                  <div className="p-6 bg-gradient-to-br from-white via-blue-50/40 to-white rounded-2xl border-2 border-blue-200 shadow-xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.89 20.1 3 19 3M19 19H5V5H19V19M10 17H8L13 9V13H15L10 21V17Z"/>
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                          Kết quả phân tích
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Phát hiện bệnh lý tự động bằng AI</p>
                      </div>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <p className="text-xs font-semibold text-blue-700">Tổng số</p>
                        </div>
                        <p className="text-2xl font-bold text-blue-900">{detections.length}</p>
                        <p className="text-xs text-blue-600 mt-1">vùng phát hiện</p>
                      </div>
                      
                      <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <p className="text-xs font-semibold text-green-700">Thời gian</p>
                        </div>
                        <p className="text-2xl font-bold text-green-900">
                          {predictionTime.toFixed(2)}s
                        </p>
                        <p className="text-xs text-green-600 mt-1">prediction time</p>
                      </div>
                      
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-200">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                          <p className="text-xs font-semibold text-purple-700">Model</p>
                        </div>
                        <p className="text-xl font-bold text-purple-900">YOLOv12s</p>
                        <p className="text-xs text-purple-600 mt-1">Small variant</p>
                      </div>
                    </div>
                    
                    {/* Overall Result */}
                    <div className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Tóm tắt:</p>
                          <pre className="text-gray-800 whitespace-pre-wrap leading-relaxed text-sm">
                            {result}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Detection Details */}
                  {detections.length > 0 && (
                    <div className="p-6 bg-gradient-to-br from-white via-purple-50/30 to-white rounded-2xl border-2 border-purple-200 shadow-xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2M12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20M16.59 7.58L10 14.17L7.41 11.59L6 13L10 17L18 9L16.59 7.58Z"/>
                          </svg>
                        </div>
                        <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                          Chi tiết phát hiện ({detections.length})
                        </h3>
                      </div>
                      
                      <div className="grid gap-3">
                        {detections.map((detection, idx) => (
                          <div key={idx} className="bg-white rounded-xl p-4 border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                                  <span className="text-lg font-bold text-purple-700">#{idx + 1}</span>
                                </div>
                                <div>
                                  <p className="font-bold text-gray-800 text-base">{detection.class}</p>
                                  <p className="text-xs text-gray-500">Bệnh lý phát hiện</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-purple-600">
                                  {(detection.confidence * 100).toFixed(1)}%
                                </p>
                                <p className="text-xs text-gray-500">độ tin cậy</p>
                              </div>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs text-gray-600">
                                <span>Confidence Level</span>
                                <span className="font-semibold">{(detection.confidence * 100).toFixed(2)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                                <div 
                                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                    detection.confidence >= 0.8 
                                      ? 'bg-gradient-to-r from-green-400 to-green-600' 
                                      : detection.confidence >= 0.5 
                                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' 
                                      : 'bg-gradient-to-r from-red-400 to-red-600'
                                  }`}
                                  style={{ width: `${detection.confidence * 100}%` }}
                                >
                                  <div className="h-full w-full bg-gradient-to-r from-white/0 via-white/30 to-white/0 animate-pulse"></div>
                                </div>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-400">Low</span>
                                <span className="text-gray-400">Medium</span>
                                <span className="text-gray-400">High</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Disclaimer */}
                  <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 9H11V7H13M13 17H11V11H13M12 2A10 10 0 0 0 2 12A10 10 0 0 0 12 22A10 10 0 0 0 22 12A10 10 0 0 0 12 2Z"/>
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-yellow-800 mb-1">Lưu ý quan trọng</p>
                      <p className="text-xs text-yellow-700">
                        Kết quả phân tích bằng AI chỉ mang tính chất tham khảo và hỗ trợ. 
                        Vui lòng tham khảo ý kiến của bác sĩ chuyên khoa để có chẩn đoán chính xác và phương án điều trị phù hợp.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {selectedZip && batchResults.length === 0 && (
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={switchToSingleMode}
                    className="px-4 py-3 bg-orange-200 text-orange-800 border border-orange-300 font-semibold rounded-lg hover:bg-orange-300 shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11 17L6 12L11 7V11H18V13H11V17M20 3H4A2 2 0 0 0 2 5V19A2 2 0 0 0 4 21H20A2 2 0 0 0 22 19V5A2 2 0 0 0 20 3Z"/>
                    </svg>
                    Phân tích 1 ảnh
                  </button>
                  <button
                    onClick={clearBatchSelection}
                    className="px-4 py-3 bg-slate-50 text-slate-600 border border-slate-200 font-semibold rounded-lg hover:bg-slate-100 shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 3V4H4V6H5V19A2 2 0 0 0 7 21H17A2 2 0 0 0 19 19V6H20V4H15V3H9M7 6H17V19H7V6M9 8V17H11V8H9M13 8V17H15V8H13Z"/>
                    </svg>
                    Xóa tệp ZIP đã chọn
                  </button>
                </div>
              )}

              {batchResults.length === 0 ? (
                <>
                  <div className="mb-8">
                    <label 
                      className="relative flex flex-col items-center justify-center w-full h-96 border-3 border-dashed border-lime-300 rounded-3xl bg-gradient-to-b from-lime-50/50 to-white hover:bg-lime-50 transition-all duration-300 cursor-pointer group overflow-hidden"
                    >
                      {/* Grid Pattern Background */}
                      <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none" 
                        style={{ 
                          backgroundImage: 'linear-gradient(#65a30d 1px, transparent 1px), linear-gradient(90deg, #65a30d 1px, transparent 1px)', 
                          backgroundSize: '20px 20px' 
                        }}
                      ></div>
                      
                      {/* Animated Pulse Circle */}
                      <div className="absolute w-64 h-64 bg-lime-400/10 rounded-full blur-3xl animate-pulse group-hover:bg-lime-400/20 transition-all"></div>

                      <div className="relative z-10 flex flex-col items-center text-center p-6">
                        {/* Icon Container */}
                        <div className="w-24 h-24 mb-6 bg-white rounded-full shadow-lg shadow-lime-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <svg className="w-12 h-12 text-lime-500 group-hover:text-lime-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                          </svg>
                        </div>

                        <h3 className="text-2xl font-bold text-slate-700 mb-2 group-hover:text-lime-600 transition-colors">
                          Tải file ZIP ảnh hàng loạt
                        </h3>
                        <p className="text-slate-500 mb-6 max-w-sm">
                          Kéo thả hoặc click để chọn file nén (.zip) chứa nhiều ảnh X-quang.
                          <br/>
                          <span className="text-xs text-slate-400 mt-2 block">Hệ thống sẽ tự động giải nén và phân tích từng ảnh.</span>
                          <span className="text-xs text-red-500 mt-1 block font-semibold">Dung lượng tối đa: 100MB/file ZIP.</span>
                        </p>

                        <div className="px-6 py-2.5 bg-lime-600 text-white rounded-xl font-semibold shadow-md shadow-lime-200 group-hover:bg-lime-700 group-hover:shadow-lime-300 transition-all flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Chọn file ZIP
                        </div>
                        
                        {selectedZip && (
                          <div className="mt-4 px-4 py-2 bg-lime-100 text-lime-700 rounded-lg font-medium flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                            {selectedZip.name} ({(selectedZip.size / 1024 / 1024).toFixed(2)} MB)
                          </div>
                        )}
                      </div>

                      <input
                        ref={zipInputRef}
                        type="file"
                        accept=".zip"
                        onChange={handleZipChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </label>
                  </div>
                  <button
                    onClick={handleUpload}
                    disabled={loading || !selectedZip}
                    className="w-full px-6 py-4 bg-gradient-to-r from-lime-500 to-lime-600 text-white font-bold text-lg rounded-xl hover:from-lime-600 hover:to-lime-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-lime-200 transition-all duration-200 flex items-center justify-center gap-3 group"
                  >
                    {loading ? (
                      <>
                        <svg className="w-6 h-6 animate-spin" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4V2A10 10 0 0 0 2 12H4A8 8 0 0 1 12 4Z"/></svg>
                        Đang phân tích hàng loạt...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M9.5 3A6.5 6.5 0 0 1 16 9.5C16 11.11 15.41 12.59 14.44 13.73L14.71 14H15.5L20.5 19L19 20.5L14 15.5V14.71L13.73 14.44C12.59 15.41 11.11 16 9.5 16A6.5 6.5 0 0 1 3 9.5A6.5 6.5 0 0 1 9.5 3M9.5 5C7 5 5 7 5 9.5C5 12 7 14 9.5 14C12 14 14 12 14 9.5C14 7 12 5 9.5 5Z"/></svg>
                        Bắt đầu phân tích
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 font-semibold text-gray-700">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.89 20.1 3 19 3M19 19H5V5H19V19M10 17H8L13 9V13H15L10 21V17Z"/></svg>
                      Kết quả phân tích ({filteredBatchResults.length}/{batchResults.length} ảnh):
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={switchToSingleMode}
                        className="px-4 py-2 bg-orange-200 text-orange-800 border border-orange-300 font-semibold rounded-lg hover:bg-orange-300 shadow-sm transition-all duration-200 flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11 17L6 12L11 7V11H18V13H11V17M20 3H4A2 2 0 0 0 2 5V19A2 2 0 0 0 4 21H20A2 2 0 0 0 22 19V5A2 2 0 0 0 20 3Z"/>
                        </svg>
                        Phân tích 1 ảnh
                      </button>
                      <button
                        onClick={clearBatchSelection}
                        className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-red-700 shadow-md transition-all duration-200 flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                        </svg>
                        Phát hiện khác
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-2">
                    <button
                      onClick={() => setBatchFilterType("all")}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        batchFilterType === "all"
                          ? "bg-blue-600 text-white shadow"
                          : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-100"
                      }`}
                    >
                      Tất cả ({batchResults.length})
                    </button>
                    <button
                      onClick={() => setBatchFilterType("disease")}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        batchFilterType === "disease"
                          ? "bg-red-600 text-white shadow"
                          : "bg-white text-red-700 border border-red-200 hover:bg-red-100"
                      }`}
                    >
                      Có bệnh ({diseaseBatchCount})
                    </button>
                    <button
                      onClick={() => setBatchFilterType("normal")}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        batchFilterType === "normal"
                          ? "bg-green-600 text-white shadow"
                          : "bg-white text-green-700 border border-green-200 hover:bg-green-100"
                      }`}
                    >
                      Không bệnh ({normalBatchCount})
                    </button>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto space-y-3 pr-2">
                    {filteredBatchResults.length === 0 && (
                      <div className="text-center py-10 border border-dashed border-gray-300 rounded-xl bg-gray-50 text-gray-600 font-medium">
                        Không có ảnh phù hợp với bộ lọc hiện tại.
                      </div>
                    )}
                    {filteredBatchResults.map((item, idx) => (
                      <div key={idx} className="border border-blue-200 rounded-xl overflow-hidden shadow-sm bg-white">
                        {/* Item Header - Always Visible */}
                        <div 
                          className="p-4 bg-gradient-to-r from-blue-50 to-green-50 cursor-pointer hover:from-blue-100 hover:to-green-100 transition-all"
                          onClick={() => toggleExpand(idx)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded">#{idx + 1}</span>
                                <p className="font-semibold text-gray-800 text-sm">{item.filename}</p>
                              </div>
                              <p className="text-gray-600 text-sm">{item.result}</p>
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
                                className={`w-5 h-5 text-blue-600 transition-transform duration-300 ${expandedItems.has(idx) ? 'rotate-180' : ''}`}
                                fill="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {expandedItems.has(idx) && (
                          <div className="p-4 bg-white border-t border-blue-100 animate-in slide-in-from-top duration-300">
                            
                            <div className="flex flex-col md:flex-row gap-4">
                              {/* Left Side: Detection Details */}
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

                              {/* Right Side: Detected Image (Compact View) */}
                              {!showOriginalImage.has(idx) && item.detected_image && (
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
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                              {/* Compare Button */}
                              {item.detected_image && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleOriginalImage(idx);
                                  }}
                                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 border border-blue-200"
                                >
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M21,17H7V3H21M21,1H7A2,2 0 0,0 5,3V17A2,2 0 0,0 7,19H21A2,2 0 0,0 23,17V3A2,2 0 0,0 21,1M3,5H1V21A2,2 0 0,0 3,23H19V21H3M15.96,10.29L13.21,13.83L11.25,11.47L8.5,15H19.5L15.96,10.29Z"/>
                                  </svg>
                                  {showOriginalImage.has(idx) ? 'Thu gọn' : 'So sánh'}
                                </button>
                              )}
                              
                              {/* PDF Export Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  generateBatchPDF(item);
                                }}
                                className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 border border-green-200"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                                </svg>
                                Xuất PDF
                              </button>

                              {/* Chatbot Consultation Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item.detected_image && item.result) {
                                    const contextData = {
                                      originalImage: item.original_image,
                                      detectedImage: item.detected_image,
                                      diagnosisResult: item.result,
                                      detections: item.detections
                                    };
                                    localStorage.setItem('consultationContext', JSON.stringify(contextData));
                                    router.push('/chatbot');
                                  }
                                }}
                                className="px-4 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 border border-cyan-200"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2M20 16H6L4 18V4H20V16M13.5 10.5C13.5 11.3 12.8 12 12 12S10.5 11.3 10.5 10.5 11.2 9 12 9 13.5 9.7 13.5 10.5M17 10.5C17 11.3 16.3 12 15.5 12S14 11.3 14 10.5 14.7 9 15.5 9 17 9.7 17 10.5M8.5 10.5C8.5 11.3 7.8 12 7 12S5.5 11.3 5.5 10.5 6.2 9 7 9 8.5 9.7 8.5 10.5Z"/></svg>
                                Tư vấn Chatbot
                              </button>
                              
                              {/* Approval Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(item.id, 'Kết quả này chưa có ID để phê duyệt.');
                                }}
                                className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 border border-purple-200"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z"/>
                                </svg>
                                Phê duyệt
                              </button>
                            </div>

                            {/* Comparison View (Full Width Bottom) */}
                            {showOriginalImage.has(idx) && item.detected_image && (
                              <div className="grid grid-cols-2 gap-4 mt-4 animate-in fade-in duration-300">
                                {/* Original Image */}
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
                                    }}
                                  />
                                </div>

                                {/* Detected Image */}
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
                </div>
              )}
            </>
          )}
        </div>
      </div>
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
            {/* Header */}
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
            {/* Image Container */}
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
            {/* Hint */}
            <p className="text-white/70 text-sm text-center mt-4">
              Cuộn chuột để phóng to/thu nhỏ • Kéo ảnh để di chuyển • Click bên ngoài để đóng
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
