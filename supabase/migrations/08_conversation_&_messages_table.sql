create table conversations (
  id uuid primary key default uuid_generate_v4(),
  user1 uuid references profiles(id),
  user2 uuid references profiles(id),
  last_message text,
  last_message_time timestamptz default now(),
  created_at timestamptz default now()
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references profiles(id),
  text text,
  created_at timestamptz default now(),
  read boolean default false
);