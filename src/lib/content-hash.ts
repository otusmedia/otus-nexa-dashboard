/** Stable hash for translation cache keys (djb2). */
export function hashContent(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 33) ^ text.charCodeAt(i);
  }
  return `h${(h >>> 0).toString(16)}`;
}
