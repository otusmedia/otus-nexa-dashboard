"use client";

import { useRef } from "react";
import Link from "next/link";
import { Bell, LogOut, PanelLeftClose, Settings, X } from "lucide-react";
import type { Client } from "@/types";
import type { ModuleKey } from "@/types";
import { SidebarClientPicker } from "@/components/layout/sidebar-client-picker";
import { SidebarNav, type SidebarNavLink } from "@/components/layout/sidebar-nav";
import { ClientLogo } from "@/components/ui/client-logo";
import { cn } from "@/lib/utils";

export type SidebarPanelContentProps = {
  variant: "aside" | "drawer";
  pathname: string;
  links: SidebarNavLink[];
  tNav: (key: SidebarNavLink["labelKey"]) => string;
  tPlatform: (key: string) => string;
  lt: (key: string) => string;
  dragLabel: string;
  showUpdatesUnreadDot: boolean;
  marketingMenuOpen: boolean;
  setMarketingMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  contentMenuOpen: boolean;
  setContentMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  crmMenuOpen: boolean;
  setCrmMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onReorder: (order: ModuleKey[]) => void;
  onCollapse?: () => void;
  onCloseDrawer?: () => void;
  collapseLabel: string;
  agencyAdmin: boolean;
  clients: Client[];
  projectsClientFilter: string;
  setProjectsClientFilter: (slug: string) => void;
  language: string;
  langMenuOpen: boolean;
  setLangMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  langMenuRef: React.RefObject<HTMLDivElement | null>;
  setLanguage: (lang: "en" | "pt-BR") => void;
  saveLocalePreference: (lang: import("@/lib/locale-types").AppLanguage | null) => Promise<void>;
  openNotifications: boolean;
  setOpenNotifications: React.Dispatch<React.SetStateAction<boolean>>;
  unreadCount: number;
  notifications: Array<{ id: string; message: string; read: boolean }>;
  markAllAsRead: () => void;
  markNotificationRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  td: (message: string) => string;
  openProfileMenu: boolean;
  setOpenProfileMenu: React.Dispatch<React.SetStateAction<boolean>>;
  profileImage: string | null;
  avatarInitial: string;
  profileName: string;
  sidebarClient: Client | null;
  onOpenSettings: () => void;
  onLogout: () => void;
  isAdmin: boolean;
};

export function SidebarPanelContent(props: SidebarPanelContentProps) {
  const {
    variant,
    pathname,
    links,
    tNav,
    tPlatform,
    lt,
    dragLabel,
    showUpdatesUnreadDot,
    marketingMenuOpen,
    setMarketingMenuOpen,
    contentMenuOpen,
    setContentMenuOpen,
    crmMenuOpen,
    setCrmMenuOpen,
    onReorder,
    onCollapse,
    onCloseDrawer,
    collapseLabel,
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
    onOpenSettings,
    onLogout,
    isAdmin,
  } = props;

  const showCollapse = variant === "aside" && onCollapse;
  const showClose = variant === "drawer" && onCloseDrawer;
  const navScrollRef = useRef<HTMLElement>(null);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-4 pb-2 pt-4">
      <div className="mb-6 flex shrink-0 items-center justify-between gap-2 px-3">
        <div className="flex h-[36.8px] min-w-0 items-center justify-start">
          <img
            src="/frame-1.svg"
            alt="RocketRide logo"
            className="h-[36.8px] w-auto max-w-[93.15px] object-contain object-left"
          />
        </div>
        {showCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="shrink-0 rounded-lg p-2 text-[rgba(255,255,255,0.45)] transition hover:bg-[var(--surface-elevated)] hover:text-white"
            aria-label={collapseLabel}
          >
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
          </button>
        ) : null}
        {showClose ? (
          <button
            type="button"
            onClick={onCloseDrawer}
            className="shrink-0 rounded-lg p-2 text-[rgba(255,255,255,0.45)] transition hover:bg-[var(--surface-elevated)] hover:text-white"
            aria-label={collapseLabel}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <nav
          ref={navScrollRef}
          className="sidebar-nav-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1"
        >
          <SidebarNav
            scrollContainerRef={navScrollRef}
            links={links}
            pathname={pathname}
            t={tNav}
            lt={lt}
            dragLabel={dragLabel}
            showUpdatesUnreadDot={showUpdatesUnreadDot}
            marketingMenuOpen={marketingMenuOpen}
            setMarketingMenuOpen={setMarketingMenuOpen}
            contentMenuOpen={contentMenuOpen}
            setContentMenuOpen={setContentMenuOpen}
            crmMenuOpen={crmMenuOpen}
            setCrmMenuOpen={setCrmMenuOpen}
            onReorder={onReorder}
          />
        </nav>
      </div>

      <div className="shrink-0 space-y-3 border-t border-[rgba(255,255,255,0.06)] px-3 pb-8 pt-3">
        {agencyAdmin ? (
          <SidebarClientPicker
            clients={clients}
            value={projectsClientFilter}
            onChange={setProjectsClientFilter}
            label={lt("Viewing client")}
            allLabel={lt("All clients")}
            className="pb-1"
          />
        ) : null}
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
                  <button
                    type="button"
                    onClick={() => {
                      void saveLocalePreference(language as "en" | "pt-BR");
                      setLangMenuOpen(false);
                    }}
                    className="block w-full border-t border-[var(--border)] px-3 py-2 text-left text-[0.7rem] text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]"
                  >
                    {lt("Save as my default language")}
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setOpenNotifications((prev) => !prev)}
              className="relative inline-flex shrink-0 p-1 text-[rgba(255,255,255,0.5)] transition hover:text-[rgba(255,255,255,0.75)]"
              aria-label={tPlatform("notifications")}
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
                <p className="min-w-0 truncate text-sm font-normal">{tPlatform("notifications")}</p>
                <button type="button" onClick={markAllAsRead} className="shrink-0 text-xs text-[var(--primary)]">
                  {tPlatform("markAll")}
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
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-light text-[rgba(255,255,255,0.5)]">{profileName}</span>
                {sidebarClient ? (
                  sidebarClient.logoUrl ? (
                    <span className="mt-1 block">
                      <ClientLogo client={sidebarClient} size="xs" />
                    </span>
                  ) : (
                    <span
                      className="mt-0.5 inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-normal text-[rgba(255,255,255,0.65)]"
                      style={{ borderColor: sidebarClient.primaryColor }}
                    >
                      {sidebarClient.name}
                    </span>
                  )
                ) : null}
              </span>
            </button>
            {openProfileMenu ? (
              <div className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenSettings();
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
            onClick={onLogout}
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
    </div>
  );
}
