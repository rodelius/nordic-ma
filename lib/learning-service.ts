import type { SupabaseClient } from '@supabase/supabase-js';
import { ENGINE_VERSION,buildModel,predict,type FeedbackRow,type Model } from './feedback-engine';
export function learningEnabled(){return process.env.LEARNING_ENABLED==='true';}
export async function learningState(client:SupabaseClient){
 const [feedback,settings,versions]=await Promise.all([
  client.from('latest_review_feedback').select('*').order('created_at',{ascending:false}).limit(500),
  client.from('learning_settings').select('*').eq('id',1).single(),
  client.from('learning_models').select('id,created_at,artifact').order('created_at',{ascending:false}).limit(20),
 ]);
 if([feedback,settings,versions].some(r=>r.error))throw Error('Apply migration 004 to enable the feedback engine');
 const rows=(feedback.data||[]) as FeedbackRow[],working=buildModel(rows);
 let active:Model|null=null;
 if(settings.data?.use_learned_ranking&&settings.data.active_model){
  const saved=versions.data?.find(m=>m.id===settings.data.active_model);
  if(saved)active=saved.artifact as Model;
  else{const {data,error}=await client.from('learning_models').select('artifact').eq('id',settings.data.active_model).single();if(error)throw Error('Could not read the active learning version');active=data.artifact as Model;}
 }
 if(active&&(active.algorithm!==ENGINE_VERSION||!Array.isArray(active.examples)))throw Error('Unsupported active learning version; return to shadow mode');
 return {rows,working,active,versions:versions.data||[]};
}
export function learningSummary(state:Awaited<ReturnType<typeof learningState>>){return {
 enabled:true,mode:state.active?'active':'shadow',algorithm:state.working.algorithm,feedbackCount:state.rows.length,trainingCases:state.working.examples.length,
 workingVersion:state.working.id,activeVersion:state.active?.id||null,evaluation:state.working.evaluation,
 versions:state.versions.map(v=>({id:v.id,createdAt:v.created_at,evaluation:v.artifact.evaluation})),
 recent:state.rows.slice(0,15).map(r=>({id:r.id,sourceId:r.source_id,headline:r.source_snapshot.headline,decision:r.decision,reason:r.reason,score:r.score,note:r.note,at:r.created_at})),
};}
export function suggest(state:Awaited<ReturnType<typeof learningState>>,text:string){return {version:(state.active||state.working).id,...predict(text,(state.active||state.working).examples),shadow:state.active?predict(text,state.working.examples):null};}
