"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';

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

interface UploadContextType {
  uploadMode: 'single' | 'batch';
  setUploadMode: (mode: 'single' | 'batch') => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
  detectedImageUrl: string | null;
  setDetectedImageUrl: (url: string | null) => void;
  selectedZip: File | null;
  setSelectedZip: (file: File | null) => void;
  result: string | null;
  setResult: (res: string | null) => void;
  detections: Detection[];
  setDetections: (dets: Detection[]) => void;
  predictionTime: number;
  setPredictionTime: (time: number) => void;
  lastDetectionId: number | null;
  setLastDetectionId: (id: number | null) => void;
  batchResults: BatchResult[];
  setBatchResults: (results: BatchResult[]) => void;
  
  // Config states (optional to persist, but good UX)
  confidence: number;
  setConfidence: (val: number) => void;
  iou: number;
  setIou: (val: number) => void;
  maxDetections: number;
  setMaxDetections: (val: number) => void;
  selectedModel: string;
  setSelectedModel: (val: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [uploadMode, setUploadMode] = useState<'single' | 'batch'>('single');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detectedImageUrl, setDetectedImageUrl] = useState<string | null>(null);
  const [selectedZip, setSelectedZip] = useState<File | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [predictionTime, setPredictionTime] = useState<number>(0);
  const [lastDetectionId, setLastDetectionId] = useState<number | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  
  // Config states
  const [confidence, setConfidence] = useState(0.12);
  const [iou, setIou] = useState(0.5);
  const [maxDetections, setMaxDetections] = useState(100);
  const [selectedModel, setSelectedModel] = useState('best.pt');

  return (
    <UploadContext.Provider value={{
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
    }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUploadContext() {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error('useUploadContext must be used within a UploadProvider');
  }
  return context;
}
