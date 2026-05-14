import { GoogleGenerativeAI } from "@google/generative-ai";
import { CATEGORIES, CONDITIONS, COLOURS, SOURCES, AGES, STYLES, WOMENS_SIZES } from "./depop-options";
import brandsRaw from "./brands.json";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const brands = brandsRaw as string[];

export interface Measurements {
  productType: "tops" | "dresses" | "pants" | "skirts" | "";
  pitToPit?: string;
  waist?: string;
  length?: string;
  inseam?: string;
}

export interface ProductInfo {
  // Display title (not a sheet column)
  title: string;

  // Sheet columns 1–14
  description: string;
  category: string;
  price: string;
  brand: string;
  condition: string;
  size: string;
  colour1: string;
  colour2: string;
  source1: string;
  source2: string;
  age: string;
  style1: string;
  style2: string;
  style3: string;

  // Entered by user before AI runs
  measurements: Measurements;
  costPrice: string;
}

function fileToGenerativePart(base64Data: string, mimeType: string) {
  return { inlineData: { data: base64Data, mimeType } };
}

function buildMeasurementsText(m: Measurements): string {
  const lines: string[] = [];

  const add = (label: string, val: string | undefined) => {
    if (val && val.trim()) lines.push(`${label}: ${val.trim()}cm`);
  };

  if (m.productType === "tops") {
    add("Pit to pit", m.pitToPit);
    add("Length", m.length);
  } else if (m.productType === "dresses") {
    add("Pit to pit", m.pitToPit);
    add("Waist", m.waist);
    add("Length", m.length);
  } else if (m.productType === "pants") {
    add("Waist", m.waist);
    add("Inseam", m.inseam);
  } else if (m.productType === "skirts") {
    add("Waist", m.waist);
    add("Length", m.length);
  }

  if (!lines.length) return "";
  return "\n\nMeasurements (flat lay)\n" + lines.join("\n");
}

function matchBrand(rawBrand: string): string {
  if (!rawBrand || rawBrand.toLowerCase() === "no brand" || rawBrand.toLowerCase() === "unknown") {
    return "";
  }
  const needle = rawBrand.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Exact slug match first
  const exact = brands.find((b) => {
    const slug = b.match(/\(([^)]+)\)$/)?.[1] ?? "";
    return slug.toLowerCase().replace(/[^a-z0-9]/g, "") === needle;
  });
  if (exact) return exact;
  // Display name match
  const nameMatch = brands.find((b) => {
    const name = b.replace(/\s*\([^)]+\)$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return name === needle;
  });
  if (nameMatch) return nameMatch;
  // Partial match
  const partial = brands.find((b) => {
    const name = b.replace(/\s*\([^)]+\)$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return name.includes(needle) || needle.includes(name);
  });
  return partial ?? rawBrand;
}

const AI_DISCLAIMER =
  "\n\nThe first image is AI-generated to showcase how this piece wears. As AI can occasionally vary in minor details, please ensure you review the actual garment photos included in the listing before purchasing";

export async function analyzeProduct(
  images: { base64: string; mimeType: string }[],
  measurements: Measurements
): Promise<ProductInfo> {
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const imageParts = images.map((img) => fileToGenerativePart(img.base64, img.mimeType));

  const prompt = `Analyze this clothing item and return ONLY a valid JSON object (no markdown, no code blocks). All dropdown fields MUST use exact values from the lists provided.

Return this exact structure:
{
  "title": "Short display title e.g. Black Zara Midi Dress (max 60 chars)",
  "description": "3-4 sentence Depop listing description in conversational, engaging tone. Mention key features: color, fit, fabric feel, any special details. Do NOT include measurements or hashtags here — those are added separately. Max 800 chars.",
  "category": "Must be one of the CATEGORIES list",
  "price": "Suggested AUD sell price as a number only e.g. 18 — based on brand prestige and condition",
  "brand": "Brand name as plain text exactly as it appears on labels/tags, or empty string if no brand",
  "condition": "Must be one of the CONDITIONS list",
  "size": "Size label visible on the garment tag. Return ONLY one exact value from this list — never add a country prefix like 'AU' or 'AUS': ${WOMENS_SIZES.join(", ")}",
  "colour1": "Must be one of the COLOURS list",
  "colour2": "Secondary colour if clearly present, must be from COLOURS list, or empty string",
  "source1": "Must be one of the SOURCES list — almost always Preloved (preloved)",
  "source2": "Optional secondary source from SOURCES list, or empty string",
  "age": "Best guess era from AGES list, or empty string if unclear",
  "style1": "Must be one of the STYLES list",
  "style2": "Optional second style from STYLES list, or empty string",
  "style3": "Optional third style from STYLES list, or empty string"
}

CATEGORIES (use exact string):
${CATEGORIES.join("\n")}

CONDITIONS (use exact string):
${CONDITIONS.join(", ")}

COLOURS (use exact string):
${COLOURS.join(", ")}

SOURCES (use exact string):
${SOURCES.join(", ")}

AGES (use exact string):
${AGES.join(", ")}

STYLES (use exact string):
${STYLES.join(", ")}`;

  const result = await model.generateContent([...imageParts, prompt]);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const raw = JSON.parse(cleaned);

  // Resolve brand to exact dropdown value; fall back to "" if not in brands list
  const resolvedBrand = matchBrand(raw.brand ?? "");
  const validatedBrand = resolvedBrand.includes("(") ? resolvedBrand : "";

  // Build full description with measurements + hashtags + disclaimer
  const measurementsText = buildMeasurementsText(measurements);

  // Generate 5 hashtags from the listing data
  const hashtagsPrompt = `Based on this clothing item — ${raw.title}, ${raw.category}, styles: ${[raw.style1, raw.style2, raw.style3].filter(Boolean).join(", ")} — give exactly 5 relevant Depop hashtags without the # symbol, as a JSON array of strings. No explanation.`;
  const hashModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  const hashResult = await hashModel.generateContent(hashtagsPrompt);
  const hashText = hashResult.response.text().trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  let tags: string[] = [];
  try { tags = JSON.parse(hashText); } catch { tags = []; }
  const hashtagLine = tags.length ? "\n\n" + tags.map((t) => `#${t}`).join(" ") : "";

  const fullDescription = raw.title + "\n\n" + raw.description + measurementsText + hashtagLine + AI_DISCLAIMER;

  return {
    title: raw.title ?? "",
    description: fullDescription,
    category: CATEGORIES.includes(raw.category) ? raw.category : "",
    price: String(raw.price ?? ""),
    brand: validatedBrand,
    condition: CONDITIONS.includes(raw.condition) ? raw.condition : "",
    size: (() => { const s = (raw.size ?? "").replace(/^AU[S]?\s*/i, "").trim(); return WOMENS_SIZES.includes(s) ? s : s; })(),
    colour1: COLOURS.includes(raw.colour1) ? raw.colour1 : "",
    colour2: COLOURS.includes(raw.colour2) ? raw.colour2 : "",
    source1: SOURCES.includes(raw.source1) ? raw.source1 : "Preloved (preloved)",
    source2: SOURCES.includes(raw.source2) ? raw.source2 : "",
    age: AGES.includes(raw.age) ? raw.age : "",
    style1: STYLES.includes(raw.style1) ? raw.style1 : "",
    style2: STYLES.includes(raw.style2) ? raw.style2 : "",
    style3: STYLES.includes(raw.style3) ? raw.style3 : "",
    measurements,
    costPrice: "",
  };
}

const MODEL_POSE_VARIATIONS = [
  "standing upright, facing the camera directly, confident pose",
  "three-quarter turn to the left, looking slightly off-camera",
  "relaxed standing pose, one hand on hip, slight smile",
];

export async function generateModelImages(
  images: { base64: string; mimeType: string }[],
  productInfo: ProductInfo,
  revisionNote?: string
): Promise<string[]> {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-image-preview",
  });

  const imageParts = images.map((img) => fileToGenerativePart(img.base64, img.mimeType));
  const baseDescription = `${productInfo.colour1.replace(/\s*\([^)]+\)/, "")} ${productInfo.brand.replace(/\s*\([^)]+\)/, "")} ${productInfo.title}`.trim();

  const generateOne = async (pose: string): Promise<string | null> => {
    const revision = revisionNote
      ? ` Important correction: ${revisionNote}. Make sure this detail is accurately shown.`
      : "";
    // Extra zoom-out instruction so the square crop doesn't cut off feet/head
    const prompt = `Generate a professional fashion photograph of a model wearing the ${baseDescription} shown in the reference image. CRITICAL FRAMING: shoot wide — the model's full body from head to toe must be visible with clear empty space above the head and below the feet so the image can be square-cropped without cutting anything off. The model is ${pose}. Plain white studio background. Soft, even product photography lighting. Portrait orientation.${revision}`;

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [...imageParts, { text: prompt }] }],
        generationConfig: {
          // @ts-expect-error responseModalities/imageConfig not yet in SDK types
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { imageSize: "1K" },
        },
      });

      const parts = result.response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        const p = part as { inlineData?: { mimeType: string; data: string } };
        if (p.inlineData?.mimeType?.startsWith("image/")) {
          return p.inlineData.data;
        }
      }
      console.warn("generateOne: no image part in response");
    } catch (e) {
      console.error("generateOne error:", e instanceof Error ? e.message : e);
    }
    return null;
  };

  const results = await Promise.all(MODEL_POSE_VARIATIONS.map((pose) => generateOne(pose)));
  return results.filter((r): r is string => r !== null);
}
