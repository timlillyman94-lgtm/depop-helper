import { NextRequest, NextResponse } from "next/server";
import { analyzeProduct } from "@/lib/gemini";
import { Measurements } from "@/lib/gemini";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("images") as File[];
    const measurementsRaw = formData.get("measurements") as string | null;

    if (!files.length) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    const measurements: Measurements = measurementsRaw
      ? JSON.parse(measurementsRaw)
      : { productType: "" };

    const images = await Promise.all(
      files.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        return { base64, mimeType: file.type || "image/jpeg" };
      })
    );

    const productInfo = await analyzeProduct(images, measurements);
    return NextResponse.json(productInfo);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("analyze error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
