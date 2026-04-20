import { Suspense } from "react";
import { ModuleGuard } from "@/components/layout/module-guard";
import { ProjectDetailPageClient } from "./project-detail-client";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <ModuleGuard module="projects">
      <Suspense fallback={null}>
        <ProjectDetailPageClient projectId={id} />
      </Suspense>
    </ModuleGuard>
  );
}
