"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PortfolioMediaFill } from "@/components/portfolio/portfolio-media";
import type { PortfolioItemContent } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

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
}: {
  type: PortfolioItemContent["coverMediaType"];
  url: string | null;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full overflow-hidden bg-[#111]", className)}>
      <div className="aspect-[16/10] w-full sm:aspect-[16/9]">
        <PortfolioMediaFill type={type} url={url} loopVideo className="absolute inset-0" />
      </div>
    </div>
  );
}

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
}) {
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
  const gallery =
    galleryFromItem.length > 0
      ? galleryFromItem
      : showSamples
        ? SAMPLE_GALLERY.map((url, i) => ({
            id: `sample-g-${i}`,
            mediaType: "image" as const,
            mediaUrl: url,
          }))
        : [];

  const mediaStack: Array<{ id: string; mediaType: PortfolioItemContent["coverMediaType"]; mediaUrl: string | null }> =
    [];
  if (item.coverMediaUrl) {
    mediaStack.push({
      id: "cover",
      mediaType: item.coverMediaType,
      mediaUrl: item.coverMediaUrl,
    });
  } else if (showSamples) {
    mediaStack.push({
      id: "cover-sample",
      mediaType: "image",
      mediaUrl: SAMPLE_GALLERY[0]!,
    });
  }
  for (const g of gallery) {
    if (g.id === "cover") continue;
    mediaStack.push(g);
  }

  const leadMedia = mediaStack.slice(0, 2);
  const restMedia = mediaStack.slice(2);
  const related = relatedItems.filter((r) => r.id !== item.id).slice(0, 2);

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
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-12">
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
      <div className="mx-auto max-w-6xl space-y-3 px-4 sm:space-y-4 sm:px-6">
        {leadMedia.map((block) => (
          <MediaBlock key={block.id} type={block.mediaType} url={block.mediaUrl} />
        ))}
      </div>

      {/* About */}
      {about ? (
        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-12 sm:px-6 sm:py-20">
          <h2 className="text-[0.7rem] uppercase tracking-[0.14em] text-white/40">About</h2>
          <p className="max-w-2xl whitespace-pre-wrap text-sm leading-[1.75] text-white/70 sm:text-[0.95rem]">
            {about}
          </p>
        </section>
      ) : (
        <div className="h-12 sm:h-16" />
      )}

      {/* Remaining gallery */}
      {restMedia.length > 0 ? (
        <div className="mx-auto max-w-6xl space-y-3 px-4 pb-6 sm:space-y-4 sm:px-6 sm:pb-10">
          {restMedia.map((block) => (
            <MediaBlock key={block.id} type={block.mediaType} url={block.mediaUrl} />
          ))}
        </div>
      ) : null}

      {/* Continue / related */}
      <section className="bg-[#fbfbfb] py-16 text-[#141414] sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          {Back}
          <p className="text-[0.65rem] uppercase tracking-[0.14em] text-white/30">{item.title}</p>
        </div>
      </footer>
    </main>
  );
}
