import { supabase } from "@/lib/supabase";

const BUCKET = "portfolio-media";
const MAX_BYTES = 30 * 1024 * 1024;

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime")) return "mov";
  return "jpg";
}

export async function uploadPortfolioMedia(
  accountId: string,
  file: File,
  folder: "logo" | "hero" | "about" | "items",
): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error("File exceeds 30 MB limit.");
  }
  const ext = extFromMime(file.type || "");
  const path = `${accountId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function detectMediaTypeFromUrlOrFile(
  file: File | null,
  url: string,
): "image" | "video" | null {
  if (file) {
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("image/")) return "image";
  }
  const u = url.trim().toLowerCase();
  if (!u) return null;
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(u) || u.includes("youtube") || u.includes("vimeo")) {
    return "video";
  }
  return "image";
}
