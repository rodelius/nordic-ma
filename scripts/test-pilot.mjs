import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=mkdtempSync(join(tmpdir(),'ficc-pilot-'));
async function run(env,check){
 const data=join(root,env.APP_MODE||'unconfigured');
 const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3102','--hostname','127.0.0.1'],{env:{...process.env,VERCEL:'1',APP_MODE:'',...env,DATA_DIR:data},stdio:['ignore','ignore','ignore']});
 const request=(path,init={})=>fetch('http://127.0.0.1:3102'+path,{redirect:'manual',...init});
 try{let ready=false;for(let i=0;i<100;i++){try{await request('/api/readiness');ready=true;break;}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready);await check(request);assert(!existsSync(data),'pilot never creates a SQLite directory');}
 finally{app.kill('SIGTERM');await new Promise(r=>app.once('exit',r));}
}
try{
 await run({},async request=>{assert.equal((await request('/')).status,503);assert.equal((await request('/api/deals')).status,503);});
 await run({APP_MODE:'pilot',APP_URL:'https://pilot.example.com',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_public_key_12345',INGEST_TOKEN:'test-token'},async request=>{
 const r=await request('/');assert.equal(r.status,307);assert.equal(r.headers.get('location'),'https://pilot.example.com/login');assert.match(r.headers.get('cache-control'),/no-store/);
 const login=await request('/login');assert.equal(login.status,200);assert.match(await login.text(),/Sign in to the pilot/);
 for(const path of ['/api/corporate-events','/api/deals','/api/brief','/api/readiness','/api/push','/api/learning','/api/reviews','/api/feedback/export'])assert.equal((await request(path)).status,401,path);
 assert.equal((await request('/api/events',{method:'POST',headers:{Authorization:'Bearer test-token','Content-Type':'application/json'},body:'{}'})).status,401);
 });
 await run({APP_MODE:'pilot',PILOT_STAGE:'2',APP_URL:'https://pilot.example.com',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_public_key_12345',CRON_SECRET:'S'.repeat(40),MONITORING_ENABLED:'false',NOTIFICATIONS_ENABLED:'false'},async request=>{
 assert.equal((await request('/api/pilot')).status,401);
 assert.equal((await request('/api/jobs/run')).status,401);
 const job=await request('/api/jobs/run',{headers:{Authorization:'Bearer '+'S'.repeat(40)}});assert.equal(job.status,200);const status=await job.json();assert.equal(status.scan.enabled,false);assert.equal(status.delivery.enabled,false);
 });
 console.log('Pilot HTTP gates passed: missing config fails closed, signed-out login redirect, private responses, API denial, bearer bypass denial and no SQLite fallback. Live provider sign-in is not tested.');
}finally{rmSync(root,{recursive:true,force:true});}
