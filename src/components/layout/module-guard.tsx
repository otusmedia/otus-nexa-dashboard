"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ModuleKey } from "@/types";
import { useAppContext } from "@/components/providers/app-providers";

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
        ? allowedModules.includes(props.module)
        : false;

  useEffect(() => {
    if (allowed) return;
    if (pathname === "/projects" || pathname.startsWith("/projects/")) {
      return;
    }
    router.replace("/projects");
  }, [allowed, router, pathname]);

  if (!allowed) {
    return null;
  }

  return <>{props.children}</>;
}
