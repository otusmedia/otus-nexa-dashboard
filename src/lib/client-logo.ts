import type { AppTheme } from "@/lib/theme-preference";
import type { Client } from "@/types";

export type ClientLogoFields = Pick<Client, "logoUrl" | "logoLightUrl">;

/** Resolve which logo asset to show for the active UI theme (with fallback). */
export function resolveClientLogoUrl(
  client: ClientLogoFields,
  theme: AppTheme,
): string | null {
  const dark = client.logoUrl?.trim() || null;
  const light = client.logoLightUrl?.trim() || null;
  if (theme === "light") return light ?? dark;
  return dark ?? light;
}
