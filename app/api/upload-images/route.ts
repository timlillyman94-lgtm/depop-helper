import { NextRequest, NextResponse } from "next/server";
import { uploadImageToDrive } from "@/lib/drive";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("images") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    const urls = await Promise.all(
      files.map(async (file, i) => {
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        const ext = file.type === "image/png" ? "png" : "jpg";
        const filename = `depop-${Date.now()}-${i}.${ext}`;
        return uploadImageToDrive(base64, file.type || "image/jpeg", filename);
      })
    );

    return NextResponse.json({ urls });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("upload-images error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
