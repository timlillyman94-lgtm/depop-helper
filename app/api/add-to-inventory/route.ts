import { NextRequest, NextResponse } from "next/server";
import { appendBulkUploadRow, appendInventoryRow } from "@/lib/sheets";
import { ProductInfo } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productInfo, imageUrls } = body as {
      productInfo: ProductInfo;
      imageUrls: string[];
    };

    if (!productInfo) {
      return NextResponse.json({ error: "Missing product info" }, { status: 400 });
    }

    await Promise.all([
      appendBulkUploadRow(productInfo, imageUrls ?? []),
      appendInventoryRow({
        title: productInfo.title,
        costPrice: productInfo.costPrice ?? "",
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add to sheet";
    console.error("add-to-inventory error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
