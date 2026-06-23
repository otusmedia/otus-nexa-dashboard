"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getCrmSourceOptions, mergeCrmSourceOptions } from "@/lib/crm-data";
import { fetchCustomCrmSources, rememberCustomCrmSource } from "@/lib/crm-custom-sources";

export function useCrmSourceOptions(clientSlug: string | null | undefined) {
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const extras = await fetchCustomCrmSources(clientSlug);
    setCustomSources(extras);
    setLoading(false);
  }, [clientSlug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sourceOptions = useMemo(
    () => mergeCrmSourceOptions(getCrmSourceOptions(clientSlug), customSources),
    [clientSlug, customSources],
  );

  const rememberSource = useCallback(
    async (source: string) => {
      await rememberCustomCrmSource(clientSlug, source);
      await reload();
    },
    [clientSlug, reload],
  );

  return { sourceOptions, rememberSource, reload, loading };
}
