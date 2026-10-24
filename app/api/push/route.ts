import { pilotMode,pilotConfig } from '@/lib/pilot-config';
import { pushEnabled } from '@/lib/push';
import { livePushReady,stage2Enabled } from '@/lib/live-config';
import { requirePilotMember } from '@/lib/supabase/server';
import { validateSubscription } from '@/lib/push-subscription';
export const runtime='nodejs';
export async function GET(){const configured=pilotMode()==='pilot'?livePushReady():pushEnabled();return Response.json({configured,publicKey:configured?process.env.VAPID_PUBLIC_KEY:null});}
export async function POST(req:Request){
 const pilot=pilotMode()==='pilot';
 if(!(pilot?livePushReady():pushEnabled()))return Response.json({error:'Web push is disabled or not configured'},{status:503});
 if(req.headers.get('origin')!==(pilot?pilotConfig().appUrl:new URL(req.url).origin))return Response.json({error:'Invalid origin'},{status:403});
 try{const raw=await req.text();if(raw.length>8000)throw Error('Subscription too large');const s=validateSubscription(JSON.parse(raw));
 if(pilot){const {client,user}=await requirePilotMember();const {error}=await client.from('push_subscriptions').upsert({...s,user_id:user.id,enabled:true},{onConflict:'endpoint'});if(error)throw Error('Could not save your subscription');}
 else{const {saveSubscription}=await import('@/lib/store');saveSubscription(s);}
 return Response.json({ok:true});
 }catch{return Response.json({error:'Invalid subscription or insufficient access'},{status:400});}
}
export async function DELETE(req:Request){
 const pilot=pilotMode()==='pilot';
 if(pilot&&!stage2Enabled())return Response.json({error:'Stage 1 is read-only'},{status:403});
 if(req.headers.get('origin')!==(pilot?pilotConfig().appUrl:new URL(req.url).origin))return Response.json({error:'Invalid origin'},{status:403});
 if(pilot){const {client,user}=await requirePilotMember();const {error}=await client.from('push_subscriptions').update({enabled:false}).eq('user_id',user.id);if(error)return Response.json({error:'Could not disable alerts'},{status:400});}
 else{const {removeSubscription}=await import('@/lib/store');const s=await req.json();if(typeof s.endpoint==='string')removeSubscription(s.endpoint);}
 return Response.json({ok:true});
}
