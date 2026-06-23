"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/components/providers/app-providers";
import { isAgencyAdmin } from "@/lib/client-utils";
import { resolveDefaultLandingPathForUser } from "@/lib/default-landing-path";
import { readSidebarNavOrder } from "@/lib/sidebar-nav-order";

export function AgencyHomeGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { currentUser, allowedModules } = useAppContext();
  const allowed = isAgencyAdmin(currentUser);

  useEffect(() => {
    if (allowed) return;
    const fallback = resolveDefaultLandingPathForUser(currentUser, readSidebarNavOrder(currentUser.id));
    router.replace(fallback || "/projects");
  }, [allowed, allowedModules, currentUser, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
