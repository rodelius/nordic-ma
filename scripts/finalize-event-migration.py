from pathlib import Path
import re
p=Path(__file__).resolve().parents[1];f=p/'supabase/migrations/202610250007_corporate_events.sql';s=f.read_text()
s=s.replace('model_id text primary key references public.deals(id)','model_id text primary key').replace("'ontology_version','root_event_id','records','legacy_fields'","'ontology_version','root_event_id','records'")
a=s.index(" return jsonb_build_object('ontology_version','1.0.0','root_event_id','event-main','records',records,'legacy_fields'");b=s.index('\nend $$;',a);s=s[:a]+" return jsonb_build_object('ontology_version','1.0.0','root_event_id','event-main','records',records);"+s[b:]
a=s.index('create function public.ce_sync_deal()');b=s.index('create view public.ce_event_programme',a)
s=s[:a]+'''create function public.ce_write_model(p_id text,g jsonb,p_source text default null) returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare old_graph jsonb;rev integer;k record;r jsonb;doc jsonb;identifier text;
begin
 perform public.ce_validate_model(g);
 select graph,revision into old_graph,rev from public.corporate_event_models where model_id=p_id for update;
 if old_graph=g then return rev;end if;rev=coalesce(rev,0)+1;
 insert into public.corporate_event_models(model_id,ontology_version,graph,revision) values(p_id,'1.0.0',g,rev) on conflict(model_id) do update set graph=excluded.graph,revision=excluded.revision,updated_at=now();
 select schema_document into doc from public.corporate_event_catalogue where version='1.0.0';
 delete from public.corporate_event_records where model_id=p_id;
 for k in select * from jsonb_each(g->'records') loop for r in select * from jsonb_array_elements(k.value) loop identifier=r->>(doc->'schemas'->k.key->>'idField');insert into public.corporate_event_records values(p_id,k.key,identifier,r);end loop;end loop;
 insert into public.corporate_event_revisions(model_id,revision,previous_graph,graph,actor,source_id) values(p_id,rev,old_graph,g,auth.uid(),p_source);
 return rev;
end $$;
revoke all on function public.ce_write_model(text,jsonb,text) from public,anon,authenticated;
-- Historical fields are archived, not carried into the new active model.
create table public.corporate_legacy_archive(table_name text not null,row_id text not null,body jsonb not null,archived_at timestamptz not null default now(),primary key(table_name,row_id));
alter table public.corporate_legacy_archive enable row level security;
revoke all on public.corporate_legacy_archive from public,anon,authenticated;
insert into public.corporate_legacy_archive(table_name,row_id,body) select 'deals',id,to_jsonb(d) from public.deals d;
insert into public.corporate_legacy_archive(table_name,row_id,body) select 'source_items',id,to_jsonb(s) from public.source_items s;
do $$declare d record;begin for d in select id,body from public.deals loop perform public.ce_write_model(d.id,public.ce_legacy_model(d.body));end loop;end $$;
alter table public.source_items add column corporate_model_id text references public.corporate_event_models(model_id);
alter table public.source_items add column corporate_model_revision integer;
update public.source_items s set corporate_model_id=s.deal_id,corporate_model_revision=case when s.analysis=d.body then 1 else 0 end from public.deals d where d.id=s.deal_id;
update public.source_items set analysis=public.ce_legacy_model(analysis) where analysis is not null;
alter table public.review_drafts rename to legacy_review_drafts;
create table public.corporate_review_drafts(
 source_id text not null references public.source_items(id),reviewer_id uuid not null references auth.users(id),draft_text text not null check(length(draft_text)<=150000),note text not null default '' check(length(note)<=1000),base_version integer not null,revision integer not null,review_input jsonb,updated_at timestamptz not null default now(),primary key(source_id,reviewer_id)
);
create table public.corporate_source_reviews(
 source_id text not null references public.source_items(id),version integer not null,model_id text not null references public.corporate_event_models(model_id),graph jsonb not null,previous_graph jsonb,model_revision integer,reviewer_id uuid not null references auth.users(id),note text not null,review_input jsonb,update_classification text not null,source_snapshot jsonb not null,recorded_at timestamptz not null default clock_timestamp(),primary key(source_id,version)
);
create table public.corporate_field_feedback(
 id bigint generated always as identity primary key,source_id text not null,source_version integer not null,ontology_version text not null,entity_type text not null,record_id text not null,field text not null,proposed_value jsonb,corrected_value jsonb,reviewer_id uuid not null references auth.users(id),reason text not null,recorded_at timestamptz not null default clock_timestamp(),foreign key(source_id,source_version) references public.corporate_source_reviews(source_id,version)
);
create table public.corporate_announcements(id text primary key,model_id text not null references public.corporate_event_models(model_id),source_id text,headline text not null,url text,published_at timestamptz,update_classification text not null check(update_classification in('UNKNOWN','MATERIAL_UPDATE','NO_MATERIAL_CHANGE')),material boolean generated always as(case update_classification when 'MATERIAL_UPDATE' then true when 'NO_MATERIAL_CHANGE' then false else null end) stored,recorded_at timestamptz not null default now());
insert into public.corporate_announcements(id,model_id,headline,url,published_at,update_classification,recorded_at) select id,deal_id,body->>'headline',body->>'sourceUrl',(body->>'timestamp')::timestamptz,case when coalesce((body->>'material')::boolean,false) then 'MATERIAL_UPDATE' else 'NO_MATERIAL_CHANGE' end,created_at from public.deal_events;
''' + s[b:]
s=s.replace('revoke all on function public.ce_sync_deal() from public,anon,authenticated;','')
s=s.replace('commit;','')
# Finish with canonical review functions; old write RPCs become inaccessible.
s+='''
create function public.save_corporate_draft(p_source text,p_text text,p_note text,p_expected integer,p_draft_revision integer,p_review_input jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.source_items;d public.corporate_review_drafts;n integer;
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required';end if;
 if length(p_text)>150000 or length(coalesce(p_note,''))>1000 or length(coalesce(p_review_input::text,''))>170000 then raise exception 'Draft too large';end if;
 select * into item from public.source_items where id=p_source for update;
 if not found or item.state not in('pending','approved') then raise exception 'Source is not editable';end if;
 if item.review_version<>p_expected then raise exception 'Review changed since you opened it';end if;
 select * into d from public.corporate_review_drafts where source_id=p_source and reviewer_id=auth.uid() for update;
 if coalesce(d.revision,0)<>p_draft_revision then raise exception 'Draft changed in another session';end if;n=coalesce(d.revision,0)+1;
 insert into public.corporate_review_drafts(source_id,reviewer_id,draft_text,note,base_version,revision,review_input) values(p_source,auth.uid(),p_text,coalesce(p_note,''),p_expected,n,p_review_input)
 on conflict(source_id,reviewer_id) do update set draft_text=excluded.draft_text,note=excluded.note,base_version=excluded.base_version,revision=excluded.revision,review_input=excluded.review_input,updated_at=now();
 return jsonb_build_object('draftRevision',n,'saved',true);
end $$;
create function public.submit_corporate_review(p_source text,p_graph jsonb,p_note text,p_existing text,p_expected integer,p_expected_model integer,p_update_classification text,p_learning boolean,p_review_input jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.source_items;mid text;current_model public.corporate_event_models;root jsonb;rev integer;source_rev integer;score integer;oid uuid;updating boolean;correcting boolean;doc jsonb;k record;r jsonb;old_r jsonb;field text;original jsonb;proposed jsonb;group_id text;old_learning text;
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review) then raise exception 'Reviewer access required';end if;
 select * into item from public.source_items where id=p_source for update;
 if not found or item.state not in('pending','approved') then raise exception 'Source is not editable';end if;
 if p_expected is null or item.review_version<>p_expected then raise exception 'Review changed since you opened it';end if;
 if length(coalesce(p_note,''))>1000 or length(coalesce(p_review_input::text,''))>170000 then raise exception 'Review metadata too large';end if;
 if p_update_classification is null or p_update_classification not in('UNKNOWN','MATERIAL_UPDATE','NO_MATERIAL_CHANGE') then raise exception 'Invalid update classification';end if;
 correcting=item.state='approved';if correcting and length(trim(coalesce(p_note,'')))<8 then raise exception 'Explain the correction in at least 8 characters';end if;
 perform public.ce_validate_model(p_graph);
 if not exists(select 1 from jsonb_array_elements(p_graph->'records'->'SourceDocument') s where s->>'url_or_internal_ref'=item.url and (s->>'publication_at')::timestamptz=item.published_at) then raise exception 'Review must retain the current source URL and publication time';end if;
 if not exists(select 1 from jsonb_array_elements(p_graph->'records'->'EventJurisdiction') j join lateral jsonb_array_elements(p_graph->'records'->'Claim') c on c->>'claim_id'=j->>'nexus_claim_id' where j->>'country' in('SE','NO','FI','DK','IS') and c->>'assertion_type' in('OFFICIAL_FACT','REPORTED_FACT') and c->>'review_state'='ACCEPTED') then raise exception 'Document an accepted source-supported Nordic nexus';end if;
 mid=case when correcting then item.corporate_model_id else coalesce(p_existing,'event-'||md5(item.id)) end;
 if correcting and p_existing is not null and p_existing<>mid then raise exception 'A historical correction cannot relink its event';end if;
 select * into current_model from public.corporate_event_models where model_id=mid for update;
 updating=not correcting or item.corporate_model_revision=current_model.revision;
 if updating and p_expected_model is distinct from coalesce(current_model.revision,0) then raise exception 'Event model changed in another session';end if;
 if not correcting and p_existing is not null and current_model.model_id is null then raise exception 'Unknown corporate model';end if;
 original=case when correcting then item.analysis else current_model.graph end;
 if updating then rev=public.ce_write_model(mid,p_graph,item.id);else rev=current_model.revision;end if;
 source_rev=item.review_version+1;
 insert into public.corporate_source_reviews(source_id,version,model_id,graph,previous_graph,model_revision,reviewer_id,note,review_input,update_classification,source_snapshot) values(item.id,source_rev,mid,p_graph,original,case when updating then rev else null end,auth.uid(),coalesce(p_note,''),p_review_input,p_update_classification,jsonb_build_object('headline',item.headline,'excerpt',item.excerpt,'url',item.url,'published_at',item.published_at,'observed_at',now()));
 select schema_document into doc from public.corporate_event_catalogue where version='1.0.0';
 proposed=coalesce(p_review_input->'original',original);
 for k in select * from jsonb_each(p_graph->'records') loop for r in select * from jsonb_array_elements(k.value) loop
  select old into old_r from jsonb_array_elements(coalesce(proposed->'records'->k.key,'[]')) old where old->>(doc->'schemas'->k.key->>'idField')=r->>(doc->'schemas'->k.key->>'idField');
  for field in select jsonb_object_keys(coalesce(old_r,'{}')||r) loop if old_r->field is distinct from r->field then
   insert into public.corporate_field_feedback(source_id,source_version,ontology_version,entity_type,record_id,field,proposed_value,corrected_value,reviewer_id,reason) values(item.id,source_rev,'1.0.0',k.key,r->>(doc->'schemas'->k.key->>'idField'),field,old_r->field,r->field,auth.uid(),coalesce(p_note,''));
  end if;end loop;
 end loop;end loop;
 for k in select * from jsonb_each(coalesce(proposed->'records','{}')) loop for old_r in select * from jsonb_array_elements(k.value) loop
  if not exists(select 1 from jsonb_array_elements(coalesce(p_graph->'records'->k.key,'[]')) current_record where current_record->>(doc->'schemas'->k.key->>'idField')=old_r->>(doc->'schemas'->k.key->>'idField')) then
   insert into public.corporate_field_feedback(source_id,source_version,ontology_version,entity_type,record_id,field,proposed_value,corrected_value,reviewer_id,reason) values(item.id,source_rev,'1.0.0',k.key,old_r->>(doc->'schemas'->k.key->>'idField'),'__record__',old_r,null,auth.uid(),coalesce(p_note,''));
  end if;
 end loop;end loop;
 update public.source_items set state='approved',analysis=p_graph,corporate_model_id=mid,corporate_model_revision=case when updating then rev else corporate_model_revision end,review_version=source_rev,reviewed_by=auth.uid(),reviewed_at=now() where id=item.id;
 select coalesce(max((o->>'ficc_score')::integer),0) into score from jsonb_array_elements(p_graph->'records'->'Opportunity') o;
 select e into root from jsonb_array_elements(p_graph->'records'->'CorporateEvent') e where e->>'event_id'=p_graph->>'root_event_id';
 if not correcting then
  insert into public.corporate_announcements(id,model_id,source_id,headline,url,published_at,update_classification) values(item.id,mid,item.id,item.headline,item.url,item.published_at,p_update_classification);
  if p_update_classification='MATERIAL_UPDATE' and score>=3 and item.published_at>=now()-interval '24 hours' then
   insert into public.notification_outbox(event_id,payload) values(item.id,jsonb_build_object('title',root->>'title','body',coalesce(root->>'event_type_id','Corporate event')||' · '||coalesce(root->>'lifecycle_phase','Unknown lifecycle'),'url','/?event='||mid,'expiresAt',item.published_at+interval '24 hours')) returning id into oid;
   insert into public.notification_deliveries(outbox_id,subscription_id) select oid,s.id from public.push_subscriptions s join public.pilot_members m on m.user_id=s.user_id where s.enabled and m.enabled and s.min_score<=score;
  end if;
 else update public.corporate_announcements set update_classification=p_update_classification where id=item.id;
 update public.notification_deliveries d set status='dead',last_error='Assessment corrected before delivery',lease_until=null where d.outbox_id in(select id from public.notification_outbox where event_id=item.id) and d.status in('queued','retry','sending');end if;
 if p_learning then
  select e->>'programme_id' into group_id from jsonb_array_elements(p_graph->'records'->'CorporateEvent') e where e->>'event_id'=p_graph->>'root_event_id';
  insert into public.review_feedback(source_id,reviewer_id,decision,reason,score,note,source_snapshot,analysis_snapshot,changed_fields) values(item.id,auth.uid(),case when score=0 then 'exclude' when score>=3 then 'useful' else 'not_useful' end,case when score=0 then 'other' when correcting then 'correction' else 'approved' end,nullif(score,0),coalesce(p_note,''),jsonb_build_object('headline',item.headline,'excerpt',item.excerpt,'url',item.url,'published_at',item.published_at,'programme_id',coalesce(group_id,mid),'model_id',mid,'ontology_version','1.0.0'),p_graph,coalesce((select array_agg(distinct feedback.entity_type||'.'||feedback.field) from public.corporate_field_feedback feedback where feedback.source_id=item.id and feedback.source_version=source_rev),'{}'::text[]));
  if correcting or exists(select 1 from public.learning_settings settings join public.learning_models model on model.id=settings.active_model where settings.id=1 and settings.use_learned_ranking and model.artifact->'examples' @> jsonb_build_array(jsonb_build_object('sourceId',item.id))) then
   update public.learning_settings set use_learned_ranking=false,updated_by=auth.uid(),updated_at=now() where id=1 and use_learned_ranking returning active_model into old_learning;
   if old_learning is not null then insert into public.learning_activation_log(model_id,enabled,reviewer_id) values(old_learning,false,auth.uid());end if;
  end if;
 end if;
 delete from public.corporate_review_drafts where source_id=item.id and reviewer_id=auth.uid();
 return jsonb_build_object('saved',true,'modelId',mid,'correction',correcting,'latestModelUpdated',updating,'reviewVersion',source_rev,'modelRevision',rev,'queued',oid is not null);
end $$;
'''
for table in ['corporate_source_reviews','corporate_field_feedback','corporate_announcements']:
 s+=f"alter table public.{table} enable row level security;create policy ce_member_read on public.{table} for select to authenticated using(exists(select 1 from public.pilot_members where user_id=(select auth.uid()) and enabled));revoke all on public.{table} from public,anon,authenticated;grant select on public.{table} to authenticated;\n"
s+='''alter table public.corporate_review_drafts enable row level security;
create policy ce_own_draft on public.corporate_review_drafts for select to authenticated using(reviewer_id=auth.uid() and exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled and can_review));
revoke all on public.corporate_review_drafts from public,anon,authenticated;grant select on public.corporate_review_drafts to authenticated;
revoke all on function public.save_corporate_draft(text,text,text,integer,integer,jsonb) from public,anon;grant execute on function public.save_corporate_draft(text,text,text,integer,integer,jsonb) to authenticated;
revoke all on function public.submit_corporate_review(text,jsonb,text,text,integer,integer,text,boolean,jsonb) from public,anon;grant execute on function public.submit_corporate_review(text,jsonb,text,text,integer,integer,text,boolean,jsonb) to authenticated;
-- Old schemas remain audit-only; no compatibility write routes or RPCs.
alter table public.deals rename to legacy_deals;
alter table public.deal_events rename to legacy_deal_events;
revoke all on public.legacy_deals,public.legacy_deal_events from authenticated,anon;
revoke all on function public.review_source(text,jsonb,text,boolean),public.review_source_feedback(text,jsonb,text,boolean,text,text,text),public.save_review_draft(text,text,text,jsonb,integer,integer,jsonb),public.submit_review_assessment(text,jsonb,jsonb,text,text,integer,boolean,text,jsonb) from authenticated,anon,public;
commit;
'''
f.write_text(s)
