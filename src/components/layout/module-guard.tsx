"use client";

import Link from "next/link";
import type { ModuleKey } from "@/types";
import { useAppContext } from "@/components/providers/app-providers";

export function ModuleGuard({
  module,
  children,
}: {
  module: ModuleKey;
  children: React.ReactNode;
}) {
  const { allowedModules } = useAppContext();
  const allowed = allowedModules.includes(module);

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
      <p className="font-medium">Access restricted</p>
      <p className="mt-1 text-sm">
        Your role cannot access this module. Switch user role in the top bar to preview other module experiences.
      </p>
      <Link href="/dashboard" className="mt-3 inline-block text-sm font-medium text-indigo-600">
        Back to dashboard
      </Link>
    </div>
  );
}
