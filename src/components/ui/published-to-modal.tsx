"use client";

import { useEffect, useState } from "react";
import { Globe, Instagram, Linkedin, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_KEYS = ["Blog", "Instagram", "X", "LinkedIn"] as const;
type PresetKey = (typeof PRESET_KEYS)[number];

const PRESET_META: Record<
  PresetKey,
  { label: string; Icon: typeof Globe; activeClass: string; inactiveBorder: string }
> = {
  Blog: {
    label: "Blog",
    Icon: Globe,
    activeClass: "border-[#FF4500]/55 bg-[#FF4500]/18 text-[#FF4500]",
    inactiveBorder: "border-[rgba(255,255,255,0.1)]",
  },
  Instagram: {
    label: "Instagram",
    Icon: Instagram,
    activeClass: "border-[#E1306C]/55 bg-[#E1306C]/18 text-[#E1306C]",
    inactiveBorder: "border-[rgba(255,255,255,0.1)]",
  },
  X: {
    label: "X",
    Icon: X,
    activeClass: "border-white/45 bg-white/12 text-white",
    inactiveBorder: "border-[rgba(255,255,255,0.1)]",
  },
  LinkedIn: {
    label: "LinkedIn",
    Icon: Linkedin,
    activeClass: "border-[#0A66C2]/55 bg-[#0A66C2]/18 text-[#0A66C2]",
    inactiveBorder: "border-[rgba(255,255,255,0.1)]",
  },
};

function normalizePresetKey(name: string): PresetKey | null {
  const t = name.trim();
  if (t === "Blog") return "Blog";
  if (t === "Instagram") return "Instagram";
  if (t === "X" || t.toLowerCase() === "twitter" || t === "X / Twitter") return "X";
  if (t === "LinkedIn" || t === "Linkedin") return "LinkedIn";
  return null;
}

/** Tailwind classes for tiny platform chips (task table / status badge). */
export function publishedPlatformChipClass(name: string): string {
  const p = normalizePresetKey(name);
  if (p === "Blog") return "border-[#FF4500]/40 bg-[#FF4500]/15 text-[#FF9a7a]";
  if (p === "Instagram") return "border-[#E1306C]/40 bg-[#E1306C]/15 text-[#f472b6]";
  if (p === "X") return "border-white/30 bg-white/10 text-white/90";
  if (p === "LinkedIn") return "border-[#0A66C2]/40 bg-[#0A66C2]/15 text-[#93c5fd]";
  return "border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.65)]";
}

export function PublishedToModal({
  open,
  title,
  subtitle,
  addPlatformLabel,
  addEntryLabel,
  customPlaceholder,
  confirmLabel,
  skipLabel,
  onConfirm,
  onSkip,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  addPlatformLabel: string;
  addEntryLabel: string;
  customPlaceholder: string;
  confirmLabel: string;
  skipLabel: string;
  onConfirm: (platforms: string[]) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customDraft, setCustomDraft] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setCustomDraft("");
      setShowCustom(false);
    }
  }, [open]);

  if (!open) return null;

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const addCustom = () => {
    const v = customDraft.trim();
    if (!v) return;
    setSelected((prev) => new Set(prev).add(v));
    setCustomDraft("");
    setShowCustom(false);
  };

  const customSelected = Array.from(selected).filter((label) => !normalizePresetKey(label));

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-4 py-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[8px] border border-[var(--border)] bg-[#161616] p-5 shadow-lg"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="section-title">{title}</p>
        <p className="mt-2 text-sm font-light text-[rgba(255,255,255,0.5)]">{subtitle}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESET_KEYS.map((key) => {
            const meta = PRESET_META[key];
            const Icon = meta.Icon;
            const on = selected.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-light transition-colors",
                  on ? meta.activeClass : cn("bg-[#141414] text-[rgba(255,255,255,0.45)]", meta.inactiveBorder),
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                {meta.label}
              </button>
            );
          })}
          {customSelected.map((label) => (
            <button
              key={`c-${label}`}
              type="button"
              onClick={() => toggle(label)}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.22)] bg-[rgba(255,255,255,0.1)] px-3 py-2 text-xs font-light text-[rgba(255,255,255,0.85)] transition-colors hover:bg-[rgba(255,255,255,0.14)]"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {!showCustom ? (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="inline-flex items-center gap-1.5 text-xs font-light text-[rgba(255,255,255,0.45)] transition-colors hover:text-[rgba(255,255,255,0.75)]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              {addPlatformLabel}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                className="min-w-[12rem] flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white outline-none"
                placeholder={customPlaceholder}
              />
              <button type="button" onClick={addCustom} className="rounded-[8px] border border-[var(--border)] bg-[#1f1f1f] px-3 py-2 text-xs font-light text-white hover:bg-[rgba(255,255,255,0.06)]">
                {addEntryLabel}
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button type="button" onClick={() => onSkip()} className="btn-ghost rounded-[8px] px-3 py-2 text-xs font-light">
            {skipLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(Array.from(selected))}
            className="btn-primary rounded-[8px] px-4 py-2 text-xs font-light"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
