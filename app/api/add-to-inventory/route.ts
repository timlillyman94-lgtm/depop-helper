import { NextRequest, NextResponse } from "next/server";
import { appendProductRow } from "@/lib/sheets";
import { ProductInfo } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productInfo, costPrice } = body as {
      productInfo: ProductInfo;
      costPrice: string;
    };

    if (!productInfo) {
      return NextResponse.json({ error: "Missing product info" }, { status: 400 });
    }

    await appendProductRow({
      title: productInfo.title,
      costPrice: costPrice?.trim() || "",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add to inventory";
    console.error("add-to-inventory error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
