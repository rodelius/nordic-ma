import { jobsAuthorized } from '@/lib/live-config';
import { scanSource,deliverNotifications } from '@/lib/live-jobs';
export const dynamic='force-dynamic';export const maxDuration=60;
export async function GET(req:Request){
 if(!jobsAuthorized(req))return Response.json({error:'Job authorization required'},{status:401});
 let scan;try{scan=await scanSource();}catch{scan={error:'Source scan failed; inspect source run history'};}
 // Dispatch already-reviewed events even when a source is temporarily unavailable.
 try{return Response.json({scan,delivery:await deliverNotifications()},{status:'error'in scan?503:200});}catch{return Response.json({scan,error:'Notification worker failed'},{status:503});}
}
