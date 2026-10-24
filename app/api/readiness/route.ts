import { readSnapshot } from '@/lib/read-model';
export const dynamic='force-dynamic';
export async function GET(){try{const s=await readSnapshot();return Response.json({mode:s.mode,stage:1,readOnly:s.readOnly,database:'reachable',foundationVersion:s.foundationVersion,validationMarker:s.validationMarker,transactions:s.deals.length,liveIngestion:false,notifications:false});}catch{return Response.json({error:'Database readiness check failed'},{status:503});}}
