-- Internal team chat (1:1 DMs between client team + agency users).

create table if not exists chat_conversations (
  id uuid default gen_random_uuid() primary key,
  participant_a uuid not null references app_users(id) on delete cascade,
  participant_b uuid not null references app_users(id) on delete cascade,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  constraint chat_conversations_participants_ordered check (participant_a < participant_b),
  constraint chat_conversations_participants_unique unique (participant_a, participant_b)
);

create index if not exists chat_conversations_participant_a_idx on chat_conversations (participant_a);
create index if not exists chat_conversations_participant_b_idx on chat_conversations (participant_b);
create index if not exists chat_conversations_last_message_at_idx on chat_conversations (last_message_at desc);

create table if not exists chat_messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  sender_id uuid not null references app_users(id) on delete cascade,
  body text not null,
  created_at timestamptz default now(),
  constraint chat_messages_body_not_empty check (char_length(trim(body)) > 0),
  constraint chat_messages_body_max_len check (char_length(body) <= 2000)
);

create index if not exists chat_messages_conversation_created_idx
  on chat_messages (conversation_id, created_at);

create table if not exists chat_conversation_reads (
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists chat_conversation_reads_user_idx on chat_conversation_reads (user_id);

alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;
alter table chat_conversation_reads enable row level security;

drop policy if exists "Allow anon chat_conversations" on chat_conversations;
create policy "Allow anon chat_conversations" on chat_conversations for all to anon using (true) with check (true);

drop policy if exists "Allow anon chat_messages" on chat_messages;
create policy "Allow anon chat_messages" on chat_messages for all to anon using (true) with check (true);

drop policy if exists "Allow anon chat_conversation_reads" on chat_conversation_reads;
create policy "Allow anon chat_conversation_reads" on chat_conversation_reads for all to anon using (true) with check (true);

-- Enable realtime for chat messages (ignore if already added).
do $$
begin
  alter publication supabase_realtime add table chat_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table chat_conversations;
exception
  when duplicate_object then null;
end $$;
