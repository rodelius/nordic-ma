import { notify } from '@/lib/push';
import { authorized } from '@/lib/auth';
import { parseDeal } from '@/lib/model';
import { deals, events, lastScan, createDeal } from '@/lib/store';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(){return Response.json({deals:deals(),events:events(),lastScan:lastScan()||null,mode:deals().every(d=>d.synthetic)?'demo':'mixed'});}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({error:'Bearer ingestion token required'},{status:401});
 try{const body=await req.text();if(body.length>64000)return Response.json({error:'Deal too large'},{status:413});const deal=parseDeal(JSON.parse(body));const id=createDeal(deal);const push=deal.score>=3?await notify(`${deal.target} · New transaction`,deal.delta,id):null;return Response.json({id,push},{status:201});}
 catch(e){return Response.json({error:(e as Error).message},{status:400});}
}
