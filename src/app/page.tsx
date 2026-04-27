"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useAppContext } from "@/components/providers/app-providers";
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

    if (saved && saved.id === sessionUserId) {
      router.replace(saved.role === "admin" ? "/dashboard" : "/projects");
      return;
    }

    const u =
      users.find((x) => x.id === sessionUserId) ?? (persistedUser?.id === sessionUserId ? persistedUser : undefined);
    if (u) {
      router.replace(u.role === "admin" ? "/dashboard" : "/projects");
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
