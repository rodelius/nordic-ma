import {requirePilotReviewer} from '@/lib/supabase/server';
import {stage2Enabled} from '@/lib/live-config';
import {pilotConfig} from '@/lib/pilot-config';
import {learningEnabled} from '@/lib/learning-service';
import {canonicalAnalysis,previewAssessment} from '@/lib/review-analysis';
import {assessFicc} from '@/lib/ficc-advisory';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 if(!stage2Enabled())return Response.json({error:'Stage 2 is not enabled'},{status:403});
 try{const {client,user}=await requirePilotReviewer();const id=new URL(req.url).searchParams.get('sourceId');if(!id||id.length>128)throw Error('Choose a source item');
 const [source,draft,revisions]=await Promise.all([client.from('source_items').select('*').eq('id',id).single(),client.from('review_drafts').select('*').eq('source_id',id).eq('reviewer_id',user.id).maybeSingle(),client.from('review_revisions').select('version,note,changed_fields,latest_deal_updated,created_at').eq('source_id',id).order('version',{ascending:false}).limit(10)]);
 if(source.error)throw Error('Source item could not be loaded');if(draft.error||revisions.error)throw Error('Apply migration 005 to save and reopen reviews');
 return Response.json({source:source.data,draft:draft.data,assessment:source.data.assessment||previewAssessment(JSON.stringify(source.data.analysis)),revisions:revisions.data});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Review could not be opened'},{status:400});}
}
export async function POST(req:Request){
 if(!stage2Enabled())return Response.json({error:'Stage 2 is not enabled'},{status:403});
 if(req.headers.get('origin')!==pilotConfig().appUrl)return Response.json({error:'Invalid origin'},{status:403});
 try{const {client}=await requirePilotReviewer();const raw=await req.text();if(raw.length>100000)throw Error('Review request is too large');const input=JSON.parse(raw);
 if(typeof input.sourceId!=='string'||input.sourceId.length>128||typeof input.text!=='string'||input.text.length>64000||typeof input.note!=='string'||input.note.length>1000||!Number.isInteger(input.version)||input.version<0)throw Error('Invalid review payload');
 const {data:source,error:lookup}=await client.from('source_items').select('*').eq('id',input.sourceId).single();if(lookup||!source)throw Error('Unknown source item');
 if(input.action==='draft'){
  if(!Number.isInteger(input.draftRevision)||input.draftRevision<0)throw Error('Invalid draft revision');
  const assessment=previewAssessment(input.text);const {data,error}=await client.rpc('save_review_draft',{p_source:source.id,p_text:input.text,p_note:input.note,p_assessment:assessment,p_expected:input.version,p_draft_revision:input.draftRevision});if(error)throw Error(error.message);
  return Response.json({...data,assessment,message:assessment?'Draft and assessment saved. Approval and learning labels have not changed.':'Draft text saved. Complete valid evidence to calculate an assessment.'});
 }
 if(input.action!=='submit')throw Error('Invalid review action');
 let parsed;try{parsed=JSON.parse(input.text);}catch{throw Error('The JSON is invalid. Fix its syntax before approval, or save it as a draft.');}
 const deal=canonicalAnalysis(parsed,source);const assessment=assessFicc(deal);
 let model=null;if(learningEnabled()){const {data,error}=await client.from('learning_settings').select('active_model,use_learned_ranking').eq('id',1).single();if(error)throw Error('Learning settings could not be read');model=data.use_learned_ranking?data.active_model:null;}
 const {data,error}=await client.rpc('submit_review_assessment',{p_source:source.id,p_deal:deal,p_assessment:assessment,p_note:input.note,p_existing:input.existingId||null,p_expected:input.version,p_learning:learningEnabled(),p_model:model});if(error)throw Error(error.message);
 return Response.json({...data,message:data.correction?(data.latestDealUpdated?'Assessment correction saved to this source and the current transaction. No alert sent.':'Historical assessment correction saved. A newer transaction update was preserved. No alert sent.'):'Reviewed analysis and assessment saved.'});
 }catch(e){const error=e instanceof Error?e.message:'Review save failed';return Response.json({error},{status:/changed since|another session/.test(error)?409:400});}
}
