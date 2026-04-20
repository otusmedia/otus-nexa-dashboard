"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useAppContext } from "@/components/providers/app-providers";

export function PlatformAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { sessionUserId, isReady, logout } = useAuth();
  const { users } = useAppContext();

  useEffect(() => {
    if (!isReady) return;
    if (!sessionUserId) {
      router.replace("/login");
      return;
    }
    if (!users.some((u) => u.id === sessionUserId)) {
      logout();
      router.replace("/login");
    }
  }, [isReady, sessionUserId, users, router, logout]);

  if (!isReady || !sessionUserId || !users.some((u) => u.id === sessionUserId)) {
    return null;
  }

  return <>{children}</>;
}
