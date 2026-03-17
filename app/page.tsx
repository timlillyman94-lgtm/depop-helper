"use client";

import { useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { ImageCarousel } from "@/components/ImageCarousel";
import { ListingInfo } from "@/components/ListingInfo";
import { ProductInfo } from "@/lib/gemini";

type Stage = "upload" | "processing" | "results";

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mimeType: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("upload");
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [modelImages, setModelImages] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (files: File[]) => {
    setError(null);
    setStage("processing");

    try {
      // Step 1: Analyze product info
      const formData = new FormData();
      files.forEach((f) => formData.append("images", f));

      const analyzeRes = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!analyzeRes.ok) throw new Error("Analysis failed — check your API key");
      const info: ProductInfo = await analyzeRes.json();
      setProductInfo(info);
      setStage("results");

      // Step 2: Generate model images (runs after results screen appears)
      setImagesLoading(true);
      const imageData = await Promise.all(files.map(fileToBase64));

      const genRes = await fetch("/api/generate-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: imageData, productInfo: info }),
      });

      if (genRes.ok) {
        const { images } = await genRes.json();
        setModelImages(images);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("upload");
    } finally {
      setImagesLoading(false);
    }
  };

  const reset = () => {
    setStage("upload");
    setProductInfo(null);
    setModelImages([]);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-depop rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900">Depop Helper</span>
        </div>
        {stage !== "upload" && (
          <button onClick={reset} className="text-sm text-depop font-semibold">
            New Product
          </button>
        )}
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {stage === "upload" && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">New Product</h1>
              <p className="text-gray-500 mt-1 text-sm">Upload up to 3 photos — get listing info + model photos</p>
            </div>
            <UploadZone onSubmit={handleUpload} loading={false} />
          </>
        )}

        {stage === "processing" && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 border-4 border-depop border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600 font-medium">Analysing your product…</p>
            <p className="text-gray-400 text-sm">Gemini is reading the photos</p>
          </div>
        )}

        {stage === "results" && productInfo && (
          <>
            <ImageCarousel images={modelImages} loading={imagesLoading} />
            <ListingInfo info={productInfo} loading={false} />
            <div className="pb-8">
              <button
                onClick={reset}
                className="w-full py-3.5 border-2 border-gray-300 text-gray-700 font-semibold rounded-2xl active:scale-95 transition-transform"
              >
                + New Product
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
