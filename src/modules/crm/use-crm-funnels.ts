"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppContext } from "@/components/providers/app-providers";
import { clientCrmResumesEnabledForSlug } from "@/lib/client-crm-features";
import { canManageCrmFunnels } from "@/lib/crm-lead-visibility";
import {
  createCrmFunnel,
  deleteCrmFunnel,
  fetchCrmFunnelsForClient,
  updateCrmFunnelDef,
  type CrmFunnelDef,
} from "@/lib/crm-funnels";

const CRM_FUNNELS_RELOAD_EVENT = "crm-funnels-reload";

export function notifyCrmFunnelsReload() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CRM_FUNNELS_RELOAD_EVENT));
  }
}

export function useCrmFunnels() {
  const { dataClientSlug, currentUser, clients } = useAppContext();
  const [funnels, setFunnels] = useState<CrmFunnelDef[]>([]);
  const [loading, setLoading] = useState(true);
  const resumesEnabled = clientCrmResumesEnabledForSlug(clients, dataClientSlug);

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await fetchCrmFunnelsForClient(dataClientSlug, currentUser, { resumesEnabled });
    setFunnels(rows);
    setLoading(false);
  }, [dataClientSlug, currentUser, resumesEnabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const handler = () => void reload();
    window.addEventListener(CRM_FUNNELS_RELOAD_EVENT, handler);
    return () => window.removeEventListener(CRM_FUNNELS_RELOAD_EVENT, handler);
  }, [reload]);

  const canManageFunnels = canManageCrmFunnels(currentUser, dataClientSlug);

  return { funnels, loading, reload, canManageFunnels, resumesEnabled };
}

export { createCrmFunnel, deleteCrmFunnel, updateCrmFunnelDef };
