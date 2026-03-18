import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;
const SHEET_NAME = "Depop Sales";

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function appendProductRow(data: {
  title: string;
  costPrice: string;
}) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // Find the last row that actually has an Item Description (col C),
  // so we insert right after the data — not after blank rows or the summary row.
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!C:C`,
  });
  const colC = readRes.data.values ?? [];
  let lastDataRow = 1; // at minimum, row 1 (header)
  for (let i = 0; i < colC.length; i++) {
    if (colC[i]?.[0]) lastDataRow = i + 1; // 1-indexed
  }
  const insertRow = lastDataRow + 1;

  // Write Item Description (col C) and Original Cost Price (col J).
  // Cols A, B, D-I, K-M are left blank — filled in manually when the item sells.
  const row = [
    "",           // A: Sale Date
    "",           // B: Buyer
    data.title,   // C: Item Description
    "",           // D: Final Item Price
    "",           // E: Shipping
    "",           // F: Payment Fee
    "",           // G: Depop Fee
    "",           // H: Boosting Fee
    "",           // I: Payout
    data.costPrice || "", // J: Original Cost Price
    "",           // K: Actual Postage Fee
    "",           // L: Postage Bag/Box Cost
    "",           // M: Profit
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${insertRow}:M${insertRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}
