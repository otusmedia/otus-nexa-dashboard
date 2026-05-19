"use client";

import { ModuleGuard } from "@/components/layout/module-guard";
import { PublishingModule } from "@/modules/publishing/publishing-module";

export default function ComposePage() {
  return (
    <ModuleGuard module="content-management">
      <PublishingModule />
    </ModuleGuard>
  );
}
