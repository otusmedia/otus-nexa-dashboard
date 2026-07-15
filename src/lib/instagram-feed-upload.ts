import { supabase } from "@/lib/supabase";

const BUCKET = "instagram-feed";

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

/** Upload a data-URL (or pass through http(s) URLs) into the instagram-feed bucket. */
export async function resolveInstagramFeedImageUrl(
  imageUrl: string,
  clientSlug: string,
  postId: string,
): Promise<{ url: string | null; error?: string }> {
  const trimmed = imageUrl.trim();
  if (!trimmed) return { url: null, error: "Image is required." };

  if (/^https?:\/\//i.test(trimmed)) {
    return { url: trimmed };
  }

  if (!trimmed.startsWith("data:")) {
    return { url: trimmed };
  }

  const slug = clientSlug.trim().toLowerCase();
  if (!slug) return { url: null, error: "Select a client before saving Instagram posts." };

  let blob: Blob;
  try {
    const res = await fetch(trimmed);
    blob = await res.blob();
  } catch {
    return { url: null, error: "Could not read image data." };
  }

  if (!blob.type.startsWith("image/")) {
    return { url: null, error: "Invalid image file." };
  }

  const ext = extFromMime(blob.type);
  const path = `${slug}/${postId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType: blob.type || undefined,
  });

  if (error) {
    console.error("[instagram-feed] storage upload:", error.message);
    return { url: null, error: error.message };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
