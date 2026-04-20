"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useAppContext } from "@/components/providers/app-providers";

export default function HomePage() {
  const router = useRouter();
  const { isReady, sessionUserId, logout } = useAuth();
  const { users } = useAppContext();

  useEffect(() => {
    if (!isReady) return;
    if (!sessionUserId) {
      router.replace("/login");
      return;
    }
    const u = users.find((x) => x.id === sessionUserId);
    if (!u) {
      logout();
      router.replace("/login");
      return;
    }
    router.replace(u.role === "admin" ? "/dashboard" : "/projects");
  }, [isReady, sessionUserId, users, router, logout]);

  return null;
}
