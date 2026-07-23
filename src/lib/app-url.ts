/** Canonical public origin for shareable links (portfolio LP, CRM snippets). Never localhost. */
export const DEFAULT_APP_ORIGIN = "https://otus-nexa-dashboard.vercel.app";

export function getPublicAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ?? "";
  if (fromEnv && !/localhost|127\.0\.0\.1/i.test(fromEnv)) {
    return fromEnv;
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname, origin } = window.location;
    if (hostname && !/localhost|127\.0\.0\.1/i.test(hostname) && protocol.startsWith("http")) {
      return origin;
    }
  }
  return DEFAULT_APP_ORIGIN;
}
