import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export async function uploadImage(base64Data: string, mimeType: string): Promise<string> {
  const result = await cloudinary.uploader.upload(
    `data:${mimeType};base64,${base64Data}`,
    { folder: "depop-listings" }
  );
  return result.secure_url;
}
