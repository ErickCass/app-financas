-- Cópia automática dos dados, dentro do próprio banco.
-- Protege contra o que já aconteceu uma vez: um comando errado apagando tudo.
create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  row_count integer not null default 0,
  payload jsonb not null
);

create index if not exists backups_user_created on public.backups (user_id, created_at desc);

alter table public.backups enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'backups' and policyname = 'backups_own') then
    create policy backups_own on public.backups
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- Mantém as 7 cópias mais recentes e nunca descarta a cópia mais recente que
-- tenha dados: se algo apagar o banco, as cópias vazias não empurram a boa para fora.
create or replace function public.prune_backups() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  keep_good uuid;
begin
  select id into keep_good
    from public.backups
   where user_id = new.user_id and row_count > 0
   order by created_at desc
   limit 1;

  delete from public.backups
   where user_id = new.user_id
     and id <> coalesce(keep_good, '00000000-0000-0000-0000-000000000000'::uuid)
     and id not in (
       select id from public.backups
        where user_id = new.user_id
        order by created_at desc
        limit 7
     );
  return null;
end $$;

drop trigger if exists prune_backups_after_insert on public.backups;
create trigger prune_backups_after_insert
  after insert on public.backups
  for each row execute function public.prune_backups();
