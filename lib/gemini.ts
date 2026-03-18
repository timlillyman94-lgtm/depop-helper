import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ProductInfo {
  title: string;
  brand: string;
  color: string;
  clothingType: string;
  size: string;
  condition: string;
  material: string;
  style: string;
  description: string;
  suggestedPrice: string;
  tags: string[];
}

function fileToGenerativePart(base64Data: string, mimeType: string) {
  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
}

export async function analyzeProduct(
  images: { base64: string; mimeType: string }[]
): Promise<ProductInfo> {
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const imageParts = images.map((img) =>
    fileToGenerativePart(img.base64, img.mimeType)
  );

  const prompt = `Analyze this clothing item and return ONLY a valid JSON object with these exact fields (no markdown, no code blocks, just raw JSON):
{
  "title": "[Color] [Brand] [Clothing Type] - max 50 chars, e.g. Black Zara Midi Dress",
  "brand": "brand name visible on labels/tags, or No Brand",
  "color": "primary color or colors",
  "clothingType": "specific clothing type e.g. Midi Dress, Oversized Hoodie, Cargo Pants",
  "size": "size label if visible, or Check measurements",
  "condition": "one of: New with tags, Like new, Good, Fair",
  "material": "best guess from visual texture e.g. Cotton blend, Polyester, Denim",
  "style": "2-3 comma-separated style descriptors e.g. Casual, Minimalist, Y2K",
  "description": "3-4 sentence Depop listing description in conversational tone, mention key features like color, fit, any special details",
  "suggestedPrice": "AUD price range e.g. $25-$35, based on brand prestige and condition",
  "tags": ["array", "of", "5", "relevant", "depop", "hashtags", "without", "hash", "symbol"]
}`;

  const result = await model.generateContent([...imageParts, prompt]);
  const text = result.response.text().trim();

  // Strip any markdown code blocks if present
  const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const info = JSON.parse(cleaned) as ProductInfo;
  info.description += getMeasurementsTemplate(info.clothingType) + AI_DISCLAIMER;
  return info;
}

const AI_DISCLAIMER =
  "\n\nThe first image is AI-generated to showcase how this piece wears. As AI can occasionally vary in minor details, please ensure you review the actual garment photos included in the listing before purchasing";

function getMeasurementsTemplate(clothingType: string): string {
  const t = clothingType.toLowerCase();
  if (/short/.test(t)) {
    return "\n\nMeasurements (flat lay)\nWaist: \nInseam: ";
  }
  if (/dress|skirt|midi|mini|maxi|jumpsuit|romper/.test(t)) {
    return "\n\nMeasurements (flat lay)\nPit to pit: \nWaist: \nLength: ";
  }
  if (/shirt|tee|top|blouse|hoodie|sweatshirt|jumper|jacket|coat|cardigan|crop|tank|vest|knit|sweater/.test(t)) {
    return "\n\nMeasurements (flat lay)\nPit to pit: \nLength: ";
  }
  if (/pant|jean|trouser|cargo|legging/.test(t)) {
    return "\n\nMeasurements (flat lay)\nWaist: \nInseam: ";
  }
  // Fallback for anything unrecognised
  return "\n\nMeasurements (flat lay)\nPit to pit: \nLength: ";
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

  const imageParts = images.map((img) =>
    fileToGenerativePart(img.base64, img.mimeType)
  );

  const baseDescription = `${productInfo.color} ${productInfo.brand} ${productInfo.clothingType}`;

  const generateOne = async (pose: string): Promise<string | null> => {
    const revision = revisionNote
      ? ` Important correction: ${revisionNote}. Make sure this detail is accurately shown.`
      : "";
    const prompt = `Generate a professional fashion photograph of a model wearing the ${baseDescription} shown in the reference image. CRITICAL: This must be a full-body shot — the model's entire body from head to toe must be fully visible, with no cropping at the legs or feet. The model is ${pose}. Plain white studio background. Soft, even product photography lighting. Portrait orientation. The complete outfit must be clearly visible.${revision}`;

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
        // inlineData contains the image bytes
        if ((part as { inlineData?: { mimeType: string; data: string } }).inlineData?.mimeType?.startsWith("image/")) {
          return (part as { inlineData: { data: string } }).inlineData.data;
        }
      }
      // Log if no image came back so we can see why
      console.warn("generateOne: no image part in response. Parts:", JSON.stringify(parts.map(p => Object.keys(p))));
    } catch (e) {
      console.error("generateOne error:", e instanceof Error ? e.message : e);
    }
    return null;
  };

  const results = await Promise.all(
    MODEL_POSE_VARIATIONS.map((pose) => generateOne(pose))
  );

  return results.filter((r): r is string => r !== null);
}
