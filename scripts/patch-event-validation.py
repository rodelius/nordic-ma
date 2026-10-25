from pathlib import Path
p=Path(__file__).resolve().parents[1];f=p/'supabase/migrations/202610250007_corporate_events.sql';s=f.read_text()
s=s.replace('other jsonb;', 'other jsonb;choices jsonb;')
s=s.replace("c->>'predicate'='event_completion'","c->>'predicate'='EVENT_COMPLETION'")
s=s.replace("'predicate',e->>'label','value',e->'value'","'predicate','OTHER','value',jsonb_build_object('legacy_label',e->>'label,'legacy_value',e->'value')")
s=s.replace("c->>'assertion_type' in('OFFICIAL_FACT','REPORTED_FACT') and c->>'review_state'='ACCEPTED') then raise exception 'Document an accepted source-supported Nordic nexus'", "c->>'assertion_type' in('OFFICIAL_FACT','REPORTED_FACT') and c->>'review_state'='ACCEPTED' and c->>'predicate'='NORDIC_NEXUS' and c->'value' not in('null'::jsonb,'false'::jsonb,'\"\"'::jsonb)) then raise exception 'Document an accepted source-supported Nordic nexus'")
s=s.replace("'programme_id',coalesce(group_id,mid)","'programme_id',case when group_id is null then mid else mid||'/'||group_id end")
s=s.replace("if item.review_version<>p_expected then", "if p_expected is null or item.review_version<>p_expected then").replace("if coalesce(d.revision,0)<>p_draft_revision then", "if p_draft_revision is null or coalesce(d.revision,0)<>p_draft_revision then")
# Date ranges, dependent transition enums and cycle checks mirror application guards.
needle="   if k.key='Condition'"
insert="""   if k.key='StateTransition' then
    if coalesce(jsonb_array_length(r->'supporting_claim_ids'),0)=0 then raise exception 'State transition needs claims';end if;
    choices=case r->>'dimension' when 'LIFECYCLE_PHASE' then doc->'enums'->'lifecycle_phases' when 'DISPOSITION' then doc->'enums'->'dispositions' when 'OUTCOME' then doc->'enums'->'outcomes' else null end;
    if r->>'dimension'='WORKSTREAM_STATUS' then select doc->'workstreams'->(w->>'workstream_type') into choices from jsonb_array_elements(g->'records'->'WorkstreamInstance') w where w->>'workstream_id'=r->>'workstream_id';end if;
    if (r->>'new_value' is not null and not coalesce(choices ? (r->>'new_value'),false)) or (r->>'prior_value' is not null and not coalesce(choices ? (r->>'prior_value'),false)) then raise exception 'Invalid transition state';end if;
   end if;
   if k.key='Forecast' and r->>'estimate_unit' is not null then
    other=jsonb_build_object('type',case r->>'estimate_unit' when 'PROBABILITY' then 'probability' when 'DATE' then 'datetime' else 'decimal' end);
    perform public.ce_check_field(r->'estimate',other,r,g,doc);perform public.ce_check_field(r->'low',other,r,g,doc);perform public.ce_check_field(r->'high',other,r,g,doc);
   end if;
   if k.key='Claim' and r->'value' is not null and r->'value'<>'null'::jsonb then
    choices=case r->>'predicate' when 'EVENT_TYPE' then doc->'enums'->'event_types' when 'LIFECYCLE_PHASE' then doc->'enums'->'lifecycle_phases' when 'FUNDING_STATUS' then doc->'enums'->'funding_certainties' when 'MILESTONE_STATUS' then doc->'enums'->'milestone_statuses' when 'CONDITION_STATUS' then doc->'enums'->'condition_states' when 'PARTY_ROLE' then doc->'enums'->'party_roles' when 'CONSIDERATION_CURRENCY' then doc->'enums'->'iso_currencies' when 'BUYER_FUNDING_CURRENCY' then doc->'enums'->'iso_currencies' when 'SELLER_PROCEEDS_CURRENCY' then doc->'enums'->'iso_currencies' else null end;
    if choices is not null and (jsonb_typeof(r->'value')<>'string' or not(choices ? (r->>'value'))) then raise exception 'Invalid predicate value enum';end if;
    if r->>'predicate'='EVENT_COMPLETION' and jsonb_typeof(r->'value')<>'boolean' then raise exception 'Completion claim must be boolean';end if;
   end if;
   for other in select * from jsonb_array_elements('[["expected_close_start","expected_close_end"],["expected_settlement_start","expected_settlement_end"],["effective_from","effective_to"],["valid_from","valid_to"],["start_at","end_at"],["exclusivity_start","exclusivity_end"]]'::jsonb) loop
    if (r->>(other->>0))::timestamptz>(r->>(other->>1))::timestamptz then raise exception 'Inverted date window';end if;
   end loop;
   if (r->>'allocated_notional')::numeric<0 then raise exception 'Negative allocation';end if;
   if k.key='HedgeExposureAllocation' and r->>'allocated_notional' is not null and not exists(select 1 from jsonb_array_elements(g->'records'->'Hedge') h where h->>'hedge_id'=r->>'hedge_id' and h->>'notional_currency'=r->>'currency') then raise exception 'Allocation must use contract notional currency';end if;
   if k.key='EconomicLeg' and (r->>'amount_min' is not null or r->>'amount_base' is not null or r->>'amount_max' is not null) and r->>'currency' is null then raise exception 'Monetary leg requires currency';end if;
   if k.key='RiskExposure' and r->>'notional' is not null and r->>'risk_currency' is null then raise exception 'Exposure notional requires currency';end if;
   if k.key in('Hedge','RiskExposure','FundingInstrument') and ((r->>'notional')::numeric<0 or (r->>'committed_amount')::numeric<0 or (r->>'drawn_amount')::numeric<0) then raise exception 'Negative financial notional';end if;
"""
s=s.replace(needle,insert+needle)
needle=" if not root_found or cardinality(ids)>500 then"
insert=""" for f in select * from (values('EconomicLeg','leg_id','parent_leg_id'),('Claim','claim_id','supersedes_claim_id'),('MilestoneOccurrence','milestone_occurrence_id','supersedes_occurrence_id'),('StateTransition','transition_id','supersedes_transition_id')) m(kind,idkey,parentkey) loop
  if exists(with recursive edges as(select node->>f.idkey a,node->>f.parentkey b from jsonb_array_elements(g->'records'->f.kind) node where node->>f.parentkey is not null),walk(a,b,path,cycle) as(select a,b,array[a,b],a=b from edges union all select w.a,e.b,w.path||e.b,e.b=any(w.path) from walk w join edges e on e.a=w.b where not w.cycle and cardinality(w.path)<502) select 1 from walk where cycle) then raise exception 'Cyclic parent/supersession relationship';end if;
 end loop;
 if exists(with recursive edges as(select d->>'predecessor_id' a,d->>'successor_id' b from jsonb_array_elements(g->'records'->'Dependency') d),walk(a,b,path,cycle) as(select a,b,array[a,b],a=b from edges union all select w.a,e.b,w.path||e.b,e.b=any(w.path) from walk w join edges e on e.a=w.b where not w.cycle and cardinality(w.path)<502) select 1 from walk where cycle) then raise exception 'Cyclic dependency graph';end if;
"""
s=s.replace(needle,insert+needle)
# The reference dictionary leaves much factual detail free, but all state labels remain fixed.
extra=(p/'scripts/corporate-extra.sql').read_text();base=(p/'supabase/migrations/202610240006_guided_review.sql').read_text();a=base.index('create or replace function public.save_learning_model');b=base.index('-- Retain the validated',a);extra+=base[a:b].replace('ficc-cases-v2','ficc-cases-v3')
s=s.replace('commit;',extra+'\ncommit;')
f.write_text(s)
