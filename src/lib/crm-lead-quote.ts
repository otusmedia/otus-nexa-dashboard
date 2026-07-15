import { supabase } from "@/lib/supabase";

const BUCKET = "crm-lead-files";

export async function uploadCrmLeadQuote(
  clientSlug: string,
  leadKey: string,
  file: File,
): Promise<{ ok: true; url: string; name: string } | { ok: false; error: string }> {
  const safeName = file.name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120) || "quote";
  const ext = (safeName.split(".").pop() || "pdf").toLowerCase();
  const path = `${clientSlug}/${leadKey}/${Date.now()}-${safeName.endsWith(`.${ext}`) ? safeName : `${safeName}.${ext}`}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: urlData.publicUrl, name: file.name };
}
