import webpush from 'web-push';
import { supabaseAdmin } from './supabase/admin';
import { fetchCisionFeed } from './source-feed';
import { livePushReady, monitoringEnabled } from './live-config';
import { validateSubscription } from './push-subscription';
export async function scanSource(manual=false){
 if(!manual&&!monitoringEnabled())return {enabled:false,reason:'Automatic collection is disabled'};
 const db=supabaseAdmin();
 const {data:run,error}=await db.from('source_runs').insert({}).select('id').single();if(error)throw Error('Could not start source run; check Stage 2 migration');
 try{const scan=await fetchCisionFeed();const items=scan.items;
 if(items.length){const saved=await db.from('source_items').upsert(items,{onConflict:'id',ignoreDuplicates:true});if(saved.error)throw Error('Could not persist source candidates');}
 const finished=await db.from('source_runs').update({finished_at:new Date().toISOString(),outcome:'ok',fetched:items.length,detail:JSON.stringify({scanned:scan.fetched,pages:scan.pages,oldestPublishedAt:scan.oldestPublishedAt,coverageLimited:scan.coverageLimited,note:scan.coverageLimited?'Scan cap reached: incomplete seven-day coverage':'Bounded general Cision scan',nordicConnection:'Unverified until analyst review'})}).eq('id',run.id);if(finished.error)throw Error('Could not finalize source run');
 const checkpoint=await db.from('monitor_state').upsert({key:'last_ingestion',value:new Date().toISOString()});if(checkpoint.error)throw Error('Could not save source checkpoint');
 return {enabled:true,candidates:items.length,scanned:scan.fetched,pages:scan.pages,oldestPublishedAt:scan.oldestPublishedAt,coverageLimited:scan.coverageLimited};
 }catch(e){await db.from('source_runs').update({finished_at:new Date().toISOString(),outcome:'failed',detail:e instanceof Error?e.message:'Source fetch failed'}).eq('id',run.id);throw e;}
}
export async function deliverNotifications(){
 if(!livePushReady())return {enabled:false,sent:0,reason:'Delivery is disabled or VAPID configuration is missing'};
 webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
 const db=supabaseAdmin();const {data:jobs,error}=await db.rpc('claim_deliveries',{p_limit:5});if(error)throw Error('Could not claim notification jobs');
 let sent=0,failed=0;
 await Promise.all((jobs||[]).map(async (job:{id:string;lease_token:string;subscription_id:string;endpoint:string;keys:{p256dh:string;auth:string};payload:Record<string,unknown>;attempts:number})=>{
  let status='sent',reason:string|null=null;let terminal=false;
  try{
   const subscription=validateSubscription({endpoint:job.endpoint,keys:job.keys});
   // Opt-out/membership changes after claim are checked again before dispatch.
   const {data:sub}=await db.from('push_subscriptions').select('enabled,user_id').eq('id',job.subscription_id).single();
   const {data:member}=sub?await db.from('pilot_members').select('enabled').eq('user_id',sub.user_id).single():{data:null};
   if(typeof job.payload.expiresAt!=='string'||!Number.isFinite(Date.parse(job.payload.expiresAt))||Date.parse(job.payload.expiresAt)<=Date.now()){status='dead';reason='Alert expired before delivery';}
   else if(!sub?.enabled||!member?.enabled){status='dead';reason='Subscription or membership disabled';}
   else{await webpush.sendNotification(subscription,JSON.stringify({...job.payload,tag:job.id}),{TTL:3600,timeout:10000});sent++;}
  }catch(e){const code=(e as {statusCode?:number}).statusCode;terminal=code===404||code===410||job.attempts>=6;status=terminal?'dead':'retry';reason=code?`Push HTTP ${code}`:'Push validation or transport failure';failed++;
   if(code===404||code===410)await db.from('push_subscriptions').update({enabled:false}).eq('id',job.subscription_id);
  }
  // A stale worker cannot acknowledge another worker's renewed lease.
  const result=await db.from('notification_deliveries').update({status,last_error:reason,sent_at:status==='sent'?new Date().toISOString():null,lease_until:null,next_attempt_at:new Date(Date.now()+Math.min(3600,30*2**job.attempts)*1000).toISOString()}).eq('id',job.id).eq('lease_token',job.lease_token);
  if(result.error)throw Error('Notification acknowledgment failed; delivery may be retried');
 }));
 return {enabled:true,sent,failed};
}
