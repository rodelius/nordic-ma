-- Relevance feedback remains separate from graph-field corrections.
create function public.dismiss_corporate_source(p_source text,p_reason text,p_note text default '',p_learning boolean default false) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.source_items;
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required';end if;
 if p_reason is null or p_reason not in('not_event','non_nordic','routine','reporting','duplicate','low_ficc','stale','other') or length(coalesce(p_note,''))>1000 then raise exception 'Invalid dismissal';end if;
 select * into item from public.source_items where id=p_source for update;if not found then raise exception 'Unknown source';end if;
 if item.state='dismissed' then return jsonb_build_object('duplicate',true);end if;if item.state<>'pending' then raise exception 'Only pending items can be dismissed';end if;
 update public.source_items set state='dismissed',reviewed_by=auth.uid(),reviewed_at=now() where id=item.id;
 if p_learning then perform public.record_learning_feedback(item.id,case when p_reason in('duplicate','stale','other') then 'exclude' else 'not_useful' end,p_reason,null,coalesce(p_note,''),null);end if;
 return jsonb_build_object('dismissed',true,'feedbackRecorded',p_learning);
end $$;
revoke all on function public.dismiss_corporate_source(text,text,text,boolean) from public,anon;grant execute on function public.dismiss_corporate_source(text,text,text,boolean) to authenticated;
insert into public.learning_activation_log(model_id,enabled,reviewer_id) select active_model,false,updated_by from public.learning_settings where use_learned_ranking and active_model is not null and updated_by is not null;
update public.learning_settings set use_learned_ranking=false,updated_at=now() where use_learned_ranking;

alter table public.review_feedback drop constraint review_feedback_reason_check;
alter table public.review_feedback add constraint review_feedback_reason_check check(reason in('approved','not_ma','not_event','non_nordic','routine','reporting','duplicate','low_ficc','stale','other','correction','retracted'));
create view public.corporate_training_labels with(security_invoker=true) as
select f.*,coalesce((select max(newer.source_version) from public.corporate_field_feedback newer where newer.source_id=f.source_id and newer.entity_type=f.entity_type and newer.record_id=f.record_id and newer.field=f.field),f.source_version)=f.source_version
 and case when f.field='__record__' then not exists(select 1 from public.corporate_source_reviews latest cross join lateral jsonb_array_elements(latest.graph->'records'->f.entity_type) record where latest.source_id=f.source_id and latest.version=(select max(v.version) from public.corporate_source_reviews v where v.source_id=f.source_id) and record->>((select schema_document->'schemas'->f.entity_type->>'idField' from public.corporate_event_catalogue where version=f.ontology_version))=f.record_id)
 else not exists(select 1 from public.corporate_field_feedback deleted where deleted.source_id=f.source_id and deleted.entity_type=f.entity_type and deleted.record_id=f.record_id and deleted.field='__record__' and deleted.source_version>f.source_version) end as is_current_label,
 r.model_id,r.model_id||'/'||coalesce((select e->>'programme_id' from jsonb_array_elements(r.graph->'records'->'CorporateEvent') e where e->>'event_id'=r.graph->>'root_event_id'),'') as programme_group,
r.source_snapshot,r.recorded_at as review_recorded_at
from public.corporate_field_feedback f join public.corporate_source_reviews r on r.source_id=f.source_id and r.version=f.source_version;
revoke all on public.corporate_training_labels from public,anon;grant select on public.corporate_training_labels to authenticated;
-- Keep news relevance corrections, using canonical IDs and fine-grained field targets.
create or replace function public.record_learning_feedback(p_source text,p_decision text,p_reason text,p_score integer default null,p_note text default '',p_model text default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.source_items;fid uuid;old_model text;group_id text;paths text[];
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required';end if;
 select * into item from public.source_items where id=p_source for update;if not found or item.state='pending' then raise exception 'Review the source before labelling it';end if;
 if p_reason in('not_event','non_nordic','routine','reporting','low_ficc') and p_decision<>'not_useful' then raise exception 'Reason requires a not-useful label';end if;
 if p_reason in('duplicate','stale','other','retracted') and p_decision<>'exclude' then raise exception 'Reason must be excluded';end if;
 if p_reason in('correction','retracted') and length(trim(coalesce(p_note,'')))<8 then raise exception 'Explain feedback correction';end if;
 select e->>'programme_id' into group_id from jsonb_array_elements(coalesce(item.analysis->'records'->'CorporateEvent','[]')) e where e->>'event_id'=item.analysis->>'root_event_id';
 select coalesce(array_agg(distinct entity_type||'.'||field),array['FICC_SCORE']) into paths from public.corporate_field_feedback where source_id=item.id and source_version=item.review_version;
 insert into public.review_feedback(source_id,reviewer_id,decision,reason,score,note,source_snapshot,model_id,analysis_snapshot,changed_fields)
 values(item.id,auth.uid(),p_decision,p_reason,p_score,coalesce(p_note,''),jsonb_build_object('headline',item.headline,'excerpt',item.excerpt,'url',item.url,'published_at',item.published_at,'model_id',item.corporate_model_id,'programme_id',case when group_id is null then item.corporate_model_id else item.corporate_model_id||'/'||group_id end,'ontology_version','1.0.0'),p_model,item.analysis,paths) returning id into fid;
 if p_reason in('correction','retracted') or exists(select 1 from public.learning_settings s join public.learning_models m on m.id=s.active_model where s.id=1 and s.use_learned_ranking and m.artifact->'examples' @> jsonb_build_array(jsonb_build_object('sourceId',item.id))) then
  update public.learning_settings set use_learned_ranking=false,updated_by=auth.uid(),updated_at=now() where id=1 and use_learned_ranking returning active_model into old_model;
  if old_model is not null then insert into public.learning_activation_log(model_id,enabled,reviewer_id) values(old_model,false,auth.uid());end if;
 end if;
 return fid;
end $$;
alter table public.source_items drop column deal_id,drop column assessment;
alter table public.review_revisions rename to legacy_review_revisions;
