-- Create session_observations table for normalized live coaching history
create table if not exists session_observations (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  player_id text references players(id) on delete cascade,
  recorded_at bigint not null,
  session_id text references training_sessions(id) on delete set null,
  drill_id text references drills(id) on delete set null,
  drill_outcome text,
  ratings jsonb not null default '{}'::jsonb,
  focus_skill text,
  focus_skill_rating integer,
  note text,
  created_at bigint,
  updated_at bigint
);

create index if not exists idx_session_observations_player_id on session_observations(player_id);
create index if not exists idx_session_observations_recorded_at on session_observations(recorded_at desc);

alter table session_observations enable row level security;

drop policy if exists "Users can manage their own session observations" on session_observations;
create policy "Users can manage their own session observations" on session_observations
  for all using (auth.uid() = user_id);
