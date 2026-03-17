"use client";

import { ProductInfo } from "@/lib/gemini";
import { CopyButton } from "./CopyButton";

interface ListingInfoProps {
  info: ProductInfo;
  loading: boolean;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-gray-800 text-sm leading-snug">{value}</p>
      </div>
      <CopyButton text={value} label={label} className="flex-shrink-0 mt-1" />
    </div>
  );
}

export function ListingInfo({ info, loading }: ListingInfoProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const fullListing = `${info.title}

${info.description}

Brand: ${info.brand}
Size: ${info.size}
Colour: ${info.color}
Material: ${info.material}
Condition: ${info.condition}
Style: ${info.style}

Price: ${info.suggestedPrice}

${info.tags.map((t) => `#${t}`).join(" ")}`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-gray-800">Listing Info</h2>
        <CopyButton text={fullListing} label="full listing" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 px-4 divide-y divide-gray-100">
        <Field label="Title" value={info.title} />
        <Field label="Description" value={info.description} />
        <Field label="Suggested Price" value={info.suggestedPrice} />
        <Field label="Brand" value={info.brand} />
        <Field label="Size" value={info.size} />
        <Field label="Colour" value={info.color} />
        <Field label="Condition" value={info.condition} />
        <Field label="Material" value={info.material} />
        <Field label="Style" value={info.style} />
        <Field label="Tags" value={info.tags.map((t) => `#${t}`).join(" ")} />
      </div>
    </div>
  );
}
