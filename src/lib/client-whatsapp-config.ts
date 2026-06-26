import type { ClientWhatsAppConfig } from "@/types";

export const EMPTY_CLIENT_WHATSAPP_CONFIG: ClientWhatsAppConfig = {
  enabled: false,
  groupInviteUrl: "",
  displayName: "",
  subtitle: "Normalmente responde em 10 minutos",
  greeting: "Olá, como posso te ajudar hoje?",
  includeUserName: true,
};

export function parseClientWhatsAppConfig(raw: unknown): ClientWhatsAppConfig {
  if (!raw || typeof raw !== "object") return { ...EMPTY_CLIENT_WHATSAPP_CONFIG };
  const o = raw as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    groupInviteUrl: o.groupInviteUrl != null ? String(o.groupInviteUrl).trim() : "",
    displayName: o.displayName != null ? String(o.displayName).trim() : "",
    subtitle:
      o.subtitle != null && String(o.subtitle).trim()
        ? String(o.subtitle).trim()
        : EMPTY_CLIENT_WHATSAPP_CONFIG.subtitle,
    greeting:
      o.greeting != null && String(o.greeting).trim()
        ? String(o.greeting).trim()
        : EMPTY_CLIENT_WHATSAPP_CONFIG.greeting,
    includeUserName: o.includeUserName !== false,
  };
}

export function clientWhatsAppConfigToDb(config: ClientWhatsAppConfig): Record<string, unknown> {
  return {
    enabled: config.enabled,
    groupInviteUrl: config.groupInviteUrl.trim(),
    displayName: config.displayName.trim(),
    subtitle: config.subtitle.trim(),
    greeting: config.greeting.trim(),
    includeUserName: config.includeUserName,
  };
}

export function isValidWhatsAppGroupUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    return host.includes("chat.whatsapp.com") || host.includes("wa.me") || host.includes("whatsapp.com");
  } catch {
    return false;
  }
}

export function whatsAppWidgetReady(config: ClientWhatsAppConfig): boolean {
  return config.enabled && isValidWhatsAppGroupUrl(config.groupInviteUrl);
}

export function buildWhatsAppOutboundMessage(opts: {
  userInput: string;
  userName: string;
  includeUserName: boolean;
}): string {
  const body = opts.userInput.trim();
  if (!opts.includeUserName) return body;
  const name = opts.userName.trim();
  if (!name) return body;
  if (!body) return `Olá, sou ${name}.`;
  return `Olá, sou ${name}.\n\n${body}`;
}
