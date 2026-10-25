-- Apply after 008. Accept PostgreSQL microsecond timestamps without losing precision.
begin;
create or replace function public.ce_check_field(v jsonb,spec jsonb,r jsonb,g jsonb,doc jsonb) returns void language plpgsql set search_path=pg_catalog,public as $$
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
  if jsonb_typeof(v)<>'string' or value!~'^-?(0|[1-9][0-9]{0,19})(\.[0-9]{1,18})?$' then raise exception 'Exact decimal strings required';end if;n=value::numeric;
  if typ='percentage' and (n<0 or n>100) or typ='probability' and (n<0 or n>1) then raise exception 'Invalid bounded decimal';end if;
 elsif typ in('integer','score') then if jsonb_typeof(v)<>'number' or value::numeric<>trunc(value::numeric) or value::numeric<(case when typ='score' then 1 else 0 end) or value::numeric>(case when typ='score' then 5 else 9007199254740991 end) then raise exception 'Invalid integer / score';end if;
 elsif typ='boolean' then if jsonb_typeof(v)<>'boolean' then raise exception 'Invalid boolean';end if;
 elsif typ in('country','currency') then if jsonb_typeof(v)<>'string' or not(doc->'enums'->(case when typ='country' then 'iso_countries' else 'iso_currencies' end) ? value) then raise exception 'Invalid ISO country/currency';end if;
 elsif typ='datetime' then
  if jsonb_typeof(v)<>'string' then raise exception 'Invalid date';end if;
  if r->>'date_precision'='QUARTER' then if value!~'^[0-9]{4}-Q[1-4]$' then raise exception 'Invalid quarter precision';end if;return;end if;
  if r->>'date_precision'='MONTH' then if value!~'^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Invalid month precision';end if;return;end if;
  if value!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2}))?$' then raise exception 'Invalid ISO date or precision';end if;perform value::timestamptz;
 elsif typ='json' then if length(v::text)>16000 then raise exception 'Corporate value too large';end if;
 else if jsonb_typeof(v)<>'string' or length(value)>4000 then raise exception 'Invalid corporate text';end if;
 end if;
end $$;
commit;
