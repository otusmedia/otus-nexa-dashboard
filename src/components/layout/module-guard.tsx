"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ModuleKey } from "@/types";
import { useAppContext } from "@/components/providers/app-providers";
import {
  AGENCY_HOME_PATH,
  canAccessMarketingForUser,
  resolveDefaultLandingPath,
} from "@/lib/default-landing-path";
import { isAgencyAdmin } from "@/lib/client-utils";
import { hasModuleAccess } from "@/lib/modules";
import { readSidebarNavOrder } from "@/lib/sidebar-nav-order";

type ModuleGuardProps =
  | { module: ModuleKey; children: React.ReactNode }
  | { requireAdmin: true; children: React.ReactNode };

export function ModuleGuard(props: ModuleGuardProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { allowedModules, currentUser } = useAppContext();

  const allowed =
    "requireAdmin" in props && props.requireAdmin
      ? currentUser.role === "admin"
      : "module" in props
        ? hasModuleAccess(allowedModules, props.module)
        : false;

  useEffect(() => {
    if (allowed) return;

    const landingOpts = {
      navOrder: readSidebarNavOrder(currentUser.id),
      canAccessMarketing: canAccessMarketingForUser(currentUser),
    };

    let fallback: string;
    if (isAgencyAdmin(currentUser)) {
      fallback =
        allowedModules.length > 0
          ? resolveDefaultLandingPath(allowedModules, landingOpts)
          : AGENCY_HOME_PATH;
    } else {
      fallback = resolveDefaultLandingPath(allowedModules, landingOpts);
    }

    if (pathname !== fallback && !pathname.startsWith(`${fallback}/`)) {
      router.replace(fallback);
    }
  }, [allowed, allowedModules, currentUser, pathname, router]);

  if (!allowed) {
    return null;
  }

  return <>{props.children}</>;
}
