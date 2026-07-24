"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
  BarChart3,
  Briefcase,
  Calendar,
  Clapperboard,
  FileText,
  FileUp,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Package,
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
import { FloatingSidebarRail } from "@/components/layout/floating-sidebar-rail";
import { WhatsAppChatWidget } from "@/components/layout/whatsapp-chat-widget";
import { whatsAppWidgetReady } from "@/lib/client-whatsapp-config";
import { TeamChatWidget } from "@/modules/team-chat/team-chat-widget";
import { SidebarDrawer } from "@/components/layout/sidebar-drawer";
import { SidebarPanelContent, type SidebarPanelContentProps } from "@/components/layout/sidebar-panel-content";
import type { SidebarNavLink } from "@/components/layout/sidebar-nav";
import { SIDEBAR_RAIL_LAYOUT_WIDTH } from "@/lib/sidebar-layout-preference";
import { orderSidebarLinks, readSidebarNavOrder, writeSidebarNavOrder } from "@/lib/sidebar-nav-order";
import { readSidebarLayout, writeSidebarLayout } from "@/lib/sidebar-layout-preference";
import { isAgencyAdmin } from "@/lib/client-utils";
import { hasModuleAccess } from "@/lib/modules";
import {
  AGENCY_HOME_PATH,
  canAccessMarketingForUser,
  isAgencyHomePath,
  pathnameAllowedForModules,
  resolveAgencyClientLandingPath,
  resolveDefaultLandingPath,
  resolveDefaultLandingPathForUser,
} from "@/lib/default-landing-path";
import { resolveActiveClient } from "@/lib/resolve-locale";
import { Modal } from "@/components/ui/modal";
import { PasswordInput } from "@/components/ui/password-input";
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
  { key: "portfolio", labelKey: "portfolio", href: "/portfolio", icon: Clapperboard },
  { key: "deliveries", labelKey: "deliveries", href: "/deliveries", icon: Package },
];

const GUEST_USER_ID = "__guest__";

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
    users,
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
  const canAccessMarketing = canAccessMarketingForUser(currentUser);
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

  useEffect(() => {
    if (currentUser.id === GUEST_USER_ID) return;

    if (isAgencyHomePath(pathname)) {
      if (isAgencyAdmin(currentUser)) return;
      const fallback = resolveDefaultLandingPathForUser(currentUser, navOrder);
      if (pathname !== fallback) router.replace(fallback);
      return;
    }

    const landingOpts = {
      navOrder,
      canAccessMarketing: canAccessMarketingForUser(currentUser),
    };

    if (allowedModules.length === 0) {
      if (isAgencyAdmin(currentUser) && pathname !== AGENCY_HOME_PATH) {
        router.replace(AGENCY_HOME_PATH);
      }
      return;
    }

    if (pathnameAllowedForModules(pathname, allowedModules, landingOpts)) return;
    const fallback = resolveDefaultLandingPath(allowedModules, landingOpts);
    if (pathname !== fallback && !pathname.startsWith(`${fallback}/`)) {
      router.replace(fallback);
    }
  }, [allowedModules, currentUser, navOrder, pathname, router]);

  const handleNavReorder = useCallback(
    (order: ModuleKey[]) => {
      setNavOrder(order);
      writeSidebarNavOrder(currentUser.id, order);
    },
    [currentUser.id],
  );
  const avatarInitial = profileName.trim().slice(0, 1).toUpperCase() || "U";
  const agencyAdmin = isAgencyAdmin(currentUser);

  const redirectAgencyAdminToClientLanding = useCallback(
    (clientSlug: string) => {
      const landing = resolveAgencyClientLandingPath(
        currentUser,
        clientSlug,
        { clients, users },
        {
          navOrder,
          canAccessMarketing: canAccessMarketingForUser(currentUser),
        },
      );
      if (pathname !== landing && !pathname.startsWith(`${landing}/`)) {
        router.push(landing);
      }
    },
    [currentUser, clients, users, navOrder, pathname, router],
  );

  const handleClientFilterChange = useCallback(
    (slug: string) => {
      setProjectsClientFilter(slug);
      if (!agencyAdmin || slug === "all") return;
      if (isAgencyHomePath(pathname)) {
        redirectAgencyAdminToClientLanding(slug);
      }
    },
    [agencyAdmin, pathname, redirectAgencyAdminToClientLanding, setProjectsClientFilter],
  );

  useEffect(() => {
    if (!agencyAdmin || projectsClientFilter === "all") return;
    if (!isAgencyHomePath(pathname)) return;
    redirectAgencyAdminToClientLanding(projectsClientFilter);
  }, [agencyAdmin, pathname, projectsClientFilter, redirectAgencyAdminToClientLanding]);

  const onUpdatesPage = pathname.startsWith("/updates");
  const hideSystemHero = pathname === "/portfolio" || pathname.startsWith("/portfolio/");
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

  const activeClient = useMemo(
    () => resolveActiveClient(currentUser, clients, projectsClientFilter),
    [currentUser, clients, projectsClientFilter],
  );

  const showWhatsAppWidget = Boolean(
    activeClient && !pathname.startsWith("/login") && whatsAppWidgetReady(activeClient.whatsappConfig),
  );
  const showTeamChat = currentUser.id !== GUEST_USER_ID && !pathname.startsWith("/login");

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
    setProjectsClientFilter: handleClientFilterChange,
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
          <aside className="sticky top-0 hidden h-screen w-64 min-w-64 shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar)] lg:flex">
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
          {hideSystemHero ? null : (
            <div className="shrink-0">
              <HeroSection />
            </div>
          )}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              key={pathname}
              className={
                hideSystemHero
                  ? "platform-route-content min-h-0 flex-1 p-0"
                  : "platform-route-content min-h-0 flex-1 px-6 pt-6 pb-6 lg:px-8"
              }
            >
              {children}
            </div>
          </main>
        </div>
      </div>
      {showWhatsAppWidget && activeClient ? (
        <WhatsAppChatWidget client={activeClient} currentUser={currentUser} lt={lt} />
      ) : null}
      {showTeamChat ? <TeamChatWidget lt={lt} offsetForWhatsApp={showWhatsAppWidget} /> : null}
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
          <PasswordInput
            value={profilePassword}
            onChange={(event) => setProfilePassword(event.target.value)}
            placeholder={lt("Password")}
            className="w-full rounded-lg px-3 py-2 text-sm"
            showLabel={lt("Show password")}
            hideLabel={lt("Hide password")}
          />
          <button onClick={() => setOpenSettingsModal(false)} className="btn-primary rounded-lg px-3 py-2 text-sm">
            {lt("Save")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
