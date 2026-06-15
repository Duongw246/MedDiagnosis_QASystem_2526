"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useValCompareContext,
  AnalyzeResponse,
  PreviewResponse,
  ValImageItem,
} from "@/context/ValCompareContext";
import { apiRequest, fetchAvailableModels } from "@/lib/api";

export default function ValComparePage() {
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const [loadingImages, setLoadingImages] = useState(true);

  const {
    images,
    setImages,
    selectedImage,
    setSelectedImage,
    selectedModel,
    setSelectedModel,
    confidence,
    setConfidence,
    iou,
    setIou,
    maxDetections,
    setMaxDetections,
    preview,
    setPreview,
    analysis,
    setAnalysis,
  } = useValCompareContext();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const fetchWeightList = async () => {
      try {
        const models = await fetchAvailableModels(BACKEND_URL);
        if (active) setAvailableModels(models);
      } catch {
      }
    };

    fetchWeightList();

    return () => {
      active = false;
    };
  }, [BACKEND_URL]);

  useEffect(() => {
    let active = true;

    const loadValImages = async () => {
      setLoadingImages(true);
      setError("");

      try {
        const data = await apiRequest<{ images?: ValImageItem[] }>("/val_dataset/images", {
          backendUrl: BACKEND_URL,
          fallbackError: "Không thể tải danh sách ảnh val",
        });

        if (!active) return;

        const list = data.images || [];
        setImages(list);
        if (list.length > 0 && !selectedImage) {
          setSelectedImage(list[0].filename);
        } else if (selectedImage && !list.some((item: { filename: string }) => item.filename === selectedImage)) {
          setSelectedImage(list[0]?.filename || "");
        }
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu val");
      } finally {
        if (active) setLoadingImages(false);
      }
    };

    loadValImages();

    return () => {
      active = false;
    };
  }, [BACKEND_URL, selectedImage, setImages, setSelectedImage]);

  useEffect(() => {
    let active = true;

    const loadPreview = async () => {
      if (!selectedImage) {
        setPreview(null);
        setAnalysis(null);
        return;
      }

      setLoadingPreview(true);
      setError("");
      setAnalysis(null);

      try {
        const data = await apiRequest<PreviewResponse>(`/val_dataset/preview?image_name=${encodeURIComponent(selectedImage)}`, {
          backendUrl: BACKEND_URL,
          fallbackError: "Không thể tải preview ảnh val",
        });

        if (!active) return;
        setPreview(data);
      } catch (e) {
        if (!active) return;
        setPreview(null);
        setError(e instanceof Error ? e.message : "Lỗi tải preview ảnh val");
      } finally {
        if (active) setLoadingPreview(false);
      }
    };

    loadPreview();

    return () => {
      active = false;
    };
  }, [BACKEND_URL, selectedImage, setAnalysis, setPreview]);

  const selectedMeta = useMemo(
    () => images.find((item) => item.filename === selectedImage),
    [images, selectedImage]
  );

  const runAnalyze = async () => {
    if (!selectedImage) {
      setError("Vui lòng chọn ảnh trong tập validation");
      return;
    }

    setAnalyzing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image_name", selectedImage);
      formData.append("confidence", String(confidence));
      formData.append("iou", String(iou));
      formData.append("max_det", String(maxDetections));
      formData.append("model", selectedModel);

      const data = await apiRequest<AnalyzeResponse>("/val_dataset/analyze", {
        backendUrl: BACKEND_URL,
        method: "POST",
        body: formData,
        fallbackError: "Không thể phân tích ảnh val",
      });

      setAnalysis(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi phân tích ảnh val");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`fixed top-32 z-50 transition-all duration-500 ease-out ${sidebarOpen ? "left-80" : "left-0"}`}
      >
        <div className="flex items-center justify-center w-8 h-16 bg-white/90 backdrop-blur-md shadow-[4px_0_24px_rgba(59,130,246,0.25)] border-y border-r border-blue-200 rounded-r-2xl cursor-pointer group hover:w-10 hover:bg-blue-50 transition-all duration-300">
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

      <aside className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-80 bg-white/95 backdrop-blur-xl shadow-2xl border-r border-blue-100/50 p-8 space-y-8 overflow-y-auto z-40 transition-all duration-500 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 pb-3 border-b-2 border-blue-200">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11.03L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11.03L19.5,12L19.43,12.97L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.35 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z"/></svg>
            Cấu hình YOLO
          </h3>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">Confidence</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={confidence}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0 && val <= 1) setConfidence(val);
                  }}
                  className="w-16 text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600" style={{ width: `${confidence * 100}%` }}></div>
                </div>
                <div className="absolute h-5 w-5 bg-white border-2 border-blue-500 rounded-full shadow-md z-10 pointer-events-none transition-all duration-75" style={{ left: `calc(${confidence * 100}% - 10px)` }}></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">IoU Threshold</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={iou}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0 && val <= 1) setIou(val);
                  }}
                  className="w-16 text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600" style={{ width: `${iou * 100}%` }}></div>
                </div>
                <div className="absolute h-5 w-5 bg-white border-2 border-blue-500 rounded-full shadow-md z-10 pointer-events-none transition-all duration-75" style={{ left: `calc(${iou * 100}% - 10px)` }}></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">Max Detections</label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  step="1"
                  value={maxDetections}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 1 && val <= 300) setMaxDetections(val);
                  }}
                  className="w-16 text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600" style={{ width: `${(maxDetections / 300) * 100}%` }}></div>
                </div>
                <div className="absolute h-5 w-5 bg-white border-2 border-blue-500 rounded-full shadow-md z-10 pointer-events-none transition-all duration-75" style={{ left: `calc(${(maxDetections / 300) * 100}% - 10px)` }}></div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 top-16 bg-black/30 backdrop-blur-sm z-30 transition-all duration-500 animate-in fade-in" />
      )}

      <div className={`space-y-6 transition-all duration-500 relative z-40 ${sidebarOpen ? "ml-80" : "ml-0"}`}>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800">Đối chiếu Val</h1>
          <p className="text-sm text-gray-600 mt-1">
            Chạy YOLO trên ảnh trong tập validation và so sánh trực quan giữa ảnh gốc, ground truth, và kết quả mô hình.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setSelectorOpen((prev) => !prev)}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-blue-50/70 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">Danh sách ảnh validation</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {selectedImage ? `Đang chọn: ${selectedImage}` : "Chưa chọn ảnh"}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${selectorOpen ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                  {selectorOpen ? "Đang mở" : "Đang ẩn"}
                </span>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${selectorOpen ? "bg-blue-100" : "bg-white border border-gray-200"}`}>
                  <svg className={`w-4 h-4 text-blue-600 transition-transform duration-300 ${selectorOpen ? "rotate-180" : "rotate-0"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </button>

            <div
              className={`transition-all duration-300 ease-out overflow-hidden ${selectorOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}`}
            >
              <div className="px-4 pb-4 pt-1 border-t border-blue-100/80 bg-white/70">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ảnh trong Val data</label>
                <select
                  value={selectedImage}
                  onChange={(e) => setSelectedImage(e.target.value)}
                  disabled={loadingImages || images.length === 0}
                  className="w-full px-3 py-2.5 rounded-xl border border-blue-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {images.map((item) => (
                    <option key={item.filename} value={item.filename}>
                      {item.filename}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">Chọn ảnh để xem trước ảnh gốc và ground truth.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runAnalyze}
              disabled={analyzing || loadingPreview || !selectedImage || loadingImages}
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {analyzing ? "Đang phân tích..." : "Phân tích"}
            </button>

            {selectedMeta && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${selectedMeta.label_exists ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {selectedMeta.label_exists ? "Có ground truth label" : "Thiếu ground truth label"}
              </span>
            )}
          </div>

          {loadingImages && <p className="text-sm text-gray-500">Đang tải danh sách ảnh val...</p>}
          {loadingPreview && <p className="text-sm text-gray-500">Đang tải ảnh preview...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {preview && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Đối chiếu: {preview.filename}</h2>
                <p className="text-sm text-gray-600">Ảnh gốc và ground truth được hiển thị sẵn. Bấm Phân tích để xem kết quả YOLO.</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                Ground truth boxes: {preview.ground_truth_count}
              </span>
            </div>

            <div className={`grid grid-cols-1 ${analysis ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4`}>
              <div className="rounded-xl border border-gray-200 p-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Ảnh gốc (Val)</h3>
                <img src={preview.original_image} alt="Ảnh gốc val" className="w-full rounded-lg border border-gray-200" />
              </div>
              <div className="rounded-xl border border-gray-200 p-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Ground Truth</h3>
                <img src={preview.ground_truth_image} alt="Ground truth" className="w-full rounded-lg border border-gray-200" />
              </div>
              {analysis && (
                <div className="rounded-xl border border-gray-200 p-3">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Kết quả YOLO</h3>
                  <img src={analysis.detected_image} alt="Kết quả YOLO" className="w-full rounded-lg border border-gray-200" />
                </div>
              )}
            </div>

            {analysis && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Danh sách phát hiện</h3>
                <p className="text-sm text-gray-600 mb-2">{analysis.result}</p>
                {analysis.detections.length === 0 ? (
                  <p className="text-sm text-gray-500">Không có vùng bất thường được phát hiện.</p>
                ) : (
                  <div className="space-y-2">
                    {analysis.detections.map((det, idx) => (
                      <div key={`${det.class}-${idx}`} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                        <span className="font-medium text-gray-800">{det.class}</span>
                        <span className="text-blue-700 font-semibold">{(det.confidence * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
