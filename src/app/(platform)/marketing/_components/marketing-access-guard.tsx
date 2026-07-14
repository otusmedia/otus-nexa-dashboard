"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/components/providers/app-providers";
import {
  canAccessMarketingForUser,
  resolveDefaultLandingPath,
} from "@/lib/default-landing-path";
import { hasModuleAccess } from "@/lib/modules";
import { readSidebarNavOrder } from "@/lib/sidebar-nav-order";

export function MarketingAccessGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { currentUser, allowedModules } = useAppContext();

  const allowed = canAccessMarketingForUser(currentUser) && hasModuleAccess(allowedModules, "marketing");

  useEffect(() => {
    if (allowed) return;
    const fallback = resolveDefaultLandingPath(allowedModules, {
      navOrder: readSidebarNavOrder(currentUser.id),
      canAccessMarketing: canAccessMarketingForUser(currentUser),
    });
    router.replace(fallback);
  }, [allowed, allowedModules, currentUser, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
