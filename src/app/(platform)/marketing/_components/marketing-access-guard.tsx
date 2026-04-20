"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/components/providers/app-providers";

export function MarketingAccessGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { currentUser } = useAppContext();

  const allowed =
    (currentUser.role === "admin" && (currentUser.company === "nexa" || currentUser.company === "otus")) ||
    (currentUser.role === "manager" && currentUser.modules.includes("marketing"));

  useEffect(() => {
    if (!allowed) router.replace("/projects");
  }, [allowed, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
