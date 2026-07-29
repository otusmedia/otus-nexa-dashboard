"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

export type DeliveriesCardAspect = "landscape" | "portrait" | "square";

export type DeliveriesExplorerItem = {
  id: string;
  title: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  /** Optional hint; real ratio is measured from the media when possible. */
  aspect?: DeliveriesCardAspect;
};

type Props = {
  items: DeliveriesExplorerItem[];
  brandLabel?: string;
  headline?: string;
  viewLabel?: string;
  className?: string;
};

const FALLBACK_CYCLE: DeliveriesCardAspect[] = [
  "portrait",
  "landscape",
  "square",
  "portrait",
  "square",
  "landscape",
  "portrait",
  "landscape",
  "square",
];

function ratioFromAspect(aspect: DeliveriesCardAspect): number {
  if (aspect === "landscape") return 16 / 10;
  if (aspect === "portrait") return 3 / 4;
  return 1;
}

function classifyRatio(ratio: number): DeliveriesCardAspect {
  if (ratio >= 1.15) return "landscape";
  if (ratio <= 0.88) return "portrait";
  return "square";
}

function MasonryCell({
  item,
  index,
  viewLabel,
  onRatioReady,
}: {
  item: DeliveriesExplorerItem;
  index: number;
  viewLabel: string;
  onRatioReady: () => void;
}) {
  const fallback = ratioFromAspect(item.aspect ?? FALLBACK_CYCLE[index % FALLBACK_CYCLE.length]!);
  const [ratio, setRatio] = useState(fallback);

  const applySize = useCallback(
    (w: number, h: number) => {
      if (!(w > 0 && h > 0)) return;
      const next = w / h;
      setRatio((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
      onRatioReady();
    },
    [onRatioReady],
  );

  return (
    <div
      role="listitem"
      data-grid-cell
      data-aspect={classifyRatio(ratio)}
      className="group relative mb-[0.25em] w-full break-inside-avoid overflow-hidden bg-[#111]"
      style={{ aspectRatio: `${ratio}`, perspective: "800px" }}
    >
      {item.mediaType === "video" ? (
        <video
          src={item.mediaUrl}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          draggable={false}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            applySize(v.videoWidth, v.videoHeight);
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.mediaUrl}
          alt={item.title}
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            applySize(img.naturalWidth, img.naturalHeight);
          }}
        />
      )}

      <button
        type="button"
        className="absolute inset-0 z-[2] flex items-center justify-center"
        aria-label={item.title}
        onClick={(e) => {
          e.preventDefault();
        }}
      >
        <span
          className={cn(
            "rounded-[0.25em] bg-black/45 px-[0.64em] py-[0.48em] text-[0.65rem] font-medium uppercase tracking-[0.08em] text-white backdrop-blur-[5.8px]",
            "opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          )}
        >
          {viewLabel}
        </span>
      </button>
    </div>
  );
}

/**
 * OFFGRID works-section masonry — column masonry with per-media aspect ratios.
 * @see https://offgridtemplate.webflow.io/ (works-section)
 */
export function DeliveriesRecentExplorer({
  items,
  brandLabel = "Entregas",
  headline = "Recent deliveries that stand out",
  viewLabel = "view",
  className,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const refreshTimer = useRef<number | null>(null);

  const gridItems = useMemo(() => {
    if (items.length === 0) return [];
    const target = items.length >= 18 ? Math.min(items.length, 27) : Math.max(18, items.length);
    const out: DeliveriesExplorerItem[] = [];
    let i = 0;
    while (out.length < target) {
      const src = items[i % items.length]!;
      out.push({
        ...src,
        id: out.length < items.length ? src.id : `${src.id}-g${out.length}`,
        aspect: src.aspect ?? FALLBACK_CYCLE[out.length % FALLBACK_CYCLE.length],
      });
      i += 1;
    }
    return out;
  }, [items]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      ScrollTrigger.refresh();
    }, 80);
  }, []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || gridItems.length === 0) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cells = Array.from(grid.querySelectorAll<HTMLElement>("[data-grid-cell]"));
    if (!cells.length) return;

    if (reduce) {
      gsap.set(cells, { clearProps: "all", opacity: 1, scale: 1, rotateY: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cells,
        { autoAlpha: 0, scale: 0.86, rotateY: 28 },
        {
          autoAlpha: 1,
          scale: 1,
          rotateY: 0,
          duration: 0.85,
          ease: "power2.out",
          stagger: { amount: 0.75, from: "center" },
          scrollTrigger: {
            trigger: grid,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        },
      );

      ScrollTrigger.matchMedia({
        "(min-width: 992px)": () => {
          gsap
            .timeline({
              scrollTrigger: {
                trigger: grid,
                start: "top top",
                end: () => `+=${Math.max(grid.offsetHeight * 0.45, 360)}`,
                scrub: 1,
              },
            })
            .to(cells, { scale: 1.04, stagger: 0.04, ease: "none" });
        },
      });
    }, sectionRef);

    scheduleRefresh();

    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      ctx.revert();
    };
  }, [gridItems.length, scheduleRefresh]);

  if (gridItems.length === 0) {
    return (
      <section
        className={cn(
          "flex min-h-[70vh] items-center justify-center bg-[#070707] px-6 text-center",
          className,
        )}
      >
        <p className="text-sm text-white/45">No recent media yet — upload files to see them here.</p>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className={cn("relative z-[2] bg-[#070707] text-white", className)}
    >
      <div className="px-4 pb-6 pt-10 sm:px-6 sm:pt-12">
        <p className="text-center text-[0.7rem] uppercase tracking-[0.22em] text-white/40">
          {brandLabel}
        </p>
        <h1 className="mt-2 text-center text-[clamp(2rem,5vw,3.25rem)] font-medium tracking-[-0.03em] text-white">
          {headline}
        </h1>
      </div>

      <div className="relative">
        {/* Column masonry — uniform column width, height follows media ratio */}
        <div
          ref={gridRef}
          data-works-grid
          role="list"
          className={cn(
            "w-full [column-fill:_balance] [column-gap:0.25em]",
            "columns-2 sm:columns-3 md:columns-5 lg:columns-7 xl:columns-9",
          )}
        >
          {gridItems.map((item, index) => (
            <MasonryCell
              key={item.id}
              item={item}
              index={index}
              viewLabel={viewLabel}
              onRatioReady={scheduleRefresh}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
