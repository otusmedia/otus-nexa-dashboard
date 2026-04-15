"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  FileUp,
  Flag,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { ModuleKey } from "@/types";
import { useAppContext } from "@/components/providers/app-providers";
import { cn } from "@/lib/utils";

const moduleLinks: Array<{
  key: ModuleKey;
  labelKey: "dashboard" | "tasks" | "goals" | "roadmap" | "events" | "ideas" | "files" | "contracts" | "invoices" | "marketing" | "users";
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "dashboard", labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "tasks", labelKey: "tasks", href: "/tasks", icon: ClipboardList },
  { key: "goals", labelKey: "goals", href: "/goals", icon: Flag },
  { key: "roadmap", labelKey: "roadmap", href: "/roadmap", icon: Gauge },
  { key: "events", labelKey: "events", href: "/events", icon: CalendarDays },
  { key: "ideas", labelKey: "ideas", href: "/ideas", icon: Lightbulb },
  { key: "files", labelKey: "files", href: "/files", icon: FileUp },
  { key: "contracts", labelKey: "contracts", href: "/contracts", icon: FileText },
  { key: "invoices", labelKey: "invoices", href: "/invoices", icon: Wallet },
  { key: "marketing", labelKey: "marketing", href: "/marketing", icon: Megaphone },
  { key: "users", labelKey: "users", href: "/users", icon: ShieldCheck },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    currentUser,
    availableUsers,
    setCurrentUserById,
    language,
    setLanguage,
    unreadCount,
    markAllAsRead,
    query,
    setQuery,
    notifications,
    markNotificationRead,
    allowedModules,
    t,
    td,
  } = useAppContext();
  const [openNotifications, setOpenNotifications] = useState(false);

  const links = moduleLinks.filter((link) => allowedModules.includes(link.key));

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-800">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 border-r border-slate-200 bg-white p-4 lg:block">
          <div className="mb-8 rounded-xl bg-indigo-600 p-4 text-white shadow-sm">
            <p className="text-xs uppercase tracking-wide text-indigo-100">Client Ops Hub</p>
            <p className="mt-1 text-lg font-semibold">Otus x Nexa</p>
          </div>
          <nav className="space-y-1">
            {links.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.key}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                    isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex-1">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-72 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  placeholder={t("searchPlaceholder")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="relative flex items-center gap-2">
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as "en" | "pt-BR")}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="en">EN</option>
                  <option value="pt-BR">PT-BR</option>
                </select>
                <select
                  value={currentUser.id}
                  onChange={(event) => setCurrentUserById(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setOpenNotifications((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 ? `${unreadCount} ${t("newAlerts")}` : t("noAlerts")}
                </button>
                {openNotifications ? (
                  <div className="absolute right-0 top-12 z-20 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold">{t("notifications")}</p>
                      <button onClick={markAllAsRead} className="text-xs text-indigo-600">
                        {t("markAll")}
                      </button>
                    </div>
                    <div className="max-h-72 space-y-2 overflow-auto">
                      {notifications.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => markNotificationRead(item.id)}
                          className={cn(
                            "block w-full rounded-lg border px-3 py-2 text-left text-xs",
                            item.read ? "border-slate-100 bg-slate-50 text-slate-500" : "border-indigo-100 bg-indigo-50 text-slate-700",
                          )}
                        >
                          {td(item.message)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
          <main className="px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
