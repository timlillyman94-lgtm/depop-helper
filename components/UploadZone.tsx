"use client";

import { useRef, useState } from "react";
import Image from "next/image";

interface UploadZoneProps {
  onSubmit: (files: File[]) => void;
  loading: boolean;
}

export function UploadZone({ onSubmit, loading }: UploadZoneProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles).slice(0, 3);
    setFiles(arr);
    const urls = arr.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
  };

  const handleSubmit = () => {
    if (files.length > 0) onSubmit(files);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Upload area */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center gap-3 text-gray-500 active:border-depop transition-colors"
      >
        <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
        <div className="text-center">
          <p className="font-semibold text-gray-700">Tap to take a photo</p>
          <p className="text-sm text-gray-400">or choose from gallery • up to 3 photos</p>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Previews */}
      {previews.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {previews.map((url, i) => (
            <div key={i} className="relative flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border border-gray-200">
              <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" />
            </div>
          ))}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-shrink-0 w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={files.length === 0 || loading}
        className="w-full py-4 bg-depop text-white font-bold text-lg rounded-2xl disabled:opacity-40 active:scale-95 transition-transform"
      >
        {loading ? "Analysing…" : "Analyse Product"}
      </button>
    </div>
  );
}
