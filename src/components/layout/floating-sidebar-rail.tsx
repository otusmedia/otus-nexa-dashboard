"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, Settings } from "lucide-react";
import { liquidGlassRailStyle } from "@/lib/liquid-glass-styles";
import { cn } from "@/lib/utils";

type FloatingSidebarRailProps = {
  onExpand: () => void;
  profileImage: string | null;
  avatarInitial: string;
  profileName: string;
  expandLabel: string;
  profileMenuLabel: string;
  profileLabel: string;
  logoutLabel: string;
  onOpenSettings: () => void;
  onLogout: () => void;
  unreadCount?: number;
};

export function FloatingSidebarRail({
  onExpand,
  profileImage,
  avatarInitial,
  profileName,
  expandLabel,
  profileMenuLabel,
  profileLabel,
  logoutLabel,
  onOpenSettings,
  onLogout,
  unreadCount = 0,
}: FloatingSidebarRailProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileOpen]);

  return (
    <aside
      className="sticky top-1/2 z-40 flex -translate-y-1/2 flex-col items-center justify-between py-3"
      style={{ ...liquidGlassRailStyle, width: 52, minHeight: 120 }}
      aria-label={expandLabel}
    >
      <button
        type="button"
        onClick={onExpand}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
        aria-label={expandLabel}
        aria-expanded={false}
      >
        <Menu className="h-5 w-5" strokeWidth={1.5} />
      </button>

      <div className="relative" ref={profileRef}>
        <button
          type="button"
          onClick={() => setProfileOpen((o) => !o)}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 transition hover:border-white/25 hover:bg-white/10",
          )}
          aria-label={profileMenuLabel}
          aria-expanded={profileOpen}
          aria-haspopup="menu"
        >
          {profileImage ? (
            <img src={profileImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-medium text-white">{avatarInitial}</span>
          )}
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--primary)] px-0.5 text-[8px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>

        {profileOpen ? (
          <div
            role="menu"
            className="absolute left-full top-1/2 z-[55] ml-3 min-w-[180px] -translate-y-1/2 rounded-xl border border-white/10 bg-[var(--surface)] p-2 shadow-xl"
            style={{
              background: "rgba(18, 18, 18, 0.92)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <p className="mb-2 truncate px-2 text-xs text-[rgba(255,255,255,0.5)]">{profileName}</p>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setProfileOpen(false);
                onOpenSettings();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-[var(--text)] hover:bg-[var(--surface-elevated)]"
            >
              <Settings className="h-4 w-4" strokeWidth={1.5} />
              {profileLabel}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setProfileOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-[var(--text)] hover:bg-[var(--surface-elevated)]"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
              {logoutLabel}
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
