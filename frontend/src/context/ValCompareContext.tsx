"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export interface ValImageItem {
  filename: string;
  label_exists: boolean;
}

export interface Detection {
  class: string;
  confidence: number;
}

export interface AnalyzeResponse {
  filename: string;
  result: string;
  detections: Detection[];
  ground_truth_count: number;
  original_image: string;
  ground_truth_image: string;
  detected_image: string;
}

export interface PreviewResponse {
  filename: string;
  ground_truth_count: number;
  original_image: string;
  ground_truth_image: string;
}

interface ValCompareContextType {
  images: ValImageItem[];
  setImages: (images: ValImageItem[]) => void;
  selectedImage: string;
  setSelectedImage: (value: string) => void;
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  confidence: number;
  setConfidence: (value: number) => void;
  iou: number;
  setIou: (value: number) => void;
  maxDetections: number;
  setMaxDetections: (value: number) => void;
  preview: PreviewResponse | null;
  setPreview: (value: PreviewResponse | null) => void;
  analysis: AnalyzeResponse | null;
  setAnalysis: (value: AnalyzeResponse | null) => void;
}

const ValCompareContext = createContext<ValCompareContextType | undefined>(undefined);

export function ValCompareProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<ValImageItem[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [selectedModel, setSelectedModel] = useState("best.pt");
  const [confidence, setConfidence] = useState(0.12);
  const [iou, setIou] = useState(0.5);
  const [maxDetections, setMaxDetections] = useState(100);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);

  return (
    <ValCompareContext.Provider
      value={{
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
      }}
    >
      {children}
    </ValCompareContext.Provider>
  );
}

export function useValCompareContext() {
  const context = useContext(ValCompareContext);
  if (context === undefined) {
    throw new Error("useValCompareContext must be used within a ValCompareProvider");
  }
  return context;
}
