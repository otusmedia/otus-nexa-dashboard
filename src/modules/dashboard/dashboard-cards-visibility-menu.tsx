"use client";

import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import {
  DASHBOARD_CARD_KEYS,
  DASHBOARD_CARD_LABELS,
  type ClientDashboardCards,
  type DashboardCardKey,
} from "@/lib/client-dashboard-cards";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";

type Props = {
  value: ClientDashboardCards;
  saving?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onChange: (next: ClientDashboardCards) => void | Promise<void>;
};

export function DashboardCardsVisibilityMenu({
  value,
  saving = false,
  disabled = false,
  disabledReason,
  onChange,
}: Props) {
  const { t: lt } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (key: DashboardCardKey) => {
    void onChange({ ...value, [key]: !(value[key] !== false) });
  };

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        disabled={disabled || saving}
        title={disabled && disabledReason ? disabledReason : lt("Customize dashboard cards")}
        aria-label={lt("Customize dashboard cards")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted)] transition-colors",
          disabled || saving
            ? "cursor-not-allowed opacity-40"
            : "hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text)]",
          open && !disabled ? "bg-[rgba(255,69,0,0.12)] text-[rgba(255,69,0,1)]" : false,
        )}
      >
        <Settings2 className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open && !disabled ? (
        <div
          role="dialog"
          aria-label={lt("Customize dashboard cards")}
          className="absolute left-0 top-[calc(100%+8px)] z-[70] w-[min(calc(100vw-2rem),280px)] rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1a1a1a] p-3 shadow-none"
        >
          <p className="mb-1 text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
            {lt("Visible to client")}
          </p>
          <p className="mb-3 text-[0.7rem] leading-relaxed text-[rgba(255,255,255,0.4)]">
            {lt("Uncheck cards to hide them from this client's dashboard.")}
          </p>
          <div className="max-h-[min(60vh,420px)] space-y-1.5 overflow-y-auto pr-0.5">
            {DASHBOARD_CARD_KEYS.map((key) => (
              <label
                key={key}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm text-[var(--text)] transition-colors hover:bg-[rgba(255,255,255,0.04)]",
                  saving && "pointer-events-none opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  checked={value[key] !== false}
                  disabled={saving}
                  onChange={() => toggle(key)}
                  className="rounded border-[var(--border)]"
                />
                <span className="min-w-0 leading-snug">{lt(DASHBOARD_CARD_LABELS[key])}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
