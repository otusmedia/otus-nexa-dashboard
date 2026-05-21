import { supabase } from "@/lib/supabase";

const BUCKET = "avatars";

export async function uploadProfileAvatar(userId: string, file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const cacheBust = `${urlData.publicUrl}${urlData.publicUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
  return { ok: true, url: cacheBust };
}
