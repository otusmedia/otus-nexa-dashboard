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

const sizeClass: Record<NonNullable<ClientLogoProps["size"]>, string> = {
  xs: "h-4 max-w-[80px]",
  sm: "h-5 max-w-[96px]",
  md: "h-8 max-w-[128px]",
  /** Same footprint as the Nexa/Otus mark at the top of the sidebar. */
  sidebar: "h-[36.8px] max-w-[93.15px]",
};

export function ClientLogo({ client, size = "sm", className, theme: themeOverride }: ClientLogoProps) {
  const { theme: activeTheme } = useTheme();
  const theme = themeOverride ?? activeTheme;
  const src = resolveClientLogoUrl(client, theme);
  if (!src) return null;

  return (
    <img
      src={src}
      alt={client.name}
      className={cn(sizeClass[size], "w-auto shrink-0 object-contain object-left", className)}
    />
  );
}
