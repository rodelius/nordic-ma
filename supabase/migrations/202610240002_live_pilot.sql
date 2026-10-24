-- Apply after 001. One shared workspace; explicit reviewer privilege is required.
begin;
alter table public.pilot_members add column can_review boolean not null default false;
create table public.source_items (
 id text primary key, headline text not null, url text not null, published_at timestamptz not null,
 excerpt text not null, source text not null, state text not null default 'pending' check(state in('pending','approved','dismissed')),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, analysis jsonb, deal_id text references public.deals(id),
 created_at timestamptz not null default now()
);
create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 endpoint text not null unique check(endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)?web\.push\.apple\.com)/[^[:space:]]+$'),
 keys jsonb not null check(jsonb_typeof(keys)='object' and keys ?& array['p256dh','auth']),
 enabled boolean not null default true, min_score integer not null default 3 check(min_score between 1 and 5), created_at timestamptz not null default now()
);
create table public.notification_outbox (
 id uuid primary key default gen_random_uuid(), event_id text unique not null,
 payload jsonb not null, created_at timestamptz not null default now()
);
create table public.notification_deliveries (
 id uuid primary key default gen_random_uuid(), outbox_id uuid not null references public.notification_outbox(id),
 subscription_id uuid not null references public.push_subscriptions(id), status text not null default 'queued' check(status in('queued','sending','retry','sent','dead')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(), lease_until timestamptz, lease_token uuid,
 last_error text, sent_at timestamptz, unique(outbox_id,subscription_id)
);
create table public.source_runs (
 id uuid primary key default gen_random_uuid(), started_at timestamptz not null default now(),
 finished_at timestamptz, fetched integer not null default 0, outcome text not null default 'running', detail text
);
alter table public.source_items enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.source_runs enable row level security;
create policy source_member_read on public.source_items for select to authenticated using(exists(select 1 from public.pilot_members where user_id=(select auth.uid()) and enabled));
create policy subscription_owner on public.push_subscriptions for all to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.pilot_members where user_id=(select auth.uid()) and enabled)) with check(user_id=(select auth.uid()) and exists(select 1 from public.pilot_members where user_id=(select auth.uid()) and enabled));
create policy delivery_owner_read on public.notification_deliveries for select to authenticated using(exists(select 1 from public.push_subscriptions s join public.pilot_members m on m.user_id=s.user_id where s.id=subscription_id and s.user_id=(select auth.uid()) and m.enabled));
create policy run_member_read on public.source_runs for select to authenticated using(exists(select 1 from public.pilot_members where user_id=(select auth.uid()) and enabled));
revoke all on public.source_items,public.push_subscriptions,public.notification_outbox,public.notification_deliveries,public.source_runs from anon,authenticated;
grant select on public.source_items,public.notification_deliveries,public.source_runs to authenticated;
grant select,insert,update,delete on public.push_subscriptions to authenticated;
grant select on public.pilot_members to service_role;
grant all on public.source_items,public.push_subscriptions,public.notification_outbox,public.notification_deliveries,public.source_runs,public.monitor_state to service_role;

create function public.review_source(p_source text,p_deal jsonb,p_existing text default null,p_dismiss boolean default false)
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

create function public.claim_deliveries(p_limit integer default 20)
returns table(id uuid,lease_token uuid,subscription_id uuid,endpoint text,keys jsonb,payload jsonb,attempts integer)
language sql security definer set search_path=pg_catalog,public as $$
 with exhausted as (
  update public.notification_deliveries d set status='dead',last_error='Retry limit reached',lease_until=null
  where d.attempts>=6 and (d.status='retry' or (d.status='sending' and d.lease_until<now())) returning d.id
 ), due as (
  select d.id from public.notification_deliveries d join public.push_subscriptions s on s.id=d.subscription_id join public.pilot_members m on m.user_id=s.user_id
  where s.enabled and m.enabled and d.attempts<6 and ((d.status in('queued','retry') and d.next_attempt_at<=now()) or (d.status='sending' and d.lease_until<now()))
  order by d.next_attempt_at for update of d skip locked limit greatest(1,least(p_limit,20))
 ), claimed as (
  update public.notification_deliveries d set status='sending',attempts=d.attempts+1,lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid()
  from due where d.id=due.id returning d.*
 ) select c.id,c.lease_token,c.subscription_id,s.endpoint,s.keys,o.payload,c.attempts from claimed c join public.push_subscriptions s on s.id=c.subscription_id join public.notification_outbox o on o.id=c.outbox_id;
$$;
revoke all on function public.claim_deliveries(integer) from public,anon,authenticated;
grant execute on function public.claim_deliveries(integer) to service_role;
create function public.queue_test_alert() returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare oid uuid; eid text; n integer;
begin
 if not exists(select 1 from public.pilot_members where user_id=auth.uid() and enabled) then raise exception 'Pilot access required'; end if;
 eid='test:'||auth.uid()::text||':'||date_trunc('minute',now())::text;
 insert into public.notification_outbox(event_id,payload) values(eid,jsonb_build_object('title','TEST · Nordic FICC','body','Delivery test only. No transaction or FICC recommendation.','url','/','expiresAt',now()+interval '1 hour'))
 on conflict(event_id) do update set event_id=excluded.event_id returning id into oid;
 insert into public.notification_deliveries(outbox_id,subscription_id) select oid,id from public.push_subscriptions where user_id=auth.uid() and enabled on conflict do nothing;
 select count(*) into n from public.notification_deliveries where outbox_id=oid;
 return jsonb_build_object('queued',n,'test',true);
end $$;
revoke all on function public.queue_test_alert() from public,anon;
grant execute on function public.queue_test_alert() to authenticated;
update public.monitor_state set value='stage-2' where key='foundation_version';
commit;
