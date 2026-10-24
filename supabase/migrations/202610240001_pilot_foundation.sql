-- Stage 1: a single invited pilot workspace. No news collection or delivery yet.
begin;
create table public.pilot_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.deals (
 id text primary key,
 body jsonb not null check (jsonb_typeof(body) = 'object' and body ?& array['id','synthetic'] and body->>'id' = id and body->'synthetic' = 'false'::jsonb),
 updated_at timestamptz not null default now()
);
create table public.deal_events (
 id text primary key,
 deal_id text not null references public.deals(id),
 body jsonb not null check (jsonb_typeof(body) = 'object' and body ?& array['id','dealId'] and body->>'id' = id and body->>'dealId' = deal_id),
 created_at timestamptz not null default now()
);
create table public.monitor_state (
 key text primary key,
 value text not null
);
alter table public.pilot_members enable row level security;
alter table public.deals enable row level security;
alter table public.deal_events enable row level security;
alter table public.monitor_state enable row level security;
-- A caller can see only its own active membership, preventing enumeration.
create policy member_self_read on public.pilot_members for select to authenticated
 using (user_id = (select auth.uid()) and enabled);
create policy pilot_deals_read on public.deals for select to authenticated
 using (exists (select 1 from public.pilot_members where user_id = (select auth.uid()) and enabled));
create policy pilot_events_read on public.deal_events for select to authenticated
 using (exists (select 1 from public.pilot_members where user_id = (select auth.uid()) and enabled));
create policy pilot_state_read on public.monitor_state for select to authenticated
 using (exists (select 1 from public.pilot_members where user_id = (select auth.uid()) and enabled));
-- Defense in depth: no anonymous access, no client writes. No service-role key in app.
revoke all on public.pilot_members,public.deals,public.deal_events,public.monitor_state from anon,authenticated;
grant select on public.pilot_members,public.deals,public.deal_events,public.monitor_state to authenticated;
insert into public.monitor_state(key,value) values ('foundation_version','stage-1');
commit;
