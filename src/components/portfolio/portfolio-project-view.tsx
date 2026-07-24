"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ImagePlus, X } from "lucide-react";
import { PortfolioMediaFill } from "@/components/portfolio/portfolio-media";
import type { PortfolioGalleryBlock, PortfolioItemContent, PortfolioMediaType } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

/** Savee-like edge for media; text keeps a readable max width. */
const EDGE = "px-3 sm:px-4";
const TEXT_SHELL = cn(EDGE, "mx-auto w-full max-w-[52rem]");

const SAMPLE_GALLERY = [
  "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80",
];

function MetaCell({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="min-w-0">
      <p className="text-[0.65rem] uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-1.5 text-sm leading-snug text-white/90">{value}</p>
    </div>
  );
}

function MediaBlock({
  type,
  url,
  className,
  editable,
  isSample,
  onRemove,
}: {
  type: PortfolioItemContent["coverMediaType"];
  url: string | null;
  className?: string;
  editable?: boolean;
  isSample?: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className={cn("group relative w-full overflow-hidden bg-[#111]", className)}>
      <div className="aspect-[16/10] w-full sm:aspect-[16/9]">
        <PortfolioMediaFill type={type} url={url} loopVideo className="absolute inset-0" />
      </div>
      {isSample ? (
        <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-white/70">
          Sample
        </span>
      ) : null}
      {editable && onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white/85 opacity-0 transition group-hover:opacity-100"
          aria-label="Remove image"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

type MediaEntry = {
  id: string;
  mediaType: PortfolioMediaType | null;
  mediaUrl: string | null;
  isSample?: boolean;
  kind: "cover" | "gallery";
};

export function PortfolioProjectView({
  item,
  backHref,
  backLabel = "Back to portfolio",
  relatedItems = [],
  projectHrefForItem,
  contactHref,
  contactLabel = "Get in touch",
  onBack,
  onSelectRelated,
  showSamples = false,
  mode = "view",
  suppressSampleGallery = false,
  onUpdateItem,
  onUpload,
  onSuppressSampleGallery,
}: {
  item: PortfolioItemContent;
  backHref: string;
  backLabel?: string;
  relatedItems?: PortfolioItemContent[];
  projectHrefForItem?: (item: PortfolioItemContent) => string | null;
  contactHref?: string;
  contactLabel?: string;
  onBack?: () => void;
  onSelectRelated?: (item: PortfolioItemContent) => void;
  showSamples?: boolean;
  mode?: "edit" | "view";
  /** When true, do not inject SAMPLE_GALLERY fillers */
  suppressSampleGallery?: boolean;
  onUpdateItem?: (patch: {
    id: string;
    coverMediaType?: PortfolioMediaType | null;
    coverMediaUrl?: string | null;
    gallery?: PortfolioGalleryBlock[];
  }) => void | Promise<void>;
  onUpload?: (file: File) => Promise<string>;
  onSuppressSampleGallery?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const editable = mode === "edit" && Boolean(onUpdateItem || onSuppressSampleGallery);

  const subtitle =
    item.subtitle.trim() ||
    (showSamples && !item.subtitle.trim() ? "Crafting exceptional visual content." : "");
  const role =
    item.role.trim() ||
    (showSamples ? "Creative Direction, Motion Design, Cinematography" : "");
  const client = item.client.trim() || (showSamples ? item.title : "");
  const year = item.year.trim() || (showSamples ? String(new Date().getFullYear()) : "");
  const about =
    item.aboutText.trim() ||
    item.description.trim() ||
    (showSamples
      ? "A visual story built around brand, product, and atmosphere — paced for cinema and crafted for screens."
      : "");

  const galleryFromItem = item.gallery.filter((g) => g.mediaUrl);
  const useSampleGallery = showSamples && galleryFromItem.length === 0 && !suppressSampleGallery;

  const mediaStack: MediaEntry[] = [];
  if (item.coverMediaUrl) {
    mediaStack.push({
      id: "cover",
      mediaType: item.coverMediaType,
      mediaUrl: item.coverMediaUrl,
      kind: "cover",
    });
  } else if (useSampleGallery) {
    mediaStack.push({
      id: "cover-sample",
      mediaType: "image",
      mediaUrl: SAMPLE_GALLERY[0]!,
      isSample: true,
      kind: "cover",
    });
  }

  const galleryBlocks: MediaEntry[] = galleryFromItem.length
    ? galleryFromItem.map((g) => ({
        id: g.id,
        mediaType: g.mediaType,
        mediaUrl: g.mediaUrl,
        kind: "gallery" as const,
      }))
    : useSampleGallery
      ? SAMPLE_GALLERY.map((url, i) => ({
          id: `sample-g-${i}`,
          mediaType: "image" as const,
          mediaUrl: url,
          isSample: true,
          kind: "gallery" as const,
        }))
      : [];

  for (const g of galleryBlocks) {
    if (g.id === "cover") continue;
    if (mediaStack.some((m) => m.mediaUrl === g.mediaUrl)) continue;
    mediaStack.push(g);
  }

  const leadMedia = mediaStack.slice(0, 2);
  const restMedia = mediaStack.slice(2);
  const related = relatedItems.filter((r) => r.id !== item.id).slice(0, 2);

  const removeMedia = async (entry: MediaEntry) => {
    if (entry.isSample) {
      onSuppressSampleGallery?.();
      return;
    }
    if (!onUpdateItem) return;
    if (entry.kind === "cover" || entry.id === "cover") {
      await onUpdateItem({
        id: item.id,
        coverMediaType: null,
        coverMediaUrl: null,
      });
      return;
    }
    await onUpdateItem({
      id: item.id,
      gallery: item.gallery.filter((g) => g.id !== entry.id),
    });
  };

  const addMedia = async (file: File) => {
    if (!onUpload || !onUpdateItem) return;
    setUploading(true);
    try {
      const url = await onUpload(file);
      const mediaType: PortfolioMediaType = file.type.startsWith("video/") ? "video" : "image";
      if (!item.coverMediaUrl) {
        await onUpdateItem({
          id: item.id,
          coverMediaType: mediaType,
          coverMediaUrl: url,
        });
      } else {
        const next: PortfolioGalleryBlock = {
          id: `g-${Date.now()}`,
          mediaType,
          mediaUrl: url,
        };
        await onUpdateItem({
          id: item.id,
          gallery: [...item.gallery.filter((g) => g.mediaUrl), next],
        });
      }
      onSuppressSampleGallery?.();
    } finally {
      setUploading(false);
    }
  };

  const Back = onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-white/45 transition hover:text-white"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {backLabel}
    </button>
  ) : (
    <Link
      href={backHref}
      className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-white/45 transition hover:text-white"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {backLabel}
    </Link>
  );

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className={cn("pb-10 pt-8 sm:pb-14 sm:pt-12", TEXT_SHELL)}>
        {Back}

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-start lg:gap-16">
          <div className="min-w-0">
            <h1 className="text-[clamp(2.25rem,5vw,3.75rem)] font-medium leading-[1.05] tracking-[-0.03em] text-white">
              {item.title}
            </h1>
            {subtitle ? (
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/50 sm:text-base">{subtitle}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 lg:grid-cols-1 lg:gap-7">
            <MetaCell label="Role" value={role} />
            <MetaCell label="Client" value={client} />
            <MetaCell label="Year" value={year} />
          </div>
        </div>
      </div>

      {/* Lead media */}
      <div className={cn("space-y-3 sm:space-y-4", EDGE)}>
        {leadMedia.map((block) => (
          <MediaBlock
            key={block.id}
            type={block.mediaType}
            url={block.mediaUrl}
            className="rounded-[10px]"
            editable={editable}
            isSample={block.isSample}
            onRemove={() => void removeMedia(block)}
          />
        ))}
      </div>

      {/* Case study summary */}
      {(() => {
        const blocks = [
          {
            label: "Problem",
            value:
              item.problem.trim() ||
              (showSamples ? "The brand needed a clearer visual story for product launches." : ""),
          },
          {
            label: "Solution",
            value:
              item.solution.trim() ||
              (showSamples ? "A cinematic system of stills and motion built around one mood." : ""),
          },
          {
            label: "Challenge",
            value:
              item.challenge.trim() ||
              (showSamples ? "Keep consistency across formats without losing atmosphere." : ""),
          },
          {
            label: "Result",
            value:
              item.result.trim() ||
              (showSamples ? "A cohesive look that scales from hero to social cuts." : ""),
          },
        ].filter((b) => b.value);
        if (!blocks.length && !about) {
          return <div className="h-12 sm:h-16" />;
        }
        return (
          <section className={cn("space-y-12 py-16 sm:py-20", TEXT_SHELL)}>
            {about ? (
              <div className="grid gap-8 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-12">
                <h2 className="text-[0.7rem] uppercase tracking-[0.14em] text-white/40">About</h2>
                <p className="max-w-2xl whitespace-pre-wrap text-sm leading-[1.75] text-white/70 sm:text-[0.95rem]">
                  {about}
                </p>
              </div>
            ) : null}
            {blocks.length ? (
              <div className="grid gap-8 sm:grid-cols-2">
                {blocks.map((block) => (
                  <div key={block.label} className="min-w-0">
                    <h3 className="text-[0.7rem] uppercase tracking-[0.14em] text-white/40">{block.label}</h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/70">{block.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        );
      })()}

      {/* Remaining gallery */}
      {restMedia.length > 0 || (editable && onUpload) ? (
        <div className={cn("space-y-3 pb-6 sm:space-y-4 sm:pb-10", EDGE)}>
          {restMedia.map((block) => (
            <MediaBlock
              key={block.id}
              type={block.mediaType}
              url={block.mediaUrl}
              className="rounded-[10px]"
              editable={editable}
              isSample={block.isSample}
              onRemove={() => void removeMedia(block)}
            />
          ))}
          {editable && onUpload && onUpdateItem ? (
            <>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-white/15 bg-[#111] text-white/40 transition hover:border-white/30 hover:text-white/70 sm:aspect-[16/9] disabled:opacity-50"
              >
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs uppercase tracking-[0.12em]">
                  {uploading ? "Uploading…" : "Add image"}
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void addMedia(file);
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {/* Continue / related */}
      <section className="bg-[#fbfbfb] py-16 text-[#141414] sm:py-20">
        <div className={EDGE}>
          <div className="mx-auto max-w-[42rem] text-center">
            <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">Continue the journey</h2>
            <p className="mt-2 text-[0.7rem] uppercase tracking-[0.16em] text-black/40">Explore more projects</p>
          </div>

          {related.length > 0 ? (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5">
              {related.map((rel) => {
                const href = projectHrefForItem?.(rel);
                const card = (
                  <>
                    <div className="relative aspect-[16/11] overflow-hidden bg-[#111]">
                      <PortfolioMediaFill
                        type={rel.coverMediaType}
                        url={rel.coverMediaUrl}
                        loopVideo
                        className="absolute inset-0"
                      />
                    </div>
                    <div className="bg-[#0a0a0a] px-4 py-3 text-white">
                      <p className="truncate text-sm font-medium">{rel.title}</p>
                      <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.12em] text-white/40">
                        {rel.year || rel.client || "Project"}
                      </p>
                    </div>
                  </>
                );

                if (href) {
                  return (
                    <Link
                      key={rel.id}
                      href={href}
                      className="overflow-hidden rounded-[8px] transition hover:opacity-95"
                    >
                      {card}
                    </Link>
                  );
                }

                if (onSelectRelated) {
                  return (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => onSelectRelated(rel)}
                      className="overflow-hidden rounded-[8px] text-left transition hover:opacity-95"
                    >
                      {card}
                    </button>
                  );
                }

                return (
                  <div key={rel.id} className="overflow-hidden rounded-[8px]">
                    {card}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-10 text-center text-sm text-black/40">More projects will show up here.</p>
          )}

          {/* CTA — Nexa accent, not purple */}
          <div className="relative mt-12 overflow-hidden rounded-[8px] bg-[#141414]">
            <div
              className="absolute inset-0 opacity-80"
              style={{
                background:
                  "radial-gradient(ellipse 80% 70% at 70% 40%, rgba(255,69,0,0.45), transparent 55%), radial-gradient(ellipse 60% 50% at 20% 80%, rgba(255,255,255,0.08), transparent 50%)",
              }}
            />
            <div className="relative flex flex-col items-center px-6 py-16 text-center sm:py-20">
              <p className="max-w-md text-2xl font-medium tracking-tight text-white sm:text-3xl">
                Ready to start your next project?
              </p>
              {contactHref ? (
                <Link
                  href={contactHref}
                  className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
                >
                  {contactLabel}
                </Link>
              ) : (
                <span className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black">
                  {contactLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] bg-[#0a0a0a] py-10">
        <div className={cn("flex flex-wrap items-center justify-between gap-4", EDGE)}>
          {Back}
          <p className="text-[0.65rem] uppercase tracking-[0.14em] text-white/30">{item.title}</p>
        </div>
      </footer>
    </main>
  );
}
