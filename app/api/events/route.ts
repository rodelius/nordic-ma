import { authorized } from '@/lib/auth';
import { parseEvent } from '@/lib/model';
import { notify } from '@/lib/push';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!authorized(request))return Response.json({error:'Configure INGEST_TOKEN and supply a Bearer token.'},{status:401});
 if(Number(request.headers.get('content-length')||0)>16000)return Response.json({error:'Event too large'},{status:413});
 try{
 const body=await request.text();if(body.length>16000)return Response.json({error:'Event too large'},{status:413});
 const {addEvent,markScan,deals}=await import('@/lib/store');
 const result=addEvent(parseEvent(JSON.parse(body))); markScan();
 let push=null;
 if(result.event?.material){const d=deals().find(d=>d.id===result.event!.dealId)!;
 if(d.score>=3)push=await notify(`${d.synthetic?'DEMO · ':''}${d.target} · ${d.stage}`,result.event.delta,d.id);}
 return Response.json({...result,push});
 }catch(err){return Response.json({error:err instanceof Error?err.message:'Invalid event'},{status:400});}
}
