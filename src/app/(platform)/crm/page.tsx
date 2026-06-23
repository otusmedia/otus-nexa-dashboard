"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { resolveDefaultCrmPath } from "@/lib/default-landing-path";

export default function CrmIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(resolveDefaultCrmPath());
  }, [router]);

  return null;
}
