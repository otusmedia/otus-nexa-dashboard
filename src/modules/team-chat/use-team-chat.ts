"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "@/components/providers/app-providers";
import { supabase } from "@/lib/supabase";
import {
  getOrCreateConversation,
  listConversationsForUser,
  listMessages,
  markConversationRead,
  sendMessage,
  totalUnread,
  type ChatConversationListItem,
  type ChatMessage,
} from "@/lib/team-chat";
import { resolveTeamChatPeers, type TeamChatPeer } from "@/lib/team-chat-peers";

export type TeamChatView = "list" | "compose" | "thread";

export function useTeamChat() {
  const {
    currentUser,
    users,
    dataClientSlug,
    pushNotification,
  } = useAppContext();

  const meId = currentUser.id;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<TeamChatView>("list");
  const [conversations, setConversations] = useState<ChatConversationListItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [peerQuery, setPeerQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openRef = useRef(open);
  const activeConvRef = useRef(activeConversationId);
  openRef.current = open;
  activeConvRef.current = activeConversationId;

  const peers = useMemo(
    () => resolveTeamChatPeers(users, dataClientSlug, currentUser),
    [users, dataClientSlug, currentUser],
  );

  const peerById = useMemo(() => new Map(peers.map((p) => [p.id, p])), [peers]);

  const activePeer: TeamChatPeer | null = activePeerId
    ? peerById.get(activePeerId) ??
      (() => {
        const u = users.find((x) => x.id === activePeerId);
        return u
          ? {
              id: u.id,
              name: u.name,
              email: u.email ?? null,
              avatarUrl: u.avatarUrl,
              company: String(u.company ?? ""),
            }
          : null;
      })()
    : null;

  const filteredPeers = useMemo(() => {
    const q = peerQuery.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.company ?? "").toLowerCase().includes(q),
    );
  }, [peers, peerQuery]);

  const unreadTotal = useMemo(() => totalUnread(conversations), [conversations]);

  const reloadConversations = useCallback(async () => {
    if (!meId || meId.startsWith("__")) return;
    setLoadingList(true);
    const { items, error: err } = await listConversationsForUser(meId);
    if (err) setError(err);
    setConversations(items);
    setLoadingList(false);
  }, [meId]);

  const openThread = useCallback(
    async (conversationId: string, peerId: string) => {
      setActiveConversationId(conversationId);
      setActivePeerId(peerId);
      setView("thread");
      setDraft("");
      setLoadingThread(true);
      const { messages: msgs, error: err } = await listMessages(conversationId);
      if (err) setError(err);
      setMessages(msgs);
      setLoadingThread(false);
      await markConversationRead(conversationId, meId);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
      );
    },
    [meId],
  );

  const startChatWithPeer = useCallback(
    async (peerId: string) => {
      if (!peers.some((p) => p.id === peerId)) {
        setError("User not available for chat");
        return;
      }
      setError(null);
      const { conversation, error: err } = await getOrCreateConversation(meId, peerId);
      if (err || !conversation) {
        setError(err ?? "Could not open conversation");
        return;
      }
      await reloadConversations();
      await openThread(conversation.id, peerId);
    },
    [peers, meId, reloadConversations, openThread],
  );

  const send = useCallback(async () => {
    if (!activeConversationId || sending) return;
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const { message, error: err } = await sendMessage(activeConversationId, meId, body);
    setSending(false);
    if (err || !message) {
      setError(err ?? "Failed to send");
      return;
    }
    setDraft("");
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              lastMessageAt: message.createdAt,
              lastMessagePreview: message.body,
              lastMessageSenderId: message.senderId,
            }
          : c,
      );
      return next.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    });
    await markConversationRead(activeConversationId, meId);
  }, [activeConversationId, draft, meId, sending]);

  const goToList = useCallback(() => {
    setView("list");
    setActiveConversationId(null);
    setActivePeerId(null);
    setMessages([]);
    setDraft("");
    void reloadConversations();
  }, [reloadConversations]);

  const goToCompose = useCallback(() => {
    setView("compose");
    setPeerQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;
    void reloadConversations();
  }, [open, reloadConversations]);

  // Realtime: new messages
  useEffect(() => {
    if (!meId || meId.startsWith("__")) return;

    const channel = supabase
      .channel(`team-chat-messages-${meId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const msg: ChatMessage = {
            id: String(row.id),
            conversationId: String(row.conversation_id),
            senderId: String(row.sender_id),
            body: String(row.body ?? ""),
            createdAt: String(row.created_at ?? ""),
          };

          if (msg.senderId === meId) {
            if (activeConvRef.current === msg.conversationId) {
              setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
            }
            return;
          }

          // Only care about conversations I'm in — reload list; update thread if open
          void (async () => {
            const { items } = await listConversationsForUser(meId);
            const mine = items.find((c) => c.id === msg.conversationId);
            if (!mine) return;

            setConversations(items);

            if (activeConvRef.current === msg.conversationId) {
              setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
              await markConversationRead(msg.conversationId, meId);
              setConversations((prev) =>
                prev.map((c) => (c.id === msg.conversationId ? { ...c, unreadCount: 0 } : c)),
              );
            } else if (!openRef.current || activeConvRef.current !== msg.conversationId) {
              const peer = peerById.get(mine.peerId) ?? users.find((u) => u.id === mine.peerId);
              const name = peer && "name" in peer ? peer.name : "Someone";
              pushNotification(`${name}: ${msg.body.slice(0, 80)}`, "comment", `chat-${msg.id}`);
            }
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [meId, peerById, users, pushNotification]);

  // Poll conversations lightly when closed to keep badge fresh
  useEffect(() => {
    if (!meId || meId.startsWith("__")) return;
    void reloadConversations();
    const id = window.setInterval(() => {
      if (!openRef.current) void reloadConversations();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [meId, reloadConversations]);

  return {
    open,
    setOpen,
    view,
    conversations,
    messages,
    activeConversationId,
    activePeer,
    peers: filteredPeers,
    peerQuery,
    setPeerQuery,
    draft,
    setDraft,
    loadingList,
    loadingThread,
    sending,
    error,
    unreadTotal,
    startChatWithPeer,
    openThread,
    send,
    goToList,
    goToCompose,
    reloadConversations,
  };
}
