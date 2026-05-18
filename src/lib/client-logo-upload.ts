/** Read an SVG file into a data URL suitable for `clients.logo_url`. */
export async function readSvgFileAsDataUrl(file: File): Promise<string | null> {
  const isSvg =
    file.type === "image/svg+xml" ||
    file.name.toLowerCase().endsWith(".svg");
  if (!isSvg) return null;

  const text = await file.text();
  const trimmed = text.trim();
  if (!trimmed.toLowerCase().includes("<svg")) return null;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`;
}
