"use client";

import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { Clock, Eye, EyeOff, Maximize2, Minimize2, Watch } from "lucide-react";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { formatLongDate, localeTag, timeOfDayGreeting } from "@/lib/locale-format";
import { cn } from "@/lib/utils";

const HERO_CLOCK_MODE_KEY = "clock-mode";
const HERO_BG_VISIBLE_KEY = "hero-bg-visible";
const HERO_HEIGHT_KEY = "hero-height";
const HERO_HEIGHT_MIN_PX = 200;

/** Fullscreen hero insets — keep greeting/clocks off viewport edges */
const HERO_FS_PAD =
  "box-border px-8 pb-14 pt-8 sm:px-12 sm:pb-16 lg:px-16 lg:pt-10 xl:px-20 2xl:px-24";

function clampHeroHeightPx(px: number): number {
  if (typeof window === "undefined") return Math.max(HERO_HEIGHT_MIN_PX, px);
  const max = window.innerHeight * 0.95;
  return Math.round(Math.min(max, Math.max(HERO_HEIGHT_MIN_PX, px)));
}

const heroGlassOnImage: CSSProperties = {
  background: "rgba(255, 255, 255, 0.05)",
  backdropFilter: "blur(11px) saturate(110%)",
  WebkitBackdropFilter: "blur(11px) saturate(110%)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
};

const heroGlassOnSurface: CSSProperties = {
  background: "var(--surface-elevated)",
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  border: "1px solid var(--border-strong)",
};

function heroControlButtonStyle(onImage: boolean): CSSProperties {
  return {
    ...(onImage ? heroGlassOnImage : heroGlassOnSurface),
    borderRadius: 8,
    padding: 8,
  };
}

function heroClockCardStyle(onImage: boolean): CSSProperties {
  return {
    ...(onImage ? heroGlassOnImage : heroGlassOnSurface),
    borderRadius: 8,
    boxSizing: "border-box",
  };
}

function heroClockToggleShellStyle(onImage: boolean): CSSProperties {
  return {
    ...(onImage ? heroGlassOnImage : heroGlassOnSurface),
    borderRadius: 20,
    padding: 4,
  };
}

type HeroClockMode = "digital" | "analog";

function HeroDigitalClockTime({ date, timeZone, lang }: { date: Date; timeZone: string; lang: "en" | "pt-BR" }) {
  const parts = new Intl.DateTimeFormat(localeTag(lang), {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  return (
    <p
      className={cn(
        "whitespace-nowrap font-[family-name:var(--font-mono)] text-[1.75rem] font-light tabular-nums leading-none",
        "text-[var(--hero-fg)]",
      )}
    >
      {parts.map((part, i) =>
        part.type === "dayPeriod" ? (
          <span key={i} className="ml-0.5 align-baseline text-[0.55em] font-normal uppercase leading-none tracking-wide">
            {part.value.toUpperCase()}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </p>
  );
}

function getHMSInZone(date: Date, timeZone: string): { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hour: n("hour"), minute: n("minute"), second: n("second") };
}

function HeroAnalogClock({
  date,
  timeZone,
  onImage,
}: {
  date: Date;
  timeZone: string;
  onImage: boolean;
}) {
  const { hour, minute, second } = getHMSInZone(date, timeZone);
  const h12 = hour % 12;
  const hourDeg = (h12 + minute / 60) * 30;
  const minuteDeg = (minute + second / 60) * 6;
  const secondDeg = second * 6;
  const hand = onImage ? "#ffffff" : "var(--text)";
  const face = onImage ? "rgba(0, 0, 0, 0.45)" : "var(--surface)";

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="block shrink-0" aria-hidden>
      <circle cx="50" cy="50" r="49" fill={face} stroke="var(--border-strong)" strokeWidth="1" />
      <g transform={`rotate(${hourDeg} 50 50)`}>
        <line x1="50" y1="50" x2="50" y2="32" stroke={hand} strokeWidth="4" strokeLinecap="round" />
      </g>
      <g transform={`rotate(${minuteDeg} 50 50)`}>
        <line x1="50" y1="50" x2="50" y2="22" stroke={hand} strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g transform={`rotate(${secondDeg} 50 50)`}>
        <line x1="50" y1="50" x2="50" y2="16" stroke="#FF4500" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="50" r="4" fill={hand} />
    </svg>
  );
}

function HeroSection() {
  const { currentUser, heroImageUrl, language } = useAppContext();
  const { t: lt } = useLanguage();
  const [, setTick] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const dragActiveRef = useRef(false);
  const latestHeightRef = useRef(320);

  const [heroHeightPx, setHeroHeightPx] = useState(() => {
    if (typeof window === "undefined") return 320;
    try {
      const saved = localStorage.getItem(HERO_HEIGHT_KEY);
      if (saved != null) {
        const n = Number.parseFloat(saved);
        if (Number.isFinite(n)) return clampHeroHeightPx(n);
      }
    } catch {
      /* ignore */
    }
    return Math.round(window.innerHeight * 0.4);
  });

  latestHeightRef.current = heroHeightPx;

  const [heroBgVisible, setHeroBgVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const saved = localStorage.getItem(HERO_BG_VISIBLE_KEY);
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  const [clockMode, setClockMode] = useState<HeroClockMode>(() => {
    if (typeof window === "undefined") return "digital";
    try {
      const v = localStorage.getItem(HERO_CLOCK_MODE_KEY);
      return v === "analog" ? "analog" : "digital";
    } catch {
      return "digital";
    }
  });

  const setClockModePersist = (mode: HeroClockMode) => {
    setClockMode(mode);
    try {
      localStorage.setItem(HERO_CLOCK_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const [isHeroFullscreen, setIsHeroFullscreen] = useState(false);

  useEffect(() => {
    const onFs = () => {
      setIsHeroFullscreen(document.fullscreenElement === sectionRef.current);
    };
    document.addEventListener("fullscreenchange", onFs);
    onFs();
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const handleScreensaverFullscreenClick = async () => {
    const el = sectionRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    try {
      await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
    } catch {
      /* fullscreen denied */
    }
  };

  const toggleHeroBgVisible = () => {
    setHeroBgVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HERO_BG_VISIBLE_KEY, next ? "true" : "false");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const startMouseResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragActiveRef.current = true;
    document.body.style.cursor = "ns-resize";

    const onMove = (ev: MouseEvent) => {
      if (!dragActiveRef.current) return;
      const el = sectionRef.current;
      if (!el) return;
      const h = clampHeroHeightPx(ev.clientY - el.getBoundingClientRect().top);
      latestHeightRef.current = h;
      setHeroHeightPx(h);
    };

    const onUp = () => {
      dragActiveRef.current = false;
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      try {
        localStorage.setItem(HERO_HEIGHT_KEY, String(latestHeightRef.current));
      } catch {
        /* ignore */
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    onMove(e.nativeEvent);
  };

  const startTouchResize = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragActiveRef.current = true;

    const onMove = (ev: TouchEvent) => {
      if (!dragActiveRef.current) return;
      ev.preventDefault();
      const t = ev.touches[0];
      if (!t) return;
      const el = sectionRef.current;
      if (!el) return;
      const h = clampHeroHeightPx(t.clientY - el.getBoundingClientRect().top);
      latestHeightRef.current = h;
      setHeroHeightPx(h);
    };

    const onEnd = () => {
      dragActiveRef.current = false;
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      try {
        localStorage.setItem(HERO_HEIGHT_KEY, String(latestHeightRef.current));
      } catch {
        /* ignore */
      }
    };

    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    if (e.touches[0]) {
      const el = sectionRef.current;
      if (el) {
        const h = clampHeroHeightPx(e.touches[0].clientY - el.getBoundingClientRect().top);
        latestHeightRef.current = h;
        setHeroHeightPx(h);
      }
    }
  };

  const now = new Date();
  const firstName = currentUser.name.trim().split(/\s+/)[0] ?? "";
  const onImage = heroBgVisible;

  const heroToneStyle = {
    height: isHeroFullscreen ? "100dvh" : heroHeightPx,
    ["--hero-fg" as string]: onImage ? "#ffffff" : "var(--text)",
    ["--hero-muted" as string]: onImage ? "rgba(255, 255, 255, 0.4)" : "var(--muted)",
    ["--hero-faint" as string]: onImage ? "rgba(255, 255, 255, 0.3)" : "var(--muted)",
    ["--hero-handle" as string]: onImage ? "rgba(255, 255, 255, 0.2)" : "var(--border-strong)",
    ["--hero-active-bg" as string]: onImage ? "#ffffff" : "var(--text)",
    ["--hero-active-fg" as string]: onImage ? "#111111" : "var(--background)",
  } as CSSProperties;

  return (
    <section
      ref={sectionRef}
      suppressHydrationWarning
      className={cn(
        "dashboard-hero relative box-border flex min-h-0 max-w-none flex-col items-start justify-start overflow-hidden",
        onImage && "dashboard-hero--on-image",
        isHeroFullscreen
          ? cn("mx-0 mb-0 mt-0 min-h-[100dvh] w-full", HERO_FS_PAD)
          : "mb-0 w-full -mt-6 px-6 lg:px-8",
        !onImage && "bg-transparent",
      )}
      style={heroToneStyle}
      aria-label={lt("Dashboard hero")}
    >
      {onImage ? (
        <>
          <img
            src={heroImageUrl}
            alt=""
            decoding="async"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center"
            aria-hidden
          />
          <div
            className="absolute inset-0 z-[1] bg-gradient-to-br from-[#111111]/88 via-[#0a0a0a]/72 to-[#111111]/80"
            aria-hidden
          />
        </>
      ) : null}
      <div
        className={cn(
          "absolute z-20 flex flex-col items-end gap-2",
          isHeroFullscreen ? "right-0 top-0" : "right-4 top-10 lg:right-4 lg:top-10",
        )}
      >
        <button
          type="button"
          onClick={toggleHeroBgVisible}
          aria-label={onImage ? lt("Hide hero background") : lt("Show hero background")}
          className="text-[var(--hero-muted)]"
          style={heroControlButtonStyle(onImage)}
        >
          {onImage ? (
            <Eye className="h-[14px] w-[14px]" strokeWidth={1.75} aria-hidden />
          ) : (
            <EyeOff className="h-[14px] w-[14px]" strokeWidth={1.75} aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={() => void handleScreensaverFullscreenClick()}
          aria-label={isHeroFullscreen ? lt("Exit hero fullscreen") : lt("Enter hero fullscreen")}
          className="text-[var(--hero-muted)]"
          style={heroControlButtonStyle(onImage)}
        >
          {isHeroFullscreen ? (
            <Minimize2 className="h-[14px] w-[14px]" strokeWidth={1.75} aria-hidden />
          ) : (
            <Maximize2 className="h-[14px] w-[14px]" strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>
      <div
        className={cn(
          "relative z-10 flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-row items-end justify-between gap-6 overflow-hidden sm:gap-10",
          isHeroFullscreen ? "pb-0" : "px-0 pb-10",
        )}
      >
        <div className="flex min-w-0 flex-col">
          <p className="text-[0.8rem] font-light tracking-[0.08em] text-[var(--hero-muted)]">
            {formatLongDate(now, language)}
          </p>
          <h1 className="mt-2 font-light">
            <span className="block text-[clamp(3rem,6vw,5rem)] leading-none text-[var(--hero-fg)] opacity-[0.64]">
              {timeOfDayGreeting(language)}
            </span>
            <span className="mt-1 block text-[clamp(3rem,6vw,5rem)] leading-none text-[var(--hero-fg)] opacity-100">
              {firstName}
            </span>
          </h1>
        </div>
        <div className="flex shrink-0 flex-col items-start justify-start">
          <div className="flex flex-col items-center">
            <div
              className="mb-4 inline-flex shrink-0"
              style={heroClockToggleShellStyle(onImage)}
              role="group"
              aria-label={lt("Clock display mode")}
            >
              <button
                type="button"
                onClick={() => setClockModePersist("digital")}
                aria-label={lt("Digital clock")}
                className={cn(
                  "inline-flex items-center justify-center rounded-[16px]",
                  clockMode === "digital"
                    ? "bg-[var(--hero-active-bg)] text-[var(--hero-active-fg)]"
                    : "bg-transparent text-[var(--hero-muted)]",
                )}
                style={{ padding: "4px 12px" }}
              >
                <Clock className="h-[14px] w-[14px]" strokeWidth={1.75} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setClockModePersist("analog")}
                aria-label={lt("Analog clock")}
                className={cn(
                  "inline-flex items-center justify-center rounded-[16px]",
                  clockMode === "analog"
                    ? "bg-[var(--hero-active-bg)] text-[var(--hero-active-fg)]"
                    : "bg-transparent text-[var(--hero-muted)]",
                )}
                style={{ padding: "4px 12px" }}
              >
                <Watch className="h-[14px] w-[14px]" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <div className="flex flex-row flex-wrap items-stretch justify-center gap-4">
              <div
                className="flex min-h-0 w-[200px] min-w-[200px] max-w-[200px] shrink-0 flex-col"
                style={heroClockCardStyle(onImage)}
              >
                <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col items-center justify-center gap-2 p-[24px] text-center">
                  <p className="text-[0.7rem] font-light uppercase tracking-[0.1em] text-[var(--hero-muted)]">
                    San Francisco
                  </p>
                  {clockMode === "digital" ? (
                    <HeroDigitalClockTime date={now} timeZone="America/Los_Angeles" lang={language} />
                  ) : (
                    <HeroAnalogClock date={now} timeZone="America/Los_Angeles" onImage={onImage} />
                  )}
                  <p className="text-[0.7rem] font-light text-[var(--hero-faint)]">PT</p>
                </div>
              </div>
              <div
                className="flex min-h-0 w-[200px] min-w-[200px] max-w-[200px] shrink-0 flex-col"
                style={heroClockCardStyle(onImage)}
              >
                <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col items-center justify-center gap-2 p-[24px] text-center">
                  <p className="text-[0.7rem] font-light uppercase tracking-[0.1em] text-[var(--hero-muted)]">Curitiba</p>
                  {clockMode === "digital" ? (
                    <HeroDigitalClockTime date={now} timeZone="America/Sao_Paulo" lang={language} />
                  ) : (
                    <HeroAnalogClock date={now} timeZone="America/Sao_Paulo" onImage={onImage} />
                  )}
                  <p className="text-[0.7rem] font-light text-[var(--hero-faint)]">BRT</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {!isHeroFullscreen ? (
        <div
          ref={handleRef}
          className="group absolute bottom-0 left-0 right-0 z-30 flex h-2 shrink-0 cursor-ns-resize touch-none items-center justify-center bg-transparent"
          onMouseDown={startMouseResize}
          onTouchStart={startTouchResize}
          role="separator"
          aria-orientation="horizontal"
          aria-label={lt("Resize hero height")}
        >
          <div className="pointer-events-none h-0.5 w-10 rounded-sm bg-[var(--hero-handle)] opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100" />
        </div>
      ) : null}
    </section>
  );
}

export default memo(HeroSection);
