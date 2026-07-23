"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, X } from "lucide-react";
import { PortfolioMediaFill } from "@/components/portfolio/portfolio-media";
import { cn } from "@/lib/utils";
import type { PortfolioAboutContent, PortfolioImpactStat } from "@/lib/portfolio";

type PortfolioSiteMode = "edit" | "view";

const EDGE = "px-3 sm:px-4";
const TEXT_SHELL = cn(EDGE, "mx-auto w-full max-w-[52rem]");

const SAMPLE_GALLERY = [
  "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
];

const SAMPLE_FEATURE =
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1400&q=80";

function InlineField({
  mode,
  value,
  onSave,
  className,
  as: Tag = "span",
  multiline = false,
  rows = 3,
  placeholder,
}: {
  mode: PortfolioSiteMode;
  value: string;
  onSave: (next: string) => void;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3" | "p";
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  if (mode !== "edit" || !editing) {
    return (
      <Tag
        className={cn(
          mode === "edit" &&
            "cursor-text rounded-sm outline-offset-2 hover:outline hover:outline-1 hover:outline-white/20",
          className,
        )}
        onClick={mode === "edit" ? () => setEditing(true) : undefined}
      >
        {value || (mode === "edit" ? placeholder || "Click to edit" : "")}
      </Tag>
    );
  }

  if (multiline) {
    return (
      <textarea
        autoFocus
        value={draft}
        rows={rows}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() !== value) onSave(draft.trim());
        }}
        className={cn(
          "w-full resize-y rounded-md border border-white/20 bg-black/40 px-2 py-2 text-inherit outline-none",
          className,
        )}
      />
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft.trim() !== value) onSave(draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={cn(
        "w-full min-w-[4rem] rounded-sm border border-white/20 bg-black/40 px-1 py-0.5 text-inherit outline-none",
        className,
      )}
    />
  );
}

function GallerySlot({
  mode,
  url,
  sample,
  onUpload,
  onClear,
}: {
  mode: PortfolioSiteMode;
  url: string | null;
  sample?: boolean;
  onUpload?: (file: File) => Promise<void>;
  onClear?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const show = url || (sample ? SAMPLE_GALLERY[0] : null);

  return (
    <div className="group relative aspect-[4/5] overflow-hidden rounded-sm bg-[#161616]">
      {show ? (
        <PortfolioMediaFill type="image" url={url ?? SAMPLE_GALLERY[0]} className="absolute inset-0" />
      ) : mode === "edit" ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/35 transition hover:text-white/60"
        >
          <ImagePlus className="h-5 w-5" />
          <span className="text-[0.65rem] uppercase tracking-[0.12em]">Add</span>
        </button>
      ) : null}
      {sample && !url ? (
        <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-white/50">
          Sample
        </span>
      ) : null}
      {mode === "edit" && url ? (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 bg-black/0 transition group-hover:bg-black/25"
            aria-label="Replace image"
          />
          {onClear ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white"
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </>
      ) : null}
      {mode === "edit" && onUpload ? (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            await onUpload(file);
          }}
        />
      ) : null}
    </div>
  );
}

type PortfolioAboutProps = {
  mode: PortfolioSiteMode;
  about: PortfolioAboutContent;
  showSamples?: boolean;
  onChange?: (patch: Partial<PortfolioAboutContent>) => void | Promise<void>;
  onUpload?: (file: File) => Promise<string>;
};

export function PortfolioAboutSection({
  mode,
  about,
  showSamples = false,
  onChange,
  onUpload,
}: PortfolioAboutProps) {
  const featureInputRef = useRef<HTMLInputElement>(null);
  const usingSampleGallery = showSamples && about.galleryUrls.length === 0;
  const featureUrl =
    about.featureImageUrl ?? (showSamples && !about.featureImageUrl ? SAMPLE_FEATURE : null);
  const usingSampleFeature = showSamples && !about.featureImageUrl;

  const patchAbout = (patch: Partial<PortfolioAboutContent>) => {
    if (!onChange) return;
    void onChange(patch);
  };

  const updateStat = (statId: string, patch: Partial<PortfolioImpactStat>) => {
    const impactStats = about.impactStats.map((s) => (s.id === statId ? { ...s, ...patch } : s));
    patchAbout({ impactStats });
  };

  const setGalleryAt = async (index: number, url: string | null) => {
    const next = [...about.galleryUrls];
    while (next.length < Math.max(3, index + 1)) next.push("");
    if (url) next[index] = url;
    else next.splice(index, 1);
    patchAbout({ galleryUrls: next.filter(Boolean).slice(0, 6) });
  };

  return (
    <section id="about" className="scroll-mt-20 bg-[#0a0a0a] py-20 sm:py-28">
      {/* Intro — Journey welcome block */}
      <div className={TEXT_SHELL}>
        <InlineField
          mode={mode}
          value={about.eyebrow}
          as="p"
          className="text-xs uppercase tracking-[0.16em] text-white/40"
          placeholder="Welcome to"
          onSave={(eyebrow) => patchAbout({ eyebrow })}
        />
        <InlineField
          mode={mode}
          value={about.title}
          as="h2"
          className="mt-3 text-[clamp(2.25rem,6vw,4.5rem)] font-medium leading-[1.05] tracking-[-0.03em] text-white"
          placeholder="Studio name"
          onSave={(title) => patchAbout({ title })}
        />
        <InlineField
          mode={mode}
          value={about.lead}
          as="p"
          multiline
          rows={4}
          className="mt-6 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-[0.95rem]"
          placeholder="Tell your story…"
          onSave={(lead) => patchAbout({ lead })}
        />
      </div>

      {/* Image strip */}
      {(usingSampleGallery || about.galleryUrls.length > 0 || mode === "edit") && (
        <div className={cn("mt-14 grid grid-cols-3 gap-2 sm:gap-3", EDGE)}>
          {(usingSampleGallery
            ? SAMPLE_GALLERY
            : about.galleryUrls.length
              ? about.galleryUrls
              : [null, null, null]
          )
            .slice(0, 3)
            .map((url, i) => (
              <GallerySlot
                key={`g-${i}`}
                mode={mode}
                url={typeof url === "string" ? url : null}
                sample={usingSampleGallery}
                onUpload={
                  onUpload
                    ? async (file) => {
                        const nextUrl = await onUpload(file);
                        const base = [...about.galleryUrls];
                        while (base.length < 3) base.push("");
                        base[i] = nextUrl;
                        patchAbout({ galleryUrls: base.filter(Boolean).slice(0, 6) });
                      }
                    : undefined
                }
                onClear={
                  mode === "edit" && about.galleryUrls[i]
                    ? () => void setGalleryAt(i, null)
                    : undefined
                }
              />
            ))}
        </div>
      )}

      {mode === "edit" && about.galleryUrls.length < 6 ? (
        <div className={cn("mt-3", EDGE)}>
          <button
            type="button"
            onClick={async () => {
              if (!onUpload) return;
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                const url = await onUpload(file);
                patchAbout({ galleryUrls: [...about.galleryUrls, url].slice(0, 6) });
              };
              input.click();
            }}
            className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/35 transition hover:text-white/60"
          >
            <Plus className="h-3.5 w-3.5" />
            Add gallery image
          </button>
        </div>
      ) : null}

      {/* Feature caption + large image */}
      <div className={cn("mt-16 sm:mt-24", EDGE)}>
        <InlineField
          mode={mode}
          value={about.featureCaption}
          as="p"
          className="mb-6 text-sm text-white/55 sm:text-base"
          placeholder="Designing the future, today."
          onSave={(featureCaption) => patchAbout({ featureCaption })}
        />
        <button
          type="button"
          disabled={mode !== "edit"}
          onClick={() => mode === "edit" && featureInputRef.current?.click()}
          className={cn(
            "relative aspect-[16/10] w-full overflow-hidden rounded-sm bg-[#161616] sm:aspect-[21/9]",
            mode === "edit" && "cursor-pointer ring-0 hover:ring-1 hover:ring-white/20",
          )}
        >
          {featureUrl ? (
            <PortfolioMediaFill type="image" url={featureUrl} className="absolute inset-0" />
          ) : mode === "edit" ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/35">
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs uppercase tracking-[0.12em]">Upload feature image</span>
            </span>
          ) : null}
          {usingSampleFeature ? (
            <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-white/50">
              Sample
            </span>
          ) : null}
        </button>
        {mode === "edit" ? (
          <input
            ref={featureInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file || !onUpload) return;
              const url = await onUpload(file);
              patchAbout({ featureImageUrl: url });
            }}
          />
        ) : null}
      </div>

      {/* Our real impact */}
      <div className={cn("mt-20 sm:mt-28", TEXT_SHELL)}>
        <InlineField
          mode={mode}
          value={about.impactEyebrow}
          as="p"
          className="text-xs uppercase tracking-[0.16em] text-white/40"
          placeholder="Our real impact"
          onSave={(impactEyebrow) => patchAbout({ impactEyebrow })}
        />
        <InlineField
          mode={mode}
          value={about.impactHeadline}
          as="h3"
          multiline
          rows={3}
          className="mt-4 text-[clamp(1.35rem,3.2vw,2.15rem)] font-medium leading-[1.2] tracking-[-0.02em] text-white"
          placeholder="Impact headline…"
          onSave={(impactHeadline) => patchAbout({ impactHeadline })}
        />
        <InlineField
          mode={mode}
          value={about.impactBody}
          as="p"
          multiline
          rows={5}
          className="mt-6 max-w-2xl text-sm leading-relaxed text-white/60"
          placeholder="Describe your methodology…"
          onSave={(impactBody) => patchAbout({ impactBody })}
        />

        <div className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
          {about.impactStats.map((stat) => (
            <div key={stat.id} className="min-w-0">
              <div className="flex items-baseline gap-2">
                <InlineField
                  mode={mode}
                  value={stat.value}
                  className="text-2xl font-medium tracking-[-0.02em] text-white sm:text-3xl"
                  onSave={(value) => updateStat(stat.id, { value })}
                />
                {stat.delta || mode === "edit" ? (
                  <InlineField
                    mode={mode}
                    value={stat.delta ?? ""}
                    className="text-xs text-[#ff4500]"
                    placeholder="+5%"
                    onSave={(delta) => updateStat(stat.id, { delta: delta || undefined })}
                  />
                ) : null}
              </div>
              <InlineField
                mode={mode}
                value={stat.label}
                className="mt-2 block text-xs text-white/45"
                onSave={(label) => updateStat(stat.id, { label })}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
