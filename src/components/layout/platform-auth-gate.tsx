"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useAppContext } from "@/components/providers/app-providers";

export function PlatformAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { sessionUserId, isReady, logout, persistedUser } = useAuth();
  const { users } = useAppContext();

  const inUsersList = Boolean(sessionUserId && users.some((u) => u.id === sessionUserId));
  const persistedOk = Boolean(sessionUserId && persistedUser?.id === sessionUserId);
  const allowed = persistedOk || inUsersList;

  useEffect(() => {
    if (!isReady) return;
    if (!sessionUserId) {
      router.replace("/login");
      return;
    }
    if (users.length > 0 && !inUsersList && !persistedOk) {
      logout();
      router.replace("/login");
    }
  }, [isReady, sessionUserId, users, router, logout, inUsersList, persistedOk]);

  if (!isReady || !sessionUserId) {
    return null;
  }

  if (allowed) {
    return <>{children}</>;
  }

  if (users.length === 0) {
    return null;
  }

  return null;
}
