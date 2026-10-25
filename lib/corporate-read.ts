import {pilotMode} from './pilot-config';
import {stage2Enabled} from './live-config';
import type {CorporateModelRow} from './corporate-events';
export async function readCorporateSnapshot(){
 if(pilotMode()==='pilot'){const {requirePilotMember}=await import('./supabase/server');const {client}=await requirePilotMember();const [models,announcements]=await Promise.all([client.from('corporate_event_models').select('*').order('updated_at',{ascending:false}).limit(1000),client.from('corporate_announcements').select('*').order('recorded_at',{ascending:false}).limit(200)]);if(models.error||announcements.error)throw Error('Apply corporate-event migration 007');return {models:models.data as CorporateModelRow[],announcements:announcements.data,mode:'pilot',stage:stage2Enabled()?2:1,ontologyVersion:'1.0.0'};}
 const {readCorporateModels}=await import('./corporate-store');return {models:readCorporateModels(),announcements:[],mode:'demo',stage:0,ontologyVersion:'1.0.0'};
}
