"use client";

import { useState, useRef, useCallback } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ProductInfo, Measurements } from "@/lib/gemini";
import { CATEGORIES, CONDITIONS, COLOURS, SOURCES, AGES, STYLES, WOMENS_SIZES } from "@/lib/depop-options";
import brandsData from "@/lib/brands.json";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "import" | "select" | "generate" | "review";

interface UploadedImage {
  file: File;
  preview: string; // object URL
  driveUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name, { type: "image/jpeg" })),
        "image/jpeg", 0.85
      );
    };
    img.src = url;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SelectField({ label, value, onChange, options, allowEmpty = true }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; allowEmpty?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-depop"
      >
        {allowEmpty && <option value="">— Select —</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TextAreaField({ label, value, onChange, rows = 4 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-depop resize-none"
      />
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", prefix }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; prefix?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full ${prefix ? "pl-12" : "px-3"} pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-depop`}
        />
      </div>
    </div>
  );
}

const brands = brandsData as string[];

function BrandField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Brand</label>
      <input
        list="brand-options"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type to search brands…"
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-depop"
      />
      <datalist id="brand-options">
        {brands.map((b) => <option key={b} value={b} />)}
      </datalist>
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      {/* X button sits above TransformWrapper in z-order and uses pointerDown to fire before gesture capture */}
      <button
        onPointerDown={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-[60] w-10 h-10 bg-white/20 rounded-full text-white text-2xl flex items-center justify-center"
      >×</button>
      <div className="w-full h-full flex items-center justify-center">
        <TransformWrapper>
          <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="max-w-full max-h-screen object-contain" />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
}

// ─── Stage 1: Import ──────────────────────────────────────────────────────────

function StageImport({ onNext }: {
  onNext: (images: UploadedImage[], measurements: Measurements, costPrice: string) => void;
}) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [measurements, setMeasurements] = useState<Measurements>({ productType: "" });
  const [costPrice, setCostPrice] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const newImgs: UploadedImage[] = arr.map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setImages((prev) => [...prev, ...newImgs]);
  }, []);

  const removeImage = (i: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const setMeasurement = (key: keyof Measurements, val: string) =>
    setMeasurements((prev) => ({ ...prev, [key]: val }));

  const canProceed = images.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Product</h1>
        <p className="text-gray-500 mt-1 text-sm">Upload all your photos, then add measurements and cost</p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${dragging ? "border-depop bg-red-50" : "border-gray-300 bg-white hover:border-depop"}`}
      >
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)} />
        <p className="text-gray-500 text-sm">Tap to add photos, or drag &amp; drop</p>
        <p className="text-gray-400 text-xs mt-1">Add as many as you like</p>
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.preview} alt="" className="w-full h-full object-cover" />
              <button
                onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full text-xs flex items-center justify-center"
              >×</button>
            </div>
          ))}
          <div
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-depop"
          >
            <span className="text-2xl text-gray-400">+</span>
          </div>
        </div>
      )}

      {/* Product type + measurements */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Measurements</p>
        <SelectField
          label="Product Type"
          value={measurements.productType}
          onChange={(v) => setMeasurements({ productType: v as Measurements["productType"] })}
          options={["tops", "dresses", "pants", "skirts"]}
        />
        {measurements.productType === "tops" && <>
          <InputField label="Pit to pit (cm)" value={measurements.pitToPit ?? ""} onChange={(v) => setMeasurement("pitToPit", v)} />
          <InputField label="Length (cm)" value={measurements.length ?? ""} onChange={(v) => setMeasurement("length", v)} />
        </>}
        {measurements.productType === "dresses" && <>
          <InputField label="Pit to pit (cm)" value={measurements.pitToPit ?? ""} onChange={(v) => setMeasurement("pitToPit", v)} />
          <InputField label="Waist (cm)" value={measurements.waist ?? ""} onChange={(v) => setMeasurement("waist", v)} />
          <InputField label="Length (cm)" value={measurements.length ?? ""} onChange={(v) => setMeasurement("length", v)} />
        </>}
        {measurements.productType === "pants" && <>
          <InputField label="Waist (cm)" value={measurements.waist ?? ""} onChange={(v) => setMeasurement("waist", v)} />
          <InputField label="Inseam (cm)" value={measurements.inseam ?? ""} onChange={(v) => setMeasurement("inseam", v)} />
        </>}
        {measurements.productType === "skirts" && <>
          <InputField label="Waist (cm)" value={measurements.waist ?? ""} onChange={(v) => setMeasurement("waist", v)} />
          <InputField label="Length (cm)" value={measurements.length ?? ""} onChange={(v) => setMeasurement("length", v)} />
        </>}
      </div>

      {/* Cost of goods */}
      <InputField label="Cost of Goods" value={costPrice} onChange={setCostPrice} type="number" prefix="AUD" />

      <button
        onClick={() => onNext(images, measurements, costPrice)}
        disabled={!canProceed}
        className="w-full py-3.5 bg-depop text-white font-semibold rounded-2xl disabled:opacity-40 active:scale-95 transition-transform"
      >
        Next — Select AI Photos
      </button>
    </div>
  );
}

// ─── Stage 2: Select AI Photos ────────────────────────────────────────────────

function StageSelect({ images, onNext, onBack }: {
  images: UploadedImage[];
  onNext: (selected: number[]) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (i: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Select AI Photos</h2>
        <p className="text-gray-500 mt-1 text-sm">Pick 2–3 photos to feed into AI for analysis and model image generation</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className={`relative aspect-square rounded-xl overflow-hidden bg-gray-100 border-2 transition-colors ${selected.has(i) ? "border-depop" : "border-transparent"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.preview} alt="" className="w-full h-full object-cover" />
            {selected.has(i) && (
              <div className="absolute inset-0 bg-depop/20 flex items-center justify-center">
                <div className="w-7 h-7 bg-depop rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {[...selected].indexOf(i) + 1}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3.5 border-2 border-gray-300 text-gray-700 font-semibold rounded-2xl active:scale-95 transition-transform text-sm">
          Back
        </button>
        <button
          onClick={() => onNext([...selected])}
          disabled={selected.size === 0}
          className="flex-1 py-3.5 bg-depop text-white font-semibold rounded-2xl disabled:opacity-40 active:scale-95 transition-transform text-sm"
        >
          Generate ({selected.size} selected)
        </button>
      </div>
    </div>
  );
}

// ─── Stage 3: Generate (loading) ──────────────────────────────────────────────

function StageGenerate() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 border-4 border-depop border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-600 font-medium">Generating your listing…</p>
      <p className="text-gray-400 text-sm">Analysing photos + creating model images</p>
    </div>
  );
}

// ─── Sortable image row (used in Stage 4) ────────────────────────────────────

type ImageSlot = { type: "uploaded"; idx: number } | { type: "ai"; idx: number };

function slotId(slot: ImageSlot) {
  return `${slot.type}-${slot.idx}`;
}

function SortableImageRow({
  slot,
  position,
  preview,
  onLightbox,
  onRemove,
}: {
  slot: ImageSlot;
  position: number;
  preview: string;
  onLightbox: (src: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slotId(slot) });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-2"
    >
      {/* Drag handle — only element that starts a drag */}
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing px-1 py-2 text-gray-300 text-lg select-none"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <span className="text-xs font-bold text-gray-400 w-5 text-center">{position}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview}
        alt=""
        className="w-12 h-12 object-cover rounded-lg flex-shrink-0 cursor-pointer active:opacity-70"
        onClick={() => onLightbox(preview)}
      />
      <span className="text-xs text-gray-500 flex-1">
        {slot.type === "ai" ? `AI model ${slot.idx + 1}` : `Photo ${slot.idx + 1}`}
      </span>
      <button
        onClick={onRemove}
        className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 text-xs flex items-center justify-center"
      >
        ×
      </button>
    </div>
  );
}

// ─── Stage 4: Review & Submit ─────────────────────────────────────────────────

function StageReview({
  productInfo,
  allImages,
  aiImages,
  onUpdate,
  onSubmit,
  onBack,
  onRevise,
  onReset,
  submitStatus,
  submitError,
}: {
  productInfo: ProductInfo;
  allImages: UploadedImage[];
  aiImages: string[]; // base64
  onUpdate: (info: ProductInfo) => void;
  onSubmit: (orderedUrls: string[]) => void;
  onBack: () => void;
  onRevise: (note: string) => Promise<string[]>;
  onReset: () => void;
  submitStatus: "idle" | "uploading" | "submitting" | "success" | "error";
  submitError: string | null;
}) {
  const set = (key: keyof ProductInfo, val: string) =>
    onUpdate({ ...productInfo, [key]: val });

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const [orderedSlots, setOrderedSlots] = useState<ImageSlot[]>(() => {
    const slots: ImageSlot[] = [];
    aiImages.forEach((_, i) => slots.push({ type: "ai", idx: i }));
    allImages.forEach((_, i) => slots.push({ type: "uploaded", idx: i }));
    return slots;
  });
  const [revisionNote, setRevisionNote] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedSlots((slots) => {
        const from = slots.findIndex((s) => slotId(s) === active.id);
        const to = slots.findIndex((s) => slotId(s) === over.id);
        return arrayMove(slots, from, to);
      });
    }
  };

  const getPreview = (slot: ImageSlot) =>
    slot.type === "ai"
      ? `data:image/jpeg;base64,${aiImages[slot.idx]}`
      : allImages[slot.idx].preview;

  const removeSlot = (i: number) =>
    setOrderedSlots((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = () => {
    // Pass back ordered slots — parent handles Drive upload + sheet write
    const identifiers = orderedSlots.map((slot) =>
      slot.type === "ai"
        ? `ai:${slot.idx}`
        : `uploaded:${slot.idx}`
    );
    onSubmit(identifiers);
  };

  return (
    <div className="space-y-6">
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Review Listing</h2>
        <p className="text-gray-500 mt-1 text-sm">Check and edit everything before sending to the sheet</p>
      </div>

      {/* Image ordering */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Image Order (drag ⠿ to reorder)</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedSlots.map(slotId)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {orderedSlots.map((slot, i) => (
                <SortableImageRow
                  key={slotId(slot)}
                  slot={slot}
                  position={i + 1}
                  preview={getPreview(slot)}
                  onLightbox={setLightboxSrc}
                  onRemove={() => removeSlot(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Revise model photos */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Revise Model Photos</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
            placeholder="e.g. dress has a slit on the left"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-depop"
            disabled={regenerating}
          />
          <button
            onClick={async () => {
              if (!revisionNote.trim() || regenerating) return;
              setRegenerating(true);
              try {
                const newImages = await onRevise(revisionNote.trim());
                setOrderedSlots((prev) => {
                  const nonAI = prev.filter((s) => s.type !== "ai");
                  const newAISlots: ImageSlot[] = newImages.map((_, i) => ({ type: "ai", idx: i }));
                  return [...newAISlots, ...nonAI];
                });
                setRevisionNote("");
              } finally {
                setRegenerating(false);
              }
            }}
            disabled={!revisionNote.trim() || regenerating}
            className="px-4 py-3 bg-depop text-white font-semibold rounded-xl disabled:opacity-40 text-sm"
          >
            {regenerating ? "…" : "Revise"}
          </button>
        </div>
      </div>

      {/* All listing fields */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Listing Details</p>
        <TextAreaField label="Description" value={productInfo.description} onChange={(v) => set("description", v)} rows={8} />
        <SelectField label="Category" value={productInfo.category} onChange={(v) => set("category", v)} options={CATEGORIES} />
        <InputField label="Price (AUD)" value={productInfo.price} onChange={(v) => set("price", v)} type="number" />
        <BrandField value={productInfo.brand} onChange={(v) => set("brand", v)} />
        <SelectField label="Condition" value={productInfo.condition} onChange={(v) => set("condition", v)} options={CONDITIONS} />
        <SelectField label="Size" value={productInfo.size} onChange={(v) => set("size", v)} options={WOMENS_SIZES} />
        <SelectField label="Colour 1" value={productInfo.colour1} onChange={(v) => set("colour1", v)} options={COLOURS} />
        <SelectField label="Colour 2 (optional)" value={productInfo.colour2} onChange={(v) => set("colour2", v)} options={COLOURS} />
        <SelectField label="Source" value={productInfo.source1} onChange={(v) => set("source1", v)} options={SOURCES} />
        <SelectField label="Age (optional)" value={productInfo.age} onChange={(v) => set("age", v)} options={AGES} />
        <SelectField label="Style 1" value={productInfo.style1} onChange={(v) => set("style1", v)} options={STYLES} />
        <SelectField label="Style 2 (optional)" value={productInfo.style2} onChange={(v) => set("style2", v)} options={STYLES} />
        <SelectField label="Style 3 (optional)" value={productInfo.style3} onChange={(v) => set("style3", v)} options={STYLES} />
        <InputField label="Cost of Goods (AUD)" value={productInfo.costPrice ?? ""} onChange={(v) => set("costPrice", v)} type="number" prefix="AUD" />
      </div>

      {submitStatus === "success" && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-medium">
          Added to bulk upload sheet and inventory
        </div>
      )}
      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{submitError}</div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3.5 border-2 border-gray-300 text-gray-700 font-semibold rounded-2xl active:scale-95 transition-transform text-sm">
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitStatus === "uploading" || submitStatus === "submitting" || submitStatus === "success"}
          className="flex-1 py-3.5 bg-depop text-white font-semibold rounded-2xl disabled:opacity-40 active:scale-95 transition-transform text-sm"
        >
          {submitStatus === "uploading" ? "Uploading images…"
            : submitStatus === "submitting" ? "Saving to both sheets…"
            : submitStatus === "success" ? "Done"
            : "Add to Both Sheets"}
        </button>
      </div>

      <div className="pb-8 text-center">
        <button onClick={onReset} className="text-sm text-gray-400 underline underline-offset-2">
          Start a new listing
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [stage, setStage] = useState<Stage>("import");
  const [allImages, setAllImages] = useState<UploadedImage[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [aiImages, setAiImages] = useState<string[]>([]); // base64
  const [error, setError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "uploading" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Refs so async handlers always read the freshest values
  const measurementsRef = useRef<Measurements>({ productType: "" });
  const costPriceRef = useRef<string>("");

  const reset = () => {
    allImages.forEach((img) => URL.revokeObjectURL(img.preview));
    setStage("import");
    setAllImages([]);
    measurementsRef.current = { productType: "" };
    costPriceRef.current = "";
    setSelectedIndices([]);
    setProductInfo(null);
    setAiImages([]);
    setError(null);
    setSubmitStatus("idle");
    setSubmitError(null);
  };

  const handleImportNext = (images: UploadedImage[], m: Measurements, costPrice: string) => {
    setAllImages(images);
    measurementsRef.current = m;
    costPriceRef.current = costPrice;
    setStage("select");
  };

  const handleSelectNext = async (selected: number[]) => {
    setSelectedIndices(selected);
    setStage("generate");
    setError(null);

    try {
      const selectedFiles = selected.map((i) => allImages[i].file);
      const compressed = await Promise.all(selectedFiles.map(compressImage));

      // Analyze
      const formData = new FormData();
      compressed.forEach((f) => formData.append("images", f));
      formData.append("measurements", JSON.stringify(measurementsRef.current));

      const analyzeRes = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!analyzeRes.ok) {
        const body = await analyzeRes.json().catch(() => ({}));
        throw new Error(body.error || `Analysis failed (${analyzeRes.status})`);
      }
      const info: ProductInfo = await analyzeRes.json();
      info.costPrice = costPriceRef.current;
      setProductInfo(info);

      // Generate model images in parallel
      const imageData = await Promise.all(
        compressed.map(async (f) => {
          const buf = await f.arrayBuffer();
          return { base64: Buffer.from(buf).toString("base64"), mimeType: f.type || "image/jpeg" };
        })
      );

      const genRes = await fetch("/api/generate-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: imageData, productInfo: info }),
      });
      if (genRes.ok) {
        const { images: generated } = await genRes.json();
        if (generated?.length) setAiImages(generated);
      }

      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("select");
    }
  };

  const handleRevise = async (note: string): Promise<string[]> => {
    const selectedFiles = selectedIndices.map((i) => allImages[i].file);
    const compressed = await Promise.all(selectedFiles.map(compressImage));
    const imageData = await Promise.all(
      compressed.map(async (f) => {
        const buf = await f.arrayBuffer();
        return { base64: Buffer.from(buf).toString("base64"), mimeType: f.type || "image/jpeg" };
      })
    );
    const genRes = await fetch("/api/generate-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: imageData, productInfo, revisionNote: note }),
    });
    if (!genRes.ok) {
      const body = await genRes.json().catch(() => ({}));
      throw new Error(body.error || "Failed to regenerate model images");
    }
    const { images: generated } = await genRes.json();
    setAiImages(generated);
    return generated as string[];
  };

  const handleSubmit = async (orderedIdentifiers: string[]) => {
    if (!productInfo) return;
    setSubmitStatus("uploading");
    setSubmitError(null);

    try {
      // Build compressed File list in order
      const files = await Promise.all(
        orderedIdentifiers.map(async (id) => {
          const [type, idxStr] = id.split(":");
          const idx = Number(idxStr);
          if (type === "uploaded") {
            return compressImage(allImages[idx].file);
          }
          // AI image — decode base64 to File (already small, no compression needed)
          const byteStr = atob(aiImages[idx]);
          const arr = new Uint8Array(byteStr.length);
          for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
          const blob = new Blob([arr], { type: "image/jpeg" });
          return new File([blob], `ai-model-${idx}.jpg`, { type: "image/jpeg" });
        })
      );

      // Upload one image at a time to stay under Vercel's 4.5 MB body limit
      const urls: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("images", file);
        const uploadRes = await fetch("/api/upload-images", { method: "POST", body: fd });
        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({}));
          throw new Error(body.error || `Image upload failed (${uploadRes.status})`);
        }
        const { urls: batch } = await uploadRes.json();
        urls.push(...batch);
      }

      setSubmitStatus("submitting");
      const submitRes = await fetch("/api/add-to-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productInfo, imageUrls: urls }),
      });
      if (!submitRes.ok) {
        const body = await submitRes.json().catch(() => ({}));
        throw new Error(body.error || `Failed to write to sheet (${submitRes.status})`);
      }

      setSubmitStatus("success");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
      setSubmitStatus("error");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4 flex items-center">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-depop rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900">Depop Helper</span>
        </div>
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}

        {stage === "import" && (
          <StageImport onNext={handleImportNext} />
        )}
        {stage === "select" && (
          <StageSelect
            images={allImages}
            onNext={handleSelectNext}
            onBack={() => setStage("import")}
          />
        )}
        {stage === "generate" && <StageGenerate />}
        {stage === "review" && productInfo && (
          <StageReview
            productInfo={productInfo}
            allImages={allImages}
            aiImages={aiImages}
            onUpdate={setProductInfo}
            onSubmit={handleSubmit}
            onBack={() => setStage("select")}
            onRevise={handleRevise}
            onReset={reset}
            submitStatus={submitStatus}
            submitError={submitError}
          />
        )}
      </div>
    </main>
  );
}
