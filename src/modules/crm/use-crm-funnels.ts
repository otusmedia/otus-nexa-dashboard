"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppContext } from "@/components/providers/app-providers";
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
  const { dataClientSlug, currentUser } = useAppContext();
  const [funnels, setFunnels] = useState<CrmFunnelDef[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await fetchCrmFunnelsForClient(dataClientSlug, currentUser);
    setFunnels(rows);
    setLoading(false);
  }, [dataClientSlug, currentUser]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const handler = () => void reload();
    window.addEventListener(CRM_FUNNELS_RELOAD_EVENT, handler);
    return () => window.removeEventListener(CRM_FUNNELS_RELOAD_EVENT, handler);
  }, [reload]);

  const canManageFunnels = canManageCrmFunnels(currentUser, dataClientSlug);

  return { funnels, loading, reload, canManageFunnels };
}

export { createCrmFunnel, deleteCrmFunnel, updateCrmFunnelDef };
