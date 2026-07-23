"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ImagePlus, Plus, X } from "lucide-react";
import { PortfolioMediaFill } from "@/components/portfolio/portfolio-media";
import { HighlightsParallaxHero } from "@/components/portfolio/portfolio-highlights-parallax";
import { PortfolioProjectView } from "@/components/portfolio/portfolio-project-view";
import { cn } from "@/lib/utils";
import type {
  PortfolioAspect,
  PortfolioHeroStat,
  PortfolioHighlight,
  PortfolioItemContent,
  PortfolioMediaType,
  PortfolioNavItem,
  PortfolioPageContent,
  PortfolioSiteData,
} from "@/lib/portfolio";
import { detectMediaTypeFromUrlOrFile } from "@/lib/portfolio-upload";

export type PortfolioSiteMode = "edit" | "view";

type PortfolioSiteProps = {
  mode: PortfolioSiteMode;
  data: PortfolioSiteData;
  onChangePage?: (patch: Partial<PortfolioPageContent>) => void | Promise<void>;
  onPublish?: () => void | Promise<void>;
  onAddItem?: (input: {
    title: string;
    coverMediaType: PortfolioMediaType | null;
    coverMediaUrl: string | null;
    description: string;
    subtitle?: string;
    role?: string;
    client?: string;
    year?: string;
    aboutText?: string;
    aspect: PortfolioAspect;
  }) => void | Promise<void>;
  onUpload?: (folder: "logo" | "hero" | "about" | "items", file: File) => Promise<string>;
  publishing?: boolean;
  publicUrl?: string | null;
  publishSuccessLabel?: string;
  viewLiveLabel?: string;
  showSamples?: boolean;
  /** Public project URLs, e.g. (id) => `/p/slug/w/${id}` */
  projectHrefForItem?: (item: PortfolioItemContent) => string | null;
};

function InlineText({
  mode,
  value,
  onSave,
  className,
  as: Tag = "span",
}: {
  mode: PortfolioSiteMode;
  value: string;
  onSave: (next: string) => void;
  className?: string;
  as?: "span" | "h1" | "h2" | "p" | "button";
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
        {value || (mode === "edit" ? "Click to edit" : "")}
      </Tag>
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

function InlineHeadline({
  mode,
  value,
  onSave,
}: {
  mode: PortfolioSiteMode;
  value: string;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  if (mode !== "edit" || !editing) {
    return (
      <h1
        className={cn(
          "max-w-3xl text-[clamp(1.75rem,4.2vw,3.25rem)] font-medium leading-[1.12] tracking-[-0.02em] text-white",
          mode === "edit" &&
            "cursor-text rounded-sm outline-offset-4 hover:outline hover:outline-1 hover:outline-white/20",
        )}
        onClick={mode === "edit" ? () => setEditing(true) : undefined}
      >
        {value || (mode === "edit" ? "Click to edit headline…" : "")}
      </h1>
    );
  }

  return (
    <textarea
      autoFocus
      value={draft}
      rows={4}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft.trim() !== value) onSave(draft.trim());
      }}
      className="max-w-3xl w-full resize-y rounded-md border border-white/20 bg-black/40 px-2 py-2 text-[clamp(1.75rem,4.2vw,3.25rem)] font-medium leading-[1.12] tracking-[-0.02em] text-white outline-none"
    />
  );
}

function aspectClass(aspect: PortfolioAspect): string {
  if (aspect === "portrait") return "aspect-[3/4]";
  if (aspect === "square") return "aspect-square";
  return "aspect-[4/3]";
}

const SAMPLE_ITEMS: PortfolioItemContent[] = [
  {
    id: "sample-1",
    title: "Amber Hour",
    subtitle: "Crafting exceptional visual content.",
    role: "Creative Direction, Cinematography",
    client: "Amber Hour",
    year: "2024",
    coverMediaType: "image",
    coverMediaUrl:
      "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80",
    description: "Sample — cinematic still. Replace with your own project.",
    aboutText: "Sample — cinematic still. Replace with your own project.",
    gallery: [],
    sortOrder: 0,
    aspect: "portrait",
  },
  {
    id: "sample-2",
    title: "Coast Line",
    subtitle: "",
    role: "",
    client: "",
    year: "",
    coverMediaType: "image",
    coverMediaUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
    description: "Sample — landscape frame for the grid.",
    aboutText: "",
    gallery: [],
    sortOrder: 1,
    aspect: "portrait",
  },
  {
    id: "sample-3",
    title: "Studio Light",
    subtitle: "",
    role: "",
    client: "",
    year: "",
    coverMediaType: "image",
    coverMediaUrl:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80",
    description: "Sample — square crop.",
    aboutText: "",
    gallery: [],
    sortOrder: 2,
    aspect: "portrait",
  },
  {
    id: "sample-4",
    title: "Night Market",
    subtitle: "",
    role: "",
    client: "",
    year: "",
    coverMediaType: "image",
    coverMediaUrl:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=80",
    description: "Sample — tall portrait for masonry rhythm.",
    aboutText: "",
    gallery: [],
    sortOrder: 3,
    aspect: "portrait",
  },
  {
    id: "sample-5",
    title: "Desert Run",
    subtitle: "",
    role: "",
    client: "",
    year: "",
    coverMediaType: "image",
    coverMediaUrl:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80",
    description: "Sample — wide landscape.",
    aboutText: "",
    gallery: [],
    sortOrder: 4,
    aspect: "portrait",
  },
  {
    id: "sample-6",
    title: "Glass Tower",
    subtitle: "",
    role: "",
    client: "",
    year: "",
    coverMediaType: "image",
    coverMediaUrl:
      "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=900&q=80",
    description: "Sample — architecture still.",
    aboutText: "",
    gallery: [],
    sortOrder: 5,
    aspect: "portrait",
  },
];

const SAMPLE_ABOUT =
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80";

const SAMPLE_ABOUT_TEXT =
  "Sample bio — filmmaker and visual storyteller. Replace this with your own about text.";

const SAMPLE_HIGHLIGHTS: PortfolioHighlight[] = [
  {
    id: "sample-h1",
    title: "Amber Hour",
    description: "Sample highlight — cinematic still for brands that want atmosphere.",
    coverMediaType: "image",
    coverMediaUrl:
      "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1600&q=80",
    linkedItemId: null,
  },
  {
    id: "sample-h2",
    title: "Night Market",
    description: "Sample highlight — motion and light in a crowded street scene.",
    coverMediaType: "image",
    coverMediaUrl:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1600&q=80",
    linkedItemId: null,
  },
  {
    id: "sample-h3",
    title: "Coast Line",
    description: "Sample highlight — wide landscape frame for the highlights slider.",
    coverMediaType: "image",
    coverMediaUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
    linkedItemId: null,
  },
];

function HighlightsSlider({
  slides,
  mode,
  usingSamples,
  projectHrefForItem,
  onOpenLinked,
  onRemove,
  viewLabel = "View project",
}: {
  slides: PortfolioHighlight[];
  mode: PortfolioSiteMode;
  usingSamples: boolean;
  projectHrefForItem?: (item: PortfolioItemContent) => string | null;
  onOpenLinked: (linkedItemId: string) => void;
  onRemove?: (id: string) => void;
  viewLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  const scrollToIndex = (index: number) => {
    const container = ref.current;
    if (!container) return;
    const next = Math.max(0, Math.min(index, slides.length - 1));
    container.scrollTo({ left: next * container.clientWidth, behavior: "smooth" });
    setActiveIndex(next);
  };

  if (!slides.length) return null;

  return (
    <>
      <div className="relative">
        <div
          ref={ref}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={() => {
            const container = ref.current;
            if (!container?.clientWidth) return;
            const idx = Math.round(container.scrollLeft / container.clientWidth);
            setActiveIndex(Math.max(0, Math.min(idx, slides.length - 1)));
          }}
        >
          {slides.map((slide) => {
            const linkedHref =
              !usingSamples && slide.linkedItemId && projectHrefForItem
                ? projectHrefForItem({ id: slide.linkedItemId } as PortfolioItemContent)
                : null;

            return (
              <div key={slide.id} className="w-full min-w-full snap-start">
                <div className="relative min-h-[42vh] w-full overflow-hidden rounded-lg bg-[#1a1a1a] sm:min-h-[50vh]">
                  <PortfolioMediaFill
                    type={slide.coverMediaType}
                    url={slide.coverMediaUrl}
                    loopVideo
                    className="absolute inset-0"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.4)_50%,transparent_100%)]" />
                  <div className="absolute inset-x-0 bottom-0 z-10 p-6">
                    <div className="max-w-[min(100%,28rem)] text-left">
                      <p className="text-[1.35rem] font-normal text-white sm:text-[1.4rem]">{slide.title}</p>
                      {slide.description ? (
                        <p className="mt-2 text-[0.85rem] text-white/60">{slide.description}</p>
                      ) : null}
                      {linkedHref && mode === "view" ? (
                        <Link
                          href={linkedHref}
                          className="mt-4 inline-flex rounded-md border border-white/35 px-2.5 py-1 text-xs text-white transition hover:bg-white/10"
                        >
                          {viewLabel}
                        </Link>
                      ) : slide.linkedItemId && !usingSamples ? (
                        <button
                          type="button"
                          onClick={() => onOpenLinked(slide.linkedItemId!)}
                          className="mt-4 inline-flex rounded-md border border-white/35 px-2.5 py-1 text-xs text-white transition hover:bg-white/10"
                        >
                          {viewLabel}
                        </button>
                      ) : null}
                      {mode === "edit" && onRemove && !usingSamples ? (
                        <button
                          type="button"
                          onClick={() => onRemove(slide.id)}
                          className="mt-3 ml-0 block text-[0.65rem] uppercase tracking-[0.1em] text-white/45 hover:text-white/80"
                        >
                          Remove from highlights
                        </button>
                      ) : null}
                      {usingSamples ? (
                        <span className="mt-3 inline-block text-[0.6rem] uppercase tracking-[0.1em] text-white/40">
                          Sample
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {slides.length > 1 ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3">
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex - 1)}
              className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/50"
              aria-label="Previous highlights"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex + 1)}
              className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/50"
              aria-label="Next highlights"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {slides.length > 1 ? (
        <div className="mt-3 flex justify-center gap-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => scrollToIndex(index)}
              aria-label={`Go to highlight ${index + 1}`}
              className={cn(
                "h-2 rounded-full transition",
                activeIndex === index ? "w-6 bg-[#141414]" : "w-2 bg-[#141414]/25",
              )}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function ProjectMarquee({
  items,
  usingSamples,
  projectHrefForItem,
  onOpenItem,
}: {
  items: PortfolioItemContent[];
  usingSamples: boolean;
  projectHrefForItem?: (item: PortfolioItemContent) => string | null;
  onOpenItem: (item: PortfolioItemContent) => void;
}) {
  if (!items.length) return null;

  const base =
    items.length >= 6
      ? items
      : Array.from({ length: Math.ceil(6 / items.length) }, () => items).flat();
  const loop = [...base, ...base];

  const CardInner = ({ item }: { item: PortfolioItemContent }) => (
    <>
      <PortfolioMediaFill
        type={item.coverMediaType}
        url={item.coverMediaUrl}
        loopVideo
        className="absolute inset-0"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
        <p className="truncate text-xs text-white">{item.title}</p>
      </div>
      {usingSamples ? (
        <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.1em] text-white/50">
          Sample
        </span>
      ) : null}
    </>
  );

  return (
    <div className="portfolio-marquee group/marquee relative mt-14 w-full overflow-hidden">
      <div className="portfolio-marquee-track flex w-max gap-3 py-1">
        {loop.map((item, index) => {
          const href = !usingSamples ? projectHrefForItem?.(item) : null;
          const className =
            "group relative h-[280px] w-[200px] shrink-0 overflow-hidden rounded-sm bg-[#161616] sm:h-[320px] sm:w-[230px]";

          if (href) {
            return (
              <Link key={`${item.id}-${index}`} href={href} className={className}>
                <CardInner item={item} />
              </Link>
            );
          }

          return (
            <button
              key={`${item.id}-${index}`}
              type="button"
              onClick={() => onOpenItem(item)}
              className={cn(className, "text-left")}
            >
              <CardInner item={item} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PortfolioSite({
  mode,
  data,
  onChangePage,
  onPublish,
  onAddItem,
  onUpload,
  publishing,
  publicUrl,
  publishSuccessLabel = "Published successfully",
  viewLiveLabel = "Open live page",
  showSamples = false,
  projectHrefForItem,
}: PortfolioSiteProps) {
  const { page, items } = data;
  const usingSampleItems = showSamples && items.length === 0;
  const galleryItems = usingSampleItems ? SAMPLE_ITEMS : items;
  const usingSampleHighlights = showSamples && page.highlights.length === 0 && items.length === 0;
  const highlightSlides = usingSampleHighlights ? SAMPLE_HIGHLIGHTS : page.highlights;
  const usingSampleAboutImage = showSamples && !page.aboutImageUrl;
  const aboutImageUrl = page.aboutImageUrl ?? (showSamples ? SAMPLE_ABOUT : null);
  const aboutText = page.aboutText.trim() || (showSamples ? SAMPLE_ABOUT_TEXT : "");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<PortfolioItemContent | null>(null);
  const [publishToastOpen, setPublishToastOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const aboutInputRef = useRef<HTMLInputElement>(null);
  const publishWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!publishToastOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!publishWrapRef.current?.contains(event.target as Node)) {
        setPublishToastOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [publishToastOpen]);

  useEffect(() => {
    if (!publishToastOpen) return;
    const t = window.setTimeout(() => setPublishToastOpen(false), 8000);
    return () => window.clearTimeout(t);
  }, [publishToastOpen]);

  const scrollTo = (anchor: string) => {
    const id = anchor.replace(/^#/, "");
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePublish = async () => {
    if (!onPublish) return;
    try {
      await onPublish();
      setPublishToastOpen(true);
    } catch {
      /* parent surfaces error */
    }
  };

  const updateStat = (statId: string, patch: Partial<PortfolioHeroStat>) => {
    if (!onChangePage) return;
    const heroStats = page.heroStats.map((s) => (s.id === statId ? { ...s, ...patch } : s));
    void onChangePage({ heroStats });
  };

  const openProject = (item: PortfolioItemContent) => {
    if (usingSampleItems) {
      setDetailItem(item);
      return;
    }
    const href = mode === "view" ? projectHrefForItem?.(item) : null;
    if (href) {
      window.location.assign(href);
      return;
    }
    setDetailItem(item);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <button
            type="button"
            className={cn(
              "flex h-9 min-w-[2.5rem] items-center justify-start",
              mode === "edit" && "cursor-pointer rounded-md hover:bg-white/[0.04]",
            )}
            onClick={() => mode === "edit" && logoInputRef.current?.click()}
          >
            {page.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.logoUrl} alt="Logo" className="h-8 w-auto max-w-[120px] object-contain object-left" />
            ) : mode === "edit" ? (
              <span className="inline-flex items-center gap-1 text-xs text-white/40">
                <ImagePlus className="h-3.5 w-3.5" /> Logo
              </span>
            ) : (
              <span className="text-sm font-normal tracking-wide text-white/80">Portfolio</span>
            )}
          </button>
          {mode === "edit" ? (
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file || !onUpload || !onChangePage) return;
                const url = await onUpload("logo", file);
                await onChangePage({ logoUrl: url });
              }}
            />
          ) : null}

          <nav className="hidden flex-1 items-center justify-center gap-6 md:flex">
            {page.navItems.map((item) => (
              <div key={item.id} className="text-xs uppercase tracking-[0.14em] text-white/55">
                {mode === "edit" ? (
                  <InlineText
                    mode={mode}
                    value={item.label}
                    className="bg-transparent text-xs uppercase tracking-[0.14em] text-white/55 hover:text-white"
                    onSave={(label) => {
                      if (!onChangePage) return;
                      const navItems: PortfolioNavItem[] = page.navItems.map((n) =>
                        n.id === item.id ? { ...n, label } : n,
                      );
                      void onChangePage({ navItems });
                    }}
                  />
                ) : (
                  <button type="button" onClick={() => scrollTo(item.anchor)} className="transition hover:text-white">
                    {item.label}
                  </button>
                )}
              </div>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <a
              href="#about"
              onClick={(e) => {
                e.preventDefault();
                scrollTo("about");
              }}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/85 transition hover:border-white/30 hover:bg-white/[0.04]"
            >
              <InlineText
                mode={mode}
                value={page.ctaLabel}
                as="span"
                onSave={(ctaLabel) => void onChangePage?.({ ctaLabel })}
              />
            </a>
            {mode === "edit" ? (
              <div className="relative" ref={publishWrapRef}>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => void handlePublish()}
                  className="rounded-full bg-[#ff4500] px-3 py-1.5 text-xs font-normal text-white disabled:opacity-50"
                >
                  {publishing ? "Publishing…" : "Publish"}
                </button>
                {publishToastOpen ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(18rem,calc(100vw-2rem))] rounded-[8px] border border-white/10 bg-[#1a1a1a] p-3 shadow-xl">
                    <p className="text-xs font-normal text-emerald-400/95">{publishSuccessLabel}</p>
                    {publicUrl ? (
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block break-all text-[0.7rem] leading-relaxed text-[#ff4500] hover:underline"
                      >
                        {viewLiveLabel}
                        <span className="mt-1 block text-white/45">{publicUrl.replace(/^https?:\/\//, "")}</span>
                      </a>
                    ) : (
                      <p className="mt-2 text-[0.7rem] text-white/40">Public link unavailable for this account.</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Savee-style hero */}
      <section id="hero" className="w-full bg-[#0a0a0a] pt-14 sm:pt-20" aria-label="Hero">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <InlineHeadline
            mode={mode}
            value={page.heroHeadline}
            onSave={(heroHeadline) => void onChangePage?.({ heroHeadline })}
          />

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => scrollTo(page.heroPrimaryCta.anchor || "work")}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
            >
              <InlineText
                mode={mode}
                value={page.heroPrimaryCta.label}
                as="span"
                onSave={(label) =>
                  void onChangePage?.({ heroPrimaryCta: { ...page.heroPrimaryCta, label } })
                }
              />
            </button>
            <button
              type="button"
              onClick={() => scrollTo(page.heroSecondaryCta.anchor || "about")}
              className="rounded-full border border-white/35 bg-transparent px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/60 hover:bg-white/[0.04]"
            >
              <InlineText
                mode={mode}
                value={page.heroSecondaryCta.label}
                as="span"
                onSave={(label) =>
                  void onChangePage?.({ heroSecondaryCta: { ...page.heroSecondaryCta, label } })
                }
              />
            </button>
          </div>

          <div className="mt-12 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
            {page.heroStats.map((stat) => (
              <div key={stat.id} className="min-w-0">
                <InlineText
                  mode={mode}
                  value={stat.value}
                  className="block text-base font-medium text-white sm:text-lg"
                  onSave={(value) => updateStat(stat.id, { value })}
                />
                <InlineText
                  mode={mode}
                  value={stat.label}
                  className="mt-1 block text-xs text-white/45"
                  onSave={(label) => updateStat(stat.id, { label })}
                />
              </div>
            ))}
          </div>
        </div>

        <ProjectMarquee
          items={galleryItems}
          usingSamples={usingSampleItems}
          projectHrefForItem={projectHrefForItem}
          onOpenItem={openProject}
        />
      </section>

      {/* Gallery */}
      <section id="work" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-3">
          <h2 className="text-xs uppercase tracking-[0.16em] text-white/40">Work</h2>
          {usingSampleItems ? (
            <p className="text-[0.65rem] uppercase tracking-[0.12em] text-white/30">
              Sample collection — add a project to replace
            </p>
          ) : null}
        </div>
        <div className="columns-2 gap-3 md:columns-3 md:gap-4">
          {galleryItems.map((item) => {
            const href = !usingSampleItems ? projectHrefForItem?.(item) : null;
            const tileClass = cn(
              "group relative mb-3 w-full break-inside-avoid overflow-hidden rounded-sm bg-[#161616] text-left md:mb-4",
              aspectClass(item.aspect),
            );
            const body = (
              <>
                <PortfolioMediaFill
                  type={item.coverMediaType}
                  url={item.coverMediaUrl}
                  loopVideo
                  className="absolute inset-0"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
                  <p className="truncate text-sm text-white">{item.title}</p>
                </div>
                {usingSampleItems ? (
                  <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-white/50">
                    Sample
                  </span>
                ) : null}
              </>
            );

            if (href && mode === "view") {
              return (
                <Link key={item.id} href={href} className={tileClass}>
                  {body}
                </Link>
              );
            }

            return (
              <button key={item.id} type="button" onClick={() => openProject(item)} className={tileClass}>
                {body}
              </button>
            );
          })}
          {mode === "edit" ? (
            <button
              type="button"
              onClick={() => setProjectModalOpen(true)}
              className="mb-3 flex aspect-[4/3] w-full break-inside-avoid flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-white/15 bg-transparent text-white/40 transition hover:border-white/30 hover:text-white/70 md:mb-4"
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs uppercase tracking-[0.12em]">Add project</span>
            </button>
          ) : null}
        </div>
      </section>

      {/* Highlights — light band: parallax hero + slider */}
      <section id="highlights" className="scroll-mt-20 bg-[#fbfbfb] py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <HighlightsParallaxHero
            mode={mode}
            title={page.bandTitle}
            tagline={page.bandTagline}
            projects={galleryItems}
            onChangeTitle={(bandTitle) => void onChangePage?.({ bandTitle })}
            onChangeTagline={(bandTagline) => void onChangePage?.({ bandTagline })}
          />

          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[0.7rem] uppercase tracking-[0.1em] text-black/40">Highlights</h2>
            {mode === "edit" && !usingSampleHighlights ? (
              <button
                type="button"
                onClick={() => setHighlightPickerOpen(true)}
                className="rounded-md border border-black/10 px-2.5 py-1 text-[0.7rem] text-black/55 transition hover:border-black/25 hover:text-black"
              >
                Add highlight
              </button>
            ) : null}
            {usingSampleHighlights ? (
              <p className="text-[0.65rem] uppercase tracking-[0.12em] text-black/30">
                Sample — add projects, then highlights
              </p>
            ) : null}
          </div>

          {highlightSlides.length > 0 ? (
            <HighlightsSlider
              slides={highlightSlides}
              mode={mode}
              usingSamples={usingSampleHighlights}
              projectHrefForItem={projectHrefForItem}
              onOpenLinked={(linkedItemId) => {
                const found = items.find((i) => i.id === linkedItemId);
                if (found) openProject(found);
              }}
              onRemove={
                mode === "edit"
                  ? (id) => {
                      void onChangePage?.({
                        highlights: page.highlights.filter((h) => h.id !== id),
                      });
                    }
                  : undefined
              }
            />
          ) : mode === "edit" ? (
            <button
              type="button"
              onClick={() => setHighlightPickerOpen(true)}
              className="flex min-h-[260px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-black/15 bg-white/60 text-black/40 transition hover:border-black/30 hover:text-black/70"
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs uppercase tracking-[0.12em]">Add highlight from a project</span>
            </button>
          ) : null}
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 py-20 sm:grid-cols-2 sm:px-6">
        <div>
          <h2 className="mb-4 text-xs uppercase tracking-[0.16em] text-white/40">About</h2>
          {mode === "edit" ? (
            <textarea
              value={page.aboutText}
              onChange={(e) => void onChangePage?.({ aboutText: e.target.value })}
              rows={10}
              placeholder={showSamples ? SAMPLE_ABOUT_TEXT : "Tell your story…"}
              className="w-full resize-y rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm leading-relaxed text-white/85 outline-none placeholder:text-white/25 focus:border-white/25"
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">{aboutText}</p>
          )}
        </div>
        <div>
          <button
            type="button"
            disabled={mode !== "edit"}
            onClick={() => mode === "edit" && aboutInputRef.current?.click()}
            className={cn(
              "relative aspect-[4/5] w-full overflow-hidden rounded-sm bg-[#161616]",
              mode === "edit" && "cursor-pointer ring-0 hover:ring-1 hover:ring-white/20",
            )}
          >
            <PortfolioMediaFill type="image" url={aboutImageUrl} className="absolute inset-0" />
            {mode === "edit" && !aboutImageUrl ? (
              <span className="absolute inset-0 flex items-center justify-center text-xs text-white/35">
                Upload photo
              </span>
            ) : null}
            {usingSampleAboutImage ? (
              <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-white/50">
                Sample
              </span>
            ) : null}
          </button>
          {mode === "edit" ? (
            <input
              ref={aboutInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file || !onUpload || !onChangePage) return;
                const url = await onUpload("about", file);
                await onChangePage({ aboutImageUrl: url });
              }}
            />
          ) : null}
        </div>
      </section>

      {mode === "edit" && projectModalOpen ? (
        <ProjectModal
          onClose={() => setProjectModalOpen(false)}
          onUpload={onUpload}
          onSave={async (input) => {
            await onAddItem?.(input);
            setProjectModalOpen(false);
          }}
        />
      ) : null}

      {mode === "edit" && highlightPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-[8px] border border-white/10 bg-[#141414] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm uppercase tracking-[0.1em] text-white">Add highlight</h3>
              <button
                type="button"
                onClick={() => setHighlightPickerOpen(false)}
                className="text-white/50 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-white/40">Pick a project to feature in the highlights slider.</p>
            {items.length === 0 ? (
              <p className="mt-6 text-sm text-white/50">Add a project in Work first.</p>
            ) : (
              <ul className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
                {items.map((item) => {
                  const already = page.highlights.some((h) => h.linkedItemId === item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={already}
                        onClick={() => {
                          if (already || !onChangePage) return;
                          const next: PortfolioHighlight = {
                            id: `h-${item.id}`,
                            title: item.title,
                            description: item.description,
                            coverMediaType: item.coverMediaType,
                            coverMediaUrl: item.coverMediaUrl,
                            linkedItemId: item.id,
                          };
                          void onChangePage({ highlights: [...page.highlights, next] });
                          setHighlightPickerOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-[8px] border border-white/10 px-3 py-2 text-left transition hover:border-white/25 disabled:opacity-40"
                      >
                        <span className="relative h-12 w-10 shrink-0 overflow-hidden rounded-sm bg-[#222]">
                          <PortfolioMediaFill
                            type={item.coverMediaType}
                            url={item.coverMediaUrl}
                            className="absolute inset-0"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-white">{item.title}</span>
                          <span className="block text-[0.65rem] text-white/40">
                            {already ? "Already in highlights" : "Add to highlights"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {detailItem ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0a0a]">
          <button
            type="button"
            className="fixed right-4 top-4 z-20 rounded-full border border-white/15 bg-black/50 p-2 text-white/70 hover:text-white"
            onClick={() => setDetailItem(null)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <PortfolioProjectView
            item={detailItem}
            backHref="#"
            backLabel="Back to portfolio"
            onBack={() => setDetailItem(null)}
            relatedItems={galleryItems}
            projectHrefForItem={mode === "view" && !usingSampleItems ? projectHrefForItem : undefined}
            onSelectRelated={(rel) => {
              setDetailItem(rel);
            }}
            contactLabel={page.ctaLabel || "Get in touch"}
            showSamples={usingSampleItems || showSamples}
          />
        </div>
      ) : null}
    </div>
  );
}

function ProjectModal({
  onClose,
  onSave,
  onUpload,
}: {
  onClose: () => void;
  onSave: (input: {
    title: string;
    coverMediaType: PortfolioMediaType | null;
    coverMediaUrl: string | null;
    description: string;
    subtitle?: string;
    role?: string;
    client?: string;
    year?: string;
    aboutText?: string;
    aspect: PortfolioAspect;
  }) => Promise<void>;
  onUpload?: (folder: "logo" | "hero" | "about" | "items", file: File) => Promise<string>;
}) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [role, setRole] = useState("");
  const [client, setClient] = useState("");
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverType, setCoverType] = useState<PortfolioMediaType | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        subtitle: subtitle.trim(),
        role: role.trim(),
        client: client.trim(),
        year: year.trim(),
        coverMediaType: coverType,
        coverMediaUrl: coverUrl,
        description,
        aboutText: description,
        aspect: "portrait",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[8px] border border-white/10 bg-[#141414] p-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm uppercase tracking-[0.1em] text-white">New project</h3>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-[0.65rem] uppercase tracking-[0.08em] text-white/45">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-[8px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[0.65rem] uppercase tracking-[0.08em] text-white/45">Subtitle</span>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Crafting exceptional visual content."
              className="w-full rounded-[8px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-[0.65rem] uppercase tracking-[0.08em] text-white/45">Role</span>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-[8px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[0.65rem] uppercase tracking-[0.08em] text-white/45">Client</span>
              <input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="w-full rounded-[8px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[0.65rem] uppercase tracking-[0.08em] text-white/45">Year</span>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full rounded-[8px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-[0.65rem] uppercase tracking-[0.08em] text-white/45">About</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-[8px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </label>
          <div className="relative aspect-video overflow-hidden rounded-[8px] bg-black">
            <PortfolioMediaFill type={coverType} url={coverUrl} loopVideo />
            {!coverUrl ? (
              <span className="absolute inset-0 flex items-center justify-center text-xs text-white/35">
                Cover image or video
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-[8px] border border-white/15 px-3 py-2 text-xs text-white/70"
            >
              Upload cover
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file || !onUpload) return;
                const url = await onUpload("items", file);
                setCoverUrl(url);
                setCoverType(detectMediaTypeFromUrlOrFile(file, url));
              }}
            />
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="Or paste media URL…"
              className="min-w-0 flex-1 rounded-[8px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              className="rounded-[8px] bg-white/10 px-3 py-2 text-xs text-white"
              onClick={() => {
                const url = urlDraft.trim();
                if (!url) return;
                setCoverUrl(url);
                setCoverType(detectMediaTypeFromUrlOrFile(null, url));
                setUrlDraft("");
              }}
            >
              Use URL
            </button>
          </div>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-[8px] bg-[#ff4500] py-2.5 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add project"}
          </button>
        </div>
      </form>
    </div>
  );
}
