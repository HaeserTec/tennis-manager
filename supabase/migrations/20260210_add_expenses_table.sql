-- Create expenses table if missing (used by Academy Office > Expenses)
create table if not exists expenses (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  date text not null,
  category text not null,
  description text not null,
  amount numeric not null default 0,
  created_at bigint,
  updated_at bigint
);

alter table expenses enable row level security;

drop policy if exists "Users can manage their own expenses" on expenses;
create policy "Users can manage their own expenses" on expenses
  for all using (auth.uid() = user_id);
