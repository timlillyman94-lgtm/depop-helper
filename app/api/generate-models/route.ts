import { NextRequest, NextResponse } from "next/server";
import { generateModelImages, ProductInfo } from "@/lib/gemini";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { images, productInfo } = body as {
      images: { base64: string; mimeType: string }[];
      productInfo: ProductInfo;
    };

    if (!images?.length || !productInfo) {
      return NextResponse.json({ error: "Missing images or productInfo" }, { status: 400 });
    }

    const generatedImages = await generateModelImages(images, productInfo);

    if (!generatedImages.length) {
      return NextResponse.json({ error: "No images generated" }, { status: 500 });
    }

    return NextResponse.json({ images: generatedImages });
  } catch (err) {
    console.error("generate-models error:", err);
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}
