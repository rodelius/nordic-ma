import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pilotMode,pilotConfig } from '../lib/pilot-config';
import { authorized } from '../lib/auth';
import { pushEnabled } from '../lib/push';
test('hosted deployment fails closed without explicit pilot mode and HTTPS configuration',()=>{
 assert.equal(pilotMode({}),'demo');assert.throws(()=>pilotMode({VERCEL:'1'}));assert.throws(()=>pilotMode({APP_MODE:'unknown'}));
 const config={APP_MODE:'pilot',APP_URL:'https://pilot.example.com',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_public_key_12345'};
 assert.equal(pilotConfig(config).appUrl,'https://pilot.example.com');
 assert.throws(()=>pilotConfig({...config,SUPABASE_PUBLISHABLE_KEY:''}));
 assert.throws(()=>pilotConfig({...config,SUPABASE_PUBLISHABLE_KEY:'sb_secret_test_secret_key_12345'}));
 assert.throws(()=>pilotConfig({...config,APP_URL:'http://pilot.example.com'}));
 assert.throws(()=>pilotConfig({...config,APP_URL:'https://attacker@example.com'}));
 assert.throws(()=>pilotConfig({...config,SUPABASE_URL:'https://project.supabase.co/path'}));
});
test('pilot disables legacy bearer writes and push even with configured demo credentials',()=>{
 const old={...process.env};try{process.env.APP_MODE='pilot';process.env.INGEST_TOKEN='test-only';process.env.VAPID_PUBLIC_KEY='test';process.env.VAPID_PRIVATE_KEY='test';process.env.VAPID_SUBJECT='mailto:test@example.com';
 assert.equal(authorized(new Request('https://pilot.example.com/api/events',{headers:{Authorization:'Bearer test-only'}})),false);assert.equal(pushEnabled(),false);
 }finally{process.env=old;}
});
test('PostgreSQL migration enforces invited reads, revocation, no client writes and no synthetic seed',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
 await db.exec(await readFile(new URL('../supabase/migrations/202610240001_pilot_foundation.sql',import.meta.url),'utf8'));
 assert.equal((await db.query('select * from public.deals')).rows.length,0);
 await assert.rejects(db.query(`insert into public.deals(id,body) values ('bad','{"id":"bad","synthetic":true}')`));
 await assert.rejects(db.query(`insert into public.deals(id,body) values ('missing','{}')`));
 await db.exec(`insert into public.pilot_members(user_id) values ('00000000-0000-0000-0000-000000000001');
 insert into public.deals(id,body) values ('one','{"id":"one","synthetic":false}');
 set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';`);
 assert.equal((await db.query('select * from public.deals')).rows.length,1);
 assert.equal((await db.query('select * from public.pilot_members')).rows.length,1);
 await assert.rejects(db.exec(`insert into public.deals values ('two','{"id":"two","synthetic":false}',now())`));
 await assert.rejects(db.exec('update public.pilot_members set enabled=false'));
 await db.exec(`set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'`);
 assert.equal((await db.query('select * from public.deals')).rows.length,0);
 assert.equal((await db.query('select * from public.pilot_members')).rows.length,0);
 await db.exec(`reset role; update public.pilot_members set enabled=false; set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'`);
 assert.equal((await db.query('select * from public.deals')).rows.length,0);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.deals'));
 }finally{await db.close();}
});
