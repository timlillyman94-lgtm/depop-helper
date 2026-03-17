"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface ImageCarouselProps {
  images: string[]; // base64 strings
  loading: boolean;
}

export function ImageCarousel({ images, loading }: ImageCarouselProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Close lightbox on back button (Android)
  useEffect(() => {
    if (lightboxIndex === null) return;
    const close = () => setLightboxIndex(null);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, [lightboxIndex]);

  // Keyboard nav
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i! + 1) % images.length);
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i! - 1 + images.length) % images.length);
      if (e.key === "Escape") setLightboxIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, images.length]);

  const toggleSelect = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const downloadImage = (base64: string, index: number) => {
    const link = document.createElement("a");
    link.href = `data:image/jpeg;base64,${base64}`;
    link.download = `depop-photo-${index + 1}.jpg`;
    link.click();
  };

  const downloadSelected = () => {
    const toDownload = selected.size > 0 ? [...selected] : images.map((_, i) => i);
    toDownload.forEach((i) => downloadImage(images[i], i));
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-48 h-64 rounded-2xl bg-gray-200 animate-pulse" />
          ))}
        </div>
        <p className="text-center text-sm text-gray-400">Generating model photos…</p>
      </div>
    );
  }

  if (!images.length) return null;

  const currentImg = lightboxIndex !== null ? images[lightboxIndex] : null;

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Model Photos</h2>
          <span className="text-sm text-gray-400">
            {selected.size > 0 ? `${selected.size} selected` : "Tap to view"}
          </span>
        </div>

        {/* Scrollable carousel */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className={`relative flex-shrink-0 w-48 h-64 rounded-2xl overflow-hidden border-4 transition-all snap-start ${
                selected.has(i) ? "border-depop" : "border-transparent"
              }`}
            >
              <Image
                src={`data:image/jpeg;base64,${img}`}
                alt={`Model photo ${i + 1}`}
                fill
                className="object-cover"
              />
              {selected.has(i) && (
                <div className="absolute top-2 right-2 w-7 h-7 bg-depop rounded-full flex items-center justify-center shadow">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {/* Zoom hint */}
              <div className="absolute bottom-2 left-2 w-7 h-7 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-sm">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={downloadSelected}
          className="w-full py-3.5 bg-gray-900 text-white font-semibold rounded-2xl active:scale-95 transition-transform"
        >
          {selected.size > 0 ? `Download ${selected.size} photo${selected.size > 1 ? "s" : ""}` : "Download all photos"}
        </button>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && currentImg && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-white/60 text-sm">{lightboxIndex + 1} / {images.length}</span>
            <button
              onClick={() => setLightboxIndex(null)}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Image — fills available space, pinch-to-zoom works natively */}
          <div className="flex-1 relative" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${currentImg}`}
              alt={`Model photo ${lightboxIndex + 1}`}
              className="w-full h-full object-contain"
              style={{ touchAction: "pinch-zoom" }}
            />

            {/* Left arrow */}
            {images.length > 1 && (
              <button
                onClick={() => setLightboxIndex((lightboxIndex - 1 + images.length) % images.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm"
                aria-label="Previous"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Right arrow */}
            {images.length > 1 && (
              <button
                onClick={() => setLightboxIndex((lightboxIndex + 1) % images.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm"
                aria-label="Next"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          {/* Bottom bar — select + download */}
          <div
            className="flex items-center justify-between px-4 py-4 gap-3 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => toggleSelect(lightboxIndex)}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${
                selected.has(lightboxIndex)
                  ? "bg-depop text-white"
                  : "bg-white/10 text-white border border-white/20"
              }`}
            >
              {selected.has(lightboxIndex) ? "✓ Selected" : "Select"}
            </button>
            <button
              onClick={() => downloadImage(currentImg, lightboxIndex)}
              className="flex-1 py-3 rounded-xl font-semibold text-sm bg-white/10 text-white border border-white/20"
            >
              Download
            </button>
          </div>
        </div>
      )}
    </>
  );
}
