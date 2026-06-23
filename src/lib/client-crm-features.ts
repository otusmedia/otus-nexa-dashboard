import type { Client } from "@/types";

/** Whether the client matrix has the Resumes CRM funnel enabled. Defaults to true. */
export function clientCrmResumesEnabled(client: Client | null | undefined): boolean {
  return client?.crmIntegration.resumesEnabled !== false;
}

export function clientCrmResumesEnabledForSlug(clients: Client[], clientSlug: string | null | undefined): boolean {
  const slug = (clientSlug ?? "").trim().toLowerCase();
  if (!slug) return true;
  const client = clients.find((row) => row.slug.trim().toLowerCase() === slug);
  return clientCrmResumesEnabled(client);
}
