"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
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
  Settings,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import type { ModuleKey } from "@/types";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { uploadProfileAvatar } from "@/lib/profile-avatar";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { FloatingSidebarRail } from "@/components/layout/floating-sidebar-rail";
import { SidebarDrawer } from "@/components/layout/sidebar-drawer";
import { SidebarPanelContent, type SidebarPanelContentProps } from "@/components/layout/sidebar-panel-content";
import type { SidebarNavLink } from "@/components/layout/sidebar-nav";
import { SIDEBAR_RAIL_LAYOUT_WIDTH } from "@/lib/sidebar-layout-preference";
import { orderSidebarLinks, readSidebarNavOrder, writeSidebarNavOrder } from "@/lib/sidebar-nav-order";
import { readSidebarLayout, writeSidebarLayout } from "@/lib/sidebar-layout-preference";
import { effectiveUserClientSlug, isAgencyAdmin, isAgencyCompany } from "@/lib/client-utils";
import { hasModuleAccess } from "@/lib/modules";
import { Modal } from "@/components/ui/modal";
import HeroSection from "@/components/layout/hero-section";

const moduleLinks: SidebarNavLink[] = [
  { key: "dashboard", labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "projects", labelKey: "projects", href: "/projects", icon: BarChart3 },
  { key: "financial", labelKey: "financial", href: "/financial", icon: Wallet },
  { key: "updates", labelKey: "updates", href: "/updates", icon: MessageSquare },
  { key: "marketing", labelKey: "marketing", href: "/marketing", icon: Megaphone },
  { key: "content-management", labelKey: "content-management", href: "/content-management", icon: Sparkles },
  { key: "calendar", labelKey: "calendar", href: "/calendar", icon: Calendar },
  { key: "crm", labelKey: "crm", href: "/crm", icon: Briefcase },
  { key: "files", labelKey: "files", href: "/files", icon: FileUp },
  { key: "contracts", labelKey: "contracts", href: "/contracts", icon: FileText },
];

const GUEST_USER_ID = "__guest__";

const WHATSAPP_POS_KEY = "whatsapp-button-position";
const WH_BTN = 36;
const WH_MARGIN = 20;
const SIDEBAR_RAIL_LEFT_OFFSET = SIDEBAR_RAIL_LAYOUT_WIDTH;

function clampWhatsAppPosition(left: number, top: number): { left: number; top: number } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    left: Math.max(WH_MARGIN, Math.min(left, w - WH_MARGIN - WH_BTN)),
    top: Math.max(WH_MARGIN, Math.min(top, h - WH_MARGIN - WH_BTN)),
  };
}

function getDefaultWhatsAppPosition(sidebarExpanded: boolean): { left: number; top: number } {
  const h = window.innerHeight;
  const lg = window.matchMedia("(min-width: 1024px)").matches;
  let sidebar = 0;
  if (!sidebarExpanded) {
    sidebar = SIDEBAR_RAIL_LEFT_OFFSET;
  } else if (lg) {
    sidebar = 256;
  }
  return clampWhatsAppPosition(WH_MARGIN + sidebar, h - WH_MARGIN - WH_BTN);
}

function readStoredWhatsAppPosition(userId: string): { left: number; top: number } {
  const expanded = readSidebarLayout(userId) !== "collapsed";
  try {
    const raw = localStorage.getItem(WHATSAPP_POS_KEY);
    if (!raw) return getDefaultWhatsAppPosition(expanded);
    const o = JSON.parse(raw) as { left?: unknown; top?: unknown };
    if (typeof o.left !== "number" || typeof o.top !== "number") return getDefaultWhatsAppPosition(expanded);
    return clampWhatsAppPosition(o.left, o.top);
  } catch {
    return getDefaultWhatsAppPosition(expanded);
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
    setProfileAvatarUrl,
    unreadCount,
    markAllAsRead,
    notifications,
    markNotificationRead,
    dismissNotification,
    allowedModules,
    clients,
    dataClientSlug,
    projectsClientFilter,
    setProjectsClientFilter,
    language,
    setLanguage,
    saveLocalePreference,
    t,
    td,
  } = useAppContext();
  const { t: lt } = useLanguage();
  const [openNotifications, setOpenNotifications] = useState(false);
  const [openProfileMenu, setOpenProfileMenu] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [marketingMenuOpen, setMarketingMenuOpen] = useState(false);
  const [crmMenuOpen, setCrmMenuOpen] = useState(false);
  const [contentMenuOpen, setContentMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profileEmail, setProfileEmail] = useState(`${currentUser.name.toLowerCase().replace(/\s+/g, ".")}@rocketride.com`);
  const [profilePassword, setProfilePassword] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(currentUser.avatarUrl);
  const [profileImageUploading, setProfileImageUploading] = useState(false);
  const [profileImageError, setProfileImageError] = useState("");
  const [latestClientUpdateAt, setLatestClientUpdateAt] = useState<string | null>(null);
  const dataClientSlugRef = useRef(dataClientSlug);
  dataClientSlugRef.current = dataClientSlug;

  const isAdmin = currentUser.role === "admin";
  const canAccessMarketing =
    (currentUser.role === "admin" && (currentUser.company === "nexa" || currentUser.company === "otus")) ||
    (currentUser.role === "manager" && currentUser.modules.includes("marketing"));
  const [navOrder, setNavOrder] = useState<ModuleKey[] | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [sidebarLayoutHydrated, setSidebarLayoutHydrated] = useState(false);
  const [isLgViewport, setIsLgViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
  );

  useEffect(() => {
    setNavOrder(readSidebarNavOrder(currentUser.id));
  }, [currentUser.id]);

  useEffect(() => {
    const stored = readSidebarLayout(currentUser.id);
    setSidebarExpanded(stored !== "collapsed");
    setSidebarLayoutHydrated(true);
  }, [currentUser.id]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLgViewport(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const setSidebarExpandedPersist = useCallback(
    (expanded: boolean) => {
      setSidebarExpanded(expanded);
      writeSidebarLayout(currentUser.id, expanded ? "expanded" : "collapsed");
    },
    [currentUser.id],
  );

  const prevLgViewportRef = useRef(isLgViewport);
  useEffect(() => {
    if (prevLgViewportRef.current && !isLgViewport) {
      setSidebarExpandedPersist(false);
    }
    prevLgViewportRef.current = isLgViewport;
  }, [isLgViewport, setSidebarExpandedPersist]);

  useEffect(() => {
    if (!isLgViewport && sidebarExpanded) {
      setSidebarExpandedPersist(false);
    }
    // Close mobile drawer after route change only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const filteredLinks = useMemo(
    () =>
      moduleLinks.filter((link) =>
        link.key === "marketing"
          ? allowedModules.includes(link.key) && canAccessMarketing
          : hasModuleAccess(allowedModules, link.key),
      ),
    [allowedModules, canAccessMarketing],
  );

  const links = useMemo(
    () => orderSidebarLinks(filteredLinks, navOrder),
    [filteredLinks, navOrder],
  );

  const handleNavReorder = useCallback(
    (order: ModuleKey[]) => {
      setNavOrder(order);
      writeSidebarNavOrder(currentUser.id, order);
    },
    [currentUser.id],
  );
  const avatarInitial = profileName.trim().slice(0, 1).toUpperCase() || "U";
  const agencyAdmin = isAgencyAdmin(currentUser);
  const sidebarClient = (() => {
    if (agencyAdmin) {
      if (projectsClientFilter === "all") return null;
      return clients.find((c) => c.slug === projectsClientFilter) ?? null;
    }
    if (isAgencyCompany(currentUser.company)) return null;
    const slug = effectiveUserClientSlug(currentUser);
    if (!slug) return null;
    return clients.find((c) => c.slug === slug) ?? null;
  })();

  const onUpdatesPage = pathname.startsWith("/updates");
  let updatesLastSeen: string | null = null;
  if (typeof window !== "undefined") {
    try {
      updatesLastSeen = localStorage.getItem(`updates-last-seen-${currentUser.id}`);
    } catch {
      updatesLastSeen = null;
    }
  }
  const lastSeenMs = updatesLastSeen ? new Date(updatesLastSeen).getTime() : NaN;
  const lastSeenValid = Number.isFinite(lastSeenMs);
  const latestMs = latestClientUpdateAt ? new Date(latestClientUpdateAt).getTime() : NaN;
  const latestValid = Number.isFinite(latestMs);
  const showUpdatesUnreadDot =
    currentUser.id !== GUEST_USER_ID &&
    !onUpdatesPage &&
    latestValid &&
    (!lastSeenValid || latestMs > lastSeenMs);
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
    if (pathname.startsWith("/content-management")) setContentMenuOpen(true);
  }, [pathname]);

  const fetchLatestClientUpdate = useCallback(async () => {
    if (currentUser.id === GUEST_USER_ID) {
      setLatestClientUpdateAt(null);
      return;
    }
    const slug = dataClientSlugRef.current;
    let q = supabase.from("client_updates").select("created_at").order("created_at", { ascending: false }).limit(1);
    if (slug) {
      q = q.eq("client_slug", slug);
    }
    const { data, error } = await q.maybeSingle();
    if (error) {
      console.error("[app-shell] client_updates latest:", error.message);
      setLatestClientUpdateAt(null);
      return;
    }
    const raw = data?.created_at;
    setLatestClientUpdateAt(raw != null ? String(raw) : null);
  }, [currentUser.id]);

  useEffect(() => {
    if (currentUser.id === GUEST_USER_ID) {
      setLatestClientUpdateAt(null);
      return;
    }
    let cancelled = false;

    const runFetch = async () => {
      if (cancelled) return;
      const slug = dataClientSlugRef.current;
      let q = supabase.from("client_updates").select("created_at").order("created_at", { ascending: false }).limit(1);
      if (slug) {
        q = q.eq("client_slug", slug);
      }
      const { data, error } = await q.maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[app-shell] client_updates latest:", error.message);
        setLatestClientUpdateAt(null);
        return;
      }
      const raw = data?.created_at;
      setLatestClientUpdateAt(raw != null ? String(raw) : null);
    };

    void runFetch();

    const channel = supabase
      .channel("updates-notification")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "client_updates" },
        (payload: { new?: Record<string, unknown> }) => {
          const slug = dataClientSlugRef.current;
          const rowSlug = payload.new?.client_slug != null ? String(payload.new.client_slug) : null;
          if (slug && rowSlug && rowSlug !== slug) return;
          const ts = payload.new?.created_at;
          if (typeof ts === "string") {
            setLatestClientUpdateAt(ts);
          } else {
            void runFetch();
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [currentUser.id]);

  useEffect(() => {
    void fetchLatestClientUpdate();
  }, [fetchLatestClientUpdate, dataClientSlug]);

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
    const p = readStoredWhatsAppPosition(currentUser.id);
    setWaPos(p);
    waLivePosRef.current = p;
  }, [currentUser.id]);

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

  useEffect(() => {
    setProfileImage(currentUser.avatarUrl);
  }, [currentUser.avatarUrl]);

  const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || currentUser.id === GUEST_USER_ID) return;
    setProfileImageError("");
    setProfileImageUploading(true);
    void (async () => {
      const result = await uploadProfileAvatar(currentUser.id, file);
      if (!result.ok) {
        setProfileImageError(lt("Upload failed. Try again."));
        setProfileImageUploading(false);
        return;
      }
      await setProfileAvatarUrl(result.url);
      setProfileImage(result.url);
      setProfileImageUploading(false);
    })();
  };

  const handleLogout = () => {
    setOpenProfileMenu(false);
    authLogout();
    router.push("/login");
  };

  const sidebarPanelProps: Omit<SidebarPanelContentProps, "variant" | "onCollapse" | "onCloseDrawer"> = {
    pathname,
    links,
    tNav: t,
    tPlatform: t as (key: string) => string,
    lt,
    dragLabel: lt("Drag to reorder"),
    showUpdatesUnreadDot,
    marketingMenuOpen,
    setMarketingMenuOpen,
    contentMenuOpen,
    setContentMenuOpen,
    crmMenuOpen,
    setCrmMenuOpen,
    onReorder: handleNavReorder,
    collapseLabel: lt("Minimize sidebar"),
    agencyAdmin,
    clients,
    projectsClientFilter,
    setProjectsClientFilter,
    language,
    langMenuOpen,
    setLangMenuOpen,
    langMenuRef,
    setLanguage,
    saveLocalePreference,
    openNotifications,
    setOpenNotifications,
    unreadCount,
    notifications,
    markAllAsRead,
    markNotificationRead,
    dismissNotification,
    td,
    openProfileMenu,
    setOpenProfileMenu,
    profileImage,
    avatarInitial,
    profileName,
    sidebarClient,
    onOpenSettings: () => setOpenSettingsModal(true),
    onLogout: handleLogout,
    isAdmin,
  };

  const showRail =
    !sidebarExpanded && (sidebarLayoutHydrated || !isLgViewport);
  const showDesktopAside = sidebarLayoutHydrated && sidebarExpanded && isLgViewport;
  const showMobileDrawer = sidebarLayoutHydrated && sidebarExpanded && !isLgViewport;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      <div className="flex min-w-0 flex-row">
        {showDesktopAside ? (
          <aside className="sticky top-0 hidden h-screen w-64 min-w-64 shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-black lg:flex">
            <SidebarPanelContent
              {...sidebarPanelProps}
              variant="aside"
              onCollapse={() => setSidebarExpandedPersist(false)}
            />
          </aside>
        ) : null}

        {showRail ? (
          <div
            className="sticky top-0 hidden h-screen shrink-0 lg:flex lg:flex-col lg:items-center lg:justify-center"
            style={{ width: SIDEBAR_RAIL_LAYOUT_WIDTH }}
          >
            <FloatingSidebarRail
              onExpand={() => setSidebarExpandedPersist(true)}
              profileImage={profileImage}
              avatarInitial={avatarInitial}
              profileName={profileName}
              expandLabel={lt("Expand menu")}
              profileMenuLabel={lt("Profile menu")}
              profileLabel={lt("Profile")}
              logoutLabel={lt("Logout")}
              onOpenSettings={() => setOpenSettingsModal(true)}
              onLogout={handleLogout}
              unreadCount={unreadCount}
            />
          </div>
        ) : null}

        <SidebarDrawer
          {...sidebarPanelProps}
          open={showMobileDrawer}
          onClose={() => setSidebarExpandedPersist(false)}
        />

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
            <input
              type="file"
              accept="image/*"
              disabled={profileImageUploading}
              onChange={handleProfileImageChange}
              className="text-xs"
            />
            {profileImageError ? <p className="text-xs text-red-400">{profileImageError}</p> : null}
            {profileImageUploading ? <p className="text-xs text-[var(--muted)]">{lt("Saving…")}</p> : null}
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
