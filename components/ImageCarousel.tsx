"use client";

import { useState } from "react";
import Image from "next/image";

interface ImageCarouselProps {
  images: string[]; // base64 strings
  loading: boolean;
}

export function ImageCarousel({ images, loading }: ImageCarouselProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">Model Photos</h2>
        <span className="text-sm text-gray-400">{selected.size > 0 ? `${selected.size} selected` : "Tap to select"}</span>
      </div>

      {/* Scrollable carousel */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {images.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggleSelect(i)}
            className={`relative flex-shrink-0 w-48 h-64 rounded-2xl overflow-hidden border-4 transition-all snap-start ${
              selected.has(i) ? "border-depop scale-[0.97]" : "border-transparent"
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
            {/* Long-press download hint */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); downloadImage(img, i); }}
              className="absolute bottom-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm"
              aria-label="Download this photo"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
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
  );
}
