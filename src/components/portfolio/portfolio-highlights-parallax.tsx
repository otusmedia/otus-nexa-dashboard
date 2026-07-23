"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { PortfolioItemContent } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

type PortfolioSiteMode = "edit" | "view";

const CONFIG = {
  distanceThreshold: 100,
  maxImages: 10,
  cooldownDuration: 600,
  maxRotation: 4,
  rotationDriftMultiplier: 0.5,
  inertiaMultiplier: 0.15,
  driftMultiplier: 0.12,
  totalDuration: 1.4,
  entryDuration: 0.5,
  blurStartDelay: 0.3,
  exitDuration: 0.75,
  cardWidth: 168,
};

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

/**
 * Journey-style mouse trail: spawn project covers along the cursor path,
 * fade/rotate in quickly, then blur + fade out (GSAP).
 * @see https://journey-creative.webflow.io/ (data-journey-trail)
 */
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
  const trailLayerRef = useRef<HTMLDivElement>(null);
  const templatesRef = useRef<HTMLDivElement>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingTagline, setEditingTagline] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [taglineDraft, setTaglineDraft] = useState(tagline);

  useEffect(() => setTitleDraft(title), [title]);
  useEffect(() => setTaglineDraft(tagline), [tagline]);

  const trailSources = projects.filter((p) => p.coverMediaUrl).slice(0, 8);

  useEffect(() => {
    const container = rootRef.current;
    const trailLayer = trailLayerRef.current;
    const templatesRoot = templatesRef.current;
    if (!container || !trailLayer || !templatesRoot) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const templates = Array.from(
      templatesRoot.querySelectorAll<HTMLElement>("[data-portfolio-trail-img]"),
    );
    if (!templates.length) return;

    gsap.set(templates, { autoAlpha: 0, display: "none" });

    let lastMouseX = 0;
    let lastMouseY = 0;
    let imgIndex = 0;
    let isFirstMove = true;
    let imagesSpawnedThisCycle = 0;
    let isCooldown = false;
    let pendingEvent: PointerEvent | null = null;
    let ticking = false;
    let cooldownTimer: number | null = null;
    const activeTimelines: gsap.core.Timeline[] = [];

    const getRandomRotation = () => (Math.random() * 2 - 1) * CONFIG.maxRotation;

    const getRelativePosition = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
        inside:
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom,
      };
    };

    const handleMouseMoveCore = (e: PointerEvent) => {
      const relativePos = getRelativePosition(e.clientX, e.clientY);

      if (!relativePos.inside) {
        lastMouseX = relativePos.x;
        lastMouseY = relativePos.y;
        isFirstMove = true;
        return;
      }

      if (isFirstMove) {
        lastMouseX = relativePos.x;
        lastMouseY = relativePos.y;
        isFirstMove = false;
        return;
      }

      if (isCooldown) {
        lastMouseX = relativePos.x;
        lastMouseY = relativePos.y;
        return;
      }

      const xDistance = relativePos.x - lastMouseX;
      const yDistance = relativePos.y - lastMouseY;
      const totalDistance = Math.hypot(xDistance, yDistance);

      if (totalDistance > CONFIG.distanceThreshold) {
        if (imagesSpawnedThisCycle >= CONFIG.maxImages) {
          isCooldown = true;
          cooldownTimer = window.setTimeout(() => {
            isCooldown = false;
            imagesSpawnedThisCycle = 0;
          }, CONFIG.cooldownDuration);
          lastMouseX = relativePos.x;
          lastMouseY = relativePos.y;
          return;
        }

        const currentTemplate = templates[imgIndex % templates.length]!;
        const clone = currentTemplate.cloneNode(true) as HTMLElement;
        clone.removeAttribute("data-portfolio-trail-img");
        clone.style.pointerEvents = "none";
        trailLayer.appendChild(clone);
        imagesSpawnedThisCycle++;

        const randomRotation = getRandomRotation();
        const rotationDrift = randomRotation * CONFIG.rotationDriftMultiplier;
        const inertiaX = xDistance * CONFIG.inertiaMultiplier;
        const inertiaY = yDistance * CONFIG.inertiaMultiplier;
        const driftX = xDistance * CONFIG.driftMultiplier;
        const driftY = yDistance * CONFIG.driftMultiplier;
        const driftDuration = CONFIG.totalDuration - CONFIG.blurStartDelay;
        const blurDuration = CONFIG.totalDuration - CONFIG.blurStartDelay;

        const tl = gsap.timeline({
          onComplete: () => {
            clone.remove();
            const idx = activeTimelines.indexOf(tl);
            if (idx >= 0) activeTimelines.splice(idx, 1);
          },
        });
        activeTimelines.push(tl);

        tl.fromTo(
          clone,
          {
            x: lastMouseX,
            y: lastMouseY,
            xPercent: -50,
            yPercent: -50,
            autoAlpha: 0,
            display: "block",
            scale: 1,
            rotation: 0,
            filter: "blur(0px)",
          },
          {
            x: relativePos.x + inertiaX,
            y: relativePos.y + inertiaY,
            autoAlpha: 1,
            rotation: randomRotation,
            duration: CONFIG.entryDuration,
            ease: "power4.out",
          },
        )
          .to(
            clone,
            {
              x: "+=" + driftX,
              y: "+=" + driftY,
              rotation: "+=" + rotationDrift,
              duration: driftDuration,
              ease: "power1.out",
            },
            CONFIG.blurStartDelay,
          )
          .to(
            clone,
            {
              filter: "blur(20px)",
              duration: blurDuration,
              ease: "power2.in",
            },
            CONFIG.blurStartDelay,
          )
          .to(
            clone,
            {
              scale: 0.9,
              autoAlpha: 0,
              duration: CONFIG.exitDuration,
              ease: "power2.in",
            },
            CONFIG.totalDuration - CONFIG.exitDuration,
          );

        lastMouseX = relativePos.x;
        lastMouseY = relativePos.y;
        imgIndex++;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      pendingEvent = e;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          if (pendingEvent) handleMouseMoveCore(pendingEvent);
          ticking = false;
        });
      }
    };

    window.addEventListener("pointermove", handlePointerMove);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (cooldownTimer != null) window.clearTimeout(cooldownTimer);
      activeTimelines.forEach((tl) => tl.kill());
      trailLayer.replaceChildren();
    };
  }, [trailSources.map((p) => p.id).join("|")]);

  const displayTitle = title.trim() || "Studio.";
  const displayTagline =
    tagline.trim() ||
    "Films and visual stories for brands that want work that looks good and feels effortless.";

  return (
    <div
      ref={rootRef}
      className="relative mb-10 min-h-[min(72vh,640px)] w-full overflow-hidden rounded-[10px] border border-black/[0.04] bg-[#fbfbfb]"
    >
      <GridBackdrop />

      {/* Hidden templates (cloned into the trail) */}
      <div ref={templatesRef} className="pointer-events-none absolute left-0 top-0" aria-hidden>
        {trailSources.map((project) => (
          <div
            key={project.id}
            data-portfolio-trail-img=""
            className="absolute left-0 top-0 overflow-hidden rounded-[8px] bg-[#e8e8e8] shadow-[0_18px_40px_rgba(0,0,0,0.14)]"
            style={{ width: CONFIG.cardWidth, aspectRatio: "3 / 4" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.coverMediaUrl!}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Live trail clones */}
      <div
        ref={trailLayerRef}
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
        aria-hidden
      />

      {/* Static copy above trail */}
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
