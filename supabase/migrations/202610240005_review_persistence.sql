-- Apply after 004. Persistent private drafts, immutable assessment revisions and JSON feedback.
begin;
alter table public.source_items add column review_version integer not null default 0;
alter table public.source_items add column assessment jsonb;
alter table public.review_feedback add column analysis_snapshot jsonb;
alter table public.review_feedback add column changed_fields text[] not null default '{}';
create table public.review_drafts (
 source_id text not null references public.source_items(id),reviewer_id uuid not null references auth.users(id),
 draft_text text not null check(length(draft_text)<=64000),note text not null default '' check(length(note)<=1000),
 assessment jsonb,base_version integer not null,revision integer not null default 1,updated_at timestamptz not null default now(),
 primary key(source_id,reviewer_id)
);
create table public.review_revisions (
 id uuid primary key default gen_random_uuid(),source_id text not null references public.source_items(id),
 version integer not null,reviewer_id uuid not null references auth.users(id),analysis jsonb not null,previous_analysis jsonb,assessment jsonb not null,
 note text not null,changed_fields text[] not null,latest_deal_updated boolean not null,created_at timestamptz not null default clock_timestamp(),unique(source_id,version)
);
alter table public.review_drafts enable row level security;
alter table public.review_revisions enable row level security;
create policy own_review_draft on public.review_drafts for select to authenticated using(reviewer_id=(select auth.uid()) and exists(select 1 from public.pilot_members where user_id=(select auth.uid()) and enabled and can_review));
create policy member_review_revisions on public.review_revisions for select to authenticated using(exists(select 1 from public.pilot_members where user_id=(select auth.uid()) and enabled));
revoke all on public.review_drafts,public.review_revisions from anon,authenticated;
grant select on public.review_drafts,public.review_revisions to authenticated;

create function public.save_review_draft(p_source text,p_text text,p_note text,p_assessment jsonb,p_expected integer,p_draft_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.source_items; draft public.review_drafts; next_revision integer;
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required'; end if;
 select * into item from public.source_items where id=p_source for update;
 if not found or item.state not in('pending','approved') then raise exception 'This source has no editable review'; end if;
 if p_expected is null or item.review_version<>p_expected then raise exception 'Review changed since you opened it. Reopen it before saving.'; end if;
 select * into draft from public.review_drafts where source_id=p_source and reviewer_id=auth.uid() for update;
 if p_draft_revision is null or coalesce(draft.revision,0)<>p_draft_revision then raise exception 'Draft changed in another session. Reopen it before saving.'; end if;
 next_revision=coalesce(draft.revision,0)+1;
 insert into public.review_drafts(source_id,reviewer_id,draft_text,note,assessment,base_version,revision)
 values(p_source,auth.uid(),p_text,p_note,p_assessment,item.review_version,next_revision)
 on conflict(source_id,reviewer_id) do update set draft_text=excluded.draft_text,note=excluded.note,assessment=excluded.assessment,base_version=excluded.base_version,revision=excluded.revision,updated_at=now();
 return jsonb_build_object('saved',true,'draftRevision',next_revision,'reviewVersion',item.review_version);
end $$;
revoke all on function public.save_review_draft(text,text,text,jsonb,integer,integer) from public,anon;
grant execute on function public.save_review_draft(text,text,text,jsonb,integer,integer) to authenticated;

create or replace function public.record_learning_feedback(p_source text,p_decision text,p_reason text,p_score integer default null,p_note text default '',p_model text default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.source_items; fid uuid; old_model text;
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required'; end if;
 select * into item from public.source_items where id=p_source for update;
 if not found or item.state='pending' then raise exception 'Review the source before labelling it'; end if;
 if p_reason in('not_ma','non_nordic','routine','low_ficc') and p_decision<>'not_useful' then raise exception 'This reason requires a not-useful label'; end if;
 if p_reason in('duplicate','stale','other','retracted') and p_decision<>'exclude' then raise exception 'This reason must be excluded from relevance learning'; end if;
 if p_reason in('correction','retracted') and length(trim(coalesce(p_note,'')))<8 then raise exception 'Explain the feedback correction or exclusion'; end if;
 insert into public.review_feedback(source_id,reviewer_id,decision,reason,score,note,source_snapshot,model_id,analysis_snapshot,changed_fields)
 values(item.id,auth.uid(),p_decision,p_reason,p_score,coalesce(p_note,''),jsonb_build_object('headline',item.headline,'excerpt',item.excerpt,'url',item.url,'published_at',item.published_at,'deal_id',item.deal_id),p_model,item.analysis,case when p_reason='correction' then coalesce((select r.changed_fields from public.review_revisions r where r.source_id=item.id and r.created_at>=transaction_timestamp() order by r.version desc limit 1),array['score']::text[]) else '{}'::text[] end) returning id into fid;
 if p_reason in('correction','retracted') or exists(select 1 from public.learning_settings s join public.learning_models m on m.id=s.active_model where s.id=1 and s.use_learned_ranking and m.artifact->'examples' @> jsonb_build_array(jsonb_build_object('sourceId',item.id))) then
  update public.learning_settings set use_learned_ranking=false,updated_by=auth.uid(),updated_at=now() where id=1 and use_learned_ranking returning active_model into old_model;
  if old_model is not null then insert into public.learning_activation_log(model_id,enabled,reviewer_id) values(old_model,false,auth.uid()); end if;
 end if;
 return fid;
end $$;
revoke all on function public.record_learning_feedback(text,text,text,integer,text,text) from public,anon;
grant execute on function public.record_learning_feedback(text,text,text,integer,text,text) to authenticated;

create function public.submit_review_assessment(p_source text,p_deal jsonb,p_assessment jsonb,p_note text,p_existing text,p_expected integer,p_learning boolean,p_model text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.source_items; original jsonb; saved jsonb; current_deal jsonb; result jsonb; changes text[]; updated boolean=false; correcting boolean; next_version integer; new_status text;
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required'; end if;
 select * into item from public.source_items where id=p_source for update;
 if not found or item.state not in('pending','approved') then raise exception 'This source has no editable assessment'; end if;
 if p_expected is null or item.review_version<>p_expected then raise exception 'Review changed since you opened it. Reopen it before saving.'; end if;
 if p_assessment is null or jsonb_typeof(p_assessment)<>'object' then raise exception 'Assessment is required'; end if;
 if length(coalesce(p_note,''))>1000 then raise exception 'Review note is too long'; end if;
 original=item.analysis;correcting=item.state='approved';next_version=item.review_version+1;
 if not correcting then
  result=public.review_source(p_source,p_deal,p_existing,false);
  select analysis into saved from public.source_items where id=item.id;
  updated=coalesce((result->>'material')::boolean,false);
 else
  if length(trim(coalesce(p_note,'')))<8 then raise exception 'Explain the assessment correction in at least 8 characters'; end if;
  if p_existing is not null and p_existing<>item.deal_id then raise exception 'An assessment correction cannot relink its transaction'; end if;
  if p_deal is null or not(p_deal ?& array['target','buyer','seller','stage','delta','score','source','evidence']) or jsonb_typeof(p_deal->'score')<>'number' or (p_deal->>'score')::numeric not between 1 and 5 or (p_deal->>'score')::numeric<>trunc((p_deal->>'score')::numeric) then raise exception 'Invalid reviewed analysis'; end if;
  if coalesce(p_deal->>'country','') not in('Sweden','Norway','Finland','Denmark') or not exists(select 1 from jsonb_array_elements(p_deal->'evidence') e where lower(trim(e->>'label'))='nordic connection' and e->>'kind'='Fact' and length(trim(e->>'value'))>=8 and lower(trim(e->>'value')) not in('unknown','unconfirmed','not verified','unclear')) then raise exception 'Document a factual Nordic connection'; end if;
  if coalesce(p_deal->'source'->>'url','')<>item.url or coalesce(p_deal->'source'->>'timestamp','')='' or (p_deal->'source'->>'timestamp')::timestamptz<>item.published_at then raise exception 'Source metadata cannot be changed'; end if;
  select body into current_deal from public.deals where id=item.deal_id for update;
  new_status=case when p_deal->>'stage' in('Closed','Failed') then p_deal->>'stage' when original->>'status' in('Closed','Failed') then 'Updated' else coalesce(original->>'status','Updated') end;
  saved=p_deal||jsonb_build_object('id',item.deal_id,'synthetic',false,'status',new_status);
  -- A correction to an older source must not overwrite a later market update.
  if current_deal=original then update public.deals set body=saved,updated_at=now() where id=item.deal_id;updated=true; end if;
  update public.source_items set analysis=saved,reviewed_by=auth.uid(),reviewed_at=now() where id=item.id;
  update public.notification_deliveries d set status='dead',last_error='Assessment corrected before delivery',lease_until=null where d.outbox_id in(select id from public.notification_outbox where event_id=item.id) and d.status in('queued','retry','sending');
  result=jsonb_build_object('correction',true,'dealId',item.deal_id,'queued',false);
 end if;
 select coalesce(array_agg(key order by key),'{}'::text[]) into changes from jsonb_object_keys(coalesce(original,'{}'::jsonb)||saved) key where key not in('id','source','status','synthetic') and original->key is distinct from saved->key;
 update public.source_items set assessment=p_assessment,review_version=next_version where id=item.id;
 insert into public.review_revisions(source_id,version,reviewer_id,analysis,previous_analysis,assessment,note,changed_fields,latest_deal_updated) values(item.id,next_version,auth.uid(),saved,original,p_assessment,coalesce(p_note,''),changes,updated);
 if p_learning then perform public.record_learning_feedback(item.id,case when (saved->>'score')::integer>=3 then 'useful' else 'not_useful' end,case when correcting then 'correction' else 'approved' end,(saved->>'score')::integer,coalesce(p_note,''),p_model); end if;
 delete from public.review_drafts where source_id=item.id and reviewer_id=auth.uid();
 return result||jsonb_build_object('saved',true,'reviewVersion',next_version,'latestDealUpdated',updated,'feedbackRecorded',p_learning);
end $$;
revoke all on function public.submit_review_assessment(text,jsonb,jsonb,text,text,integer,boolean,text) from public,anon;
grant execute on function public.submit_review_assessment(text,jsonb,jsonb,text,text,integer,boolean,text) to authenticated;
create or replace view public.latest_review_feedback with (security_invoker=true) as select distinct on(source_id) * from public.review_feedback order by source_id,created_at desc,id desc;
commit;
