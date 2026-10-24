import { requirePilotMember,requirePilotReviewer } from '@/lib/supabase/server';
import { pilotConfig } from '@/lib/pilot-config';
import { stage2Enabled } from '@/lib/live-config';
import { learningEnabled,learningState,learningSummary } from '@/lib/learning-service';
export const dynamic='force-dynamic';
export async function GET(){
 if(!stage2Enabled()||!learningEnabled())return Response.json({enabled:false});
 try{const {client}=await requirePilotMember();return Response.json(learningSummary(await learningState(client)));}catch{return Response.json({error:'Could not read learning state. Check migration 004 and your access.'},{status:503});}
}
export async function POST(req:Request){
 if(!stage2Enabled()||!learningEnabled())return Response.json({error:'Feedback engine is not enabled'},{status:403});
 if(req.headers.get('origin')!==pilotConfig().appUrl)return Response.json({error:'Invalid origin'},{status:403});
 try{const {client}=await requirePilotReviewer();const raw=await req.text();if(raw.length>8000)throw Error('Request is too large');const input=JSON.parse(raw);
 if(input.action==='save'){
  const state=await learningState(client);const {error}=await client.rpc('save_learning_model',{p_id:state.working.id,p_artifact:state.working});if(error)throw Error(error.message);
  return Response.json({saved:true,id:state.working.id,evaluation:state.working.evaluation});
 }
 if(input.action==='activate'||input.action==='shadow'){
  if(input.action==='activate'&&(typeof input.modelId!=='string'||!/^[a-f0-9]{64}$/.test(input.modelId)))throw Error('Choose a saved model version');
  const {error}=await client.rpc('set_learning_mode',{p_model:input.action==='activate'?input.modelId:null,p_enabled:input.action==='activate'});if(error)throw Error(error.message);return Response.json({ok:true});
 }
 if(input.action==='correct'||input.action==='exclude'){
  if(typeof input.sourceId!=='string'||typeof input.note!=='string'||input.note.trim().length<8||input.note.length>1000)throw Error('Identify the case and explain the correction in 8–1000 characters');
  const decision=input.action==='exclude'?'exclude':input.decision;
  if(!['useful','not_useful','exclude'].includes(decision))throw Error('Invalid feedback label');
  const score=input.score===null||input.score===undefined?null:input.score;
  if(score!==null&&(!Number.isInteger(score)||score<1||score>5))throw Error('Score must be 1–5 or blank');
  if(score!==null&&((decision==='useful'&&score<3)||(decision==='not_useful'&&score>2)))throw Error('Useful feedback needs score 3–5; not-useful feedback needs 1–2, or leave the score blank');
  const {error}=await client.rpc('record_learning_feedback',{p_source:input.sourceId,p_decision:decision,p_reason:input.action==='exclude'?'retracted':'correction',p_score:decision==='exclude'?null:score,p_note:input.note,p_model:null});if(error)throw Error(error.message);
  return Response.json({ok:true,message:'Feedback updated. Any active ranking is returned to shadow mode. Tracked deal facts and alerts were not changed.'});
 }
 throw Error('Invalid learning action');
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Learning action failed'},{status:400});}
}
