import { stage2Enabled } from './live-config';
import { pilotMode } from './pilot-config';
import type { Deal,DealEvent } from './model';
export async function readSnapshot(){
 if(pilotMode()==='pilot'){
  const {requirePilotMember}=await import('./supabase/server');
  const {client}=await requirePilotMember();
  const results=await Promise.all([
   client.from('deals').select('body').order('updated_at',{ascending:false}).limit(1000),
   client.from('deal_events').select('body').order('created_at',{ascending:false}).limit(200),
   client.from('monitor_state').select('key,value').in('key',['last_ingestion','foundation_version','validation_marker']),
  ]);
  if(results.some(r=>r.error))throw Error('Pilot database read failed; verify the Stage 1 migration');
  const state=Object.fromEntries((results[2].data||[]).map(row=>[row.key,row.value]));
  if(!['stage-1','stage-2'].includes(state.foundation_version)||(stage2Enabled()&&state.foundation_version!=='stage-2'))throw Error('Unexpected pilot schema version');
  return {deals:(results[0].data||[]).map(r=>r.body as Deal),events:(results[1].data||[]).map(r=>r.body as DealEvent),lastScan:state.last_ingestion||null,foundationVersion:state.foundation_version,validationMarker:state.validation_marker||null,mode:'pilot' as const,readOnly:!stage2Enabled(),stage:stage2Enabled()?2:1};
 }
 const demo=await import('./store');
 const all=demo.deals();return {deals:all,events:demo.events(),lastScan:demo.lastScan()||null,mode:all.every(d=>d.synthetic)?'demo' as const:'mixed' as const,readOnly:false,stage:0,foundationVersion:'local-demo',validationMarker:null};
}
