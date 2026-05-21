"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Phase = "black" | "loading" | "login";

const BLACK_TO_LOADING_MS = 320;
const PROGRESS_DURATION_MS = 1400;
const LOGIN_LOGO_SRC = "/frame-1.svg";

type Props = {
  isAppReady: boolean;
  isRedirecting: boolean;
  backgroundSrc: string;
  children: ReactNode;
};

export function LoginEntrance({ isAppReady, isRedirecting, backgroundSrc, children }: Props) {
  const [phase, setPhase] = useState<Phase>("black");
  const [progressComplete, setProgressComplete] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      if (isRedirecting) {
        setPhase("loading");
      } else if (isAppReady) {
        setPhase("login");
      } else {
        setPhase("loading");
      }
      return;
    }

    if (phase !== "black") return;
    const timer = window.setTimeout(() => setPhase("loading"), BLACK_TO_LOADING_MS);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion, isAppReady, isRedirecting]);

  useEffect(() => {
    if (phase !== "loading") {
      setProgressComplete(false);
      return;
    }
    if (reducedMotion) {
      setProgressComplete(true);
      return;
    }
    setProgressComplete(false);
    const timer = window.setTimeout(() => setProgressComplete(true), PROGRESS_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    if (isRedirecting) {
      setPhase((p) => (p === "login" ? "loading" : p));
      return;
    }
    if (!isAppReady || phase !== "loading" || !progressComplete) return;

    const timer = window.setTimeout(() => setPhase("login"), 120);
    return () => window.clearTimeout(timer);
  }, [isAppReady, isRedirecting, phase, progressComplete, reducedMotion]);

  const showBackground = phase !== "black";
  const showLoadingBrand = phase === "loading" || isRedirecting || !isAppReady;
  const showLoginCard = phase === "login" && !isRedirecting && isAppReady;

  return (
    <div
      className="relative flex h-[100vh] w-[100vw] items-center justify-center overflow-hidden p-4 text-[var(--text)]"
      aria-busy={!showLoginCard}
    >
      <div
        className={cn(
          "login-black-curtain pointer-events-none absolute inset-0 z-50 bg-black",
          phase === "black" ? "login-black-curtain--visible" : "login-black-curtain--hidden",
        )}
        aria-hidden
      />

      <img
        src={backgroundSrc}
        alt=""
        decoding="async"
        className={cn(
          "login-bg-fade pointer-events-none absolute left-0 top-0 z-0 h-[100vh] w-[100vw] object-cover object-center",
          showBackground && "login-bg-fade--visible",
        )}
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-0 z-[1] bg-black/50" aria-hidden />

      <div
        className={cn(
          "login-loading-brand absolute inset-0 z-20 flex flex-col items-center justify-center gap-5",
          showLoadingBrand ? "login-loading-brand--visible" : "login-loading-brand--hidden",
        )}
        aria-hidden={!showLoadingBrand}
      >
        <div className="flex h-[36.8px] items-center justify-center">
          <img
            src={LOGIN_LOGO_SRC}
            alt="Nexa and Otus logo"
            className="h-[36.8px] w-auto max-w-[93.15px] object-contain object-center"
          />
        </div>
        <div
          className="login-progress-track"
          role="progressbar"
          aria-label="Loading"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressComplete ? 100 : undefined}
        >
          <div
            className={cn(
              "login-progress-bar h-full rounded-full bg-white/80",
              phase === "loading" && !reducedMotion && "login-progress-bar--fill",
              (progressComplete || reducedMotion) && "login-progress-bar--complete",
            )}
          />
        </div>
      </div>

      <div
        className={cn(
          "login-card-fade relative z-10 w-full max-w-[400px]",
          showLoginCard ? "login-card-fade--visible" : "login-card-fade--hidden",
        )}
        aria-hidden={!showLoginCard}
      >
        {children}
      </div>
    </div>
  );
}
