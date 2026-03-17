import { NextRequest, NextResponse } from "next/server";
import { generateModelImages, ProductInfo } from "@/lib/gemini";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { images, productInfo, revisionNote } = body as {
      images: { base64: string; mimeType: string }[];
      productInfo: ProductInfo;
      revisionNote?: string;
    };

    if (!images?.length || !productInfo) {
      return NextResponse.json({ error: "Missing images or productInfo" }, { status: 400 });
    }

    const generatedImages = await generateModelImages(images, productInfo, revisionNote);

    if (!generatedImages.length) {
      return NextResponse.json({ error: "No images generated" }, { status: 500 });
    }

    return NextResponse.json({ images: generatedImages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    console.error("generate-models error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
