import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
const data=mkdtempSync(join(tmpdir(),'ficc-api-')),token=randomBytes(24).toString('hex');
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3101','--hostname','127.0.0.1'],{env:{...process.env,DATA_DIR:data,INGEST_TOKEN:token,AI_API_KEY:'',VAPID_PUBLIC_KEY:'',VAPID_PRIVATE_KEY:''},stdio:['ignore','ignore','ignore']});
const url='http://127.0.0.1:3101';
try{
 let ready=false;for(let i=0;i<50;i++){try{ready=(await fetch(url+'/api/deals')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready,'test server started');
 const post=(path,body,auth=true)=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 assert.equal((await post('/api/events',{},false)).status,401);
 assert.equal((await post('/api/analyze',{})).status,503);
 let event={dealId:'alpha',headline:'API test event',delta:'New financing commitment under review',stage:'Financing',timestamp:new Date().toISOString(),sourceUrl:'https://example.com/test-release',type:'Financing'};
 let r=await post('/api/events',event);assert.equal(r.status,200);let j=await r.json();assert.equal(j.event.material,true);assert.equal(j.push.configured,false);
 r=await post('/api/events',event);assert.equal((await r.json()).duplicate,true);
 r=await post('/api/events',{...event,timestamp:'2020-01-01T00:00:00Z',headline:'Stale event'});assert.equal((await r.json()).event.material,false);
 const current=await fetch(url+'/api/deals').then(r=>r.json());assert.equal(current.deals.find(d=>d.id==='alpha').source.headline,'API test event');
 const newDeal={...current.deals[0],target:'Isolated API test transaction',source:{headline:'Test fixture',url:'https://example.com/test-new-deal',timestamp:new Date().toISOString()}};
 r=await post('/api/deals',newDeal);assert.equal(r.status,201);const created=await r.json();assert(created.id);
 assert.equal((await post('/api/deals',newDeal)).status,400);
 r=await post('/api/events',{...event,dealId:created.id,timestamp:new Date().toISOString(),type:'Closed',delta:'Closed in test fixture',headline:'Test closing'});assert.equal((await r.json()).event.material,true);
 const final=await fetch(url+'/api/deals').then(r=>r.json());assert.equal(final.deals.find(d=>d.id===created.id).status,'Closed');
 assert.equal(final.deals.find(d=>d.id===created.id).synthetic,false);
 console.log('Production API integration passed: auth, credential gates, event writes, deduplication, stale suppression, new-deal ingestion, closing and persistence.');
}finally{app.kill('SIGTERM');await new Promise(r=>app.once('exit',r));rmSync(data,{recursive:true,force:true});}
