import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {buildModel,currentCases,predict,type FeedbackRow} from '../lib/feedback-engine';
import {seed} from '../lib/seed';
const text='Swedish acquisition bridge financing in SEK and EUR with floating-rate debt';
function label(i:number,useful=true):FeedbackRow{return {id:String(i),source_id:'source-'+i,decision:useful?'useful':'not_useful',reason:useful?'approved':'routine',score:useful?5:null,note:'',created_at:new Date(2026,0,i+1).toISOString(),source_snapshot:{headline:useful?text:'Form 8.3 holdings in company and own shares',excerpt:'Issuer disclosure',url:'https://news.cision.com/issuer/r/story-'+i,published_at:new Date(2026,0,i+1).toISOString()}};}
test('learning is neutral on cold start, changes with comparable labels and does not invent exposures',()=>{
 assert.equal(predict(text,[]).priority,50);assert.equal(predict(text,currentCases([label(0),label(1)])).priority,50);
 const high=predict(text,currentCases([label(0),label(1),label(2)]));assert(high.priority>50);assert.equal(high.suggestedFiccScore,5);assert.equal(high.support,3);
 const low=predict(text,currentCases([0,1,2].map(i=>({...label(i),decision:'not_useful' as const,score:1,reason:'low_ficc'}))));assert(low.priority<50);assert.equal(low.suggestedFiccScore,1);
 assert(!('buyerCurrency'in high));assert.equal(predict('An unrelated clinical trial result',currentCases([label(0),label(1),label(2)])).priority,50);
});
test('latest corrections replace labels, exclusions remove cases, and repeated deal updates cannot inflate support',()=>{
 const rows=[label(0),label(1),label(2)].map(r=>({...r,source_snapshot:{...r.source_snapshot,deal_id:'same-known-deal'}}));assert.equal(predict(text,currentCases(rows)).support,1);
 const corrected={...label(0),id:'correction',created_at:'2027-01-01T00:00:00Z',decision:'not_useful' as const,score:1,reason:'correction'};
 assert.equal(currentCases([label(0),corrected]).length,1);assert.equal(currentCases([label(0),corrected])[0].useful,false);
 assert.equal(currentCases([label(0),{...corrected,id:'excluded',created_at:'2028-01-01T00:00:00Z',decision:'exclude',score:null,reason:'retracted'}]).length,0);
 assert.equal(currentCases([{...label(0),decision:'exclude',score:null,reason:'stale'}]).length,0);
});
test('versions are deterministic and evaluation holds out groups without label leakage',()=>{
 const rows=Array.from({length:12},(_,i)=>label(i,i%2===0));const model=buildModel(rows);
 assert.equal(model.id,buildModel([...rows].reverse()).id);assert.equal(model.evaluation.eligible,true);assert.equal(model.evaluation.trainingCount,8);assert.equal(model.evaluation.holdoutCount,4);
 assert(model.evaluation.precisionAt3!>=model.evaluation.baselinePrecisionAt3!);
 assert(model.evaluation.holdoutIds.every(id=>!model.evaluation.trainingIds.includes(id)));assert.equal(buildModel(rows.slice(0,5)).evaluation.eligible,false);
 const grouped=rows.map(r=>({...r,source_snapshot:{...r.source_snapshot,deal_id:'one'}}));assert.equal(buildModel(grouped).evaluation.eligible,false);
});
test('feedback SQL is atomic, append-only, reviewer-only and safely invalidates corrected active models',async()=>{
 const db=new PGlite(),uid='00000000-0000-0000-0000-000000000001',reader='00000000-0000-0000-0000-000000000002';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;insert into auth.users values('${uid}'),('${reader}');`);
 for(const file of ['202610240001_pilot_foundation.sql','202610240002_live_pilot.sql','202610240003_cision_review.sql','202610240004_feedback_engine.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec(`insert into public.pilot_members(user_id,can_review) values('${uid}',true),('${reader}',false)`);
 const add=async(id:string,headline:string,date='2026-01-01T00:00:00Z')=>{await db.exec('reset role');await db.query(`insert into public.source_items(id,headline,url,published_at,excerpt,source) values($1,$2,$3,$4,'Issuer disclosure','Cision')`,[id,headline,'https://news.cision.com/issuer/r/'+id,date]);await db.exec(`set role authenticated;set request.jwt.claim.sub='${uid}'`);};
 await add('dismissed','Routine holdings disclosure');await assert.rejects(db.query('select public.review_source_feedback($1,null,null,true,null)',['dismissed']));
 await db.query('select public.review_source_feedback($1,null,null,true,$2)',['dismissed','routine']);
 await db.query('select public.review_source_feedback($1,null,null,true,$2)',['dismissed','routine']);assert.equal((await db.query('select * from public.review_feedback')).rows.length,1);
 await assert.rejects(db.exec(`update public.review_feedback set note='Changed history'`));
 await add('rollback','A routine disclosure');await assert.rejects(db.query('select public.review_source_feedback($1,null,null,true,$2,$3)',['rollback','routine','X'.repeat(1001)]));assert.equal((await db.query<{state:string}>(`select state from public.source_items where id='rollback'`)).rows[0].state,'pending');
 await db.exec(`set request.jwt.claim.sub='${reader}'`);await assert.rejects(db.query('select public.record_learning_feedback($1,$2,$3,null,$4)',['dismissed','exclude','retracted','Reader may not change labels']));
 await db.exec(`set request.jwt.claim.sub='${uid}'`);await db.query('select public.record_learning_feedback($1,$2,$3,null,$4)',['dismissed','exclude','retracted','Exclude this fixture from the dataset']);
 for(let i=0;i<12;i++){
  const row=label(i,i%2===0),date=row.source_snapshot.published_at;await add('case-'+i,row.source_snapshot.headline,date);
  if(i%2===0){const deal={...seed[0],target:'Feedback SQL deal '+i,score:5,synthetic:false,evidence:[{label:'Nordic connection',kind:'Fact',value:'Swedish target in source fixture'}],source:{headline:row.source_snapshot.headline,url:'https://news.cision.com/issuer/r/case-'+i,timestamp:date}};await db.query('select public.review_source_feedback($1,$2)', ['case-'+i,JSON.stringify(deal)]);}
  else await db.query('select public.review_source_feedback($1,null,null,true,$2)', ['case-'+i,'routine']);
 }
 const rows=(await db.query<FeedbackRow>('select * from public.latest_review_feedback')).rows.map(r=>({...r,created_at:new Date(r.created_at).toISOString()}));
 const model=buildModel(rows);assert.equal(model.evaluation.eligible,true);
 await assert.rejects(db.query('select public.save_learning_model($1,$2)',['f'.repeat(64),'{}']));
 const cold=buildModel([]);await db.query('select public.save_learning_model($1,$2)',[cold.id,JSON.stringify(cold)]);await assert.rejects(db.query('select public.set_learning_mode($1,true)',[cold.id]));
 await db.query('select public.save_learning_model($1,$2)',[model.id,JSON.stringify(model)]);await db.query('select public.set_learning_mode($1,true)',[model.id]);
 assert.equal((await db.query<{use_learned_ranking:boolean}>('select * from public.learning_settings')).rows[0].use_learned_ranking,true);
 await db.query('select public.record_learning_feedback($1,$2,$3,null,$4)',['case-0','exclude','retracted','Withdraw this feedback example from learning']);
 assert.equal((await db.query<{use_learned_ranking:boolean}>('select * from public.learning_settings')).rows[0].use_learned_ranking,false);
 await assert.rejects(db.query('select public.set_learning_mode($1,true)',[model.id]));
 assert.equal((await db.query(`select * from public.review_feedback where source_id='case-0'`)).rows.length,2);
 await db.exec('reset role');assert.equal((await db.query('select * from public.notification_outbox')).rows.length,0);await db.exec('set role authenticated');
 await db.exec(`set request.jwt.claim.sub='${reader}'`);await assert.rejects(db.query('select public.set_learning_mode(null,false)'));
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.latest_review_feedback'));
 }finally{await db.close();}
});

test('FICC assessment uses confirmed funding, settlement and desired proceeds, not country or assumptions',async()=>{
 const {assessFicc}=await import('../lib/ficc-advisory');
 const fact=(label:string,value:string)=>({label,value,kind:'Fact' as const});
 const uncertain=assessFicc({...seed[0],evidence:[{label:'Consideration currency',value:'SEK',kind:'Inference'},fact('Buyer reporting currency','EUR')]});assert.equal(uncertain.buyerFx,'Unclear');assert.equal(uncertain.twoSided,false);
 const d={...seed[0],evidence:[fact('Consideration type','CASH'),fact('Consideration currency','SEK'),fact('Buyer funding currency','EUR'),fact('Seller desired proceeds currency','EUR'),fact('Debt rate type','Floating')]};
 const two=assessFicc(d);assert.equal(two.twoSided,true);assert(two.angles.some(a=>a.includes('floating-rate')));
 const shares=assessFicc({...d,evidence:[...d.evidence.filter(e=>e.label!=='Consideration type'),fact('Consideration type','SHARES')]});assert.equal(shares.twoSided,false);assert.equal(shares.buyerFx,'No cash FX established');
 const conflict=assessFicc({...d,evidence:[...d.evidence,fact('Settlement currency','USD')]});assert.equal(conflict.buyerFx,'Unclear');assert(conflict.questions.some(q=>q.includes('Conflicting')));
 const fund=assessFicc({...seed[0],evidence:[fact('Consideration currency','NOK'),fact('Fund denomination','EUR')]});assert.equal(fund.buyerFx,'Unclear');assert(fund.angles.some(a=>a.includes('hypothesis')));
});
