"use client";

import { useState, useRef } from "react";
import { UploadZone } from "@/components/UploadZone";
import { ImageCarousel } from "@/components/ImageCarousel";
import { ListingInfo } from "@/components/ListingInfo";
import { ProductInfo } from "@/lib/gemini";

type Stage = "upload" | "processing" | "results";

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height / width) * MAX); width = MAX; }
        else { width = Math.round((width / height) * MAX); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name, { type: "image/jpeg" })),
        "image/jpeg",
        0.85
      );
    };
    img.src = url;
  });
}

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ base64: dataUrl.split(",")[1], mimeType: file.type || "image/jpeg" });
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
  const [imageError, setImageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [revising, setRevising] = useState(false);

  // Keep compressed image data around so revisions don't need re-upload
  const cachedImageData = useRef<{ base64: string; mimeType: string }[]>([]);

  const runImageGeneration = async (
    imageData: { base64: string; mimeType: string }[],
    info: ProductInfo,
    revision?: string
  ) => {
    setImagesLoading(true);
    setImageError(null);

    const genRes = await fetch("/api/generate-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: imageData, productInfo: info, revisionNote: revision }),
    });

    if (genRes.ok) {
      const { images } = await genRes.json();
      if (images?.length) {
        setModelImages(images);
      } else {
        setImageError("No model photos were generated — try again");
      }
    } else {
      const body = await genRes.json().catch(() => ({}));
      setImageError(body.error || "Model photo generation failed");
    }

    setImagesLoading(false);
  };

  const handleUpload = async (files: File[]) => {
    setError(null);
    setImageError(null);
    setRevisionNote("");
    setStage("processing");

    try {
      const compressed = await Promise.all(files.map(compressImage));

      const formData = new FormData();
      compressed.forEach((f) => formData.append("images", f));

      const analyzeRes = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!analyzeRes.ok) {
        const body = await analyzeRes.json().catch(() => ({}));
        throw new Error(body.error || `Analysis failed (${analyzeRes.status})`);
      }
      const info: ProductInfo = await analyzeRes.json();
      setProductInfo(info);
      setStage("results");

      const imageData = await Promise.all(compressed.map(fileToBase64));
      cachedImageData.current = imageData;

      await runImageGeneration(imageData, info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("upload");
    }
  };

  const handleRevise = async () => {
    if (!revisionNote.trim() || !productInfo || imagesLoading) return;
    setRevising(true);
    await runImageGeneration(cachedImageData.current, productInfo, revisionNote.trim());
    setRevisionNote("");
    setRevising(false);
  };

  const reset = () => {
    setStage("upload");
    setProductInfo(null);
    setModelImages([]);
    setError(null);
    setImageError(null);
    setRevisionNote("");
    cachedImageData.current = [];
  };

  return (
    <main className="min-h-screen bg-gray-50">
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
          <button onClick={reset} className="text-sm text-depop font-semibold">New Product</button>
        )}
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
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
            {imageError && !imagesLoading && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm">{imageError}</div>
            )}

            <ImageCarousel images={modelImages} loading={imagesLoading} />

            {/* Revision input — shown after images load */}
            {!imagesLoading && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Revise model photos</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={revisionNote}
                    onChange={(e) => setRevisionNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRevise()}
                    placeholder="e.g. the dress has a slit on the left shoulder"
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-depop"
                    disabled={revising}
                  />
                  <button
                    onClick={handleRevise}
                    disabled={!revisionNote.trim() || revising}
                    className="px-4 py-3 bg-depop text-white font-semibold rounded-xl disabled:opacity-40 active:scale-95 transition-transform text-sm"
                  >
                    {revising ? "…" : "Revise"}
                  </button>
                </div>
              </div>
            )}

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
