import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {canonicalAnalysis,previewAssessment} from './legacy-support/review-analysis';
import {seed} from './legacy-support/seed';
const uid='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',reader='00000000-0000-0000-0000-000000000003';
const source={id:'first',headline:'Acquisition',url:'https://news.cision.com/issuer/r/first',published_at:'2026-01-01T00:00:00Z'};
const evidence=[{label:'Nordic connection',kind:'Fact' as const,value:'Swedish target documented in the source'},{label:'Consideration type',kind:'Fact' as const,value:'CASH'},{label:'Consideration currency',kind:'Fact' as const,value:'SEK'},{label:'Buyer funding currency',kind:'Fact' as const,value:'EUR'}];
const initial={...seed[0],synthetic:false,target:'Persistence fixture',score:4,evidence,source:{headline:source.headline,url:source.url,timestamp:source.published_at}};
test('draft assessment is reproducible from incomplete JSON; source metadata is canonicalized on final approval',()=>{
 assert.equal(previewAssessment('{unfinished'),null);
 const partial={evidence,status:'New'};assert.equal(previewAssessment(JSON.stringify(partial))?.buyerFx,'Potential FX');
 const d=canonicalAnalysis({...initial,source:{url:'wrong'}},source);assert.deepEqual(d.source,initial.source);
 assert.equal(canonicalAnalysis({...initial,target:'',sector:'',timing:''},source).target,'');
 assert.throws(()=>canonicalAnalysis({...initial,score:0},source),/Score/);
 assert.throws(()=>canonicalAnalysis({...initial,country:''},source),/Nordic/);
});
test('drafts, approved assessments and corrections survive reload without overwriting later news or sending correction alerts',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;insert into auth.users values('${uid}'),('${other}'),('${reader}');`);
 for(const file of ['202610240001_pilot_foundation.sql','202610240002_live_pilot.sql','202610240003_cision_review.sql','202610240004_feedback_engine.sql','202610240005_review_persistence.sql','202610240006_guided_review.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec(`insert into public.pilot_members(user_id,can_review) values('${uid}',true),('${other}',true),('${reader}',false)`);
 await db.query(`insert into public.source_items(id,headline,url,published_at,excerpt,source) values($1,$2,$3,$4,'Source excerpt','Cision')`,[source.id,source.headline,source.url,source.published_at]);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${uid}'`);
 const draftText=JSON.stringify(initial),a=previewAssessment(draftText);
 const reviewInput={original:{...initial,target:''},suggestion:{score:4},version:null,mode:'shadow',explanation:'Comparable cases'};
 await db.query('select public.save_review_draft($1,$2,$3,$4,0,0,$5)',[source.id,draftText,'Initial notes',JSON.stringify(a),JSON.stringify(reviewInput)]);
 let drafts=(await db.query<{draft_text:string;assessment:unknown;revision:number}>('select * from public.review_drafts')).rows;assert.equal(drafts[0].draft_text,draftText);assert.deepEqual(drafts[0].assessment,a);assert.equal(drafts[0].revision,1);
 await assert.rejects(db.query('select public.save_review_draft($1,$2,$3,null,0,0)',[source.id,'stale tab','']));
 await db.query('select public.save_review_draft($1,$2,$3,null,0,1)',[source.id,'{incomplete JSON','Keep these edits']);assert.equal((await db.query<{draft_text:string}>('select draft_text from public.review_drafts')).rows[0].draft_text,'{incomplete JSON');
 await db.exec(`set request.jwt.claim.sub='${other}'`);assert.equal((await db.query('select * from public.review_drafts')).rows.length,0);
 await db.exec(`set request.jwt.claim.sub='${uid}'`);
 const submit=async(id:string,d:unknown,note:string,version:number,existing:string|null=null,model:string|null=null)=>db.query<{result:{reviewVersion:number;latestDealUpdated:boolean;dealId:string}}>('select public.submit_review_assessment($1,$2,$3,$4,$5,$6,true,$7) as result',[id,JSON.stringify(d),JSON.stringify(previewAssessment(JSON.stringify(d))),note,existing,version,model]);
 const approved=(await submit(source.id,initial,'Reviewed initial analysis',0)).rows[0].result;
 assert.equal(approved.reviewVersion,1);assert.equal(approved.latestDealUpdated,true);
 assert.equal((await db.query('select * from public.review_drafts')).rows.length,0);
 let saved=(await db.query<{analysis:{score:number};assessment:unknown;review_version:number}>('select * from public.source_items where id=$1',[source.id])).rows[0];assert.equal(saved.analysis.score,4);assert.deepEqual(saved.assessment,a);assert.equal(saved.review_version,1);
 let feedback=(await db.query<{analysis_snapshot:{score:number};changed_fields:string[]}>('select * from public.latest_review_feedback')).rows[0];assert.equal(feedback.analysis_snapshot.score,4);
 const changed={...initial,score:2,buyerFx:'No',evidence:evidence.map(e=>e.label==='Consideration type'?{...e,value:'SHARES'}:e)};
 const corrected=(await submit(source.id,changed,'Source confirms shares rather than cash',1,approved.dealId)).rows[0].result;assert.equal(corrected.reviewVersion,2);assert.equal(corrected.latestDealUpdated,true);
 saved=(await db.query<typeof saved>('select * from public.source_items where id=$1',[source.id])).rows[0];assert.equal(saved.analysis.score,2);assert.equal((saved.assessment as {buyerFx:string}).buyerFx,'No cash FX established');
 feedback=(await db.query<typeof feedback>('select * from public.latest_review_feedback')).rows[0];assert.equal(feedback.analysis_snapshot.score,2);assert(feedback.changed_fields.includes('score'));assert(feedback.changed_fields.includes('evidence'));
 const revision=(await db.query<{previous_analysis:{score:number};analysis:{score:number}}>('select * from public.review_revisions where version=2')).rows[0];assert.equal(revision.previous_analysis.score,4);assert.equal(revision.analysis.score,2);
 const input=(await db.query<{review_input:unknown}>('select review_input from public.review_revisions where version=1')).rows[0].review_input;assert.deepEqual(input,reviewInput);
 await assert.rejects(submit(source.id,initial,'A stale editor must not overwrite saved work',1,approved.dealId));
 // Any feedback failure must roll back the entire analysis/assessment/revision save.
 await assert.rejects(submit(source.id,initial,'This model reference does not exist',2,approved.dealId,'a'.repeat(64)));
 assert.equal((await db.query<{review_version:number}>('select review_version from public.source_items where id=$1',[source.id])).rows[0].review_version,2);
 await db.exec('reset role');await db.query(`insert into public.source_items(id,headline,url,published_at,excerpt,source) values('later','Later news','https://news.cision.com/issuer/r/later','2026-01-02','excerpt','Cision')`);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${uid}'`);
 const later={...initial,delta:'A later transaction update',source:{headline:'Later news',url:'https://news.cision.com/issuer/r/later',timestamp:'2026-01-02T00:00:00Z'}};
 await submit('later',later,'Reviewed later news',0,approved.dealId);
 const historic=(await submit(source.id,{...changed,score:1},'Correct only the earlier source analysis',2,approved.dealId)).rows[0].result;assert.equal(historic.latestDealUpdated,false);
 const latest=(await db.query<{body:{delta:string;score:number}}>('select body from public.deals where id=$1',[approved.dealId])).rows[0].body;assert.equal(latest.delta,later.delta);assert.equal(latest.score,4);
 assert.equal((await db.query('select * from public.deal_events')).rows.length,2);
 await db.exec('reset role');assert.equal((await db.query('select * from public.notification_outbox')).rows.length,0);
 await db.exec('reset role');await db.query(`insert into public.push_subscriptions(user_id,endpoint,keys) values($1,'https://web.push.apple.com/review-test','{"p256dh":"key","auth":"key"}')`,[uid]);
 const freshDate=new Date().toISOString();await db.query(`insert into public.source_items(id,headline,url,published_at,excerpt,source) values('fresh','Fresh source','https://news.cision.com/issuer/r/fresh',$1,'excerpt','Cision')`,[freshDate]);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${uid}'`);
 const freshDeal={...initial,target:'Fresh alert fixture',source:{headline:'Fresh source',url:'https://news.cision.com/issuer/r/fresh',timestamp:freshDate}};
 const fresh=(await submit('fresh',freshDeal,'Approved fresh source',0)).rows[0].result;
 assert.equal((await db.query<{status:string}>("select status from public.notification_deliveries")).rows[0].status,'queued');
 await submit('fresh',{...freshDeal,score:1},'Correct relevance before dispatching an alert',1,fresh.dealId);
 assert.equal((await db.query<{status:string}>("select status from public.notification_deliveries")).rows[0].status,'dead');
 await db.exec('reset role');assert.equal((await db.query('select * from public.notification_outbox')).rows.length,1);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${reader}'`);await assert.rejects(submit(source.id,initial,'Reader cannot edit assessments',3,approved.dealId));
 await db.exec('reset role');
 for(const id of ['blank-a','blank-b','reporting'])await db.query(`insert into public.source_items(id,headline,url,published_at,excerpt,source) values($1,'Unidentified transaction',$2,'2026-01-01','Annual report with no transaction','Cision')`,[id,'https://news.cision.com/issuer/r/'+id]);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${uid}'`);
 const blankA=(await submit('blank-a',{...initial,target:'',source:{...initial.source,url:'https://news.cision.com/issuer/r/blank-a'}},'',0)).rows[0].result;
 const blankB=(await submit('blank-b',{...initial,target:'',source:{...initial.source,url:'https://news.cision.com/issuer/r/blank-b'}},'',0)).rows[0].result;assert.notEqual(blankA.dealId,blankB.dealId);
 assert.equal((await db.query<{analysis:{target:string}}>('select analysis from public.source_items where id=$1',['blank-a'])).rows[0].analysis.target,'');
 await db.query("select public.review_source_feedback('reporting',null,null,true,'reporting','Routine annual report',null)");assert.equal((await db.query<{decision:string}>("select decision from public.latest_review_feedback where source_id='reporting'")).rows[0].decision,'not_useful');
 await assert.rejects(db.query('select public.submit_review_assessment_v5($1,$2,$3,$4,$5,$6,true,null)',[source.id,JSON.stringify(initial),JSON.stringify(a),'Cannot bypass new audit wrapper',approved.dealId,3]));
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.review_drafts'));
 }finally{await db.close();}
});

test('display grouping keeps identical headlines together while preserving material updates',async()=>{
 const {sourceGroups}=await import('../lib/source-groups');
 const items=[{id:'a',headline:'Company acquires Nordic technology business',url:'https://news.cision.com/a'},
 {id:'b',headline:'Company acquires Nordic technology business!',url:'https://news.cision.com/b'},
 {id:'c',headline:'Company acquires Nordic technology business — financing revised',url:'https://news.cision.com/c'}];
 assert.deepEqual(sourceGroups(items).map(g=>g.map(i=>i.id)),[['a','b'],['c']]);assert.equal(items.length,3);
});
