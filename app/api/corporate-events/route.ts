import {readCorporateSnapshot} from '@/lib/corporate-read';
import {parseCorporateEventModel} from '@/lib/corporate-events';
import {authorized} from '@/lib/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(await readCorporateSnapshot());}catch(e){return Response.json({error:(e as Error).message},{status:503});}}
export async function POST(req:Request){if(!authorized(req))return Response.json({error:'Authenticated canonical ingestion required'},{status:401});try{const text=await req.text();if(text.length>180000)throw Error('Model too large');const input=JSON.parse(text),graph=parseCorporateEventModel(input.graph,{approval:true});const {writeCorporateModel}=await import('@/lib/corporate-store');return Response.json(writeCorporateModel(graph,input.modelId,input.expectedVersion||0),{status:201});}catch(e){return Response.json({error:(e as Error).message},{status:400});}}
