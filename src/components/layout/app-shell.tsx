"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
  Bell,
  BarChart3,
  Briefcase,
  Calendar,
  FileText,
  FileUp,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Megaphone,
  MessageSquare,
  Send,
  Settings,
  Wallet,
  X,
} from "lucide-react";
import type { ModuleKey } from "@/types";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import HeroSection from "@/components/layout/hero-section";

const moduleLinks: Array<{
  key: ModuleKey;
  labelKey:
    | "dashboard"
    | "projects"
    | "financial"
    | "updates"
    | "marketing"
    | "publishing"
    | "calendar"
    | "crm"
    | "files"
    | "contracts";
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  { key: "dashboard", labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "projects", labelKey: "projects", href: "/projects", icon: BarChart3 },
  { key: "financial", labelKey: "financial", href: "/financial", icon: Wallet },
  { key: "updates", labelKey: "updates", href: "/updates", icon: MessageSquare },
  { key: "marketing", labelKey: "marketing", href: "/marketing", icon: Megaphone },
  { key: "publishing", labelKey: "publishing", href: "/publishing", icon: Send },
  { key: "calendar", labelKey: "calendar", href: "/calendar", icon: Calendar },
  { key: "crm", labelKey: "crm", href: "/crm", icon: Briefcase },
  { key: "files", labelKey: "files", href: "/files", icon: FileUp },
  { key: "contracts", labelKey: "contracts", href: "/contracts", icon: FileText },
];

const WHATSAPP_POS_KEY = "whatsapp-button-position";
const WH_BTN = 36;
const WH_MARGIN = 20;

function clampWhatsAppPosition(left: number, top: number): { left: number; top: number } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    left: Math.max(WH_MARGIN, Math.min(left, w - WH_MARGIN - WH_BTN)),
    top: Math.max(WH_MARGIN, Math.min(top, h - WH_MARGIN - WH_BTN)),
  };
}

function getDefaultWhatsAppPosition(): { left: number; top: number } {
  const h = window.innerHeight;
  const w = window.innerWidth;
  const lg = window.matchMedia("(min-width: 1024px)").matches;
  const sidebar = lg ? 256 : 0;
  return clampWhatsAppPosition(WH_MARGIN + sidebar, h - WH_MARGIN - WH_BTN);
}

function readStoredWhatsAppPosition(): { left: number; top: number } {
  try {
    const raw = localStorage.getItem(WHATSAPP_POS_KEY);
    if (!raw) return getDefaultWhatsAppPosition();
    const o = JSON.parse(raw) as { left?: unknown; top?: unknown };
    if (typeof o.left !== "number" || typeof o.top !== "number") return getDefaultWhatsAppPosition();
    return clampWhatsAppPosition(o.left, o.top);
  } catch {
    return getDefaultWhatsAppPosition();
  }
}

function snapWhatsAppToNearestEdge(left: number, top: number): { left: number; top: number } {
  const w = window.innerWidth;
  const center = left + WH_BTN / 2;
  const snapLeft = center < w / 2;
  const nextLeft = snapLeft ? WH_MARGIN : w - WH_BTN - WH_MARGIN;
  return clampWhatsAppPosition(nextLeft, top);
}

function persistWhatsAppPosition(p: { left: number; top: number }) {
  try {
    localStorage.setItem(WHATSAPP_POS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout: authLogout } = useAuth();
  const {
    currentUser,
    unreadCount,
    markAllAsRead,
    notifications,
    markNotificationRead,
    dismissNotification,
    allowedModules,
    t,
    td,
  } = useAppContext();
  const { t: lt, setLanguage, language } = useLanguage();
  const [openNotifications, setOpenNotifications] = useState(false);
  const [openProfileMenu, setOpenProfileMenu] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [marketingMenuOpen, setMarketingMenuOpen] = useState(false);
  const [crmMenuOpen, setCrmMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profileEmail, setProfileEmail] = useState(`${currentUser.name.toLowerCase().replace(/\s+/g, ".")}@rocketride.com`);
  const [profilePassword, setProfilePassword] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const isAdmin = currentUser.role === "admin";
  const canAccessMarketing =
    (currentUser.role === "admin" && (currentUser.company === "nexa" || currentUser.company === "otus")) ||
    (currentUser.role === "manager" && currentUser.modules.includes("marketing"));
  const links = moduleLinks.filter((link) =>
    link.key === "marketing" ? allowedModules.includes(link.key) && canAccessMarketing : allowedModules.includes(link.key),
  );
  const avatarInitial = profileName.trim().slice(0, 1).toUpperCase() || "U";
  useEffect(() => {
    setProfileName(currentUser.name);
    setProfileEmail(`${currentUser.name.toLowerCase().replace(/\s+/g, ".")}@rocketride.com`);
  }, [currentUser.id, currentUser.name]);

  useEffect(() => {
    if (pathname.startsWith("/marketing")) setMarketingMenuOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/crm")) setCrmMenuOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (!langMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [langMenuOpen]);

  const [waPos, setWaPos] = useState<{ left: number; top: number }>({ left: WH_MARGIN, top: 600 });
  const [waDragging, setWaDragging] = useState(false);
  const [waSnapTransition, setWaSnapTransition] = useState(false);
  const waLinkRef = useRef<HTMLAnchorElement>(null);
  const waDragRef = useRef({
    active: false,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    hasMoved: false,
  });
  const waLivePosRef = useRef<{ left: number; top: number }>({ left: WH_MARGIN, top: 600 });
  const waSuppressClickRef = useRef(false);
  const waMoveMouseRef = useRef<(e: MouseEvent) => void>(() => {});
  const waUpMouseRef = useRef<() => void>(() => {});
  const waMoveTouchRef = useRef<(e: TouchEvent) => void>(() => {});
  const waEndTouchRef = useRef<(e: TouchEvent) => void>(() => {});
  const waRemoveDocListenersRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const p = readStoredWhatsAppPosition();
    setWaPos(p);
    waLivePosRef.current = p;
  }, []);

  useEffect(() => {
    const onResize = () => {
      setWaPos((prev) => {
        const next = clampWhatsAppPosition(prev.left, prev.top);
        waLivePosRef.current = next;
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => {
      waRemoveDocListenersRef.current?.();
      waRemoveDocListenersRef.current = null;
      document.body.style.cursor = "";
    };
  }, []);

  waMoveMouseRef.current = (e: MouseEvent) => {
    const drag = waDragRef.current;
    if (!drag.active) return;
    const next = clampWhatsAppPosition(e.clientX - drag.offsetX, e.clientY - drag.offsetY);
    waLivePosRef.current = next;
    setWaPos(next);
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (dx * dx + dy * dy > 9) drag.hasMoved = true;
  };

  waUpMouseRef.current = () => {
    const drag = waDragRef.current;
    if (!drag.active) return;
    drag.active = false;
    waRemoveDocListenersRef.current?.();
    waRemoveDocListenersRef.current = null;
    document.body.style.cursor = "";
    setWaDragging(false);
    if (drag.hasMoved) {
      const snapped = snapWhatsAppToNearestEdge(waLivePosRef.current.left, waLivePosRef.current.top);
      waSuppressClickRef.current = true;
      setWaSnapTransition(true);
      setWaPos(snapped);
      waLivePosRef.current = snapped;
      persistWhatsAppPosition(snapped);
      window.setTimeout(() => setWaSnapTransition(false), 200);
    }
    drag.hasMoved = false;
  };

  waMoveTouchRef.current = (e: TouchEvent) => {
    const drag = waDragRef.current;
    if (!drag.active || e.touches.length === 0) return;
    e.preventDefault();
    const t = e.touches[0];
    const next = clampWhatsAppPosition(t.clientX - drag.offsetX, t.clientY - drag.offsetY);
    waLivePosRef.current = next;
    setWaPos(next);
    const dx = t.clientX - drag.startX;
    const dy = t.clientY - drag.startY;
    if (dx * dx + dy * dy > 9) drag.hasMoved = true;
  };

  waEndTouchRef.current = (e: TouchEvent) => {
    const drag = waDragRef.current;
    if (!drag.active) return;
    drag.active = false;
    waRemoveDocListenersRef.current?.();
    waRemoveDocListenersRef.current = null;
    document.body.style.cursor = "";
    setWaDragging(false);
    if (drag.hasMoved) {
      const t = e.changedTouches[0];
      if (t) {
        waLivePosRef.current = clampWhatsAppPosition(t.clientX - drag.offsetX, t.clientY - drag.offsetY);
      }
      const snapped = snapWhatsAppToNearestEdge(waLivePosRef.current.left, waLivePosRef.current.top);
      waSuppressClickRef.current = true;
      setWaSnapTransition(true);
      setWaPos(snapped);
      waLivePosRef.current = snapped;
      persistWhatsAppPosition(snapped);
      window.setTimeout(() => setWaSnapTransition(false), 200);
    }
    drag.hasMoved = false;
  };

  const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setProfileImage(objectUrl);
  };

  const handleLogout = () => {
    setOpenProfileMenu(false);
    authLogout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      <div className="flex min-w-0 flex-row">
        <aside className="sticky top-0 hidden h-screen w-64 min-w-64 shrink-0 flex-col border-r border-[var(--border)] bg-black lg:flex">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-2 pt-4">
            <div className="mb-6 flex shrink-0 items-center px-3">
              <div className="flex h-[36.8px] items-center justify-start">
                <img
                  src="/frame-1.svg"
                  alt="RocketRide logo"
                  className="h-[36.8px] w-auto max-w-[93.15px] object-contain object-left"
                />
              </div>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {links.map((link) => {
                const isActive =
                  link.key === "projects"
                    ? pathname.startsWith("/projects")
                    : link.key === "updates"
                      ? pathname.startsWith("/updates")
                      : link.key === "publishing"
                        ? pathname.startsWith("/publishing")
                        : link.key === "calendar"
                          ? pathname.startsWith("/calendar")
                          : pathname === link.href;
                const Icon = link.icon;
                if (link.key === "marketing") {
                  const isMarketingActive = pathname.startsWith("/marketing");
                  const submenuItems = [
                    { label: "Strategy", href: "/marketing/strategy" },
                    { label: "Campaigns", href: "/marketing/campaigns" },
                    { label: "Reports", href: "/marketing/reports" },
                  ] as const;
                  return (
                    <div key={link.key}>
                      <button
                        type="button"
                        onClick={() => setMarketingMenuOpen((prev) => !prev)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm transition [border-image:none]",
                          isMarketingActive
                            ? "border-l-[rgba(255,69,0,1)] bg-[rgba(255,69,0,0.15)] text-[#FF4500]"
                            : "text-[rgba(255,255,255,0.4)] hover:bg-[var(--surface-elevated)] hover:text-white",
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.5} />
                        {t(link.labelKey)}
                      </button>
                      {marketingMenuOpen ? (
                        <div className="mt-1 space-y-1 pl-7">
                          {submenuItems.map((item) => {
                            const subActive = pathname === item.href;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                  "flex items-center rounded-lg border-l-2 border-transparent px-3 py-1.5 text-xs transition [border-image:none]",
                                  subActive
                                    ? "border-l-[rgba(255,69,0,1)] bg-[rgba(255,69,0,0.15)] text-[#FF4500]"
                                    : "text-[rgba(255,255,255,0.4)] hover:bg-[var(--surface-elevated)] hover:text-white",
                                )}
                              >
                                {item.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }
                if (link.key === "crm") {
                  const isCrmActive = pathname.startsWith("/crm");
                  const crmSubmenuItems = [
                    { label: "Dashboard", href: "/crm/dashboard" },
                    { label: "Pipeline", href: "/crm/pipeline" },
                    { label: "Contacts", href: "/crm/contacts" },
                    { label: "Reports", href: "/crm/reports" },
                  ] as const;
                  return (
                    <div key={link.key}>
                      <button
                        type="button"
                        onClick={() => setCrmMenuOpen((prev) => !prev)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm transition [border-image:none]",
                          isCrmActive
                            ? "border-l-[rgba(255,69,0,1)] bg-[rgba(255,69,0,0.15)] text-[#FF4500]"
                            : "text-[rgba(255,255,255,0.4)] hover:bg-[var(--surface-elevated)] hover:text-white",
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.5} />
                        {t(link.labelKey)}
                      </button>
                      {crmMenuOpen ? (
                        <div className="mt-1 space-y-1 pl-7">
                          {crmSubmenuItems.map((item) => {
                            const subActive = pathname === item.href;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                  "flex items-center rounded-lg border-l-2 border-transparent px-3 py-1.5 text-xs transition [border-image:none]",
                                  subActive
                                    ? "border-l-[rgba(255,69,0,1)] bg-[rgba(255,69,0,0.15)] text-[#FF4500]"
                                    : "text-[rgba(255,255,255,0.4)] hover:bg-[var(--surface-elevated)] hover:text-white",
                                )}
                              >
                                {item.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }
                return (
                  <Link
                    key={link.key}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm transition [border-image:none]",
                      isActive
                        ? "border-l-[rgba(255,69,0,1)] bg-[rgba(255,69,0,0.15)] text-[#FF4500]"
                        : "text-[rgba(255,255,255,0.4)] hover:bg-[var(--surface-elevated)] hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                    {t(link.labelKey)}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="shrink-0 space-y-3 border-t border-[rgba(255,255,255,0.06)] px-3 pb-8 pt-3">
            <div className="relative w-full min-w-0">
              <div className="flex items-center justify-between">
              <div className="relative ml-3" ref={langMenuRef}>
                <button
                  type="button"
                  onClick={() => setLangMenuOpen((o) => !o)}
                  className="cursor-pointer border-none bg-transparent text-[0.8rem] font-light text-[rgba(255,255,255,0.5)] outline-none"
                  aria-expanded={langMenuOpen}
                  aria-haspopup="listbox"
                >
                  {language === "pt-BR" ? "PT" : "EN"}
                </button>
                {langMenuOpen ? (
                  <div
                    className="absolute bottom-full left-0 z-[60] mb-1 min-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
                    role="listbox"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={language === "en"}
                      onClick={() => {
                        setLanguage("en");
                        setLangMenuOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-xs text-[var(--text)] hover:bg-[var(--surface-elevated)]"
                    >
                    {lt("EN — English")}
                  </button>
                  <button
                    type="button"
                    role="option"
                    aria-selected={language === "pt-BR"}
                    onClick={() => {
                      setLanguage("pt-BR");
                      setLangMenuOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-xs text-[var(--text)] hover:bg-[var(--surface-elevated)]"
                  >
                    {lt("PT — Português (Brasil)")}
                  </button>
                  </div>
                ) : null}
              </div>
                <button
                  type="button"
                  onClick={() => setOpenNotifications((prev) => !prev)}
                  className="relative inline-flex shrink-0 p-1 text-[rgba(255,255,255,0.5)] transition hover:text-[rgba(255,255,255,0.75)]"
                  aria-label={t("notifications")}
                >
                  <Bell className="h-5 w-5" strokeWidth={1.5} />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-medium text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </button>
              </div>
              {openNotifications ? (
                <div className="absolute bottom-full left-0 right-0 z-50 mb-2 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-normal">{t("notifications")}</p>
                    <button type="button" onClick={markAllAsRead} className="shrink-0 text-xs text-[var(--primary)]">
                      {t("markAll")}
                    </button>
                  </div>
                  <div className="max-h-72 space-y-2 overflow-auto">
                    {notifications.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "flex min-w-0 items-stretch gap-1 rounded-lg border text-xs",
                          item.read
                            ? "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)]"
                            : "border-[var(--border-strong)] bg-[var(--primary)]/10 text-white",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => markNotificationRead(item.id)}
                          className="min-w-0 flex-1 px-3 py-2 text-left font-light"
                        >
                          {td(item.message)}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(item.id);
                          }}
                          className="shrink-0 px-2 text-[rgba(255,255,255,0.45)] transition hover:text-white"
                          aria-label="Dismiss notification"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-1">
              <div className="relative min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setOpenProfileMenu((prev) => !prev)}
                  className="flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-1.5 text-left transition hover:bg-[var(--surface-elevated)]"
                  aria-label={lt("Profile menu")}
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-elevated)]">
                    {profileImage ? (
                      <img src={profileImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-[var(--text)]">{avatarInitial}</span>
                    )}
                  </span>
                  <span className="truncate text-xs font-light text-[rgba(255,255,255,0.5)]">{profileName}</span>
                </button>
                {openProfileMenu ? (
                  <div className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenSettingsModal(true);
                        setOpenProfileMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-[var(--text)] hover:bg-[var(--surface-elevated)]"
                    >
                      <Settings className="h-4 w-4" />
                      {lt("Profile")}
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 rounded-lg p-2 text-[rgba(255,255,255,0.5)] transition hover:bg-[var(--surface-elevated)] hover:text-[rgba(255,255,255,0.75)]"
                aria-label={lt("Logout")}
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            {isAdmin ? (
              <>
                <div className="border-t border-[rgba(255,255,255,0.06)]" />
                <Link
                  href="/settings"
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition [border-image:none]",
                    pathname === "/settings"
                      ? "border-l-2 border-l-[rgba(255,69,0,1)] bg-[rgba(255,69,0,0.15)] pl-[10px] text-[#FF4500]"
                      : "border-l-2 border-transparent text-[rgba(255,255,255,0.4)] hover:bg-[var(--surface-elevated)] hover:text-white",
                  )}
                >
                  <Settings className="h-4 w-4" strokeWidth={1.5} />
                  {lt("Settings")}
                </Link>
              </>
            ) : null}
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
          <div className="shrink-0">
            <HeroSection />
          </div>
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              key={pathname}
              className="platform-route-content min-h-0 flex-1 px-6 pt-6 pb-6 lg:px-8"
            >
              {children}
            </div>
          </main>
          <a
            ref={waLinkRef}
            href="https://chat.whatsapp.com/GM1ODG5EMHuLf03W6kn1b9?mode=gi_t"
            target="_blank"
            rel="noreferrer"
            className={cn(
              "fixed z-30 inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-full border border-[var(--border)] bg-[#25d366] text-white",
              waDragging && "cursor-grabbing",
            )}
            style={{
              left: waPos.left,
              top: waPos.top,
              right: "auto",
              bottom: "auto",
              transition: waSnapTransition ? "left 0.15s ease, top 0.15s ease" : "none",
            }}
            aria-label={lt("WhatsApp group")}
            onClick={(e) => {
              if (waSuppressClickRef.current) {
                e.preventDefault();
                e.stopPropagation();
                waSuppressClickRef.current = false;
              }
            }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              const el = waLinkRef.current;
              if (!el) return;
              const r = el.getBoundingClientRect();
              waDragRef.current = {
                active: true,
                offsetX: e.clientX - r.left,
                offsetY: e.clientY - r.top,
                startX: e.clientX,
                startY: e.clientY,
                hasMoved: false,
              };
              waLivePosRef.current = { left: r.left, top: r.top };
              document.body.style.cursor = "grabbing";
              setWaDragging(true);
              const move = (ev: MouseEvent) => waMoveMouseRef.current(ev);
              const up = () => waUpMouseRef.current();
              document.addEventListener("mousemove", move);
              document.addEventListener("mouseup", up);
              waRemoveDocListenersRef.current = () => {
                document.removeEventListener("mousemove", move);
                document.removeEventListener("mouseup", up);
              };
            }}
            onTouchStart={(e) => {
              if (e.touches.length !== 1) return;
              const t = e.touches[0];
              const el = waLinkRef.current;
              if (!el) return;
              const r = el.getBoundingClientRect();
              waDragRef.current = {
                active: true,
                offsetX: t.clientX - r.left,
                offsetY: t.clientY - r.top,
                startX: t.clientX,
                startY: t.clientY,
                hasMoved: false,
              };
              waLivePosRef.current = { left: r.left, top: r.top };
              document.body.style.cursor = "grabbing";
              setWaDragging(true);
              const move = (ev: TouchEvent) => waMoveTouchRef.current(ev);
              const end = (ev: TouchEvent) => waEndTouchRef.current(ev);
              const touchOpts: AddEventListenerOptions = { passive: false };
              document.addEventListener("touchmove", move, touchOpts);
              document.addEventListener("touchend", end);
              document.addEventListener("touchcancel", end);
              waRemoveDocListenersRef.current = () => {
                document.removeEventListener("touchmove", move, touchOpts);
                document.removeEventListener("touchend", end);
                document.removeEventListener("touchcancel", end);
              };
            }}
          >
            <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
          </a>
        </div>
      </div>
      <Modal open={openSettingsModal} title={lt("Profile settings")} onClose={() => setOpenSettingsModal(false)} closeLabel={lt("Close")}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-elevated)]">
              {profileImage ? (
                <img src={profileImage} alt="Profile preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm text-[var(--text)]">{avatarInitial}</span>
              )}
            </div>
            <input type="file" accept="image/*" onChange={handleProfileImageChange} className="text-xs" />
          </div>
          <input
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            placeholder={lt("Name")}
            className="w-full rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={profileEmail}
            onChange={(event) => setProfileEmail(event.target.value)}
            placeholder={lt("Email")}
            className="w-full rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={profilePassword}
            onChange={(event) => setProfilePassword(event.target.value)}
            placeholder={lt("Password")}
            className="w-full rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={() => setOpenSettingsModal(false)} className="btn-primary rounded-lg px-3 py-2 text-sm">
            {lt("Save")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
