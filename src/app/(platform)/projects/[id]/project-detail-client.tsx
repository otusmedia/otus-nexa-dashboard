"use client";

import { notFound } from "next/navigation";
import { useMemo } from "react";
import { useAppContext } from "@/components/providers/app-providers";
import { mergeProjectsByColumn } from "../data";
import { ProjectDetailView } from "../_components/project-detail-view";

export function ProjectDetailPageClient({ projectId }: { projectId: string }) {
  const { projectsByColumn } = useAppContext();
  const project = useMemo(
    () => mergeProjectsByColumn(projectsByColumn).find((p) => p.id === projectId),
    [projectsByColumn, projectId],
  );

  if (!project) {
    notFound();
  }

  return <ProjectDetailView project={project} />;
}
