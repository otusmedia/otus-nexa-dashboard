"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import {
  effectiveUserClientSlug,
  isAgencyAdmin,
  isAgencyCompany,
} from "@/lib/client-utils";
import { isAgencyHomePath } from "@/lib/default-landing-path";
import type { AppUser, Client } from "@/types";

const SYSTEM_TITLE = "NXO System";

function resolveSelectedClientName(
  currentUser: AppUser,
  clients: Client[],
  projectsClientFilter: string,
  allClientsLabel: string,
  homeLabel: string,
  pathname: string,
): string {
  if (isAgencyHomePath(pathname)) return homeLabel;

  if (isAgencyAdmin(currentUser)) {
    if (projectsClientFilter === "all") return allClientsLabel;
    return clients.find((c) => c.slug === projectsClientFilter)?.name ?? projectsClientFilter;
  }

  const slug = effectiveUserClientSlug(currentUser);
  if (slug) {
    return clients.find((c) => c.slug === slug)?.name ?? slug;
  }

  if (!isAgencyCompany(currentUser.company)) {
    const fromClient = clients.find((c) => c.slug === currentUser.company)?.name;
    const fromCompany = String(currentUser.company || "").trim();
    return fromClient ?? (fromCompany || allClientsLabel);
  }

  return allClientsLabel;
}

export function DocumentHead() {
  const pathname = usePathname() ?? "";
  const { currentUser, clients, projectsClientFilter } = useAppContext();
  const { t: lt } = useLanguage();
  const allClientsLabel = lt("All clients");
  const homeLabel = lt("Home");

  useEffect(() => {
    const clientName = resolveSelectedClientName(
      currentUser,
      clients,
      projectsClientFilter,
      allClientsLabel,
      homeLabel,
      pathname,
    );
    document.title = clientName ? `${SYSTEM_TITLE} - ${clientName}` : SYSTEM_TITLE;
  }, [currentUser, clients, projectsClientFilter, allClientsLabel, homeLabel, pathname]);

  return null;
}
