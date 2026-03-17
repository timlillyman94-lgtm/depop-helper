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
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
  return JSON.parse(cleaned) as ProductInfo;
}

const MODEL_POSE_VARIATIONS = [
  "standing upright, facing camera directly, confident pose",
  "three-quarter turn, looking slightly off-camera",
  "relaxed standing pose, one hand on hip",
  "walking pose, natural movement",
  "standing with slight lean, casual stance",
];

export async function generateModelImages(
  images: { base64: string; mimeType: string }[],
  productInfo: ProductInfo
): Promise<string[]> {
  const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-image-preview",
  });

  const imageParts = images.map((img) =>
    fileToGenerativePart(img.base64, img.mimeType)
  );

  const baseDescription = `${productInfo.color} ${productInfo.brand} ${productInfo.clothingType}`;

  const generateOne = async (pose: string): Promise<string | null> => {
    const prompt = `Generate a professional fashion photograph of a virtual model wearing the ${baseDescription} shown in the reference image. The model is ${pose}. Clean minimal white or light grey studio background. Professional product photography lighting. Editorial fashion style. The clothing should be clearly visible and well-lit.`;

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [...imageParts, { text: prompt }] }],
        generationConfig: {
          // @ts-expect-error responseModalities is not in the types yet
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const parts = result.response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("image/")) {
          return part.inlineData.data;
        }
      }
    } catch {
      // individual variation failed — return null, caller filters
    }
    return null;
  };

  const results = await Promise.all(
    MODEL_POSE_VARIATIONS.map((pose) => generateOne(pose))
  );

  return results.filter((r): r is string => r !== null);
}
