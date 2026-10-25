import { learningEnabled,learningState,learningSummary,suggest } from '@/lib/learning-service';
import {reviewHistoryLimit} from '@/lib/review-config';
import { DISMISS_REASONS } from '@/lib/feedback-labels';
import { requirePilotMember,requirePilotReviewer } from '@/lib/supabase/server';
import { stage2Enabled,livePushReady,monitoringEnabled } from '@/lib/live-config';
import { pilotConfig } from '@/lib/pilot-config';
import { scanSource,deliverNotifications } from '@/lib/live-jobs';
export const dynamic='force-dynamic';export const maxDuration=60;
export async function GET(){
 if(!stage2Enabled())return Response.json({enabled:false});
 const {client,user}=await requirePilotMember();
 const [items,runs,delivery,member,subs,reviewed]=await Promise.all([
 client.from('source_items').select('*',{count:'exact'}).eq('state','pending').order('published_at',{ascending:false}).limit(100),
 client.from('source_runs').select('*').order('started_at',{ascending:false}).limit(10),
 client.from('notification_deliveries').select('id,status,attempts,last_error,sent_at').order('next_attempt_at',{ascending:false}).limit(30),
 client.from('pilot_members').select('can_review').eq('user_id',user.id).single(),
 client.from('push_subscriptions').select('id,enabled,min_score').eq('user_id',user.id),
 client.from('source_items').select('id,headline,url,reviewed_at').eq('state','approved').order('reviewed_at',{ascending:false}).limit(reviewHistoryLimit()),
 ]);
 if([items,runs,delivery,member,subs,reviewed].some(r=>r.error))return Response.json({error:'Apply the Stage 2 migration before enabling PILOT_STAGE=2'},{status:503});
 let learning:Record<string,unknown>={enabled:false},predictions:Record<string,unknown>={};let ordered=items.data||[];
 if(learningEnabled()){try{const engine=await learningState(client);learning=learningSummary(engine);for(const item of ordered)predictions[item.id]=suggest(engine,item.headline+'\n'+item.excerpt);if(engine.active)ordered=[...ordered].sort((a,b)=>(predictions[b.id] as {priority:number}).priority-(predictions[a.id] as {priority:number}).priority||b.published_at.localeCompare(a.published_at));}catch{learning={enabled:false,error:'Apply migration 004 before enabling learning'};}}
 return Response.json({enabled:true,learning,predictions,reviewHistoryLimit:reviewHistoryLimit(),reviewed:reviewed.data,items:ordered,pendingTotal:items.count,runs:runs.data,deliveries:delivery.data,subscriptions:subs.data,canReview:member.data?.can_review,monitoring:monitoringEnabled(),notifications:livePushReady()});
}
export async function POST(req:Request){
 if(!stage2Enabled())return Response.json({error:'Stage 2 is not enabled'},{status:403});
 if(req.headers.get('origin')!==pilotConfig().appUrl)return Response.json({error:'Invalid origin'},{status:403});
 try{
 const {client}=await requirePilotReviewer();const raw=await req.text();if(raw.length>65000)throw Error('Request is too large');const input=JSON.parse(raw);
 if(input.action==='test'){const {data,error}=await client.rpc('queue_test_alert');if(error)throw Error('Could not queue test alert');return Response.json(data);}
 if(input.action==='scan')return Response.json(await scanSource(true));
 if(input.action==='deliver')return Response.json(await deliverNotifications());
 if(input.action!=='dismiss'||typeof input.sourceId!=='string'||!Object.hasOwn(DISMISS_REASONS,input.reason))throw Error('Choose a source and dismissal reason');
 if(input.note!==undefined&&(typeof input.note!=='string'||input.note.length>1000))throw Error('Feedback note too long');
 const {data,error}=await client.rpc('dismiss_corporate_source',{p_source:input.sourceId,p_reason:input.reason,p_note:input.note||'',p_learning:learningEnabled()});if(error)throw Error(error.message);return Response.json(data);
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Pilot action failed'},{status:400});}
}
