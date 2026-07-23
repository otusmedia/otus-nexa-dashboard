"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, EyeOff, ImagePlus, Plus, X } from "lucide-react";
import { PortfolioMediaFill } from "@/components/portfolio/portfolio-media";
import { cn } from "@/lib/utils";
import type {
  PortfolioAboutBlockKey,
  PortfolioAboutContent,
  PortfolioImpactStat,
} from "@/lib/portfolio";

type PortfolioSiteMode = "edit" | "view";

const EDGE = "px-3 sm:px-4";
const SHELL = cn(EDGE, "mx-auto w-full max-w-[72rem]");
const TEXT = cn(EDGE, "mx-auto w-full max-w-[52rem]");

const BLOCK_LABELS: Record<PortfolioAboutBlockKey, string> = {
  intro: "Intro",
  gallery: "Gallery",
  feature: "Feature",
  impact: "Impact",
  brands: "Brands",
  team: "Team",
  testimonials: "Testimonials",
  cta: "CTA",
  insights: "Insights",
  pricing: "Pricing",
  faq: "FAQ",
};

const SAMPLE_GALLERY = [
  "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
];

const SAMPLE_FEATURE =
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1600&q=80";

const SAMPLE_TEAM = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
];

const SAMPLE_INSIGHTS = [
  "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
];

function InlineField({
  mode,
  value,
  onSave,
  className,
  as: Tag = "span",
  multiline = false,
  rows = 3,
  placeholder,
  dark = false,
}: {
  mode: PortfolioSiteMode;
  value: string;
  onSave: (next: string) => void;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3" | "h4" | "p";
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  dark?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const outline = dark
    ? "hover:outline hover:outline-1 hover:outline-white/25"
    : "hover:outline hover:outline-1 hover:outline-black/15";

  if (mode !== "edit" || !editing) {
    return (
      <Tag
        className={cn(mode === "edit" && cn("cursor-text rounded-sm outline-offset-2", outline), className)}
        onClick={mode === "edit" ? () => setEditing(true) : undefined}
      >
        {value || (mode === "edit" ? placeholder || "Click to edit" : "")}
      </Tag>
    );
  }

  const fieldClass = cn(
    "w-full rounded-md border px-2 py-1.5 text-inherit outline-none",
    dark ? "border-white/20 bg-black/40" : "border-black/15 bg-white/80",
    className,
  );

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
        className={cn(fieldClass, "resize-y")}
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
      className={fieldClass}
    />
  );
}

function ImageSlot({
  mode,
  url,
  sampleUrl,
  className,
  onUpload,
  onClear,
  label = "Upload",
}: {
  mode: PortfolioSiteMode;
  url: string | null;
  sampleUrl?: string | null;
  className?: string;
  onUpload?: (file: File) => Promise<void>;
  onClear?: () => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const show = url || sampleUrl || null;
  const isSample = !url && Boolean(sampleUrl);

  return (
    <div className={cn("group relative overflow-hidden bg-[#e8e8e8]", className)}>
      {show ? (
        <PortfolioMediaFill type="image" url={show} className="absolute inset-0" />
      ) : mode === "edit" ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-black/35 transition hover:text-black/55"
        >
          <ImagePlus className="h-5 w-5" />
          <span className="text-[0.65rem] uppercase tracking-[0.12em]">{label}</span>
        </button>
      ) : null}
      {isSample ? (
        <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-white/70">
          Sample
        </span>
      ) : null}
      {mode === "edit" && url ? (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20"
            aria-label="Replace"
          />
          {onClear ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white/80 opacity-0 transition group-hover:opacity-100"
              aria-label="Remove"
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

function FaqItem({
  mode,
  question,
  answer,
  onSaveQuestion,
  onSaveAnswer,
}: {
  mode: PortfolioSiteMode;
  question: string;
  answer: string;
  onSaveQuestion: (v: string) => void;
  onSaveAnswer: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-black/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <InlineField
          mode={mode}
          value={question}
          className="text-sm font-medium text-black sm:text-base"
          onSave={onSaveQuestion}
        />
        <Plus
          className={cn("h-4 w-4 shrink-0 text-black/40 transition", open && "rotate-45")}
        />
      </button>
      {open || mode === "edit" ? (
        <div className={cn("pb-5 pr-8", !open && mode === "edit" && "opacity-60")}>
          <InlineField
            mode={mode}
            value={answer}
            multiline
            rows={3}
            className="text-sm leading-relaxed text-black/60"
            onSave={onSaveAnswer}
          />
        </div>
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
  const blocks = about.blocks ?? {
    intro: true,
    gallery: true,
    feature: true,
    impact: true,
    brands: true,
    team: true,
    testimonials: true,
    cta: true,
    insights: true,
    pricing: true,
    faq: true,
  };
  const showBlock = (key: PortfolioAboutBlockKey) => mode === "edit" || blocks[key];

  const patch = (next: Partial<PortfolioAboutContent>) => {
    if (!onChange) return;
    void onChange(next);
  };

  const toggleBlock = (key: PortfolioAboutBlockKey) => {
    patch({ blocks: { ...blocks, [key]: !blocks[key] } });
  };

  const updateStat = (statId: string, next: Partial<PortfolioImpactStat>) => {
    patch({
      impactStats: about.impactStats.map((s) => (s.id === statId ? { ...s, ...next } : s)),
    });
  };

  const usingSampleGallery = showSamples && about.galleryUrls.length === 0;

  return (
    <section id="about" className="scroll-mt-20 bg-[#f5f5f5] text-black">
      {mode === "edit" ? (
        <div className="sticky top-[7.5rem] z-10 border-b border-black/8 bg-[#f5f5f5]/95 backdrop-blur-md">
          <div className={cn("flex flex-wrap items-center gap-1.5 py-2", EDGE)}>
            <span className="mr-1 text-[0.6rem] uppercase tracking-[0.12em] text-black/35">
              About blocks
            </span>
            {(Object.keys(BLOCK_LABELS) as PortfolioAboutBlockKey[]).map((key) => {
              const on = blocks[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleBlock(key)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] transition",
                    on
                      ? "border-black/15 bg-black/[0.04] text-black/75"
                      : "border-black/8 text-black/30 hover:text-black/50",
                  )}
                >
                  {on ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                  {BLOCK_LABELS[key]}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 1. Intro — Welcome / Studio / lead */}
      {showBlock("intro") ? (
        <div className={cn("relative pt-20 sm:pt-28", !blocks.intro && mode === "edit" && "opacity-50")}>
          {!blocks.intro && mode === "edit" ? (
            <p className="absolute left-3 top-3 text-[0.65rem] uppercase tracking-[0.12em] text-amber-700/80">
              Hidden
            </p>
          ) : null}
          <div className={TEXT}>
            <InlineField
              mode={mode}
              value={about.eyebrow}
              as="p"
              className="text-xs uppercase tracking-[0.16em] text-black/40"
              placeholder="Welcome to"
              onSave={(eyebrow) => patch({ eyebrow })}
            />
            <InlineField
              mode={mode}
              value={about.title}
              as="h2"
              className="mt-3 text-[clamp(2.75rem,8vw,5.5rem)] font-medium leading-[0.98] tracking-[-0.04em] text-black"
              placeholder="Studio"
              onSave={(title) => patch({ title })}
            />
            <InlineField
              mode={mode}
              value={about.lead}
              as="p"
              multiline
              rows={4}
              className="mt-6 max-w-xl text-sm leading-relaxed text-black/65 sm:text-[0.95rem]"
              placeholder="Tell your story…"
              onSave={(lead) => patch({ lead })}
            />
          </div>
        </div>
      ) : null}

      {/* 2. Gallery strip */}
      {showBlock("gallery") ? (
        <div className={cn("mt-14 sm:mt-16", !blocks.gallery && mode === "edit" && "opacity-50")}>
          <div className={cn("grid grid-cols-3 gap-2 sm:gap-3", EDGE)}>
            {[0, 1, 2].map((i) => {
              const realUrl = about.galleryUrls[i] ?? null;
              const sampleUrl = usingSampleGallery ? SAMPLE_GALLERY[i] : null;
              return (
                <ImageSlot
                  key={`g-${i}`}
                  mode={mode}
                  url={realUrl}
                  sampleUrl={sampleUrl}
                  className="aspect-[4/5] rounded-sm"
                  onUpload={
                    onUpload
                      ? async (file) => {
                          const nextUrl = await onUpload(file);
                          const base = [...about.galleryUrls];
                          while (base.length < 3) base.push("");
                          base[i] = nextUrl;
                          patch({ galleryUrls: base.filter(Boolean).slice(0, 6) });
                        }
                      : undefined
                  }
                  onClear={
                    mode === "edit" && realUrl
                      ? () => {
                          const next = [...about.galleryUrls];
                          next.splice(i, 1);
                          patch({ galleryUrls: next });
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 3. Feature caption + large image */}
      {showBlock("feature") ? (
        <div className={cn("mt-16 sm:mt-24", EDGE, !blocks.feature && mode === "edit" && "opacity-50")}>
          <InlineField
            mode={mode}
            value={about.featureCaption}
            as="p"
            className="mb-5 text-sm text-black/55 sm:text-base"
            placeholder="Designing the future, today."
            onSave={(featureCaption) => patch({ featureCaption })}
          />
          <ImageSlot
            mode={mode}
            url={about.featureImageUrl}
            sampleUrl={showSamples && !about.featureImageUrl ? SAMPLE_FEATURE : null}
            className="aspect-[16/10] w-full rounded-sm sm:aspect-[21/9]"
            label="Upload feature image"
            onUpload={
              onUpload
                ? async (file) => {
                    const url = await onUpload(file);
                    patch({ featureImageUrl: url });
                  }
                : undefined
            }
            onClear={
              about.featureImageUrl ? () => patch({ featureImageUrl: null }) : undefined
            }
          />
        </div>
      ) : null}

      {/* 4. Our real impact — label left / content right + stats */}
      {showBlock("impact") ? (
        <div className={cn("mt-20 py-16 sm:mt-28 sm:py-24", !blocks.impact && mode === "edit" && "opacity-50")}>
          <div className={SHELL}>
            <div className="grid gap-8 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] md:gap-12 lg:gap-16">
              <InlineField
                mode={mode}
                value={about.impactEyebrow}
                as="p"
                className="text-xs uppercase tracking-[0.16em] text-black/40"
                placeholder="Our real impact"
                onSave={(impactEyebrow) => patch({ impactEyebrow })}
              />
              <div>
                <InlineField
                  mode={mode}
                  value={about.impactHeadline}
                  as="h3"
                  multiline
                  rows={3}
                  className="text-[clamp(1.4rem,3vw,2.25rem)] font-medium leading-[1.2] tracking-[-0.02em] text-black"
                  placeholder="Impact headline…"
                  onSave={(impactHeadline) => patch({ impactHeadline })}
                />
                <InlineField
                  mode={mode}
                  value={about.impactBody}
                  as="p"
                  multiline
                  rows={5}
                  className="mt-6 max-w-2xl text-sm leading-relaxed text-black/55"
                  placeholder="Describe your methodology…"
                  onSave={(impactBody) => patch({ impactBody })}
                />
                <div className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
                  {about.impactStats.map((stat) => (
                    <div key={stat.id} className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <InlineField
                          mode={mode}
                          value={stat.value}
                          className="text-2xl font-medium tracking-[-0.02em] text-black sm:text-3xl"
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
                        className="mt-2 block text-xs text-black/45"
                        onSave={(label) => updateStat(stat.id, { label })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 5. Trusted Brands — dark band */}
      {showBlock("brands") ? (
        <div
          className={cn(
            "bg-[#0a0a0a] py-20 text-white sm:py-28",
            !blocks.brands && mode === "edit" && "opacity-50",
          )}
        >
          <div className={SHELL}>
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <InlineField
                  mode={mode}
                  value={about.brandsEyebrow}
                  as="p"
                  dark
                  className="text-[clamp(2rem,5vw,3.5rem)] font-medium leading-none tracking-[-0.03em] text-white"
                  placeholder="/Trusted"
                  onSave={(brandsEyebrow) => patch({ brandsEyebrow })}
                />
                <InlineField
                  mode={mode}
                  value={about.brandsHeadline}
                  as="p"
                  dark
                  className="text-[clamp(2rem,5vw,3.5rem)] font-medium leading-none tracking-[-0.03em] text-white"
                  placeholder="Brands."
                  onSave={(brandsHeadline) => patch({ brandsHeadline })}
                />
              </div>
              <InlineField
                mode={mode}
                value={about.brandsBody}
                as="p"
                dark
                multiline
                rows={2}
                className="max-w-sm text-sm leading-relaxed text-white/50"
                placeholder="From startups to enterprises…"
                onSave={(brandsBody) => patch({ brandsBody })}
              />
            </div>
            <div className="mt-14 grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {about.brands.map((brand, i) => (
                <div
                  key={brand.id}
                  className="flex aspect-[5/3] items-center justify-center bg-[#0a0a0a] px-3"
                >
                  {brand.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brand.logoUrl}
                      alt={brand.name}
                      className="max-h-8 w-auto max-w-[70%] object-contain opacity-80"
                    />
                  ) : (
                    <InlineField
                      mode={mode}
                      value={brand.name}
                      dark
                      className="text-center text-xs uppercase tracking-[0.14em] text-white/55"
                      onSave={(name) => {
                        const brands = about.brands.map((b, idx) =>
                          idx === i ? { ...b, name } : b,
                        );
                        patch({ brands });
                      }}
                    />
                  )}
                  {mode === "edit" && onUpload ? (
                    <button
                      type="button"
                      className="sr-only"
                      onClick={async () => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.onchange = async () => {
                          const file = input.files?.[0];
                          if (!file) return;
                          const url = await onUpload(file);
                          const brands = about.brands.map((b, idx) =>
                            idx === i ? { ...b, logoUrl: url } : b,
                          );
                          patch({ brands });
                        };
                        input.click();
                      }}
                    >
                      Upload logo
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {mode === "edit" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {about.brands.map((brand, i) => (
                  <button
                    key={`up-${brand.id}`}
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
                        const brands = about.brands.map((b, idx) =>
                          idx === i ? { ...b, logoUrl: url } : b,
                        );
                        patch({ brands });
                      };
                      input.click();
                    }}
                    className="text-[0.6rem] uppercase tracking-[0.1em] text-white/35 hover:text-white/60"
                  >
                    Logo: {brand.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 6. Team */}
      {showBlock("team") ? (
        <div className={cn("py-20 sm:py-28", !blocks.team && mode === "edit" && "opacity-50")}>
          <div className={SHELL}>
            <InlineField
              mode={mode}
              value={about.teamEyebrow}
              as="p"
              className="text-xs uppercase tracking-[0.16em] text-black/40"
              placeholder="Meet the creators"
              onSave={(teamEyebrow) => patch({ teamEyebrow })}
            />
            <InlineField
              mode={mode}
              value={about.teamHeadline}
              as="h3"
              multiline
              rows={2}
              className="mt-4 max-w-3xl text-[clamp(1.4rem,3vw,2.25rem)] font-medium leading-[1.2] tracking-[-0.02em] text-black"
              placeholder="Team headline…"
              onSave={(teamHeadline) => patch({ teamHeadline })}
            />

            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3">
              {about.teamMembers.map((member, i) => (
                <div key={member.id}>
                  <ImageSlot
                    mode={mode}
                    url={member.photoUrl}
                    sampleUrl={
                      showSamples && !member.photoUrl ? SAMPLE_TEAM[i % SAMPLE_TEAM.length] : null
                    }
                    className="aspect-[3/4] w-full rounded-sm"
                    onUpload={
                      onUpload
                        ? async (file) => {
                            const url = await onUpload(file);
                            const teamMembers = about.teamMembers.map((m, idx) =>
                              idx === i ? { ...m, photoUrl: url } : m,
                            );
                            patch({ teamMembers });
                          }
                        : undefined
                    }
                  />
                  <div className="mt-4">
                    <InlineField
                      mode={mode}
                      value={member.role}
                      className="block text-xs uppercase tracking-[0.12em] text-black/40"
                      onSave={(role) => {
                        const teamMembers = about.teamMembers.map((m, idx) =>
                          idx === i ? { ...m, role } : m,
                        );
                        patch({ teamMembers });
                      }}
                    />
                    <InlineField
                      mode={mode}
                      value={member.name}
                      className="mt-1 block text-base font-medium text-black"
                      onSave={(name) => {
                        const teamMembers = about.teamMembers.map((m, idx) =>
                          idx === i ? { ...m, name } : m,
                        );
                        patch({ teamMembers });
                      }}
                    />
                    <InlineField
                      mode={mode}
                      value={member.bio}
                      multiline
                      rows={2}
                      className="mt-2 block text-sm leading-relaxed text-black/50"
                      onSave={(bio) => {
                        const teamMembers = about.teamMembers.map((m, idx) =>
                          idx === i ? { ...m, bio } : m,
                        );
                        patch({ teamMembers });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {about.awards.map((award, i) => (
                <div key={award.id} className="border-t border-black/10 pt-4">
                  <InlineField
                    mode={mode}
                    value={award.org}
                    className="block text-sm font-medium text-black"
                    onSave={(org) => {
                      const awards = about.awards.map((a, idx) =>
                        idx === i ? { ...a, org } : a,
                      );
                      patch({ awards });
                    }}
                  />
                  <InlineField
                    mode={mode}
                    value={award.detail}
                    className="mt-1 block text-xs text-black/45"
                    onSave={(detail) => {
                      const awards = about.awards.map((a, idx) =>
                        idx === i ? { ...a, detail } : a,
                      );
                      patch({ awards });
                    }}
                  />
                  <InlineField
                    mode={mode}
                    value={award.count}
                    className="mt-2 block text-xs text-black/35"
                    onSave={(count) => {
                      const awards = about.awards.map((a, idx) =>
                        idx === i ? { ...a, count } : a,
                      );
                      patch({ awards });
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="mt-12 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-black/15 px-5 py-2.5 text-xs uppercase tracking-[0.12em] text-black/70">
                <InlineField
                  mode={mode}
                  value={about.teamCtaLabel}
                  as="span"
                  onSave={(teamCtaLabel) => patch({ teamCtaLabel })}
                />
                <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* 7. Testimonials */}
      {showBlock("testimonials") ? (
        <div className={cn("pb-20 sm:pb-28", !blocks.testimonials && mode === "edit" && "opacity-50")}>
          <div className={SHELL}>
            <div className="grid gap-8 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] md:gap-12">
              <InlineField
                mode={mode}
                value={about.testimonialsEyebrow}
                as="p"
                className="text-xs uppercase tracking-[0.16em] text-black/40"
                placeholder="Voices of partners"
                onSave={(testimonialsEyebrow) => patch({ testimonialsEyebrow })}
              />
              <InlineField
                mode={mode}
                value={about.testimonialsHeadline}
                as="h3"
                multiline
                rows={2}
                className="text-[clamp(1.4rem,3vw,2.15rem)] font-medium leading-[1.2] tracking-[-0.02em] text-black"
                placeholder="Testimonials headline…"
                onSave={(testimonialsHeadline) => patch({ testimonialsHeadline })}
              />
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {about.testimonials.map((t, i) => (
                <article
                  key={t.id}
                  className="flex flex-col rounded-[12px] border border-black/8 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
                >
                  <InlineField
                    mode={mode}
                    value={t.quote}
                    multiline
                    rows={4}
                    className="flex-1 text-sm leading-relaxed text-black/70"
                    onSave={(quote) => {
                      const testimonials = about.testimonials.map((item, idx) =>
                        idx === i ? { ...item, quote } : item,
                      );
                      patch({ testimonials });
                    }}
                  />
                  <div className="mt-6 flex items-center gap-3">
                    <ImageSlot
                      mode={mode}
                      url={t.photoUrl}
                      sampleUrl={
                        showSamples && !t.photoUrl ? SAMPLE_TEAM[i % SAMPLE_TEAM.length] : null
                      }
                      className="h-10 w-10 shrink-0 rounded-full"
                      onUpload={
                        onUpload
                          ? async (file) => {
                              const url = await onUpload(file);
                              const testimonials = about.testimonials.map((item, idx) =>
                                idx === i ? { ...item, photoUrl: url } : item,
                              );
                              patch({ testimonials });
                            }
                          : undefined
                      }
                    />
                    <div className="min-w-0">
                      <InlineField
                        mode={mode}
                        value={t.name}
                        className="block text-sm font-medium text-black"
                        onSave={(name) => {
                          const testimonials = about.testimonials.map((item, idx) =>
                            idx === i ? { ...item, name } : item,
                          );
                          patch({ testimonials });
                        }}
                      />
                      <InlineField
                        mode={mode}
                        value={t.title}
                        className="block text-xs text-black/45"
                        onSave={(title) => {
                          const testimonials = about.testimonials.map((item, idx) =>
                            idx === i ? { ...item, title } : item,
                          );
                          patch({ testimonials });
                        }}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* 8. CTA banner */}
      {showBlock("cta") ? (
        <div className={cn(EDGE, "pb-16 sm:pb-20", !blocks.cta && mode === "edit" && "opacity-50")}>
          <div
            className="relative overflow-hidden rounded-[20px] px-6 py-16 text-center sm:rounded-[28px] sm:px-10 sm:py-20"
            style={{
              background:
                "radial-gradient(120% 80% at 20% 30%, #ff6a2a 0%, transparent 55%), radial-gradient(100% 70% at 80% 60%, #ff4500 0%, transparent 50%), radial-gradient(80% 60% at 50% 100%, #1a1a1a 0%, #0a0a0a 100%), #111",
            }}
          >
            <InlineField
              mode={mode}
              value={about.ctaHeadline}
              as="h3"
              dark
              className="mx-auto max-w-xl text-[clamp(1.5rem,3.5vw,2.5rem)] font-medium leading-[1.15] tracking-[-0.02em] text-white"
              placeholder="Ready to start your new journey?"
              onSave={(ctaHeadline) => patch({ ctaHeadline })}
            />
            <a
              href="#contact"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-medium uppercase tracking-[0.12em] text-black transition hover:bg-white/90"
            >
              <InlineField
                mode={mode}
                value={about.ctaLabel}
                as="span"
                onSave={(ctaLabel) => patch({ ctaLabel })}
              />
              <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
            </a>
          </div>
        </div>
      ) : null}

      {/* 9. Insights */}
      {showBlock("insights") ? (
        <div className={cn("pb-20 sm:pb-28", !blocks.insights && mode === "edit" && "opacity-50")}>
          <div className={SHELL}>
            <InlineField
              mode={mode}
              value={about.insightsEyebrow}
              as="p"
              className="text-xs uppercase tracking-[0.16em] text-black/40"
              placeholder="Our posts"
              onSave={(insightsEyebrow) => patch({ insightsEyebrow })}
            />
            <InlineField
              mode={mode}
              value={about.insightsHeadline}
              as="h3"
              className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-medium tracking-[-0.02em] text-black"
              placeholder="Explore more insights"
              onSave={(insightsHeadline) => patch({ insightsHeadline })}
            />
            <InlineField
              mode={mode}
              value={about.insightsBody}
              as="p"
              multiline
              rows={2}
              className="mt-4 max-w-xl text-sm leading-relaxed text-black/50"
              onSave={(insightsBody) => patch({ insightsBody })}
            />

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {about.insights.map((post, i) => (
                <article key={post.id}>
                  <ImageSlot
                    mode={mode}
                    url={post.imageUrl}
                    sampleUrl={
                      showSamples && !post.imageUrl
                        ? SAMPLE_INSIGHTS[i % SAMPLE_INSIGHTS.length]
                        : null
                    }
                    className="aspect-[16/10] w-full rounded-sm"
                    onUpload={
                      onUpload
                        ? async (file) => {
                            const url = await onUpload(file);
                            const insights = about.insights.map((item, idx) =>
                              idx === i ? { ...item, imageUrl: url } : item,
                            );
                            patch({ insights });
                          }
                        : undefined
                    }
                  />
                  <InlineField
                    mode={mode}
                    value={post.title}
                    as="h4"
                    className="mt-4 text-base font-medium leading-snug text-black"
                    onSave={(title) => {
                      const insights = about.insights.map((item, idx) =>
                        idx === i ? { ...item, title } : item,
                      );
                      patch({ insights });
                    }}
                  />
                  <InlineField
                    mode={mode}
                    value={post.excerpt}
                    as="p"
                    multiline
                    rows={2}
                    className="mt-2 text-sm leading-relaxed text-black/50"
                    onSave={(excerpt) => {
                      const insights = about.insights.map((item, idx) =>
                        idx === i ? { ...item, excerpt } : item,
                      );
                      patch({ insights });
                    }}
                  />
                  <InlineField
                    mode={mode}
                    value={post.meta}
                    className="mt-3 block text-xs uppercase tracking-[0.12em] text-black/35"
                    onSave={(meta) => {
                      const insights = about.insights.map((item, idx) =>
                        idx === i ? { ...item, meta } : item,
                      );
                      patch({ insights });
                    }}
                  />
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* 10. Pricing */}
      {showBlock("pricing") ? (
        <div className={cn("pb-16 sm:pb-20", !blocks.pricing && mode === "edit" && "opacity-50")}>
          <div className={SHELL}>
            <InlineField
              mode={mode}
              value={about.pricingEyebrow}
              as="p"
              className="text-xs uppercase tracking-[0.16em] text-black/40"
              placeholder="Start your journey"
              onSave={(pricingEyebrow) => patch({ pricingEyebrow })}
            />
            <InlineField
              mode={mode}
              value={about.pricingHeadline}
              as="h3"
              className="mt-3 text-[clamp(1.5rem,3.5vw,2.5rem)] font-medium tracking-[-0.02em] text-black"
              placeholder="Pricing for Visionaries"
              onSave={(pricingHeadline) => patch({ pricingHeadline })}
            />
            <InlineField
              mode={mode}
              value={about.pricingBody}
              as="p"
              multiline
              rows={2}
              className="mt-4 max-w-xl text-sm leading-relaxed text-black/50"
              onSave={(pricingBody) => patch({ pricingBody })}
            />

            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {about.plans.map((plan, i) => {
                const featured = Boolean(plan.featured);
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "flex flex-col rounded-[16px] border p-6 sm:p-8",
                      featured
                        ? "border-black/10 bg-white text-black"
                        : "border-black bg-[#0a0a0a] text-white",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <InlineField
                        mode={mode}
                        value={plan.name}
                        dark={!featured}
                        className={cn(
                          "text-sm font-medium uppercase tracking-[0.1em]",
                          featured ? "text-black/70" : "text-white/80",
                        )}
                        onSave={(name) => {
                          const plans = about.plans.map((p, idx) =>
                            idx === i ? { ...p, name } : p,
                          );
                          patch({ plans });
                        }}
                      />
                      {featured ? (
                        <span className="rounded-full bg-[#ff4500] px-2.5 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-white">
                          Most Popular
                        </span>
                      ) : null}
                    </div>
                    <InlineField
                      mode={mode}
                      value={plan.description}
                      dark={!featured}
                      multiline
                      rows={2}
                      className={cn(
                        "mt-4 text-sm leading-relaxed",
                        featured ? "text-black/50" : "text-white/50",
                      )}
                      onSave={(description) => {
                        const plans = about.plans.map((p, idx) =>
                          idx === i ? { ...p, description } : p,
                        );
                        patch({ plans });
                      }}
                    />
                    <InlineField
                      mode={mode}
                      value={plan.price}
                      dark={!featured}
                      className={cn(
                        "mt-6 text-3xl font-medium tracking-[-0.02em]",
                        featured ? "text-black" : "text-white",
                      )}
                      onSave={(price) => {
                        const plans = about.plans.map((p, idx) =>
                          idx === i ? { ...p, price } : p,
                        );
                        patch({ plans });
                      }}
                    />
                    <ul className="mt-6 space-y-3">
                      {plan.features.map((feat, fi) => (
                        <li key={`${plan.id}-f${fi}`} className="flex items-start gap-2 text-sm">
                          <span
                            className={cn(
                              "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                              featured ? "bg-[#ff4500]" : "bg-white/40",
                            )}
                          />
                          <InlineField
                            mode={mode}
                            value={feat}
                            dark={!featured}
                            className={featured ? "text-black/65" : "text-white/70"}
                            onSave={(nextFeat) => {
                              const plans = about.plans.map((p, idx) => {
                                if (idx !== i) return p;
                                const features = [...p.features];
                                features[fi] = nextFeat;
                                return { ...p, features };
                              });
                              patch({ plans });
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className={cn(
                        "mt-8 rounded-full px-5 py-2.5 text-xs uppercase tracking-[0.12em] transition",
                        featured
                          ? "bg-[#ff4500] text-white hover:bg-[#e33f00]"
                          : "bg-white text-black hover:bg-white/90",
                      )}
                    >
                      <InlineField
                        mode={mode}
                        value={plan.ctaLabel}
                        as="span"
                        dark={!featured}
                        onSave={(ctaLabel) => {
                          const plans = about.plans.map((p, idx) =>
                            idx === i ? { ...p, ctaLabel } : p,
                          );
                          patch({ plans });
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* 11. FAQ */}
      {showBlock("faq") ? (
        <div className={cn("pb-24 sm:pb-32", !blocks.faq && mode === "edit" && "opacity-50")}>
          <div className={cn(SHELL, "max-w-[52rem]")}>
            {about.faqs.map((faq, i) => (
              <FaqItem
                key={faq.id}
                mode={mode}
                question={faq.question}
                answer={faq.answer}
                onSaveQuestion={(question) => {
                  const faqs = about.faqs.map((f, idx) =>
                    idx === i ? { ...f, question } : f,
                  );
                  patch({ faqs });
                }}
                onSaveAnswer={(answer) => {
                  const faqs = about.faqs.map((f, idx) => (idx === i ? { ...f, answer } : f));
                  patch({ faqs });
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
