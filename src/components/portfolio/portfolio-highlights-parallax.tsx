"use client";

import { useEffect, useRef, useState } from "react";
import { PortfolioMediaFill } from "@/components/portfolio/portfolio-media";
import type { PortfolioItemContent } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

type PortfolioSiteMode = "edit" | "view";

type CardPose = {
  x: string;
  y: string;
  rotate: number;
  depth: number;
  width: number;
};

/** Cascade poses — center-right stack like the Journey reference */
const CARD_POSES: CardPose[] = [
  { x: "42%", y: "18%", rotate: -6, depth: 0.55, width: 168 },
  { x: "52%", y: "22%", rotate: -2, depth: 0.4, width: 158 },
  { x: "61%", y: "28%", rotate: 3, depth: 0.28, width: 148 },
  { x: "48%", y: "38%", rotate: -4, depth: 0.7, width: 176 },
  { x: "58%", y: "44%", rotate: 5, depth: 0.35, width: 152 },
  { x: "68%", y: "36%", rotate: 8, depth: 0.22, width: 140 },
];

function GridBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.045) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />
      {[
        ["12%", "18%"],
        ["28%", "42%"],
        ["44%", "14%"],
        ["60%", "55%"],
        ["76%", "22%"],
        ["18%", "70%"],
        ["84%", "68%"],
        ["36%", "78%"],
      ].map(([left, top], i) => (
        <span
          key={i}
          className="absolute text-[11px] font-light leading-none text-black/20"
          style={{ left, top }}
        >
          {i % 2 === 0 ? "+" : "×"}
        </span>
      ))}
    </div>
  );
}

export function HighlightsParallaxHero({
  mode,
  title,
  tagline,
  projects,
  onChangeTitle,
  onChangeTagline,
}: {
  mode: PortfolioSiteMode;
  title: string;
  tagline: string;
  projects: PortfolioItemContent[];
  onChangeTitle?: (next: string) => void;
  onChangeTagline?: (next: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingTagline, setEditingTagline] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [taglineDraft, setTaglineDraft] = useState(tagline);

  useEffect(() => setTitleDraft(title), [title]);
  useEffect(() => setTaglineDraft(tagline), [tagline]);

  useEffect(() => {
    return () => {
      if (idleTimer.current != null) window.clearTimeout(idleTimer.current);
    };
  }, []);

  const cards = projects.filter((p) => p.coverMediaUrl).slice(0, CARD_POSES.length);
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const onMove = (clientX: number, clientY: number) => {
    if (reduceMotion) {
      setVisible(true);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
    setMouse({ x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) });
    setVisible(true);
    if (idleTimer.current != null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setVisible(false), 900);
  };

  const displayTitle = title.trim() || "Studio.";
  const displayTagline =
    tagline.trim() ||
    "Films and visual stories for brands that want work that looks good and feels effortless.";

  return (
    <div
      ref={rootRef}
      className="relative mb-12 min-h-[min(72vh,640px)] w-full overflow-hidden rounded-[8px] border border-black/[0.04] bg-[#fbfbfb]"
      onMouseMove={(e) => onMove(e.clientX, e.clientY)}
      onMouseLeave={() => {
        if (idleTimer.current != null) window.clearTimeout(idleTimer.current);
        setVisible(false);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) onMove(t.clientX, t.clientY);
      }}
    >
      <GridBackdrop />

      {/* Parallax project cards — decorative, not clickable */}
      <div className="pointer-events-none absolute inset-0 z-[1]">
        {cards.map((project, index) => {
          const pose = CARD_POSES[index] ?? CARD_POSES[0]!;
          const parallaxX = mouse.x * 28 * pose.depth;
          const parallaxY = mouse.y * 22 * pose.depth;
          const stackBlur = index * 2.2;
          const blur = visible ? stackBlur : 18 + stackBlur;
          const opacity = visible ? Math.max(0.35, 1 - index * 0.1) : 0;

          return (
            <div
              key={project.id}
              className="absolute overflow-hidden rounded-[8px] bg-[#e8e8e8] shadow-[0_18px_40px_rgba(0,0,0,0.12)]"
              style={{
                left: pose.x,
                top: pose.y,
                width: pose.width,
                aspectRatio: "3 / 4",
                transform: `translate3d(calc(-50% + ${parallaxX}px), calc(-50% + ${parallaxY}px), 0) rotate(${pose.rotate}deg)`,
                opacity,
                filter: `blur(${blur}px)`,
                transition: visible
                  ? "opacity 220ms ease-out, filter 220ms ease-out, transform 120ms linear"
                  : "opacity 700ms ease-in, filter 700ms ease-in, transform 400ms ease-out",
                willChange: "transform, opacity, filter",
              }}
            >
              <PortfolioMediaFill
                type={project.coverMediaType}
                url={project.coverMediaUrl}
                loopVideo
                className="absolute inset-0"
              />
            </div>
          );
        })}
      </div>

      {/* Static copy */}
      <div className="relative z-[2] flex h-full min-h-[min(72vh,640px)] flex-col justify-between p-6 sm:p-8 lg:p-10">
        <div className="flex justify-end">
          {mode === "edit" && editingTagline ? (
            <textarea
              autoFocus
              value={taglineDraft}
              rows={3}
              onChange={(e) => setTaglineDraft(e.target.value)}
              onBlur={() => {
                setEditingTagline(false);
                if (taglineDraft.trim() !== tagline) onChangeTagline?.(taglineDraft.trim());
              }}
              className="max-w-[16rem] resize-none rounded-md border border-black/15 bg-white/80 px-2 py-1 text-right text-xs leading-relaxed text-black/70 outline-none sm:max-w-[18rem]"
            />
          ) : (
            <p
              className={cn(
                "max-w-[16rem] text-right text-xs leading-relaxed text-black/50 sm:max-w-[18rem] sm:text-[0.8rem]",
                mode === "edit" && "cursor-text rounded-sm hover:outline hover:outline-1 hover:outline-black/15",
              )}
              onClick={() => mode === "edit" && setEditingTagline(true)}
            >
              {displayTagline}
            </p>
          )}
        </div>

        <div className="max-w-[90%]">
          {mode === "edit" && editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                setEditingTitle(false);
                if (titleDraft.trim() !== title) onChangeTitle?.(titleDraft.trim());
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="w-full max-w-xl rounded-md border border-black/15 bg-white/80 px-2 py-1 text-[clamp(2.75rem,8vw,5.5rem)] font-medium leading-[0.95] tracking-[-0.04em] text-black outline-none"
            />
          ) : (
            <h2
              className={cn(
                "text-[clamp(2.75rem,8vw,5.5rem)] font-medium leading-[0.95] tracking-[-0.04em] text-black",
                mode === "edit" && "cursor-text rounded-sm hover:outline hover:outline-1 hover:outline-black/15",
              )}
              onClick={() => mode === "edit" && setEditingTitle(true)}
            >
              {displayTitle}
              <span className="ml-1 inline-flex h-[0.55em] w-[0.55em] translate-y-[-0.15em] items-center justify-center rounded-full bg-[#ff4500] align-middle text-[0.22em] font-normal text-white">
                ©
              </span>
            </h2>
          )}
        </div>
      </div>
    </div>
  );
}
