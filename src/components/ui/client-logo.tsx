"use client";

import { useTheme } from "@/components/providers/theme-provider";
import { resolveClientLogoUrl } from "@/lib/client-logo";
import type { AppTheme } from "@/lib/theme-preference";
import type { Client } from "@/types";
import { cn } from "@/lib/utils";

type ClientLogoProps = {
  client: Pick<Client, "name" | "logoUrl" | "logoLightUrl" | "primaryColor">;
  size?: "xs" | "sm" | "md" | "sidebar";
  className?: string;
  /** Force a theme asset (settings previews). Defaults to active UI theme. */
  theme?: AppTheme;
};

/** Matches the system mark (`/frame-1.svg`) in the sidebar header. */
export const SIDEBAR_BRAND_LOGO_HEIGHT_PX = 36.8;
export const SIDEBAR_BRAND_LOGO_MAX_WIDTH_PX = 87;

const sizeClass: Record<NonNullable<ClientLogoProps["size"]>, string> = {
  xs: "h-4 w-auto max-w-[120px]",
  sm: "h-5 w-auto max-w-[144px]",
  md: "h-8 w-auto max-w-[160px]",
  sidebar: "h-[36.8px] w-auto max-w-[87px]",
};

export function ClientLogo({ client, size = "sm", className, theme: themeOverride }: ClientLogoProps) {
  const { theme: activeTheme } = useTheme();
  const theme = themeOverride ?? activeTheme;
  const src = resolveClientLogoUrl(client, theme);
  if (!src) return null;

  const isSidebar = size === "sidebar";

  return (
    <img
      src={src}
      alt={client.name}
      style={
        isSidebar
          ? {
              height: SIDEBAR_BRAND_LOGO_HEIGHT_PX,
              width: "auto",
              maxWidth: SIDEBAR_BRAND_LOGO_MAX_WIDTH_PX,
              maxHeight: SIDEBAR_BRAND_LOGO_HEIGHT_PX,
              objectFit: "contain",
              objectPosition: "left center",
            }
          : undefined
      }
      className={cn(sizeClass[size], "w-auto shrink-0 object-contain object-left", className)}
    />
  );
}
