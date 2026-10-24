import { notify } from '@/lib/push';
import { authorized } from '@/lib/auth';
import { parseDeal } from '@/lib/model';
import { readSnapshot } from '@/lib/read-model';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(await readSnapshot());}catch{return Response.json({error:'Could not read transaction data'},{status:503});}}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({error:'Bearer ingestion token required'},{status:401});
 try{const body=await req.text();if(body.length>64000)return Response.json({error:'Deal too large'},{status:413});const deal=parseDeal(JSON.parse(body));const {createDeal}=await import('@/lib/store');const id=createDeal(deal);const push=deal.score>=3?await notify(`${deal.target} · New transaction`,deal.delta,id):null;return Response.json({id,push},{status:201});}
 catch(e){return Response.json({error:(e as Error).message},{status:400});}
}
