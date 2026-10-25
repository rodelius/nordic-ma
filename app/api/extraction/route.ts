import {createHash} from 'node:crypto';
import {requirePilotReviewer} from '@/lib/supabase/server';
import {supabaseAdmin} from '@/lib/supabase/admin';
import {stage2Enabled} from '@/lib/live-config';
import {pilotConfig} from '@/lib/pilot-config';
import {retrieveArticle} from '@/lib/article-source';
import {extractArticle} from '@/lib/extraction-provider';
import {EXTRACTION_VERSION} from '@/lib/extraction';
import {evaluateExtraction,summarizeEvaluations} from '@/lib/extraction-evaluation';
import {corporateState,parseCorporateEventModel} from '@/lib/corporate-events';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=90;
const privateHeaders={'Cache-Control':'private, no-store'};
export async function GET(req:Request){
 if(!stage2Enabled())return Response.json({error:'Reviewer stage required'},{status:403});
 try{const {client}=await requirePilotReviewer();const params=new URL(req.url).searchParams,sourceId=params.get('sourceId');
  if(sourceId){if(sourceId.length>128)throw Error('Invalid source');const {data,error}=await client.from('extraction_runs').select('*').eq('source_id',sourceId).order('created_at',{ascending:false}).limit(5);if(error)throw Error('Apply extraction migration 010');return Response.json({runs:data,configured:!!process.env.AI_API_KEY,backgroundEnabled:false},{headers:privateHeaders});}
  const [runs,evaluations,cases]=await Promise.all([client.from('extraction_runs').select('id,source_id,status,extractor_version,model_name,created_at,error').order('created_at',{ascending:false}).limit(100),client.from('extraction_evaluations').select('*').order('created_at',{ascending:false}).limit(100),client.from('source_items').select('id,headline,review_version').eq('state','approved').order('reviewed_at',{ascending:false}).limit(100)]);
  if(runs.error||evaluations.error||cases.error)throw Error('Apply extraction migration 010');return Response.json({runs:runs.data,evaluations:evaluations.data,cases:cases.data,summary:summarizeEvaluations(runs.data||[],evaluations.data||[],cases.data||[]),configured:!!process.env.AI_API_KEY,backgroundEnabled:false},{headers:privateHeaders});
 }catch(e){return Response.json({error:(e as Error).message},{status:400,headers:privateHeaders});}
}
export async function POST(req:Request){
 if(!stage2Enabled()||req.headers.get('origin')!==pilotConfig().appUrl)return Response.json({error:'Reviewer stage and origin required'},{status:403});
 let runId:string|undefined;
 try{const {client,user}=await requirePilotReviewer();const body=await req.text();if(body.length>5000)throw Error('Extraction request too large');const input=JSON.parse(body);const db=supabaseAdmin();
  const policy=await client.from('monitor_state').select('value').eq('key','extraction_version').maybeSingle();if(policy.error||policy.data?.value!=='1')throw Error('Apply extraction migration 010');
  if(input.action==='evaluate'){
   if(typeof input.runId!=='string'||input.runId.length>50)throw Error('Choose a completed extraction');const {data:run,error}=await client.from('extraction_runs').select('*').eq('id',input.runId).single();if(error||run.status!=='succeeded')throw Error('Choose a completed extraction');
   const {data:review,error:reviewError}=await client.from('corporate_source_reviews').select('version,graph,model_id,recorded_at').eq('source_id',run.source_id).order('version',{ascending:false}).limit(1).maybeSingle();if(reviewError||!review)throw Error('Approve this source manually before comparing with a saved review');
   const graph=parseCorporateEventModel(review.graph),metrics={...evaluateExtraction(run.suggestions,graph),retrospective:Date.parse(run.created_at)>Date.parse(review.recorded_at),articleHash:run.article.hash,extractorVersion:run.extractor_version,modelName:run.model_name,eventType:corporateState(graph).event_type_id||'UNKNOWN'};const group=String(corporateState(graph).programme_id||review.model_id);
   const {data,error:saveError}=await db.from('extraction_evaluations').upsert({run_id:run.id,reviewed_by:user.id,source_version:review.version,review_recorded_at:review.recorded_at,programme_group:group,review_hash:createHash('sha256').update(JSON.stringify(graph)).digest('hex'),metrics},{onConflict:'run_id,source_version'}).select('*').single();if(saveError)throw Error('Could not save extraction evaluation');return Response.json({evaluation:data},{headers:privateHeaders});
  }
  if(input.action!=='extract'||typeof input.sourceId!=='string'||input.sourceId.length>128)throw Error('Choose a source to extract');if(!process.env.AI_API_KEY)throw Error('AI_API_KEY is missing; configure the server-side AI provider before extracting');
  const {data:source,error}=await client.from('source_items').select('id,headline,url,published_at,excerpt,source,review_version,state').eq('id',input.sourceId).single();if(error||source.state==='dismissed')throw Error('Choose a pending or approved source');
  const recent=await db.from('extraction_runs').select('id',{count:'exact',head:true}).eq('requested_by',user.id).gte('created_at',new Date(Date.now()-3600000).toISOString());if(recent.error)throw Error('Could not check extraction limit');if((recent.count||0)>=20)throw Error('Pilot limit reached: 20 extractions per reviewer per hour');
  // Expired workers cannot leave a source permanently locked; their final writes remain conditional.
  const expiry=await db.from('extraction_runs').update({status:'failed',error:'Extraction timed out; retry manually',finished_at:new Date().toISOString()}).eq('source_id',source.id).in('status',['retrieving','extracting']).lt('created_at',new Date(Date.now()-120000).toISOString());if(expiry.error)throw Error('Could not check prior extraction');
  const created=await db.from('extraction_runs').insert({source_id:source.id,requested_by:user.id,source_version:source.review_version,source_snapshot:source,extractor_version:EXTRACTION_VERSION,model_name:process.env.AI_MODEL||'gpt-4.1-mini',status:'retrieving'}).select('id').single();if(created.error)throw Error(created.error.code==='23505'?'This source already has an extraction in progress':'Could not start extraction');runId=created.data.id;
  const article=await retrieveArticle(source.url);const retrieved=await db.from('extraction_runs').update({article,status:'extracting'}).eq('id',runId).eq('status','retrieving').select('id').single();if(retrieved.error)throw Error('Extraction expired while retrieving article');
  const suggestions=await extractArticle(article,source,runId!);const finished=await db.from('extraction_runs').update({status:'succeeded',suggestions,finished_at:new Date().toISOString()}).eq('id',runId).eq('status','extracting').select('*').single();if(finished.error)throw Error('Could not retain extraction; no suggestions applied');return Response.json({run:finished.data,message:'Suggestions retained. Apply selected fields to a draft; manual approval is still required.'},{headers:privateHeaders});
 }catch(e){const message=(e as Error).message;if(runId){try{await supabaseAdmin().from('extraction_runs').update({status:'failed',error:message.slice(0,1000),finished_at:new Date().toISOString()}).eq('id',runId).in('status',['retrieving','extracting']);}catch{}}return Response.json({error:message},{status:400,headers:privateHeaders});}
}
