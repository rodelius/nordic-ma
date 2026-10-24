-- Apply after migration 002, including if its earlier Addtech version was already installed.
begin;
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
  did='deal-'||md5(lower(trim(p_deal->>'target'))||'|'||lower(trim(p_deal->>'buyer'))||'|'||lower(trim(p_deal->>'seller')));
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
  insert into public.notification_outbox(event_id,payload) values(item.id,jsonb_build_object('title',(p_deal->>'target')||' · '||result_status,'body',p_deal->>'delta','url','/?deal='||did,'expiresAt',item.published_at+interval '24 hours')) returning id into oid;
  insert into public.notification_deliveries(outbox_id,subscription_id)
   select oid,s.id from public.push_subscriptions s join public.pilot_members m on m.user_id=s.user_id
   where s.enabled and m.enabled and s.min_score<=(p_deal->>'score')::integer;
 end if;
 return jsonb_build_object('duplicate',false,'material',material,'dealId',did,'queued',oid is not null);
end $$;
revoke all on function public.review_source(text,jsonb,text,boolean) from public,anon;
grant execute on function public.review_source(text,jsonb,text,boolean) to authenticated;

insert into public.monitor_state(key,value) values('source_provider','cision') on conflict(key) do update set value=excluded.value;
commit;
