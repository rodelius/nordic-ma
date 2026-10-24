import { saveSubscription, removeSubscription } from '@/lib/store';
import { pushEnabled } from '@/lib/push';
export const runtime='nodejs';
export async function GET(){return Response.json({configured:pushEnabled(),publicKey:process.env.VAPID_PUBLIC_KEY||null});}
export async function POST(req:Request){
 if(!pushEnabled())return Response.json({error:'Web push is not configured'},{status:503});
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 try{const s=await req.json();const u=new URL(s.endpoint);
 // Restrict outbound requests to browser push services to prevent SSRF.
 const allowed=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'];
 if(u.protocol!=='https:'||u.port||u.username||u.password||!allowed.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))||!s.keys||typeof s.keys.auth!=='string'||typeof s.keys.p256dh!=='string'||s.endpoint.length>4096)throw Error('Invalid push subscription');
 saveSubscription(s);return Response.json({ok:true});
 }catch{return Response.json({error:'Invalid subscription'},{status:400});}
}
export async function DELETE(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const s=await req.json();if(typeof s.endpoint==='string')removeSubscription(s.endpoint);return Response.json({ok:true});
}
