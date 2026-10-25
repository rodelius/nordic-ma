-- Apply after 009. Extraction artifacts are separate from approved corporate events.
begin;
create table public.extraction_runs(
 id uuid primary key default gen_random_uuid(),source_id text not null references public.source_items(id),
 requested_by uuid not null references auth.users(id),source_version integer not null,
 source_snapshot jsonb not null,extractor_version text not null,model_name text not null,
 status text not null check(status in('retrieving','extracting','succeeded','failed')),
 article jsonb,suggestions jsonb,error text,created_at timestamptz not null default now(),finished_at timestamptz,
 check(article is null or length(article::text)<=500000),check(suggestions is null or length(suggestions::text)<=200000)
);
create index extraction_source_history on public.extraction_runs(source_id,created_at desc);
create unique index extraction_one_running on public.extraction_runs(source_id) where status in('retrieving','extracting');
create table public.extraction_evaluations(
 id uuid primary key default gen_random_uuid(),run_id uuid not null references public.extraction_runs(id),
 reviewed_by uuid not null references auth.users(id),source_version integer not null,review_recorded_at timestamptz not null,
 programme_group text not null,review_hash text not null,metrics jsonb not null,created_at timestamptz not null default now(),
 unique(run_id,source_version)
);
alter table public.extraction_runs enable row level security;
alter table public.extraction_evaluations enable row level security;
create policy extraction_reviewer_read on public.extraction_runs for select to authenticated using(exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review));
create policy extraction_evaluation_read on public.extraction_evaluations for select to authenticated using(exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review));
revoke all on public.extraction_runs,public.extraction_evaluations from public,anon,authenticated;
grant select on public.extraction_runs,public.extraction_evaluations to authenticated;
grant all on public.extraction_runs,public.extraction_evaluations to service_role;
insert into public.monitor_state(key,value) values('extraction_version','1') on conflict(key) do update set value=excluded.value;
commit;
