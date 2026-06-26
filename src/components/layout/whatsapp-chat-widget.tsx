"use client";

import { useCallback, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ClientLogo } from "@/components/ui/client-logo";
import { Modal } from "@/components/ui/modal";
import {
  buildWhatsAppOutboundMessage,
  whatsAppWidgetReady,
} from "@/lib/client-whatsapp-config";
import type { AppUser, Client } from "@/types";
import { cn } from "@/lib/utils";

type WhatsAppChatWidgetProps = {
  client: Client;
  currentUser: AppUser;
  lt: (key: string) => string;
};

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function WhatsAppChatWidget({ client, currentUser, lt }: WhatsAppChatWidgetProps) {
  const config = client.whatsappConfig;
  const [open, setOpen] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [clipboardFallback, setClipboardFallback] = useState<string | null>(null);

  const ready = whatsAppWidgetReady(config);
  const displayName = useMemo(
    () => config.displayName.trim() || client.name,
    [config.displayName, client.name],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const startConversation = useCallback(async () => {
    if (!ready) return;
    const text = buildWhatsAppOutboundMessage({
      userInput,
      userName: currentUser.name,
      includeUserName: config.includeUserName,
    });
    try {
      await navigator.clipboard.writeText(text);
      showToast(lt("Message copied — paste in the WhatsApp group"));
    } catch {
      setClipboardFallback(text);
      return;
    }
    window.open(config.groupInviteUrl.trim(), "_blank", "noopener,noreferrer");
    setOpen(false);
  }, [ready, userInput, currentUser.name, config, showToast, lt]);

  if (!ready) return null;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {open ? (
          <div
            className="w-[min(320px,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl"
            role="dialog"
            aria-label={displayName}
          >
            <div className="flex items-start gap-2 border-b border-[var(--border)] bg-white px-3 py-3">
              <ClientLogo client={client} size="sm" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#111827]">{displayName}</p>
                <p className="truncate text-[11px] text-[#6B7280]">{config.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#6B7280] hover:bg-black/5"
                aria-label={lt("Close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-[#F5F0EB] px-3 py-4">
              <div className="mb-3 inline-block max-w-[90%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-[#374151] shadow-sm">
                {config.greeting}
              </div>
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={lt("Type your message…")}
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#374151]/20"
              />
            </div>

            <div className="border-t border-[var(--border)] bg-white px-3 py-3">
              <button
                type="button"
                onClick={() => void startConversation()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#374151] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1F2937]"
              >
                <WhatsAppIcon className="h-4 w-4" />
                {lt("Start conversation")}
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#374151] text-white shadow-lg transition hover:bg-[#1F2937]",
            open && "ring-2 ring-white/20",
          )}
          aria-label={lt("WhatsApp chat")}
          aria-expanded={open}
        >
          <WhatsAppIcon className="h-7 w-7" />
          <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-[#374151] bg-[#22C55E]" />
        </button>

        {toast ? (
          <div className="fixed bottom-24 right-6 z-50 max-w-xs rounded-lg bg-[#111827] px-4 py-2.5 text-sm text-white shadow-lg">
            {toast}
          </div>
        ) : null}
      </div>

      <Modal
        open={clipboardFallback != null}
        title={lt("Copy your message")}
        onClose={() => setClipboardFallback(null)}
        closeLabel={lt("Close")}
      >
        <p className="mb-2 text-sm text-[var(--muted)]">
          {lt("Could not copy automatically. Select the text below, copy it, then open the WhatsApp group.")}
        </p>
        <textarea
          readOnly
          value={clipboardFallback ?? ""}
          rows={5}
          className="w-full rounded-lg border border-[var(--border)] bg-[rgba(0,0,0,0.2)] px-3 py-2 font-mono text-sm"
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="btn-primary mt-3 w-full rounded-lg px-3 py-2 text-sm"
          onClick={() => {
            window.open(config.groupInviteUrl.trim(), "_blank", "noopener,noreferrer");
            setClipboardFallback(null);
            setOpen(false);
          }}
        >
          {lt("Open WhatsApp group")}
        </button>
      </Modal>
    </>
  );
}
