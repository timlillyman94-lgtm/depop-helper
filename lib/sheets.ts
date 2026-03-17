import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;

const HEADERS = [
  "Date", "Title", "Brand", "Colour", "Type", "Size",
  "Condition", "Material", "Style", "Description",
  "Cost Price (AUD)", "Suggested Price", "Tags",
];

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function appendProductRow(data: {
  title: string;
  brand: string;
  color: string;
  clothingType: string;
  size: string;
  condition: string;
  material: string;
  style: string;
  description: string;
  costPrice: string;
  suggestedPrice: string;
  tags: string[];
}) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // Add header row if sheet is empty
  const check = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "A1:A1",
  });

  if (!check.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "A1",
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
  }

  const date = new Date().toLocaleDateString("en-AU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "A:M",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        date,
        data.title,
        data.brand,
        data.color,
        data.clothingType,
        data.size,
        data.condition,
        data.material,
        data.style,
        data.description,
        data.costPrice,
        data.suggestedPrice,
        data.tags.join(", "),
      ]],
    },
  });
}
