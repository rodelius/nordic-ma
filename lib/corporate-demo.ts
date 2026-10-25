import {blankCorporateEvent,parseCorporateEventModel,type CorporateModelRow} from './corporate-events';
export function demoCorporateModels():CorporateModelRow[]{return [['alpha','Project Alpha','PUBLIC_OFFER','CONDITIONS_AND_EXECUTION','SE',5],['fjord','Project Fjord','REFI_LOAN','COMMITMENT','NO',4],['boreal','Project Boreal','IPO','PREPARATION','FI',3]].map(([id,title,type,phase,country,score])=>{
 const g=blankCorporateEvent({id:String(id),headline:String(title)+' · synthetic event',url:'https://example.com/synthetic/'+id,published_at:new Date(Date.now()-3600000).toISOString(),excerpt:'Synthetic demonstration, not market information.'});
 const event=g.records.CorporateEvent[0];Object.assign(event,{title,event_type_id:type,lifecycle_phase:phase,disposition:'ACTIVE'});
 g.records.Entity.push({entity_id:'client',legal_name:'Illustrative corporate client',entity_type:'COMPANY'});
 g.records.EventParty.push({event_party_id:'client-party',event_id:g.root_event_id,entity_id:'client',role:'BORROWER'});
 g.records.Claim.push({claim_id:'nordic',source_id:'source-current',subject_id:g.root_event_id,predicate:'NORDIC_NEXUS',value:'Synthetic '+country+' operating business',assertion_type:'MODEL_ESTIMATE',review_state:'ACCEPTED'});
 g.records.EventJurisdiction.push({jurisdiction_id:'nordic-nexus',event_id:g.root_event_id,country,nexus_entity_id:'client',nexus_claim_id:'nordic',nexus_role:'OPERATIONS'});
 g.records.Opportunity.push({opportunity_id:'opportunity-main',event_id:g.root_event_id,client_entity_id:'client',product_family:'FX',exposure_status:'POTENTIAL',urgency:'MEDIUM',ficc_score:score,next_action:'VERIFY_EXPOSURE',rationale_codes:['INSUFFICIENT_EVIDENCE'],status:'VALIDATING'});
 return {model_id:String(id),graph:parseCorporateEventModel(g),revision:1,updated_at:new Date().toISOString()};
 });}
