import { NextRequest, NextResponse } from "next/server";
import { analyzeProduct } from "@/lib/gemini";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("images") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    const images = await Promise.all(
      files.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        return { base64, mimeType: file.type || "image/jpeg" };
      })
    );

    const productInfo = await analyzeProduct(images);
    return NextResponse.json(productInfo);
  } catch (err) {
    console.error("analyze error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
