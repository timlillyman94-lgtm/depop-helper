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

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:M`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}
