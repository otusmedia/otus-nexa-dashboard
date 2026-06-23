"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/components/providers/app-providers";
import {
  canAccessMarketingForUser,
  resolveDefaultLandingPath,
} from "@/lib/default-landing-path";
import { readSidebarNavOrder } from "@/lib/sidebar-nav-order";

export function MarketingAccessGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { currentUser, allowedModules } = useAppContext();

  const allowed =
    (currentUser.role === "admin" && (currentUser.company === "nexa" || currentUser.company === "otus")) ||
    (currentUser.role === "manager" && currentUser.modules.includes("marketing"));

  useEffect(() => {
    if (allowed) return;
    const fallback = resolveDefaultLandingPath(allowedModules, {
      navOrder: readSidebarNavOrder(currentUser.id),
      canAccessMarketing: canAccessMarketingForUser(currentUser),
    });
    router.replace(fallback);
  }, [allowed, allowedModules, currentUser.id, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
