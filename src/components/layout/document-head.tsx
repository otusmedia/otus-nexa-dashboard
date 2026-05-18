"use client";

import { useEffect } from "react";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import {
  effectiveUserClientSlug,
  isAgencyAdmin,
  isAgencyCompany,
} from "@/lib/client-utils";
import type { AppUser, Client } from "@/types";

const SYSTEM_TITLE = "NXO System";

function resolveSelectedClientName(
  currentUser: AppUser,
  clients: Client[],
  projectsClientFilter: string,
  allClientsLabel: string,
): string {
  if (isAgencyAdmin(currentUser)) {
    if (projectsClientFilter === "all") return allClientsLabel;
    return clients.find((c) => c.slug === projectsClientFilter)?.name ?? projectsClientFilter;
  }

  const slug = effectiveUserClientSlug(currentUser);
  if (slug) {
    return clients.find((c) => c.slug === slug)?.name ?? slug;
  }

  if (!isAgencyCompany(currentUser.company)) {
    return (
      clients.find((c) => c.slug === currentUser.company)?.name ??
      String(currentUser.company || "").trim() ||
      allClientsLabel
    );
  }

  return allClientsLabel;
}

export function DocumentHead() {
  const { currentUser, clients, projectsClientFilter } = useAppContext();
  const { t: lt } = useLanguage();
  const allClientsLabel = lt("All clients");

  useEffect(() => {
    const clientName = resolveSelectedClientName(
      currentUser,
      clients,
      projectsClientFilter,
      allClientsLabel,
    );
    document.title = clientName ? `${SYSTEM_TITLE} - ${clientName}` : SYSTEM_TITLE;
  }, [currentUser, clients, projectsClientFilter, allClientsLabel]);

  return null;
}
