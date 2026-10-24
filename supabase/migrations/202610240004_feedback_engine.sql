-- Apply after 003. Append-only review feedback and versioned case-based learning.
begin;
create table public.learning_models (
 id text primary key check(id ~ '^[a-f0-9]{64}$'), artifact jsonb not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create table public.review_feedback (
 id uuid primary key default gen_random_uuid(),source_id text not null references public.source_items(id),
 reviewer_id uuid not null references auth.users(id),decision text not null check(decision in('useful','not_useful','exclude')),
 reason text not null check(reason in('approved','not_ma','non_nordic','routine','duplicate','low_ficc','stale','other','correction','retracted')),
 score integer check(score between 1 and 5),note text not null default '' check(length(note)<=1000),
 source_snapshot jsonb not null,model_id text references public.learning_models(id),created_at timestamptz not null default clock_timestamp(),
 check((decision='useful' and (score is null or score>=3)) or (decision='not_useful' and (score is null or score<=2)) or (decision='exclude' and score is null))
);
create index feedback_source_time on public.review_feedback(source_id,created_at desc);
create table public.learning_settings (
 id integer primary key check(id=1),use_learned_ranking boolean not null default false,
 active_model text references public.learning_models(id),updated_by uuid references auth.users(id),updated_at timestamptz not null default now()
);
create table public.learning_activation_log (
 id uuid primary key default gen_random_uuid(),model_id text references public.learning_models(id),enabled boolean not null,
 reviewer_id uuid not null references auth.users(id),created_at timestamptz not null default now()
);
insert into public.learning_settings(id) values(1);
alter table public.learning_models enable row level security;
alter table public.review_feedback enable row level security;
alter table public.learning_settings enable row level security;
alter table public.learning_activation_log enable row level security;
create policy models_member_read on public.learning_models for select to authenticated using(exists(select 1 from public.pilot_members where user_id=(select auth.uid()) and enabled));
create policy feedback_member_read on public.review_feedback for select to authenticated using(exists(select 1 from public.pilot_members where user_id=(select auth.uid()) and enabled));
create policy learning_settings_read on public.learning_settings for select to authenticated using(exists(select 1 from public.pilot_members where user_id=(select auth.uid()) and enabled));
create policy learning_log_read on public.learning_activation_log for select to authenticated using(exists(select 1 from public.pilot_members where user_id=(select auth.uid()) and enabled));
revoke all on public.learning_models,public.review_feedback,public.learning_settings,public.learning_activation_log from anon,authenticated;
grant select on public.learning_models,public.review_feedback,public.learning_settings,public.learning_activation_log to authenticated;
create view public.latest_review_feedback with (security_invoker=true) as
 select distinct on(source_id) * from public.review_feedback order by source_id,created_at desc,id desc;
grant select on public.latest_review_feedback to authenticated;
revoke all on public.latest_review_feedback from anon;

create function public.record_learning_feedback(p_source text,p_decision text,p_reason text,p_score integer default null,p_note text default '',p_model text default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.source_items; fid uuid; old_model text;
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required'; end if;
 select * into item from public.source_items where id=p_source for update;
 if not found or item.state='pending' then raise exception 'Review the source before labelling it'; end if;
 if p_reason in('not_ma','non_nordic','routine','low_ficc') and p_decision<>'not_useful' then raise exception 'This reason requires a not-useful label'; end if;
 if p_reason in('duplicate','stale','other','retracted') and p_decision<>'exclude' then raise exception 'This reason must be excluded from relevance learning'; end if;
 if p_reason in('correction','retracted') and length(trim(coalesce(p_note,'')))<8 then raise exception 'Explain the feedback correction or exclusion'; end if;
 insert into public.review_feedback(source_id,reviewer_id,decision,reason,score,note,source_snapshot,model_id)
 values(item.id,auth.uid(),p_decision,p_reason,p_score,coalesce(p_note,''),jsonb_build_object('headline',item.headline,'excerpt',item.excerpt,'url',item.url,'published_at',item.published_at,'deal_id',item.deal_id),p_model) returning id into fid;
 if p_reason in('correction','retracted') or exists(select 1 from public.learning_settings s join public.learning_models m on m.id=s.active_model where s.id=1 and s.use_learned_ranking and m.artifact->'examples' @> jsonb_build_array(jsonb_build_object('sourceId',item.id))) then
  update public.learning_settings set use_learned_ranking=false,updated_by=auth.uid(),updated_at=now() where id=1 and use_learned_ranking returning active_model into old_model;
  if old_model is not null then insert into public.learning_activation_log(model_id,enabled,reviewer_id) values(old_model,false,auth.uid()); end if;
 end if;
 return fid;
end $$;
revoke all on function public.record_learning_feedback(text,text,text,integer,text,text) from public,anon;
grant execute on function public.record_learning_feedback(text,text,text,integer,text,text) to authenticated;

create function public.review_source_feedback(p_source text,p_deal jsonb,p_existing text default null,p_dismiss boolean default false,p_reason text default null,p_note text default '',p_model text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb; decision text; reason text; score integer;
begin
 if p_dismiss and (p_reason is null or p_reason not in('not_ma','non_nordic','routine','duplicate','low_ficc','stale','other')) then raise exception 'Choose a dismissal reason'; end if;
 result=public.review_source(p_source,p_deal,p_existing,p_dismiss);
 if coalesce((result->>'duplicate')::boolean,false) then return result; end if;
 if p_dismiss then reason=p_reason;decision=case when reason in('duplicate','stale','other') then 'exclude' else 'not_useful' end;score=null;
 else score=(p_deal->>'score')::integer;decision=case when score>=3 then 'useful' else 'not_useful' end;reason='approved'; end if;
 perform public.record_learning_feedback(p_source,decision,reason,score,p_note,p_model);
 return result||jsonb_build_object('feedbackRecorded',true);
end $$;
revoke all on function public.review_source_feedback(text,jsonb,text,boolean,text,text,text) from public,anon;
grant execute on function public.review_source_feedback(text,jsonb,text,boolean,text,text,text) to authenticated;

create function public.save_learning_model(p_id text,p_artifact jsonb) returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required'; end if;
 if p_artifact is null or not(p_artifact ?& array['algorithm','id','examples','evaluation']) or p_artifact->>'algorithm'<>'ficc-cases-v1' or p_artifact->>'id'<>p_id or jsonb_typeof(p_artifact->'examples')<>'array' or jsonb_array_length(p_artifact->'examples')>500 then raise exception 'Invalid model artifact'; end if;
 insert into public.learning_models(id,artifact,created_by) values(p_id,p_artifact,auth.uid()) on conflict do nothing;
 return p_id;
end $$;
revoke all on function public.save_learning_model(text,jsonb) from public,anon;
grant execute on function public.save_learning_model(text,jsonb) to authenticated;
create function public.set_learning_mode(p_model text,p_enabled boolean) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare artifact jsonb;
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required'; end if;
 if p_enabled then
  select m.artifact into artifact from public.learning_models m where m.id=p_model;
  if not found or coalesce((artifact->'evaluation'->>'eligible')::boolean,false) is not true then raise exception 'This model has not passed the pilot evaluation gate'; end if;
  if exists(select 1 from jsonb_array_elements(artifact->'examples') e where not exists(select 1 from public.latest_review_feedback f where f.id::text=e->>'id' and f.decision<>'exclude' and f.reason not in('duplicate','stale','other'))) then raise exception 'Model contains superseded or excluded feedback; rebuild it'; end if;
 end if;
 update public.learning_settings set use_learned_ranking=p_enabled,active_model=case when p_enabled then p_model else active_model end,updated_by=auth.uid(),updated_at=now() where id=1;
 insert into public.learning_activation_log(model_id,enabled,reviewer_id) values(p_model,p_enabled,auth.uid());
end $$;
revoke all on function public.set_learning_mode(text,boolean) from public,anon;
grant execute on function public.set_learning_mode(text,boolean) to authenticated;
commit;
