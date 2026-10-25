import {readCorporateSnapshot} from '@/lib/corporate-read';
import {eventSummary} from '@/lib/corporate-events';
export const dynamic='force-dynamic';
export async function GET(){const s=await readCorporateSnapshot();return Response.json({ontologyVersion:s.ontologyVersion,generatedAt:new Date().toISOString(),events:s.models.map(m=>({modelId:m.model_id,...eventSummary(m.graph)})),notice:'Evidence confidence, completion probability and commercial FICC score are separate measures.'});}
