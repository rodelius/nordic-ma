import {livePushReady,monitoringEnabled} from '@/lib/live-config';
import {readCorporateSnapshot} from '@/lib/corporate-read';
export const dynamic='force-dynamic';
export async function GET(){try{const s=await readCorporateSnapshot();return Response.json({mode:s.mode,stage:s.stage,readOnly:s.stage<2,database:'reachable',ontologyVersion:s.ontologyVersion,corporateEvents:s.models.length,liveIngestion:monitoringEnabled(),notifications:livePushReady()});}catch(e){return Response.json({error:(e as Error).message},{status:503});}}
