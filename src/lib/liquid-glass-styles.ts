import type { CSSProperties } from "react";

/** Frosted glass panel — matches hero-section controls */
export const liquidGlassPanelStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.06)",
  backdropFilter: "blur(18px) saturate(120%)",
  WebkitBackdropFilter: "blur(18px) saturate(120%)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  boxShadow:
    "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 rgba(255, 255, 255, 0.04)",
};

export const liquidGlassRailStyle: CSSProperties = {
  ...liquidGlassPanelStyle,
  borderRadius: 28,
};
