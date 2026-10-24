import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {parseFeed} from '../lib/source-feed';
import {validateSubscription} from '../lib/push-subscription';
import {jobsAuthorized,livePushReady,monitoringEnabled} from '../lib/live-config';
import {seed} from '../lib/seed';
const uid='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
test('RSS deduplicates, decodes and filters old, future, foreign and non-M&A items',()=>{
 const now=Date.now(),date=new Date(now-1000).toUTCString();const item=(title:string,link='https://news.cision.com/addtech/r/acquisition,c123',pub=date)=>`<item><title>${title}</title><link>${link}</link><pubDate>${pub}</pubDate><description><![CDATA[<p>A source excerpt</p>]]></description></item>`;
 const xml=`<rss><channel>${item('Addtech acquires A &amp; B')}${item('Addtech acquires A &amp; B')}${item('Quarterly report')}${item('Acquisition','https://evil.example/x')}${item('Acquisition',undefined,'Sat, 01 Jan 2000 00:00:00 GMT')}${item('Acquisition',undefined,new Date(now+86400000).toUTCString())}</channel></rss>`;
 const rows=parseFeed(xml,now);assert.equal(rows.length,1);assert.equal(rows[0].headline,'Addtech acquires A & B');assert.equal(rows[0].excerpt,'A source excerpt');
 assert.throws(()=>parseFeed('<!DOCTYPE rss [<!ENTITY x "boom">]><rss/>'));
 assert.throws(()=>parseFeed('<rss>'));assert.throws(()=>parseFeed('<html><body>Not a feed</body></html>'));
});
test('push validation rejects SSRF destinations and invalid keys',()=>{
 const keys={p256dh:'A'.repeat(87),auth:'B'.repeat(22)};assert.equal(validateSubscription({endpoint:'https://web.push.apple.com/token',keys}).keys.auth,keys.auth);
 for(const endpoint of ['http://web.push.apple.com/token','https://web.push.apple.com.evil.test/token','https://127.0.0.1/token','https://user@web.push.apple.com/token'])assert.throws(()=>validateSubscription({endpoint,keys}));
 assert.throws(()=>validateSubscription({endpoint:'https://fcm.googleapis.com/token',keys:{p256dh:'bad',auth:'bad'}}));
});
test('collection and delivery default off; cron requires an exact long bearer secret',()=>{
 const old={...process.env};try{process.env.APP_MODE='pilot';process.env.PILOT_STAGE='2';delete process.env.MONITORING_ENABLED;delete process.env.NOTIFICATIONS_ENABLED;process.env.CRON_SECRET='S'.repeat(40);
 assert.equal(livePushReady(),false);assert.equal(monitoringEnabled(),false);
 assert.equal(jobsAuthorized(new Request('https://example.com/api/jobs/run')),false);
 assert.equal(jobsAuthorized(new Request('https://example.com/api/jobs/run',{headers:{Authorization:'Bearer '+'S'.repeat(40)}})),true);
 }finally{process.env=old;}
});
test('review transaction and outbox are atomic, scoped, idempotent and leased',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;insert into auth.users values('${uid}'),('${other}');`);
 for(const file of ['202610240001_pilot_foundation.sql','202610240002_live_pilot.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec(`insert into public.pilot_members(user_id,can_review) values('${uid}',true),('${other}',false);
 insert into public.push_subscriptions(user_id,endpoint,keys) values('${uid}','https://web.push.apple.com/one','{"p256dh":"key","auth":"key"}'),('${other}','https://web.push.apple.com/two','{"p256dh":"key","auth":"key"}');`);
 const published=new Date().toISOString();
 await db.query(`insert into public.source_items(id,headline,url,published_at,excerpt,source) values('source-1','Acquisition','https://news.cision.com/addtech/r/acquisition',$1,'Evidence excerpt','Addtech')`,[published]);
 const deal={...seed[0],synthetic:false,source:{headline:'Acquisition',url:'https://news.cision.com/addtech/r/acquisition',timestamp:published}};
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${other}'`);
 await assert.rejects(db.query('select public.review_source($1,$2)', ['source-1',JSON.stringify(deal)]));
 await assert.rejects(db.query('select * from public.claim_deliveries(5)'));
 assert.equal((await db.query('select * from public.push_subscriptions')).rows.length,1);
 await db.exec(`set request.jwt.claim.sub='${uid}'`);
 await assert.rejects(db.query('select public.review_source($1,$2)', ['source-1',JSON.stringify({...deal,source:{...deal.source,url:'https://evil.test'}})]));
 assert.equal((await db.query<{state:string}>(`select state from public.source_items where id='source-1'`)).rows[0].state,'pending');
 const approved=(await db.query<{result:{material:boolean;dealId:string;queued:boolean}}>('select public.review_source($1,$2) as result',['source-1',JSON.stringify(deal)])).rows[0].result;
 assert.equal(approved.material,true);assert.equal(approved.queued,true);
 const duplicate=(await db.query<{result:{duplicate:boolean}}>('select public.review_source($1,$2) as result',['source-1',JSON.stringify(deal)])).rows[0].result;assert.equal(duplicate.duplicate,true);
 await db.exec('reset role');
 await db.query(`insert into public.source_items(id,headline,url,published_at,excerpt,source) values('rollback-source','Rollback fixture','https://news.cision.com/addtech/r/acquisition',$1,'excerpt','Addtech')`,[published]);
 await db.query(`insert into public.deal_events(id,deal_id,body) values('rollback-source',$1,jsonb_build_object('id','rollback-source','dealId',$1::text))`,[approved.dealId]);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${uid}'`);
 await assert.rejects(db.query('select public.review_source($1,$2,$3)',['rollback-source',JSON.stringify({...deal,delta:'This change must roll back'}),approved.dealId]));
 assert.equal((await db.query<{state:string}>(`select state from public.source_items where id='rollback-source'`)).rows[0].state,'pending');
 assert.equal((await db.query<{body:{delta:string}}>('select body from public.deals where id=$1',[approved.dealId])).rows[0].body.delta,deal.delta);
 await db.exec(`reset role;delete from public.deal_events where id='rollback-source';delete from public.source_items where id='rollback-source'`);
 assert.equal((await db.query('select * from public.notification_outbox')).rows.length,1);assert.equal((await db.query('select * from public.notification_deliveries')).rows.length,2);
 await db.exec('set role service_role');const claimed=await db.query<{id:string;lease_token:string}>('select * from public.claim_deliveries(5)');assert.equal(claimed.rows.length,2);assert.equal((await db.query('select * from public.claim_deliveries(5)')).rows.length,0);
 await db.exec(`reset role;update public.notification_deliveries set lease_until=now()-interval '1 minute';set role service_role`);const reclaimed=await db.query<{id:string;lease_token:string;attempts:number}>('select * from public.claim_deliveries(5)');assert.equal(reclaimed.rows.length,2);assert.notEqual(reclaimed.rows[0].lease_token,claimed.rows[0].lease_token);assert.equal(reclaimed.rows[0].attempts,2);
 await db.exec(`reset role;update public.notification_deliveries set attempts=6,lease_until=now()-interval '1 minute';set role service_role`);assert.equal((await db.query('select * from public.claim_deliveries(5)')).rows.length,0);
 await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid}'`);
 await db.query('select public.queue_test_alert()');await db.query('select public.queue_test_alert()');
 await db.exec('reset role');assert.equal((await db.query(`select * from public.notification_outbox where event_id like 'test:%'`)).rows.length,1);
 assert.equal((await db.query(`select * from public.notification_deliveries where status='dead'`)).rows.length,2);
 // New source attached to a closed deal is retained but does not reopen or alert.
 await db.query(`update public.deals set body=body||'{"status":"Closed"}' where id=$1`,[approved.dealId]);
 await db.query(`insert into public.source_items(id,headline,url,published_at,excerpt,source) values('source-2','Followup','https://news.cision.com/addtech/r/acquisition',$1,'excerpt','Addtech')`,[published]);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${uid}'`);
 const closed=(await db.query<{result:{material:boolean}}>('select public.review_source($1,$2,$3) as result',['source-2',JSON.stringify({...deal,delta:'New update'}),approved.dealId])).rows[0].result;assert.equal(closed.material,false);
 await db.exec(`reset role;update public.pilot_members set enabled=false where user_id='${uid}';set role authenticated;set request.jwt.claim.sub='${uid}'`);
 await assert.rejects(db.query('select public.queue_test_alert()'));
 }finally{await db.close();}
});
