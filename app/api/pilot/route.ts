import { learningEnabled,learningState,learningSummary,suggest } from '@/lib/learning-service';
import { DISMISS_REASONS } from '@/lib/feedback-labels';
import { requirePilotMember,requirePilotReviewer } from '@/lib/supabase/server';
import { stage2Enabled,livePushReady,monitoringEnabled } from '@/lib/live-config';
import { pilotConfig } from '@/lib/pilot-config';
import { parseDeal } from '@/lib/model';
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
 client.from('source_items').select('id,headline,url,reviewed_at').eq('state','approved').order('reviewed_at',{ascending:false}).limit(15),
 ]);
 if([items,runs,delivery,member,subs,reviewed].some(r=>r.error))return Response.json({error:'Apply the Stage 2 migration before enabling PILOT_STAGE=2'},{status:503});
 let learning:Record<string,unknown>={enabled:false},predictions:Record<string,unknown>={};let ordered=items.data||[];
 if(learningEnabled()){try{const engine=await learningState(client);learning=learningSummary(engine);for(const item of ordered)predictions[item.id]=suggest(engine,item.headline+'\n'+item.excerpt);if(engine.active)ordered=[...ordered].sort((a,b)=>(predictions[b.id] as {priority:number}).priority-(predictions[a.id] as {priority:number}).priority||b.published_at.localeCompare(a.published_at));}catch{learning={enabled:false,error:'Apply migration 004 before enabling learning'};}}
 return Response.json({enabled:true,learning,predictions,reviewed:reviewed.data,items:ordered,pendingTotal:items.count,runs:runs.data,deliveries:delivery.data,subscriptions:subs.data,canReview:member.data?.can_review,monitoring:monitoringEnabled(),notifications:livePushReady()});
}
export async function POST(req:Request){
 if(!stage2Enabled())return Response.json({error:'Stage 2 is not enabled'},{status:403});
 if(req.headers.get('origin')!==pilotConfig().appUrl)return Response.json({error:'Invalid origin'},{status:403});
 try{
 const {client}=await requirePilotReviewer();const raw=await req.text();if(raw.length>65000)throw Error('Request is too large');const input=JSON.parse(raw);
 if(input.action==='test'){const {data,error}=await client.rpc('queue_test_alert');if(error)throw Error('Could not queue test alert');return Response.json(data);}
 if(input.action==='scan')return Response.json(await scanSource(true));
 if(input.action==='deliver')return Response.json(await deliverNotifications());
 if(!['approve','dismiss'].includes(input.action)||typeof input.sourceId!=='string')throw Error('Invalid review action');
 const {data:item,error:lookup}=await client.from('source_items').select('*').eq('id',input.sourceId).single();if(lookup||!item)throw Error('Unknown source item');
 let deal=null;
 if(input.action==='approve'){
  deal=parseDeal(input.deal);
  if(!deal.evidence.some(e=>e.label.trim().toLowerCase()==='nordic connection'&&e.kind==='Fact'&&e.value.trim().length>=8&&!/^(unknown|unconfirmed|not verified|unclear)$/i.test(e.value.trim())))throw Error('Document a source-supported Nordic connection as a Fact evidence entry labelled Nordic connection');
  deal.source={headline:item.headline,url:item.url,timestamp:item.published_at};
 }
 if(input.existingId!==undefined&&input.existingId!==null&&typeof input.existingId!=='string')throw Error('Invalid transaction selection');
 const params:Record<string,unknown>={p_source:item.id,p_deal:deal,p_existing:input.existingId||null,p_dismiss:input.action==='dismiss'};
 let rpc='review_source';
 if(learningEnabled()){
  if(input.action==='dismiss'&&(!input.reason||!Object.hasOwn(DISMISS_REASONS,input.reason)))throw Error('Choose a dismissal reason');
  if(input.note!==undefined&&(typeof input.note!=='string'||input.note.length>1000))throw Error('Feedback note is too long');
  rpc='review_source_feedback';params.p_reason=input.action==='dismiss'?input.reason:null;params.p_note=input.note||'';const {data:settings,error:settingsError}=await client.from('learning_settings').select('active_model,use_learned_ranking').eq('id',1).single();if(settingsError)throw Error('Apply migration 004 before recording learning feedback');params.p_model=settings?.use_learned_ranking?settings.active_model:null;
 }
 const {data,error}=await client.rpc(rpc,params);
 if(error)throw Error(error.message);
 return Response.json(data);
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Pilot action failed'},{status:400});}
}
