import { google } from "googleapis";
import { Readable } from "stream";

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
}

export async function uploadImageToDrive(
  base64Data: string,
  mimeType: string,
  filename: string
): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  const buffer = Buffer.from(base64Data, "base64");
  // Wrap in array so the stream emits the whole buffer as one binary chunk,
  // not individual byte values (which is what iterating a Buffer produces).
  const stream = Readable.from([buffer]);

  const uploadRes = await drive.files.create({
    requestBody: {
      name: filename,
      mimeType,
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id",
  });

  const fileId = uploadRes.data.id!;

  // Make publicly readable
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}
