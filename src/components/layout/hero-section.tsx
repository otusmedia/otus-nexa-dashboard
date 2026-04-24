"use client";

import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { Clock, Eye, EyeOff, Maximize2, Minimize2, Watch } from "lucide-react";
import { useAppContext } from "@/components/providers/app-providers";
import { cn } from "@/lib/utils";

const HERO_CLOCK_MODE_KEY = "clock-mode";
const HERO_BG_VISIBLE_KEY = "hero-bg-visible";
const HERO_HEIGHT_KEY = "hero-height";
const HERO_HEIGHT_MIN_PX = 200;

function clampHeroHeightPx(px: number): number {
  if (typeof window === "undefined") return Math.max(HERO_HEIGHT_MIN_PX, px);
  const max = window.innerHeight * 0.95;
  return Math.round(Math.min(max, Math.max(HERO_HEIGHT_MIN_PX, px)));
}

const heroBgToggleButtonStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.05)",
  backdropFilter: "blur(11px) saturate(110%)",
  WebkitBackdropFilter: "blur(11px) saturate(110%)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 8,
  padding: 8,
};

const heroClockCardGlassStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.05)",
  backdropFilter: "blur(11px) saturate(110%)",
  WebkitBackdropFilter: "blur(11px) saturate(110%)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 8,
  boxSizing: "border-box",
};

const heroClockToggleShellStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.05)",
  backdropFilter: "blur(11px) saturate(110%)",
  WebkitBackdropFilter: "blur(11px) saturate(110%)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 20,
  padding: 4,
};

type HeroClockMode = "digital" | "analog";

function formatHeroLongDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(d);
}

function HeroDigitalClockTime({ date, timeZone }: { date: Date; timeZone: string }) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  return (
    <p className="whitespace-nowrap font-[family-name:var(--font-mono)] text-[1.75rem] font-light tabular-nums leading-none text-white">
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

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning,";
  if (h >= 12 && h < 18) return "Good afternoon,";
  return "Good evening,";
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

function HeroAnalogClock({ date, timeZone }: { date: Date; timeZone: string }) {
  const { hour, minute, second } = getHMSInZone(date, timeZone);
  const h12 = hour % 12;
  const hourDeg = (h12 + minute / 60) * 30;
  const minuteDeg = (minute + second / 60) * 6;
  const secondDeg = second * 6;

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="block shrink-0" aria-hidden>
      <circle cx="50" cy="50" r="49" fill="rgba(0, 0, 0, 0.45)" />
      <g transform={`rotate(${hourDeg} 50 50)`}>
        <line x1="50" y1="50" x2="50" y2="32" stroke="white" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g transform={`rotate(${minuteDeg} 50 50)`}>
        <line x1="50" y1="50" x2="50" y2="22" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g transform={`rotate(${secondDeg} 50 50)`}>
        <line x1="50" y1="50" x2="50" y2="16" stroke="#FF4500" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="50" r="4" fill="white" />
    </svg>
  );
}

function HeroSection() {
  const { currentUser } = useAppContext();
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

  return (
    <section
      ref={sectionRef}
      suppressHydrationWarning
      className={cn(
        "relative box-border flex min-h-0 max-w-none flex-col items-start justify-start overflow-hidden",
        isHeroFullscreen
          ? "mx-0 mb-0 mt-0 min-h-[100dvh] w-full"
          : "mb-0 w-full -mt-6 px-6 lg:px-8",
        !heroBgVisible && "bg-transparent",
      )}
      style={{ height: isHeroFullscreen ? "100dvh" : heroHeightPx }}
      aria-label="Dashboard hero"
    >
      {heroBgVisible ? (
        <>
          <img
            src="/Biotecc%20-%202026-159.jpg"
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
          "absolute right-4 z-20 flex flex-col items-end gap-2 lg:right-4",
          isHeroFullscreen ? "top-4 lg:top-4" : "top-10 lg:top-10",
        )}
      >
        <button
          type="button"
          onClick={toggleHeroBgVisible}
          aria-label={heroBgVisible ? "Hide hero background" : "Show hero background"}
          className="text-[rgba(255,255,255,0.4)]"
          style={heroBgToggleButtonStyle}
        >
          {heroBgVisible ? (
            <Eye className="h-[14px] w-[14px]" strokeWidth={1.75} aria-hidden />
          ) : (
            <EyeOff className="h-[14px] w-[14px]" strokeWidth={1.75} aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={() => void handleScreensaverFullscreenClick()}
          aria-label={isHeroFullscreen ? "Exit hero fullscreen" : "Enter hero fullscreen"}
          className="text-[rgba(255,255,255,0.4)]"
          style={heroBgToggleButtonStyle}
        >
          {isHeroFullscreen ? (
            <Minimize2 className="h-[14px] w-[14px]" strokeWidth={1.75} aria-hidden />
          ) : (
            <Maximize2 className="h-[14px] w-[14px]" strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>
      <div className="relative z-10 flex h-full min-h-0 min-w-0 w-full flex-1 flex-row items-end justify-between gap-10 overflow-hidden px-0 pb-10">
        <div className="flex min-w-0 flex-col">
          <p className="text-[0.8rem] font-light tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
            {formatHeroLongDate(now)}
          </p>
          <h1 className="mt-2 font-light">
            <span className="block text-[clamp(3rem,6vw,5rem)] leading-none text-white opacity-[0.64]">
              {timeOfDayGreeting()}
            </span>
            <span className="mt-1 block text-[clamp(3rem,6vw,5rem)] leading-none text-white opacity-100">
              {firstName}
            </span>
          </h1>
        </div>
        <div className="flex shrink-0 flex-col items-start justify-start">
          <div className="flex flex-col items-center">
            <div className="mb-4 inline-flex shrink-0" style={heroClockToggleShellStyle} role="group" aria-label="Clock display mode">
              <button
                type="button"
                onClick={() => setClockModePersist("digital")}
                aria-label="Digital clock"
                className={cn(
                  "inline-flex items-center justify-center rounded-[16px]",
                  clockMode === "digital" ? "bg-white text-[#111111]" : "bg-transparent text-[rgba(255,255,255,0.4)]",
                )}
                style={{ padding: "4px 12px" }}
              >
                <Clock className="h-[14px] w-[14px]" strokeWidth={1.75} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setClockModePersist("analog")}
                aria-label="Analog clock"
                className={cn(
                  "inline-flex items-center justify-center rounded-[16px]",
                  clockMode === "analog" ? "bg-white text-[#111111]" : "bg-transparent text-[rgba(255,255,255,0.4)]",
                )}
                style={{ padding: "4px 12px" }}
              >
                <Watch className="h-[14px] w-[14px]" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <div className="flex flex-row flex-wrap items-stretch justify-center gap-4">
              <div className="flex min-h-0 w-[200px] min-w-[200px] max-w-[200px] shrink-0 flex-col" style={heroClockCardGlassStyle}>
                <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col items-center justify-center gap-2 p-[24px] text-center">
                  <p className="text-[0.7rem] font-light uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">
                    San Francisco
                  </p>
                  {clockMode === "digital" ? (
                    <HeroDigitalClockTime date={now} timeZone="America/Los_Angeles" />
                  ) : (
                    <HeroAnalogClock date={now} timeZone="America/Los_Angeles" />
                  )}
                  <p className="text-[0.7rem] font-light text-[rgba(255,255,255,0.3)]">PT</p>
                </div>
              </div>
              <div className="flex min-h-0 w-[200px] min-w-[200px] max-w-[200px] shrink-0 flex-col" style={heroClockCardGlassStyle}>
                <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col items-center justify-center gap-2 p-[24px] text-center">
                  <p className="text-[0.7rem] font-light uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">Curitiba</p>
                  {clockMode === "digital" ? (
                    <HeroDigitalClockTime date={now} timeZone="America/Sao_Paulo" />
                  ) : (
                    <HeroAnalogClock date={now} timeZone="America/Sao_Paulo" />
                  )}
                  <p className="text-[0.7rem] font-light text-[rgba(255,255,255,0.3)]">BRT</p>
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
          aria-label="Resize hero height"
        >
          <div className="pointer-events-none h-0.5 w-10 rounded-sm bg-[rgba(255,255,255,0.2)] opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100" />
        </div>
      ) : null}
    </section>
  );
}

export default memo(HeroSection);
