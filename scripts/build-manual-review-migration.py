from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]
base=(root/'supabase/migrations/202610250007_corporate_events.sql').read_text()
schema=json.loads((root/'lib/corporate-event-schema.json').read_text())
s="-- Apply after 007. Optional task groups, core-only approval and product-aware hedge currencies.\nbegin;\n"
s+="update public.corporate_event_catalogue set schema_document=$SCHEMA$"+json.dumps(schema,separators=(',',':'))+"$SCHEMA$::jsonb where version='1.0.0';\n"
def fn(name):
 match=re.search(r'create function public\.'+name+r'\(.*?end \$\$;',base,re.S)
 if not match:raise ValueError(name)
 return match.group(0).replace('create function public.','create or replace function public.',1)
validate=fn('ce_validate_model')
a=validate.index("    if r->>'disposition'='COMPLETED'")
b=validate.index("   end if;\n   if k.key='Hedge'",a)
validate=validate[:a]+validate[b:]
validate=validate.replace("    if r->>'status' is not null and r->>'status'<>'UNKNOWN' and coalesce(jsonb_array_length(r->'source_claim_ids'),0)=0 then raise exception 'Milestone state needs supporting claims';end if;\n",'')
validate=validate.replace("    if coalesce(jsonb_array_length(r->'supporting_claim_ids'),0)=0 then raise exception 'State transition needs claims';end if;\n",'')
validate=re.sub(r"   if k.key='Claim' and r->>'assertion_type'.*?end if;\n",'',validate)
needle="   if k.key='Hedge' then select sum"
insert="""   if k.key='Hedge' then
    if coalesce(jsonb_array_length(r->'currencies'),0)<>(select count(distinct c) from jsonb_array_elements(coalesce(r->'currencies','[]')) c) then raise exception 'Hedge currencies must be distinct';end if;
    if r->>'product' in('FX_FORWARD','FX_OPTION','CONTINGENT_FX','CROSS_CURRENCY_SWAP') and coalesce(jsonb_array_length(r->'currencies'),0)>0 and jsonb_array_length(r->'currencies')<>2 then raise exception 'FX hedge requires a base and quote currency';end if;
    if r->>'product' in('IRS','RATE_CAP','RATE_COLLAR','INFLATION_SWAP','COMMODITY_HEDGE') and coalesce(jsonb_array_length(r->'currencies'),0)>1 then raise exception 'This hedge product uses one currency';end if;
    if r->>'notional_currency' is not null and coalesce(jsonb_array_length(r->'currencies'),0)>0 and not(r->'currencies' ? (r->>'notional_currency')) then raise exception 'Notional currency must belong to hedge currencies';end if;
   end if;
"""
validate=validate.replace(needle,insert+needle)
validate=validate.replace("(r->>'waiver_permitted')::boolean is distinct from true","(r->>'waiver_permitted')::boolean=false")
validate='\n'.join(line for line in validate.splitlines() if "raise exception 'Monetary leg requires currency'" not in line and "raise exception 'Exposure notional requires currency'" not in line)
validate=validate.replace("and not exists(select 1 from jsonb_array_elements(g->'records'->'Hedge') h where h->>'hedge_id'=r->>'hedge_id' and h->>'notional_currency'=r->>'currency')","and exists(select 1 from jsonb_array_elements(g->'records'->'Hedge') h where h->>'hedge_id'=r->>'hedge_id' and h->>'notional_currency' is not null and r->>'currency' is not null and h->>'notional_currency'<>r->>'currency')")
validate=validate.replace("if r->>'estimate_unit' is distinct from 'PROBABILITY' then","if r->>'estimate_unit' is not null and r->>'estimate_unit'<>'PROBABILITY' then")
validate=validate.replace("where a->>'hedge_id'=r->>'hedge_id';if total","where a->>'hedge_id'=r->>'hedge_id' and a->>'currency'=r->>'notional_currency';if total")
s+=validate+'\n'
submit=fn('submit_corporate_review')
submit='\n'.join(line for line in submit.splitlines() if "raise exception 'Document an accepted source-supported Nordic nexus'" not in line)
submit=submit.replace(" perform public.ce_validate_model(p_graph);", " perform public.ce_validate_model(p_graph);\n if exists(select 1 from jsonb_array_elements(p_graph->'records'->'CorporateEvent') event where coalesce(event->>'event_type_id','')='' or coalesce(event->>'lifecycle_phase','')='' or coalesce(event->>'disposition','')='') then raise exception 'Event type, lifecycle phase and disposition are required';end if;")
s+=submit+"\ninsert into public.monitor_state(key,value) values('manual_review_version','1') on conflict(key) do update set value=excluded.value;\ncommit;\n"
(root/'supabase/migrations/202610250008_manual_review.sql').write_text(s)
