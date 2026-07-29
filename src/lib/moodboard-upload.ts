import { supabase } from "@/lib/supabase";

const BUCKET = "moodboard-media";
const MAX_BYTES = 30 * 1024 * 1024;

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

export async function uploadMoodboardMedia(
  accountId: string,
  file: File,
  folder: "logo" | "items",
  moodboardId?: string,
): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error("File exceeds 30 MB limit.");
  }
  const ext = extFromMime(file.type || "");
  const scope = moodboardId ? `${accountId}/${moodboardId}` : accountId;
  const path = `${scope}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function readImageNaturalSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 0;
      const height = img.naturalHeight || 0;
      URL.revokeObjectURL(url);
      resolve(width > 0 && height > 0 ? { width, height } : null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
