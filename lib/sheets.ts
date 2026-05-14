import { google } from "googleapis";
import { ProductInfo } from "./gemini";
import {
  LOCATION,
  DEFAULT_SOURCE,
  DOMESTIC_SHIPPING,
  BULK_UPLOAD_TAB,
} from "./depop-options";

const INVENTORY_SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const BULK_SHEET_ID = process.env.BULK_UPLOAD_SHEET_ID!;

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function appendBulkUploadRow(
  productInfo: ProductInfo,
  imageUrls: string[]
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // Find last data row in the bulk upload tab (data starts at row 4, col A = Description)
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: BULK_SHEET_ID,
    range: `${BULK_UPLOAD_TAB}!A:A`,
  });
  const colA = readRes.data.values ?? [];
  let lastDataRow = 3; // row 3 is the instructions row (1-indexed), data from row 4
  for (let i = 3; i < colA.length; i++) {
    if (colA[i]?.[0]) lastDataRow = i + 1;
  }
  const insertRow = lastDataRow + 1;

  // Pad or trim image URLs to slots 1–8
  const urls = [...imageUrls, "", "", "", "", "", "", "", ""].slice(0, 8);

  // 26 columns matching the template exactly
  const row = [
    productInfo.description,                                    // A: Description
    productInfo.category,                                       // B: Category
    productInfo.price ? Number(productInfo.price) : "",          // C: Price
    productInfo.brand,                                          // D: Brand
    productInfo.condition,                                      // E: Condition
    productInfo.size,                                           // F: Size
    productInfo.colour1,                                        // G: Colour 1
    productInfo.colour2 || "",                                  // H: Colour 2
    productInfo.source1 || DEFAULT_SOURCE,                      // I: Source 1
    productInfo.source2 || "",                                  // J: Source 2
    productInfo.age || "",                                      // K: Age
    productInfo.style1 || "",                                   // L: Style 1
    productInfo.style2 || "",                                   // M: Style 2
    productInfo.style3 || "",                                   // N: Style 3
    LOCATION,                                                   // O: Location
    urls[0], urls[1], urls[2], urls[3],                        // P–S: Picture Hero + 2–4
    urls[4], urls[5], urls[6], urls[7],                        // T–W: Picture 5–8
    DOMESTIC_SHIPPING,                                          // X: Domestic Shipping
    "",                                                         // Y: International Shipping
    "",                                                         // Z: SKU
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: BULK_SHEET_ID,
    range: `${BULK_UPLOAD_TAB}!A${insertRow}:Z${insertRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

export async function appendInventoryRow(data: {
  title: string;
  costPrice: string;
}): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_SHEET_ID,
    range: "Depop Sales!C:C",
  });
  const colC = readRes.data.values ?? [];
  let lastDataRow = 1;
  for (let i = 0; i < colC.length; i++) {
    if (colC[i]?.[0]) lastDataRow = i + 1;
  }
  const insertRow = lastDataRow + 1;

  const row = [
    "",                       // A: Sale Date
    "",                       // B: Buyer
    data.title,               // C: Item Description
    "",                       // D: Final Item Price
    "",                       // E: Shipping
    "",                       // F: Payment Fee
    "",                       // G: Depop Fee
    "",                       // H: Boosting Fee
    "",                       // I: Payout
    data.costPrice || "",     // J: Original Cost Price
    "",                       // K: Actual Postage Fee
    "",                       // L: Postage Bag/Box Cost
    "",                       // M: Profit
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: INVENTORY_SHEET_ID,
    range: `Depop Sales!A${insertRow}:M${insertRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}
