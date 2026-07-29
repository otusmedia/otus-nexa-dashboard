"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mergeCrmSourceOptions } from "@/lib/crm-data";
import {
  fetchCustomCrmServiceProducts,
  rememberCustomCrmServiceProduct,
  removeCustomCrmServiceProduct,
  type CrmOfferingKind,
} from "@/lib/crm-custom-service-products";

export function useCrmServiceProductOptions(
  clientSlug: string | null | undefined,
  kind: CrmOfferingKind | null,
) {
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const activeKind: CrmOfferingKind = kind ?? "product";

  const reload = useCallback(async () => {
    if (!kind) {
      setCustomOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const extras = await fetchCustomCrmServiceProducts(clientSlug, kind);
    setCustomOptions(extras);
    setLoading(false);
  }, [clientSlug, kind]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const serviceProductOptions = useMemo(
    () => mergeCrmSourceOptions([], customOptions),
    [customOptions],
  );

  const rememberServiceProduct = useCallback(
    async (serviceProduct: string) => {
      if (!kind) return;
      await rememberCustomCrmServiceProduct(clientSlug, serviceProduct, kind);
      await reload();
    },
    [clientSlug, kind, reload],
  );

  const removeServiceProduct = useCallback(
    async (serviceProduct: string) => {
      if (!kind) return;
      await removeCustomCrmServiceProduct(clientSlug, serviceProduct, kind);
      await reload();
    },
    [clientSlug, kind, reload],
  );

  return {
    serviceProductOptions,
    rememberServiceProduct,
    removeServiceProduct,
    reload,
    loading,
    activeKind,
  };
}
