import { deals } from '@/lib/store';
import { sections, inWindow } from '@/lib/model';
export const dynamic='force-dynamic';
export async function GET(req:Request){const h=Number(new URL(req.url).searchParams.get('hours')||24);if(!Number.isFinite(h)||h<1||h>168)return Response.json({error:'Hours must be 1–168'},{status:400});const all=deals();const s=sections(all,h);return Response.json({generatedAt:new Date().toISOString(),hours:h,disclaimer:'Synthetic demonstration. No live news monitoring or verified trading recommendation.',sections:s,table:all.map(d=>({...d,status:inWindow(d.source.timestamp,h)?d.status:'No Change'}))});}
