"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import type { AppUser } from "@/types";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const { isReady, sessionUserId, login } = useAuth();
  const { users, ts } = useAppContext();
  const { t: lt } = useLanguage();

  useEffect(() => {
    if (!isReady || !sessionUserId) return;
    const u = users.find((x) => x.id === sessionUserId);
    if (u) {
      router.replace(u.role === "admin" ? "/dashboard" : "/projects");
    }
  }, [isReady, sessionUserId, users, router]);

  const handleSelect = (user: AppUser) => {
    login(user);
    router.replace(user.role === "admin" ? "/dashboard" : "/projects");
  };

  const sorted = [...users].sort((a, b) => {
    if (a.role === b.role) return a.name.localeCompare(b.name);
    return a.role === "admin" ? -1 : 1;
  });

  if (!isReady) {
    return null;
  }

  return (
    <div className="relative flex h-[100vh] w-[100vw] items-center justify-center overflow-hidden p-4 text-[var(--text)]">
      <img
        src="/Biotecc%20-%202026-159.jpg"
        alt=""
        decoding="async"
        className="pointer-events-none absolute left-0 top-0 z-0 h-[100vh] w-[100vw] object-cover object-center"
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.6)] p-6 shadow-lg backdrop-blur-[12px]">
        <div className="mb-[24px] flex justify-center">
          <div className="flex h-[36.8px] items-center justify-center">
            <img
              src="/frame-1.svg"
              alt="RocketRide logo"
              className="h-[36.8px] w-auto max-w-[93.15px] object-contain object-left"
            />
          </div>
        </div>
        <h1 className="text-center text-lg font-normal text-white">{lt("Select your account")}</h1>
        <p className="mt-1 text-center text-xs font-light text-[var(--muted)]">{lt("Choose a profile to continue")}</p>
        <div className="mt-6 space-y-2">
          {sorted.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => handleSelect(user)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[#161616] px-4 py-3 text-left transition hover:border-[rgba(255,255,255,0.12)] hover:bg-[var(--surface-elevated)]"
            >
              <span className="text-sm font-normal text-[var(--text)]">{user.name}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-normal capitalize",
                  user.role === "admin"
                    ? "border-[#FF4500] bg-[rgba(255,69,0,0.15)] text-[#FF4500]"
                    : "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.55)]",
                )}
              >
                {ts(user.role)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
