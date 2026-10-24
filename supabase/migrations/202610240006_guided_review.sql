-- Apply after 005, before deploying the guided editor. Existing rows and old RPC calls remain compatible.
begin;
alter table public.review_feedback drop constraint review_feedback_reason_check;
alter table public.review_feedback add constraint review_feedback_reason_check check(reason in('approved','not_ma','non_nordic','routine','reporting','duplicate','low_ficc','stale','other','correction','retracted'));
alter table public.review_drafts add column review_input jsonb;
alter table public.review_revisions add column review_input jsonb;
-- New feature extraction requires a newly evaluated model. Preserve old artifacts for audit.
insert into public.learning_activation_log(model_id,enabled,reviewer_id) select active_model,false,updated_by from public.learning_settings where use_learned_ranking and active_model is not null and updated_by is not null;
update public.learning_settings set use_learned_ranking=false,updated_at=now() where use_learned_ranking;
create or replace function public.review_source(p_source text,p_deal jsonb,p_existing text default null,p_dismiss boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.source_items; prior jsonb; reviewed jsonb; ev jsonb; material boolean; did text; oid uuid; result_status text;
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required'; end if;
 select * into item from public.source_items where id=p_source for update;
 if not found then raise exception 'Unknown source item'; end if;
 if item.state<>'pending' then return jsonb_build_object('duplicate',true,'material',false,'dealId',item.deal_id); end if;
 if p_dismiss then update public.source_items set state='dismissed',reviewed_by=auth.uid(),reviewed_at=now() where id=p_source; return jsonb_build_object('dismissed',true); end if;
 -- These checks also apply to direct RPC callers, not just the validated application route.
 if jsonb_typeof(p_deal)<>'object' or not (p_deal ?& array['target','buyer','seller','stage','delta','score','source','synthetic','evidence'])
  or p_deal->'synthetic'<>'false'::jsonb or jsonb_typeof(p_deal->'score')<>'number'
  or (p_deal->>'score')::numeric not between 1 and 5 or (p_deal->>'score')::numeric<>trunc((p_deal->>'score')::numeric)
  or jsonb_typeof(p_deal->'evidence')<>'array' or jsonb_array_length(p_deal->'evidence')=0
  or coalesce(p_deal->'source'->>'url','')<>item.url or coalesce(p_deal->'source'->>'timestamp','')='' then raise exception 'Invalid reviewed deal'; end if;
 if coalesce(p_deal->>'country','') not in('Sweden','Norway','Finland','Denmark') or not exists(select 1 from jsonb_array_elements(p_deal->'evidence') e where lower(trim(e->>'label'))='nordic connection' and e->>'kind'='Fact' and length(trim(e->>'value'))>=8 and lower(trim(e->>'value')) not in('unknown','unconfirmed','not verified','unclear')) then raise exception 'Document a factual Nordic connection'; end if;
 if (p_deal->'source'->>'timestamp')::timestamptz<>item.published_at then raise exception 'Publication timestamp must match the source'; end if;
 if p_existing is not null then
  select body into prior from public.deals where id=p_existing for update;
  if not found then raise exception 'Unknown existing transaction'; end if;
  did=p_existing;
  material=prior->>'status' not in('Closed','Failed') and item.published_at >= (prior->'source'->>'timestamp')::timestamptz
   and lower(trim(p_deal->>'delta')) not in('no material update','no material change')
   and (p_deal->>'stage'<>prior->>'stage' or p_deal->>'delta'<>prior->>'delta');
 else
  -- An unidentified target cannot safely share a transaction identity with another item.
  did='deal-'||md5(case when lower(trim(coalesce(p_deal->>'target',''))) in('','unknown','undisclosed','unconfirmed','not verified') then item.id else lower(trim(p_deal->>'target'))||'|'||lower(trim(p_deal->>'buyer'))||'|'||lower(trim(p_deal->>'seller')) end);
  if exists(select 1 from public.deals where id=did) then raise exception 'Transaction exists; attach this item to that transaction'; end if;
  material=true;
 end if;
 result_status=case when p_deal->>'stage'='Closed' then 'Closed' when p_deal->>'stage'='Failed' then 'Failed' when p_existing is null then 'New' else 'Updated' end;
 reviewed=p_deal||jsonb_build_object('id',did,'synthetic',false,'status',result_status);
 if p_existing is null then insert into public.deals(id,body) values(did,reviewed);
 elsif material then update public.deals set body=reviewed,updated_at=now() where id=did; end if;
 ev=jsonb_build_object('id',item.id,'dealId',did,'headline',item.headline,'delta',p_deal->>'delta','stage',p_deal->>'stage','timestamp',item.published_at,'sourceUrl',item.url,'type',case when result_status in('Closed','Failed') then result_status else 'Process' end,'material',material);
 insert into public.deal_events(id,deal_id,body) values(item.id,did,ev);
 update public.source_items set state='approved',reviewed_by=auth.uid(),reviewed_at=now(),analysis=reviewed,deal_id=did where id=p_source;
 -- Archive updates remain in history; only recent, material, relevant updates alert.
 if material and (p_deal->>'score')::integer>=3 and item.published_at>=now()-interval '24 hours' then
  insert into public.notification_outbox(event_id,payload) values(item.id,jsonb_build_object('title',coalesce(nullif(trim(p_deal->>'target'),''),item.headline)||' · '||result_status,'body',p_deal->>'delta','url','/?deal='||did,'expiresAt',item.published_at+interval '24 hours')) returning id into oid;
  insert into public.notification_deliveries(outbox_id,subscription_id)
   select oid,s.id from public.push_subscriptions s join public.pilot_members m on m.user_id=s.user_id
   where s.enabled and m.enabled and s.min_score<=(p_deal->>'score')::integer;
 end if;
 return jsonb_build_object('duplicate',false,'material',material,'dealId',did,'queued',oid is not null);
end $$;
revoke all on function public.review_source(text,jsonb,text,boolean) from public,anon;
grant execute on function public.review_source(text,jsonb,text,boolean) to authenticated;

create or replace function public.record_learning_feedback(p_source text,p_decision text,p_reason text,p_score integer default null,p_note text default '',p_model text default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.source_items; fid uuid; old_model text;
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required'; end if;
 select * into item from public.source_items where id=p_source for update;
 if not found or item.state='pending' then raise exception 'Review the source before labelling it'; end if;
 if p_reason in('not_ma','non_nordic','routine','reporting','low_ficc') and p_decision<>'not_useful' then raise exception 'This reason requires a not-useful label'; end if;
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

create or replace function public.review_source_feedback(p_source text,p_deal jsonb,p_existing text default null,p_dismiss boolean default false,p_reason text default null,p_note text default '',p_model text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb; decision text; reason text; score integer;
begin
 if p_dismiss and (p_reason is null or p_reason not in('not_ma','non_nordic','routine','reporting','duplicate','low_ficc','stale','other')) then raise exception 'Choose a dismissal reason'; end if;
 result=public.review_source(p_source,p_deal,p_existing,p_dismiss);
 if coalesce((result->>'duplicate')::boolean,false) then return result; end if;
 if p_dismiss then reason=p_reason;decision=case when reason in('duplicate','stale','other') then 'exclude' else 'not_useful' end;score=null;
 else score=(p_deal->>'score')::integer;decision=case when score>=3 then 'useful' else 'not_useful' end;reason='approved'; end if;
 perform public.record_learning_feedback(p_source,decision,reason,score,p_note,p_model);
 return result||jsonb_build_object('feedbackRecorded',true);
end $$;
revoke all on function public.review_source_feedback(text,jsonb,text,boolean,text,text,text) from public,anon;
grant execute on function public.review_source_feedback(text,jsonb,text,boolean,text,text,text) to authenticated;

create or replace function public.save_learning_model(p_id text,p_artifact jsonb) returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required'; end if;
 if p_artifact is null or not(p_artifact ?& array['algorithm','id','examples','evaluation']) or p_artifact->>'algorithm'<>'ficc-cases-v2' or p_artifact->>'id'<>p_id or jsonb_typeof(p_artifact->'examples')<>'array' or jsonb_array_length(p_artifact->'examples')>500 then raise exception 'Invalid model artifact'; end if;
 insert into public.learning_models(id,artifact,created_by) values(p_id,p_artifact,auth.uid()) on conflict do nothing;
 return p_id;
end $$;
revoke all on function public.save_learning_model(text,jsonb) from public,anon;
grant execute on function public.save_learning_model(text,jsonb) to authenticated;
create or replace function public.set_learning_mode(p_model text,p_enabled boolean) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare artifact jsonb;
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required'; end if;
 if p_enabled then
  select m.artifact into artifact from public.learning_models m where m.id=p_model;
  if not found or artifact->>'algorithm'<>'ficc-cases-v2' or coalesce((artifact->'evaluation'->>'eligible')::boolean,false) is not true then raise exception 'This model has not passed the pilot evaluation gate'; end if;
  if exists(select 1 from jsonb_array_elements(artifact->'examples') e where not exists(select 1 from public.latest_review_feedback f where f.id::text=e->>'id' and f.decision<>'exclude' and f.reason not in('duplicate','stale','other'))) then raise exception 'Model contains superseded or excluded feedback; rebuild it'; end if;
 end if;
 update public.learning_settings set use_learned_ranking=p_enabled,active_model=case when p_enabled then p_model else active_model end,updated_by=auth.uid(),updated_at=now() where id=1;
 insert into public.learning_activation_log(model_id,enabled,reviewer_id) values(p_model,p_enabled,auth.uid());
end $$;
revoke all on function public.set_learning_mode(text,boolean) from public,anon;
grant execute on function public.set_learning_mode(text,boolean) to authenticated;

-- Retain the validated, atomic version-005 implementations as private helpers.
alter function public.save_review_draft(text,text,text,jsonb,integer,integer) rename to save_review_draft_v5;
revoke all on function public.save_review_draft_v5(text,text,text,jsonb,integer,integer) from public,anon,authenticated;
create function public.save_review_draft(p_source text,p_text text,p_note text,p_assessment jsonb,p_expected integer,p_draft_revision integer,p_review_input jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if p_review_input is not null and (jsonb_typeof(p_review_input)<>'object' or length(p_review_input::text)>64000) then raise exception 'Invalid review input reference'; end if;
 result=public.save_review_draft_v5(p_source,p_text,p_note,p_assessment,p_expected,p_draft_revision);
 update public.review_drafts set review_input=coalesce(p_review_input,review_input) where source_id=p_source and reviewer_id=auth.uid();
 return result;
end $$;
revoke all on function public.save_review_draft(text,text,text,jsonb,integer,integer,jsonb) from public,anon;
grant execute on function public.save_review_draft(text,text,text,jsonb,integer,integer,jsonb) to authenticated;
alter function public.submit_review_assessment(text,jsonb,jsonb,text,text,integer,boolean,text) rename to submit_review_assessment_v5;
revoke all on function public.submit_review_assessment_v5(text,jsonb,jsonb,text,text,integer,boolean,text) from public,anon,authenticated;
create function public.submit_review_assessment(p_source text,p_deal jsonb,p_assessment jsonb,p_note text,p_existing text,p_expected integer,p_learning boolean,p_model text default null,p_review_input jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb; context jsonb;
begin
 if p_review_input is not null and (jsonb_typeof(p_review_input)<>'object' or length(p_review_input::text)>64000) then raise exception 'Invalid review input reference'; end if;
 select review_input into context from public.review_drafts where source_id=p_source and reviewer_id=auth.uid();
 result=public.submit_review_assessment_v5(p_source,p_deal,p_assessment,p_note,p_existing,p_expected,p_learning,p_model);
 update public.review_revisions set review_input=coalesce(p_review_input,context) where source_id=p_source and version=(result->>'reviewVersion')::integer and reviewer_id=auth.uid();
 return result;
end $$;
revoke all on function public.submit_review_assessment(text,jsonb,jsonb,text,text,integer,boolean,text,jsonb) from public,anon;
grant execute on function public.submit_review_assessment(text,jsonb,jsonb,text,text,integer,boolean,text,jsonb) to authenticated;
commit;
