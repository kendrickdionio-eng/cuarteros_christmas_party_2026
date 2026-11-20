-- Run this once in Supabase SQL Editor. Tables have no browser-accessible policies;
-- the Edge Function uses the server-side service key to access them.
create extension if not exists pgcrypto;

create table if not exists public.exchange_participants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  household_group smallint,
  code_hash text,
  created_at timestamptz not null default now()
);

-- Add this column when upgrading a database created with an earlier schema.
alter table public.exchange_participants add column if not exists household_group smallint;

create table if not exists public.exchange_assignments (
  giver_id uuid primary key references public.exchange_participants(id) on delete cascade,
  recipient_id uuid not null unique references public.exchange_participants(id) on delete cascade,
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint no_self_gift check (giver_id <> recipient_id)
);

create table if not exists public.exchange_sessions (
  token_hash text primary key,
  role text not null check (role in ('admin','participant')),
  participant_id uuid references public.exchange_participants(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.exchange_login_attempts (
  attempt_key text primary key,
  window_started_at timestamptz not null,
  attempts integer not null default 0
);

alter table public.exchange_participants enable row level security;
alter table public.exchange_assignments enable row level security;
alter table public.exchange_sessions enable row level security;
alter table public.exchange_login_attempts enable row level security;

insert into public.exchange_participants(name,household_group) values
 ('Dann',1),('Blair',1),('ceecee',1),('sarah',1),('Vanessa',1),('Ayeisha',1),('Basti',1),('Warren',1),('Lore',1),('Dongki',1),('Joshua',2),('Sofia',2),('Jenny',2),('Klienx2',3),('Tito Amay',3),('Kathleen',4),('Ramil',4),('Rk',4),('Rap2x',4),('Kevin',4),('Franco',5),('Con2x',5),('Isa',5),('Haizy',4),('Kado',1),('Coy 2',6),('Maxine',6),('Kenu',6)
on conflict (name) do update set household_group=excluded.household_group;

create or replace function public.allow_exchange_login(p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into exchange_login_attempts(attempt_key,window_started_at,attempts)
  values(p_key,now(),1)
  on conflict(attempt_key) do update set
    attempts = case when exchange_login_attempts.window_started_at < now() - interval '15 minutes' then 1 else exchange_login_attempts.attempts + 1 end,
    window_started_at = case when exchange_login_attempts.window_started_at < now() - interval '15 minutes' then now() else exchange_login_attempts.window_started_at end;
  select attempts <= 10 into ok from exchange_login_attempts where attempt_key=p_key;
  return ok;
end $$;

create or replace function public.draw_exchange_for(p_giver uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare giver_ids uuid[]; household_order smallint[]; i integer; n integer; largest_household integer; recipient_name text; draw_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('north-pole-exchange-draw'));
  if not exists(select 1 from exchange_participants where id=p_giver) then raise exception 'Participant not found'; end if;
  if exists(select 1 from exchange_participants where household_group is null) then
    raise exception 'Every participant needs a household group before the draw can start. Set missing groups in the participant table.';
  end if;
  if exists(select 1 from exchange_participants group by household_group having count(*) * 2 > (select count(*) from exchange_participants)) then
    raise exception 'A valid one-to-one draw is not possible because one household has more than half of all participants.';
  end if;
  -- An earlier version may already have created assignments without household rules.
  -- Do not silently change any result that a participant has already seen.
  if exists (
    select 1 from exchange_assignments a
    join exchange_participants g on g.id=a.giver_id
    join exchange_participants r on r.id=a.recipient_id
    where g.household_group=r.household_group
  ) then
    if exists(select 1 from exchange_assignments where revealed_at is not null) then
      raise exception 'The existing draw has same-household assignments. The organizer must reset the draw before using the new household rule.';
    end if;
    delete from exchange_assignments;
  end if;
  if not exists(select 1 from exchange_assignments) then
    select array_agg(household_group order by random()) into household_order
      from (select distinct household_group from exchange_participants) groups;
    -- Shuffle household blocks and people within each block, then rotate by the
    -- largest household size. Since no household exceeds half the roster, this
    -- is a one-to-one assignment with no same-household matches.
    select array_agg(id order by array_position(household_order,household_group),random()),
           max(group_size), count(*)
      into giver_ids,largest_household,n
      from exchange_participants
      cross join (select household_group as group_key,count(*) as group_size
                  from exchange_participants group by household_group) sizes
      where sizes.group_key=exchange_participants.household_group;
    if coalesce(n,0) < 2 then raise exception 'At least two participants are required'; end if;
    for i in array_lower(giver_ids,1)..array_upper(giver_ids,1) loop
      insert into exchange_assignments(giver_id,recipient_id)
      values(giver_ids[i],giver_ids[((i-1+largest_household) % n)+1]);
    end loop;
  end if;
  update exchange_assignments set revealed_at=coalesce(revealed_at,now()) where giver_id=p_giver;
  select p.name into recipient_name from exchange_assignments a join exchange_participants p on p.id=a.recipient_id where a.giver_id=p_giver;
  select count(*) into draw_count from exchange_assignments where revealed_at is not null;
  return jsonb_build_object('recipient',recipient_name,'drawn_count',draw_count);
end $$;

revoke all on function public.allow_exchange_login(text) from public, anon, authenticated;
revoke all on function public.draw_exchange_for(uuid) from public, anon, authenticated;
grant execute on function public.allow_exchange_login(text) to service_role;
grant execute on function public.draw_exchange_for(uuid) to service_role;
