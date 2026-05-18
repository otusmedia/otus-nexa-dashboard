import { supabase } from "@/lib/supabase";

const BUCKET = "client-assets";

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

export async function uploadClientHeroImage(clientSlug: string, file: File): Promise<{ url: string | null; error?: string }> {
  const slug = clientSlug.trim().toLowerCase();
  if (!slug) return { url: null, error: "Client slug is required." };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) {
    return { url: null, error: "Use JPG, PNG, or WebP for the hero image." };
  }

  const path = `${slug}/hero.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || undefined,
  });

  if (error) {
    console.error("[client-assets] hero upload:", error.message);
    return { url: null, error: error.message };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
