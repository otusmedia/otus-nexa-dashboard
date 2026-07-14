import { supabase } from "@/lib/supabase";

export const CHAT_MAX_BODY_LENGTH = 2000;

export type ChatConversation = {
  id: string;
  participantA: string;
  participantB: string;
  lastMessageAt: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type ChatConversationListItem = ChatConversation & {
  peerId: string;
  lastMessagePreview: string | null;
  lastMessageSenderId: string | null;
  unreadCount: number;
};

function orderedPair(userA: string, userB: string): [string, string] {
  return userA < userB ? [userA, userB] : [userB, userA];
}

function mapConversation(row: Record<string, unknown>): ChatConversation {
  return {
    id: String(row.id),
    participantA: String(row.participant_a),
    participantB: String(row.participant_b),
    lastMessageAt: String(row.last_message_at ?? row.created_at ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: String(row.sender_id),
    body: String(row.body ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export function peerIdForConversation(conv: ChatConversation, meId: string): string {
  return conv.participantA === meId ? conv.participantB : conv.participantA;
}

export async function getOrCreateConversation(
  meId: string,
  peerId: string,
): Promise<{ conversation: ChatConversation | null; error: string | null }> {
  if (!meId || !peerId || meId === peerId) {
    return { conversation: null, error: "Invalid participants" };
  }
  const [a, b] = orderedPair(meId, peerId);

  const { data: existing, error: findErr } = await supabase
    .from("chat_conversations")
    .select("*")
    .eq("participant_a", a)
    .eq("participant_b", b)
    .maybeSingle();

  if (findErr) return { conversation: null, error: findErr.message };
  if (existing) return { conversation: mapConversation(existing as Record<string, unknown>), error: null };

  const { data: created, error: insertErr } = await supabase
    .from("chat_conversations")
    .insert({ participant_a: a, participant_b: b })
    .select("*")
    .single();

  if (insertErr) {
    // Race: another client created it
    const { data: retry, error: retryErr } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("participant_a", a)
      .eq("participant_b", b)
      .maybeSingle();
    if (retryErr || !retry) return { conversation: null, error: insertErr.message };
    return { conversation: mapConversation(retry as Record<string, unknown>), error: null };
  }

  return { conversation: mapConversation(created as Record<string, unknown>), error: null };
}

export async function listConversationsForUser(
  meId: string,
): Promise<{ items: ChatConversationListItem[]; error: string | null }> {
  const { data: rows, error } = await supabase
    .from("chat_conversations")
    .select("*")
    .or(`participant_a.eq.${meId},participant_b.eq.${meId}`)
    .order("last_message_at", { ascending: false });

  if (error) return { items: [], error: error.message };
  const conversations = (rows ?? []).map((r) => mapConversation(r as Record<string, unknown>));
  if (conversations.length === 0) return { items: [], error: null };

  const ids = conversations.map((c) => c.id);

  const [{ data: reads }, { data: latestMsgs }] = await Promise.all([
    supabase.from("chat_conversation_reads").select("*").eq("user_id", meId).in("conversation_id", ids),
    supabase
      .from("chat_messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  const readByConv = new Map<string, string>();
  for (const r of reads ?? []) {
    readByConv.set(String(r.conversation_id), String(r.last_read_at));
  }

  const latestByConv = new Map<string, ChatMessage>();
  for (const m of latestMsgs ?? []) {
    const mapped = mapMessage(m as Record<string, unknown>);
    if (!latestByConv.has(mapped.conversationId)) {
      latestByConv.set(mapped.conversationId, mapped);
    }
  }

  // Unread: messages after last_read_at that are not from me
  const unreadByConv = new Map<string, number>();
  for (const m of latestMsgs ?? []) {
    const mapped = mapMessage(m as Record<string, unknown>);
    if (mapped.senderId === meId) continue;
    const lastRead = readByConv.get(mapped.conversationId);
    if (!lastRead || mapped.createdAt > lastRead) {
      unreadByConv.set(mapped.conversationId, (unreadByConv.get(mapped.conversationId) ?? 0) + 1);
    }
  }

  const items: ChatConversationListItem[] = conversations.map((c) => {
    const latest = latestByConv.get(c.id) ?? null;
    return {
      ...c,
      peerId: peerIdForConversation(c, meId),
      lastMessagePreview: latest?.body ?? null,
      lastMessageSenderId: latest?.senderId ?? null,
      unreadCount: unreadByConv.get(c.id) ?? 0,
    };
  });

  return { items, error: null };
}

export async function listMessages(
  conversationId: string,
  limit = 100,
): Promise<{ messages: ChatMessage[]; error: string | null }> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return { messages: [], error: error.message };
  return { messages: (data ?? []).map((r) => mapMessage(r as Record<string, unknown>)), error: null };
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<{ message: ChatMessage | null; error: string | null }> {
  const trimmed = body.trim();
  if (!trimmed) return { message: null, error: "Empty message" };
  if (trimmed.length > CHAT_MAX_BODY_LENGTH) {
    return { message: null, error: `Message too long (max ${CHAT_MAX_BODY_LENGTH})` };
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmed,
    })
    .select("*")
    .single();

  if (error) return { message: null, error: error.message };

  const now = new Date().toISOString();
  await supabase
    .from("chat_conversations")
    .update({ last_message_at: now })
    .eq("id", conversationId);

  return { message: mapMessage(data as Record<string, unknown>), error: null };
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("chat_conversation_reads").upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      last_read_at: now,
    },
    { onConflict: "conversation_id,user_id" },
  );
  return { error: error?.message ?? null };
}

export function totalUnread(items: ChatConversationListItem[]): number {
  return items.reduce((sum, i) => sum + i.unreadCount, 0);
}
