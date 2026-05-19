"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Legacy /publishing URLs → Content Management → Compose */
export default function PublishingRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = new URLSearchParams();
    const tab = searchParams.get("tab");
    const edit = searchParams.get("edit");
    const post = searchParams.get("post");
    if (tab) q.set("tab", tab);
    if (edit) q.set("edit", edit);
    if (post) q.set("post", post);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    router.replace(`/content-management/compose${suffix}`);
  }, [router, searchParams]);

  return null;
}
