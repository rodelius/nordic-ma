from pathlib import Path
import json,re
p=Path(__file__).resolve().parents[1];schema=json.loads((p/'lib/corporate-event-schema.json').read_text());cat=json.loads((p/'reference/corporate-event/corporate_event_catalogue.json').read_text())
s='''-- Corporate-event ontology 1.0.0. Apply after 006. Breaking active-model cutover; prior data is archived.
begin;
create table public.corporate_event_catalogue(version text primary key,schema_document jsonb not null,catalogue jsonb not null);
'''
s+="insert into public.corporate_event_catalogue values('1.0.0',$CE_SCHEMA$"+json.dumps(schema,separators=(',',':'))+"$CE_SCHEMA$::jsonb,$CE_CATALOGUE$"+json.dumps(cat,separators=(',',':'))+"$CE_CATALOGUE$::jsonb);\n"
s+='''
create table public.corporate_event_models(
 model_id text primary key references public.deals(id),ontology_version text not null references public.corporate_event_catalogue(version),
 graph jsonb not null,revision integer not null default 1,updated_at timestamptz not null default now()
);
create table public.corporate_event_records(
 model_id text not null references public.corporate_event_models(model_id),kind text not null,record_id text not null,body jsonb not null,
 primary key(model_id,record_id)
);
create index corporate_record_kind on public.corporate_event_records(kind,model_id);
create index corporate_record_data on public.corporate_event_records using gin(body);
create table public.corporate_event_revisions(
 id bigint generated always as identity primary key,model_id text not null references public.corporate_event_models(model_id),
 revision integer not null,previous_graph jsonb,graph jsonb not null,actor uuid references auth.users(id),source_id text,
 recorded_at timestamptz not null default clock_timestamp(),unique(model_id,revision)
);
'''
for table in ['corporate_event_catalogue','corporate_event_models','corporate_event_records','corporate_event_revisions']:
 s+=f'''alter table public.{table} enable row level security;
create policy ce_member_read on public.{table} for select to authenticated using(exists(select 1 from public.pilot_members where user_id=(select auth.uid()) and enabled));
revoke all on public.{table} from public,anon,authenticated;
grant select on public.{table} to authenticated;
'''
s+='''
create function public.ce_ref_exists(g jsonb,identifier text,expected text default null) returns boolean language sql stable set search_path=pg_catalog,public as $$
 select exists(select 1 from jsonb_each(g->'records') k cross join lateral jsonb_array_elements(k.value) r
 where (expected is null or k.key=expected) and r->>((select schema_document->'schemas'->k.key->>'idField' from public.corporate_event_catalogue where version='1.0.0'))=identifier)
 or (expected='MilestoneDefinition' and exists(select 1 from public.corporate_event_catalogue c cross join lateral jsonb_array_elements(c.catalogue->'event_templates') t cross join lateral jsonb_array_elements(t->'illustrative_milestones') m where c.version='1.0.0' and m->>'milestone_definition_id'=identifier));
$$;
create function public.ce_check_field(v jsonb,spec jsonb,r jsonb,g jsonb,doc jsonb) returns void language plpgsql set search_path=pg_catalog,public as $$
declare typ text=spec->>'type'; value text; child jsonb; n numeric;
begin
 if v is null or v='null'::jsonb then if coalesce((spec->>'required')::boolean,false) then raise exception 'Required corporate-event field missing'; end if;return;end if;
 value=v#>>'{}';
 if typ='id' then if jsonb_typeof(v)<>'string' or value!~'^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$' then raise exception 'Invalid corporate record ID';end if;
 elsif typ in('ref','any_ref') then if jsonb_typeof(v)<>'string' or not public.ce_ref_exists(g,value,case when typ='ref' then spec->>'ref' else null end) then raise exception 'Missing or wrongly typed corporate reference: %',value;end if;
 elsif typ='enum' then if jsonb_typeof(v)<>'string' or not(doc->'enums'->(spec->>'enum') ? value) then raise exception 'Invalid corporate enum %: %',spec->>'enum',value;end if;
 elsif typ='workstream_status' then if jsonb_typeof(v)<>'string' or not coalesce(doc->'workstreams'->(r->>'workstream_type') ? value,false) then raise exception 'State does not belong to workstream';end if;
 elsif typ='array' then
  if jsonb_typeof(v)<>'array' or jsonb_array_length(v)>200 then raise exception 'Invalid corporate array';end if;
  for child in select * from jsonb_array_elements(v) loop perform public.ce_check_field(child,jsonb_build_object('type',spec->>'items','ref',spec->>'ref','enum',spec->>'enum','required',true),r,g,doc);end loop;
 elsif typ in('decimal','percentage','probability') then
  if jsonb_typeof(v)<>'string' or value!~'^-?(0|[1-9][0-9]{0,19})(\\.[0-9]{1,18})?$' then raise exception 'Exact decimal strings required';end if;n=value::numeric;
  if typ='percentage' and (n<0 or n>100) or typ='probability' and (n<0 or n>1) then raise exception 'Invalid bounded decimal';end if;
 elsif typ in('integer','score') then if jsonb_typeof(v)<>'number' or value::numeric<>trunc(value::numeric) or value::numeric<(case when typ='score' then 1 else 0 end) or value::numeric>(case when typ='score' then 5 else 9007199254740991 end) then raise exception 'Invalid integer / score';end if;
 elsif typ='boolean' then if jsonb_typeof(v)<>'boolean' then raise exception 'Invalid boolean';end if;
 elsif typ in('country','currency') then if jsonb_typeof(v)<>'string' or not(doc->'enums'->(case when typ='country' then 'iso_countries' else 'iso_currencies' end) ? value) then raise exception 'Invalid ISO country/currency';end if;
 elsif typ='datetime' then
  if jsonb_typeof(v)<>'string' then raise exception 'Invalid date';end if;
  if r->>'date_precision'='QUARTER' then if value!~'^[0-9]{4}-Q[1-4]$' then raise exception 'Invalid quarter precision';end if;return;end if;
  if r->>'date_precision'='MONTH' then if value!~'^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Invalid month precision';end if;return;end if;
  if value!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,3})?(Z|[+-][0-9]{2}:[0-9]{2}))?$' then raise exception 'Invalid ISO date or precision';end if;perform value::timestamptz;
 elsif typ='json' then if length(v::text)>16000 then raise exception 'Corporate value too large';end if;
 else if jsonb_typeof(v)<>'string' or length(value)>4000 then raise exception 'Invalid corporate text';end if;
 end if;
end $$;
create function public.ce_validate_model(g jsonb) returns void language plpgsql set search_path=pg_catalog,public as $$
declare doc jsonb;k record;r jsonb;f record;identifier text;ids text[]='{}';root_found boolean=false;ev jsonb;claim jsonb;definition jsonb;support boolean;total numeric;other jsonb;
begin
 select schema_document into doc from public.corporate_event_catalogue where version='1.0.0';
 if jsonb_typeof(g)<>'object' or g->>'ontology_version' is distinct from '1.0.0' or jsonb_typeof(g->'records') is distinct from 'object' or length(g::text)>170000 then raise exception 'Invalid corporate-event model / ontology';end if;
 if exists(select 1 from jsonb_object_keys(g) key where key not in('ontology_version','root_event_id','records','legacy_fields')) then raise exception 'Unknown model field';end if;
 for k in select * from jsonb_each(g->'records') loop
  definition=doc->'schemas'->k.key;if definition is null or jsonb_typeof(k.value)<>'array' or jsonb_array_length(k.value)>200 then raise exception 'Unknown or oversized corporate collection';end if;
  for r in select * from jsonb_array_elements(k.value) loop
   if jsonb_typeof(r)<>'object' then raise exception 'Invalid corporate record';end if;
   identifier=r->>(definition->>'idField');if identifier is null or identifier=any(ids) then raise exception 'Duplicate or missing corporate ID';end if;ids=array_append(ids,identifier);
   if k.key='CorporateEvent' and identifier=g->>'root_event_id' then root_found=true;end if;
   if exists(select 1 from jsonb_object_keys(r) key where not(definition->'fields' ? key)) then raise exception 'Unknown corporate field';end if;
   for f in select * from jsonb_each(definition->'fields') loop perform public.ce_check_field(r->f.key,f.value,r,g,doc);end loop;
   if k.key='MilestoneOccurrence' then
    select m into other from public.corporate_event_catalogue c cross join lateral jsonb_array_elements(c.catalogue->'event_templates') t cross join lateral jsonb_array_elements(t->'illustrative_milestones') m where c.version='1.0.0' and m->>'milestone_definition_id'=r->>'milestone_definition_id' limit 1;
    if other is not null and not exists(select 1 from public.corporate_event_catalogue c cross join lateral jsonb_array_elements(c.catalogue->'event_templates') t cross join lateral jsonb_array_elements(t->'illustrative_milestones') m cross join lateral jsonb_array_elements(g->'records'->'CorporateEvent') event where c.version='1.0.0' and event->>'event_id'=r->>'event_id' and t->>'event_type_id'=event->>'event_type_id' and m->>'milestone_definition_id'=r->>'milestone_definition_id') then raise exception 'Milestone template mismatch';end if;
    if r->>'status' is not null and r->>'status'<>'UNKNOWN' and coalesce(jsonb_array_length(r->'source_claim_ids'),0)=0 then raise exception 'Milestone state needs supporting claims';end if;
   end if;
   if k.key='Condition' and r->>'state'='WAIVED' and (r->>'waiver_permitted')::boolean is distinct from true then raise exception 'Condition waiver is not permitted';end if;
   if k.key='EconomicLeg' then
    if (r->>'amount_min')::numeric<0 or (r->>'amount_base')::numeric<0 or (r->>'amount_max')::numeric<0 or (r->>'amount_min')::numeric>(r->>'amount_base')::numeric or (r->>'amount_base')::numeric>(r->>'amount_max')::numeric or (r->>'amount_min')::numeric>(r->>'amount_max')::numeric then raise exception 'Invalid economic amount range';end if;
   end if;
   if k.key='EventRelationship' and r->>'from_event_id'=r->>'to_event_id' then raise exception 'Self relationship';end if;
   if k.key='ClaimSupport' and not public.ce_ref_exists(g,r->>'target_id',r->>'target_type') then raise exception 'Claim support type mismatch';end if;
   if k.key='Claim' and r->>'assertion_type' is not null and (r->>'source_id' is null or coalesce(r->>'predicate','')='' or not(r ? 'value')) then raise exception 'Incomplete claim';end if;
   if k.key='Forecast' and r->>'target'='COMPLETION_PROBABILITY' then
    if r->>'estimate_unit' is distinct from 'PROBABILITY' then raise exception 'Probability requires its own unit';end if;
    perform public.ce_check_field(r->'estimate','{"type":"probability"}',r,g,doc);perform public.ce_check_field(r->'low','{"type":"probability"}',r,g,doc);perform public.ce_check_field(r->'high','{"type":"probability"}',r,g,doc);
   end if;
   if k.key='CorporateEvent' then
    if r->>'model_version' is not null and r->>'model_version'<>'1.0.0' then raise exception 'Event version mismatch';end if;
    if r->>'disposition'='COMPLETED' or r->>'lifecycle_phase'='COMPLETION' or r->>'actual_completion_at' is not null then
     select exists(select 1 from jsonb_array_elements(g->'records'->'ClaimSupport') s join lateral jsonb_array_elements(g->'records'->'Claim') c on c->>'claim_id'=s->>'claim_id' where s->>'target_id'=r->>'event_id' and c->>'predicate'='EVENT_COMPLETION' and c->>'assertion_type' in('OFFICIAL_FACT','REPORTED_FACT') and c->>'review_state'='ACCEPTED' and c->'value' in('true'::jsonb,'"COMPLETED"'::jsonb)) into support;
     if not support then raise exception 'Completion requires an accepted event_completion claim';end if;
     if exists(select 1 from jsonb_array_elements(g->'records'->'Condition') c where c->>'event_id'=r->>'event_id' and coalesce(c->>'state','UNKNOWN') not in('SATISFIED','WAIVED','NOT_APPLICABLE')) then raise exception 'Outstanding conditions prevent completion';end if;
    end if;
   end if;
   if k.key='Hedge' then select sum((a->>'allocated_notional')::numeric) into total from jsonb_array_elements(g->'records'->'HedgeExposureAllocation') a where a->>'hedge_id'=r->>'hedge_id';if total>(r->>'notional')::numeric then raise exception 'Hedge over-allocation';end if;end if;
  end loop;
 end loop;
 if not root_found or cardinality(ids)>500 then raise exception 'Missing root or oversized model';end if;
end $$;
'''
# Legacy seed is intentionally unclassified; no guessed legs, currencies or state assertions.
s+='''
create function public.ce_legacy_model(d jsonb) returns jsonb language plpgsql stable set search_path=pg_catalog,public as $$
declare records jsonb='{}';k text;claims jsonb='[]';e jsonb;i integer=0;party_role text;party_name text;party_id text;
begin
 for k in select jsonb_object_keys(schema_document->'schemas') from public.corporate_event_catalogue where version='1.0.0' loop records=jsonb_set(records,array[k],'[]');end loop;
 records=jsonb_set(records,'{CorporateEvent}',jsonb_build_array(jsonb_build_object('event_id','event-main','title',coalesce(nullif(d->>'target',''),d->'source'->>'headline','Unclassified corporate event'),'event_type_id',null,'lifecycle_phase',null,'disposition',null,'outcome','UNKNOWN','model_version','1.0.0')));
 foreach party_role in array array['BUYER','SELLER','TARGET'] loop
  party_name=d->>lower(party_role);if coalesce(trim(party_name),'')<>'' and lower(trim(party_name)) not in('unknown','undisclosed','unconfirmed','unclear') then
   party_id='legacy-'||lower(party_role);
   records=jsonb_set(records,'{Entity}',records->'Entity'||jsonb_build_array(jsonb_build_object('entity_id',party_id,'legal_name',party_name)));
   records=jsonb_set(records,'{EventParty}',records->'EventParty'||jsonb_build_array(jsonb_build_object('event_party_id','party-'||party_id,'event_id','event-main','entity_id',party_id,'role',party_role)));
  end if;
 end loop;
 if d->'source' is not null then
  records=jsonb_set(records,'{SourceDocument}',jsonb_build_array(jsonb_build_object('source_id','source-current','url_or_internal_ref',d->'source'->>'url','publication_at',d->'source'->>'timestamp','source_type','UNKNOWN')));
  records=jsonb_set(records,'{EventSource}','[{"event_source_id":"event-source","event_id":"event-main","source_id":"source-current"}]');
  for e in select * from jsonb_array_elements(coalesce(d->'evidence','[]')) loop if e->>'kind'<>'Unknown' and coalesce(e->>'value','')<>'' then claims=claims||jsonb_build_array(jsonb_build_object('claim_id','legacy-claim-'||i,'source_id','source-current','subject_id','event-main','predicate','OTHER','value',jsonb_build_object('legacy_label',e->>'label','legacy_value',e->'value'),'assertion_type',case when e->>'kind'='Fact' then 'REPORTED_FACT' else 'ANALYST_INFERENCE' end,'review_state','LEGACY_IMPORTED','effective_at',null,'observed_at',null,'evidence_excerpt',null));i=i+1;end if;end loop;
  records=jsonb_set(records,'{Claim}',claims);
 end if;
 return jsonb_build_object('ontology_version','1.0.0','root_event_id','event-main','records',records,'legacy_fields',jsonb_build_object('stage',d->'stage','confidence',d->'confidence','ficc_score',d->'score','classification',d->'classification','pair',d->'pair','notional',d->'notional','angle',d->'angle','rates',d->'rates','rationale',d->'rationale','action',d->'action','note','Legacy assertions retained without inferring lifecycle, economic legs, completion or exposure.'));
end $$;
create function public.ce_sync_deal() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare g jsonb;old_graph jsonb;rev integer;k record;r jsonb;doc jsonb;identifier text;
begin
 select graph,revision into old_graph,rev from public.corporate_event_models where model_id=new.id for update;
 g=coalesce(nullif(new.body->'corporateEvent','null'::jsonb),old_graph,public.ce_legacy_model(new.body));
 if old_graph=g then return new;end if;
 perform public.ce_validate_model(g);
 rev=coalesce(rev,0)+1;
 insert into public.corporate_event_models(model_id,ontology_version,graph,revision) values(new.id,'1.0.0',g,rev)
 on conflict(model_id) do update set graph=excluded.graph,revision=excluded.revision,updated_at=now();
 select schema_document into doc from public.corporate_event_catalogue where version='1.0.0';
 delete from public.corporate_event_records where model_id=new.id;
 for k in select * from jsonb_each(g->'records') loop for r in select * from jsonb_array_elements(k.value) loop identifier=r->>(doc->'schemas'->k.key->>'idField');insert into public.corporate_event_records values(new.id,k.key,identifier,r);end loop;end loop;
 insert into public.corporate_event_revisions(model_id,revision,previous_graph,graph,actor,source_id) values(new.id,rev,old_graph,g,auth.uid(),new.body->'source'->>'url');
 return new;
end $$;
create trigger ce_deal_model after insert or update of body on public.deals for each row execute function public.ce_sync_deal();
-- Backfill without altering deal bodies or their review/notification histories.
do $$declare d record;begin for d in select id,body from public.deals loop update public.deals set body=body where id=d.id;end loop;end $$;
'''
# Queryable typed views, keeping exact amounts numeric and date precision as text.
for kind,definition in schema['schemas'].items():
 name='ce_'+re.sub(r'(?<!^)(?=[A-Z])','_',kind).lower();cols=['model_id']
 for field,spec in definition['fields'].items():
  typ=spec['type'];expr=f"body->'{field}'" if typ in ['array','json'] else f"body->>'{field}'"
  if typ in ['decimal','probability','percentage']:expr=f'({expr})::numeric'
  if typ in ['integer','score']:expr=f'({expr})::bigint'
  if typ=='boolean':expr=f'({expr})::boolean'
  cols.append(expr+' as "'+field+'"')
 s+=f"create view public.{name} with(security_invoker=true) as select "+', '.join(cols)+f" from public.corporate_event_records where kind='{kind}';\nrevoke all on public.{name} from public,anon;grant select on public.{name} to authenticated;\n"
for signature in ['ce_ref_exists(jsonb,text,text)','ce_check_field(jsonb,jsonb,jsonb,jsonb,jsonb)','ce_validate_model(jsonb)','ce_legacy_model(jsonb)','ce_sync_deal()']:
 s+=f'revoke all on function public.{signature} from public,anon,authenticated;\n'
s+="insert into public.monitor_state(key,value) values('corporate_event_ontology','1.0.0') on conflict(key) do update set value=excluded.value;\ncommit;\n"
(p/'supabase/migrations/202610250007_corporate_events.sql').write_text(s)
