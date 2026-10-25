import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const data=mkdtempSync(join(tmpdir(),'corporate-api-')),token='test-canonical-ingestion-token';
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3101','--hostname','127.0.0.1'],{env:{...process.env,APP_MODE:'demo',DATA_DIR:data,INGEST_TOKEN:token,AI_API_KEY:''},stdio:['ignore','ignore','ignore']});const base='http://127.0.0.1:3101';
try{let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/corporate-events')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready);
 const initial=await fetch(base+'/api/corporate-events').then(r=>r.json());assert.equal(initial.ontologyVersion,'1.0.0');assert.equal(initial.models.length,3);assert.equal((await fetch(base+'/api/deals')).status,410);assert.equal((await fetch(base+'/api/events',{method:'POST'})).status,410);assert.equal((await fetch(base+'/api/corporate-events',{method:'POST',body:'{}'})).status,401);
 const graph=structuredClone(initial.models[0].graph);graph.records.CorporateEvent[0].title='Canonical persistence fixture';const post=async value=>fetch(base+'/api/corporate-events',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(value)});
 const created=await post({graph});assert.equal(created.status,201);const saved=await created.json();graph.records.CorporateEvent[0].lifecycle_phase='SPA drafting';assert.equal((await post({graph})).status,400);graph.records.CorporateEvent[0].lifecycle_phase='EVALUATION';assert.equal((await post({graph,modelId:saved.modelId,expectedVersion:1})).status,201);assert.equal((await post({graph,modelId:saved.modelId,expectedVersion:1})).status,400);const final=await fetch(base+'/api/corporate-events').then(r=>r.json());assert.equal(final.models.find(m=>m.model_id===saved.modelId).revision,2);assert.equal((await fetch(base+'/api/analyze',{method:'POST',headers:{Authorization:'Bearer '+token},body:'{}'})).status,503);console.log('Canonical API gates, fixed enums, version conflicts and persistence passed.');
}finally{app.kill('SIGTERM');await new Promise(r=>app.once('exit',r));rmSync(data,{recursive:true,force:true});}
