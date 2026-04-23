"use client";

import { ModuleGuard } from "@/components/layout/module-guard";
import { PublishingModule } from "@/modules/publishing/publishing-module";

export default function PublishingPage() {
  return (
    <ModuleGuard module="publishing">
      <PublishingModule />
    </ModuleGuard>
  );
}
