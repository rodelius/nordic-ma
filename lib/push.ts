import webpush from 'web-push';
import { pilotMode } from './pilot-config';
export function pushEnabled(){return pilotMode()==='demo' && !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);}
export async function notify(title:string,body:string,dealId:string){
 if(!pushEnabled()) return {sent:0,failed:0,configured:false};
 const {subscriptions,removeSubscription}=await import('./store');
 try{webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);}catch{return {sent:0,failed:subscriptions().length,configured:true,error:'Invalid VAPID configuration'};}
 let sent=0,failed=0;
 await Promise.all(subscriptions().map(async subscription=>{
 try{await webpush.sendNotification(subscription,JSON.stringify({title,body,url:`/?deal=${encodeURIComponent(dealId)}`} ),{TTL:3600});sent++;}
 catch(err){failed++;const code=(err as {statusCode?:number}).statusCode;if(code===404||code===410)removeSubscription(subscription.endpoint);}
 }));return {sent,failed,configured:true};
}
