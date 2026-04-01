create table items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  is_top_twelve boolean default false,
  position integer not null,
  created_at timestamptz default now()
);

create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null,
  completed_item_ids jsonb default '[]'::jsonb not null,
  all_completed boolean default false,
  created_at timestamptz default now(),
  unique(user_id, log_date)
);

create table streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_day integer default 0,
  streak_start_date date default current_date,
  last_perfect_date date,
  updated_at timestamptz default now()
);

alter table items enable row level security;
alter table daily_logs enable row level security;
alter table streaks enable row level security;

create policy "Users manage own items" on items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own daily_logs" on daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own streaks" on streaks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
