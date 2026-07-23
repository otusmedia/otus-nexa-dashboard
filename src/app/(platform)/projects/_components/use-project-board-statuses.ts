"use client";

import { useCallback, useEffect, useState } from "react";
import {
  canManageProjectBoardStatuses,
  defaultProjectBoardStatuses,
  fetchProjectBoardStatuses,
  saveProjectBoardStatuses,
  type ProjectBoardStatusDef,
  type SaveProjectBoardStatusesInput,
} from "@/lib/project-board-statuses";
import type { AppUser } from "@/types";

export function useProjectBoardStatuses(
  boardClientSlug: string | null | undefined,
  currentUser: AppUser,
) {
  const [statuses, setStatuses] = useState<ProjectBoardStatusDef[]>(() => defaultProjectBoardStatuses());
  const [loading, setLoading] = useState(false);

  const slug = (boardClientSlug ?? "").trim().toLowerCase();
  const canManage = canManageProjectBoardStatuses(currentUser, slug || null);

  const reload = useCallback(async () => {
    if (!slug || slug === "all") {
      setStatuses(defaultProjectBoardStatuses());
      return;
    }
    setLoading(true);
    const next = await fetchProjectBoardStatuses(slug);
    setStatuses(next);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (input: SaveProjectBoardStatusesInput): Promise<ProjectBoardStatusDef[] | null> => {
      if (!slug || slug === "all") return null;
      const saved = await saveProjectBoardStatuses(slug, input);
      if (saved) setStatuses(saved);
      return saved;
    },
    [slug],
  );

  return { statuses, loading, canManage, reload, save, boardClientSlug: slug || null };
}
