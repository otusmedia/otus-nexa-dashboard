"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

type Props = {
  lt: (key: string) => string;
  className?: string;
};

export function SidebarThemeSwitch({ lt, className }: Props) {
  const { theme, setTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <div className={cn("flex items-center justify-between gap-3 px-1", className)}>
      <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">
        {lt("Theme")}
      </span>
      <div
        className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-0.5"
        role="group"
        aria-label={lt("Theme")}
      >
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full transition",
            !isLight
              ? "bg-[var(--text)] text-[var(--background)]"
              : "text-[var(--muted)] hover:text-[var(--text)]",
          )}
          aria-pressed={!isLight}
          aria-label={lt("Dark theme")}
          title={lt("Dark theme")}
        >
          <Moon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full transition",
            isLight
              ? "bg-[var(--text)] text-[var(--background)]"
              : "text-[var(--muted)] hover:text-[var(--text)]",
          )}
          aria-pressed={isLight}
          aria-label={lt("Light theme")}
          title={lt("Light theme")}
        >
          <Sun className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
