"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useAppContext } from "@/components/providers/app-providers";
import {
  canAccessMarketingForUser,
  resolveDefaultLandingPath,
  resolveDefaultLandingPathForUser,
} from "@/lib/default-landing-path";
import { readSidebarNavOrder } from "@/lib/sidebar-nav-order";
import type { AppUser } from "@/types";

export default function HomePage() {
  const router = useRouter();
  const { isReady, sessionUserId, logout, persistedUser } = useAuth();
  const { users, appUsersReady } = useAppContext();

  useEffect(() => {
    if (!isReady) return;

    let saved: AppUser | null = null;
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("currentUser") : null;
      if (raw) saved = JSON.parse(raw) as AppUser;
    } catch {
      /* ignore */
    }

    if (!sessionUserId) {
      router.replace("/login");
      return;
    }

    const navOrder = readSidebarNavOrder(sessionUserId);

    if (saved && saved.id === sessionUserId) {
      router.replace(resolveDefaultLandingPathForUser(saved, navOrder));
      return;
    }

    const u =
      users.find((x) => x.id === sessionUserId) ?? (persistedUser?.id === sessionUserId ? persistedUser : undefined);
    if (u) {
      router.replace(
        resolveDefaultLandingPath(u.modules, {
          navOrder,
          canAccessMarketing: canAccessMarketingForUser(u),
        }),
      );
      return;
    }

    if (!appUsersReady) {
      return;
    }

    logout();
    router.replace("/login");
  }, [isReady, sessionUserId, users, router, logout, persistedUser, appUsersReady]);

  return null;
}
