-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Drills
create table drills (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  session text, -- 'Private', 'Semi', 'Group'
  format text, -- 'Beginner', 'Intermediate', 'Advanced'
  intensity text, -- 'Warm-Up', 'Active', 'Hard Work'
  duration_mins integer default 10,
  description text,
  target_player text,
  opponent_action text,
  coaching_points text,
  tags text[],
  starred boolean default false,
  diagram jsonb default '{}'::jsonb,
  category_id text,
  difficulty integer,
  estimated_duration integer,
  created_at bigint,
  updated_at bigint
);
alter table drills enable row level security;
create policy "Users can manage their own drills" on drills
  for all using (auth.uid() = user_id);

-- 2. Drill Templates
create table drill_templates (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  description text,
  starred boolean default false,
  diagram jsonb default '{}'::jsonb,
  created_at bigint,
  updated_at bigint
);
alter table drill_templates enable row level security;
create policy "Users can manage their own templates" on drill_templates
  for all using (auth.uid() = user_id);

-- 3. Sequences
create table sequences (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  description text,
  frames jsonb default '[]'::jsonb,
  tags text[],
  starred boolean default false,
  created_at bigint,
  updated_at bigint
);
alter table sequences enable row level security;
create policy "Users can manage their own sequences" on sequences
  for all using (auth.uid() = user_id);

-- 4. Session Plans
create table session_plans (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  date text,
  items jsonb default '[]'::jsonb, -- Array of PlanItem
  tags text[],
  starred boolean default false,
  created_at bigint,
  updated_at bigint
);
alter table session_plans enable row level security;
create policy "Users can manage their own plans" on session_plans
  for all using (auth.uid() = user_id);

-- 5. Clients (Parents)
create table clients (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  email text,
  phone text,
  notes text,
  status text default 'Active',
  payments jsonb default '[]'::jsonb, -- Ledger of payments
  created_at bigint,
  updated_at bigint
);
alter table clients enable row level security;
create policy "Users can manage their own clients" on clients
  for all using (auth.uid() = user_id);

-- 6. Players
create table players (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  client_id text references clients(id) on delete set null,
  name text not null,
  dob text,
  age integer,
  level text,
  stats jsonb default '{"forehand":50,"backhand":50,"serve":50,"volley":50,"movement":50,"consistency":50}'::jsonb,
  assigned_drills text[],
  notes text,
  analysis_notes text,
  kit_notes text,
  avatar_color text,
  avatar_url text,
  attendance bigint[],
  academy_pos jsonb,
  handedness text,
  play_style text,
  height text,
  reach text,
  equipment jsonb,
  pbs jsonb,
  dna jsonb,
  intel jsonb,
  schedule jsonb, -- Legacy schedule field, kept for safety
  account jsonb,
  progress_goals jsonb,
  created_at bigint,
  updated_at bigint
);
alter table players enable row level security;
create policy "Users can manage their own players" on players
  for all using (auth.uid() = user_id);

-- 7. Training Sessions
create table training_sessions (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  date text not null,
  start_time text not null,
  end_time text not null,
  location text not null,
  type text not null,
  price integer default 0,
  coach_id text,
  participant_ids text[],
  max_capacity integer default 1,
  notes text,
  created_at bigint,
  updated_at bigint
);
alter table training_sessions enable row level security;
create policy "Users can manage their own sessions" on training_sessions
  for all using (auth.uid() = user_id);

-- 8. Locations
create table locations (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  courts text[],
  color text,
  created_at bigint,
  updated_at bigint
);
alter table locations enable row level security;
create policy "Users can manage their own locations" on locations
  for all using (auth.uid() = user_id);

-- 9. Session Logs
create table session_logs (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  player_id text references players(id) on delete cascade,
  term_id text,
  date text not null,
  duration_min integer,
  tech integer default 0,
  consistency integer default 0,
  tactics integer default 0,
  movement integer default 0,
  coachability integer default 0,
  total_score integer default 0,
  anchor_best_streak integer,
  anchor_serve_in integer,
  note text,
  next_focus text,
  created_at bigint,
  updated_at bigint
);
alter table session_logs enable row level security;
create policy "Users can manage their own logs" on session_logs
  for all using (auth.uid() = user_id);

-- 10. Terms
create table terms (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  start_date text,
  end_date text,
  created_at bigint,
  updated_at bigint
);
alter table terms enable row level security;
create policy "Users can manage their own terms" on terms
  for all using (auth.uid() = user_id);
