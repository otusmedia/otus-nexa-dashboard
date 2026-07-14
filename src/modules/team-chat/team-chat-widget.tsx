"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ArrowLeft,
  MessageCircle,
  Plus,
  Search,
  Send,
  X,
} from "lucide-react";
import { useAppContext } from "@/components/providers/app-providers";
import { isAgencyCompany } from "@/lib/client-utils";
import { cn } from "@/lib/utils";
import { useTeamChat } from "@/modules/team-chat/use-team-chat";
import type { UserCompany } from "@/types";

type Props = {
  lt: (key: string) => string;
  /** Lift FAB when WhatsApp widget is also visible */
  offsetForWhatsApp?: boolean;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function Avatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-8 w-8 text-[0.65rem]" : "h-9 w-9 text-xs";
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className={cn("shrink-0 rounded-full object-cover", dim)} />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[rgba(255,69,0,0.25)] font-medium text-[#FF4500]",
        dim,
      )}
    >
      {initials(name)}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function peerSubtitle(company: string | undefined, lt: (k: string) => string): string {
  if (!company) return "";
  if (isAgencyCompany(company as UserCompany)) return lt("Agency");
  return company;
}

export function TeamChatWidget({ lt, offsetForWhatsApp = false }: Props) {
  const { users, currentUser } = useAppContext();
  const chat = useTeamChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  useEffect(() => {
    if (chat.view === "thread") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [chat.messages.length, chat.view, chat.activeConversationId]);

  const bottomClass = offsetForWhatsApp ? "bottom-24" : "bottom-6";

  return (
    <div className={cn("fixed right-6 z-40 flex flex-col items-end gap-3", bottomClass)}>
      {chat.open ? (
        <div
          className="flex h-[min(520px,calc(100vh-8rem))] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#161616] shadow-2xl"
          role="dialog"
          aria-label={lt("Team chat")}
        >
          <header className="flex items-center gap-2 border-b border-white/[0.08] px-3 py-2.5">
            {chat.view !== "list" ? (
              <button
                type="button"
                onClick={chat.goToList}
                className="rounded-lg p-1.5 text-[rgba(255,255,255,0.5)] hover:bg-white/[0.06] hover:text-white"
                aria-label={lt("Back to chats")}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {chat.view === "thread" && chat.activePeer
                  ? chat.activePeer.name
                  : chat.view === "compose"
                    ? lt("New message")
                    : lt("Team chat")}
              </p>
              {chat.view === "thread" && chat.activePeer ? (
                <p className="truncate text-[11px] text-[rgba(255,255,255,0.4)]">
                  {peerSubtitle(chat.activePeer.company, lt)}
                </p>
              ) : null}
            </div>
            {chat.view === "list" ? (
              <button
                type="button"
                onClick={chat.goToCompose}
                className="rounded-lg p-1.5 text-[rgba(255,255,255,0.5)] hover:bg-white/[0.06] hover:text-white"
                aria-label={lt("New message")}
              >
                <Plus className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => chat.setOpen(false)}
              className="rounded-lg p-1.5 text-[rgba(255,255,255,0.5)] hover:bg-white/[0.06] hover:text-white"
              aria-label={lt("Close team chat")}
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {chat.error ? (
            <p className="border-b border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-300">
              {chat.error}
            </p>
          ) : null}

          {chat.view === "list" ? (
            <div className="flex-1 overflow-y-auto">
              {chat.loadingList && chat.conversations.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-[rgba(255,255,255,0.4)]">…</p>
              ) : chat.conversations.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <MessageCircle className="mb-3 h-8 w-8 text-[rgba(255,255,255,0.25)]" />
                  <p className="text-sm text-[rgba(255,255,255,0.55)]">{lt("No conversations yet")}</p>
                  <p className="mt-1 text-xs text-[rgba(255,255,255,0.35)]">
                    {lt("Start a chat with your team or agency")}
                  </p>
                  <button
                    type="button"
                    onClick={chat.goToCompose}
                    className="btn-primary mt-4 rounded-lg px-3 py-1.5 text-xs"
                  >
                    {lt("New message")}
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {chat.conversations.map((c) => {
                    const peerUser = usersById.get(c.peerId);
                    const name = peerUser?.name?.trim() || "—";
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => void chat.openThread(c.id, c.peerId)}
                          className="flex w-full gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04]"
                        >
                          <Avatar name={name} avatarUrl={peerUser?.avatarUrl} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="truncate text-sm text-white">{name}</p>
                              <span className="shrink-0 text-[10px] text-[rgba(255,255,255,0.35)]">
                                {formatTime(c.lastMessageAt)}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2">
                              <p className="truncate text-xs text-[rgba(255,255,255,0.4)]">
                                {c.lastMessageSenderId === currentUser.id
                                  ? `${lt("You")}: ${c.lastMessagePreview ?? ""}`
                                  : (c.lastMessagePreview ?? "—")}
                              </p>
                              {c.unreadCount > 0 ? (
                                <span className="ml-auto shrink-0 rounded-full bg-[#FF4500] px-1.5 py-0.5 text-[10px] text-white">
                                  {c.unreadCount}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {chat.view === "compose" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-white/[0.08] px-3 py-2">
                <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5">
                  <Search className="h-3.5 w-3.5 shrink-0 text-[rgba(255,255,255,0.35)]" />
                  <input
                    value={chat.peerQuery}
                    onChange={(e) => chat.setPeerQuery(e.target.value)}
                    placeholder={lt("Search people")}
                    className="w-full bg-transparent text-xs text-white outline-none placeholder:text-[rgba(255,255,255,0.3)]"
                  />
                </div>
              </div>
              <ul className="flex-1 overflow-y-auto">
                {chat.peers.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-[rgba(255,255,255,0.4)]">
                    {lt("No people found")}
                  </p>
                ) : (
                  chat.peers.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => void chat.startChatWithPeer(p.id)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04]"
                      >
                        <Avatar name={p.name} avatarUrl={p.avatarUrl} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-white">{p.name}</p>
                          <p className="truncate text-[11px] text-[rgba(255,255,255,0.4)]">
                            {peerSubtitle(p.company, lt) || p.email}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}

          {chat.view === "thread" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {chat.loadingThread && chat.messages.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[rgba(255,255,255,0.4)]">…</p>
                ) : (
                  chat.messages.map((m) => {
                    const isMine = m.senderId === currentUser.id;
                    return (
                      <div
                        key={m.id}
                        className={cn("flex", isMine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                            isMine
                              ? "rounded-br-md bg-[#FF4500] text-white"
                              : "rounded-bl-md bg-white/[0.08] text-white",
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p
                            className={cn(
                              "mt-1 text-[10px]",
                              isMine ? "text-white/70" : "text-[rgba(255,255,255,0.35)]",
                            )}
                          >
                            {formatTime(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
              <form
                className="flex items-end gap-2 border-t border-white/[0.08] p-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void chat.send();
                }}
              >
                <textarea
                  ref={inputRef}
                  value={chat.draft}
                  onChange={(e) => chat.setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void chat.send();
                    }
                  }}
                  rows={1}
                  placeholder={lt("Type a message…")}
                  className="max-h-24 min-h-[36px] flex-1 resize-none rounded-xl border border-white/[0.1] bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-[rgba(255,255,255,0.3)] focus:border-[#FF4500]/40"
                />
                <button
                  type="submit"
                  disabled={chat.sending || !chat.draft.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF4500] text-white disabled:opacity-40"
                  aria-label={lt("Send")}
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => chat.setOpen((v) => !v)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#FF4500] text-white shadow-lg transition hover:brightness-110"
        aria-label={chat.open ? lt("Close team chat") : lt("Open team chat")}
      >
        {chat.open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!chat.open && chat.unreadTotal > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-[#FF4500]">
            {chat.unreadTotal > 99 ? "99+" : chat.unreadTotal}
          </span>
        ) : null}
      </button>
    </div>
  );
}
