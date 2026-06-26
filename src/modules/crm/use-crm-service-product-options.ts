"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mergeCrmSourceOptions } from "@/lib/crm-data";
import {
  fetchCustomCrmServiceProducts,
  rememberCustomCrmServiceProduct,
} from "@/lib/crm-custom-service-products";

export function useCrmServiceProductOptions(clientSlug: string | null | undefined) {
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const extras = await fetchCustomCrmServiceProducts(clientSlug);
    setCustomOptions(extras);
    setLoading(false);
  }, [clientSlug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const serviceProductOptions = useMemo(
    () => mergeCrmSourceOptions([], customOptions),
    [customOptions],
  );

  const rememberServiceProduct = useCallback(
    async (serviceProduct: string) => {
      await rememberCustomCrmServiceProduct(clientSlug, serviceProduct);
      await reload();
    },
    [clientSlug, reload],
  );

  return { serviceProductOptions, rememberServiceProduct, reload, loading };
}
