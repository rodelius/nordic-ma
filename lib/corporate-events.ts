import schemaJson from './corporate-event-schema.json';
import catalogue from '../reference/corporate-event/corporate_event_catalogue.json';
export const ONTOLOGY_VERSION='1.0.0';
export type FieldSpec={type:string;required?:boolean;enum?:string;ref?:string;items?:string};
export type RecordSchema={idField:string;fields:Record<string,FieldSpec>};
export const EVENT_SCHEMA=schemaJson as unknown as {version:string;enums:Record<string,string[]>;workstreams:Record<string,string[]>;schemas:Record<string,RecordSchema>};
export const EVENT_TEMPLATES=catalogue.event_templates;
export type EventRecord={ [field:string]:unknown };
export type CorporateEventModel={ontology_version:string;root_event_id:string;records:Record<string,EventRecord[]>};
const ID=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;
export const currencies=()=>EVENT_SCHEMA.enums.iso_currencies;
export function decimalUnits(value:string){if(!/^-?(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/.test(value))throw Error('Use an exact decimal string (up to 20 integer and 18 fractional digits)');const negative=value.startsWith('-'),[a,b='']=value.replace(/^-/,'').split('.');return BigInt(a)*10n**18n*(negative?-1n:1n)+BigInt(b.padEnd(18,'0'))*(negative?-1n:1n);}
export function formatUnits(n:bigint){const sign=n<0n?'-':'';if(n<0n)n=-n;return sign+(n/10n**18n).toString()+((n%10n**18n)?'.'+(n%10n**18n).toString().padStart(18,'0').replace(/0+$/,''):'');}
function dateValid(v:unknown,precision?:unknown){if(typeof v!=='string')return false;if(precision==='QUARTER')return /^\d{4}-Q[1-4]$/.test(v);if(precision==='MONTH')return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(v)||!Number.isFinite(Date.parse(v)))return false;return new Date(v.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)===v.slice(0,10);}
const milestoneIds=new Map(EVENT_TEMPLATES.flatMap(t=>t.illustrative_milestones.map(m=>[m.milestone_definition_id,t.event_type_id] as const)));
export function parseCorporateEventModel(input:unknown,options:{approval?:boolean}={}):CorporateEventModel{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Corporate event model must be an object');
 const model=structuredClone(input) as CorporateEventModel;
 if(model.ontology_version!==ONTOLOGY_VERSION||!model.records||typeof model.records!=='object'||Array.isArray(model.records)||!ID.test(model.root_event_id||''))throw Error('Unsupported corporate-event ontology or invalid root');
 if(Object.keys(model).some(k=>!['ontology_version','root_event_id','records'].includes(k)))throw Error('Unknown corporate-event model field');
 if(JSON.stringify(model).length>150000)throw Error('Corporate event model exceeds 150,000 characters');
 if(Object.keys(model.records).some(k=>!EVENT_SCHEMA.schemas[k]))throw Error('Unknown corporate-event entity type');
 const lookup=new Map<string,{kind:string;record:EventRecord}>();
 for(const [kind,definition] of Object.entries(EVENT_SCHEMA.schemas)){
  const records=model.records[kind]??[];if(!Array.isArray(records)||records.length>200)throw Error(`Invalid ${kind} collection`);model.records[kind]=records;
  for(const r of records){if(!r||typeof r!=='object'||Array.isArray(r))throw Error(`Invalid ${kind} record`);const id=r[definition.idField];if(typeof id!=='string'||!ID.test(id)||lookup.has(id))throw Error(`Duplicate or invalid record ID: ${String(id)}`);lookup.set(id,{kind,record:r});
   for(const key of Object.keys(r))if(!definition.fields[key])throw Error(`Unknown ${kind}.${key}`);
  }
 }
 if(lookup.size>500)throw Error('Corporate event model exceeds 500 records');
 const ref=(v:unknown,kind?:string)=>typeof v==='string'&&(kind==='MilestoneDefinition'?milestoneIds.has(v)||lookup.get(v)?.kind===kind:lookup.has(v)&&(!kind||lookup.get(v)?.kind===kind));
 function check(v:unknown,f:FieldSpec,r:EventRecord,label:string){
  if(v===null||v===undefined){if(f.required)throw Error(`${label} is required`);return;}
  let valid=true;
  switch(f.type){
   case 'id':valid=typeof v==='string'&&ID.test(v);break;
   case 'ref':valid=ref(v,f.ref);break;
   case 'any_ref':valid=ref(v);break;
   case 'enum':valid=typeof v==='string'&&EVENT_SCHEMA.enums[f.enum!].includes(v);break;
   case 'workstream_status':valid=typeof v==='string'&&!!EVENT_SCHEMA.workstreams[String(r.workstream_type)]?.includes(v);break;
   case 'array':valid=Array.isArray(v)&&v.length<=200;if(valid)for(const item of v as unknown[])check(item,{type:f.items!,ref:f.ref,enum:f.enum,required:true},r,label);break;
   case 'decimal':case 'percentage':case 'probability':try{if(typeof v!=='string')throw Error();const n=decimalUnits(v);valid=f.type==='decimal'||(n>=0n&&n<=BigInt(f.type==='percentage'?100:1)*10n**18n);}catch{valid=false;}break;
   case 'integer':valid=Number.isSafeInteger(v)&&Number(v)>=0;break;
   case 'score':valid=Number.isInteger(v)&&Number(v)>=1&&Number(v)<=5;break;
   case 'boolean':valid=typeof v==='boolean';break;
   case 'currency':valid=typeof v==='string'&&currencies().includes(v);break;
   case 'country':valid=typeof v==='string'&&EVENT_SCHEMA.enums.iso_countries.includes(v);break;
   case 'datetime':valid=dateValid(v,r.date_precision);break;
   case 'json':valid=JSON.stringify(v).length<=16000;break;
   default:valid=typeof v==='string'&&v.length<=4000;
  }if(!valid)throw Error(`Invalid ${label}: ${f.enum||f.type}`);
 }
 for(const [kind,records] of Object.entries(model.records))for(const r of records){for(const [key,f] of Object.entries(EVENT_SCHEMA.schemas[kind].fields))check(r[key],f,r,`${kind}.${key}`);
  for(const [a,b] of [['expected_close_start','expected_close_end'],['expected_settlement_start','expected_settlement_end'],['effective_from','effective_to'],['valid_from','valid_to'],['start_at','end_at'],['exclusivity_start','exclusivity_end']])if(r[a]&&r[b]&&Date.parse(String(r[a]))>Date.parse(String(r[b])))throw Error(`${kind}: inverted date window`);
  if(kind==='CorporateEvent'&&r.model_version&&r.model_version!==ONTOLOGY_VERSION)throw Error('Event ontology version mismatch');
  if(kind==='MilestoneDefinition'&&milestoneIds.get(String(r.milestone_definition_id))!==r.event_type_id)throw Error('Milestone definition must use the fixed catalogue');
  if(kind==='MilestoneOccurrence'){const event=lookup.get(String(r.event_id))?.record,template=milestoneIds.get(String(r.milestone_definition_id));if(template&&event?.event_type_id!==template)throw Error('Milestone belongs to another event template');}
  if(kind==='StateTransition'){const domain=r.dimension==='LIFECYCLE_PHASE'?'lifecycle_phases':r.dimension==='DISPOSITION'?'dispositions':r.dimension==='OUTCOME'?'outcomes':null;const stream=r.dimension==='WORKSTREAM_STATUS'?lookup.get(String(r.workstream_id))?.record:null;const choices=domain?EVENT_SCHEMA.enums[domain]:EVENT_SCHEMA.workstreams[String(stream?.workstream_type)];for(const key of ['prior_value','new_value'])if(r[key]!=null&&(!choices||!choices.includes(String(r[key]))))throw Error('Transition value does not belong to its state dimension');}
  if(r.allocated_notional!=null&&decimalUnits(String(r.allocated_notional))<0n)throw Error('Negative allocation');
  if(kind==='HedgeExposureAllocation'&&r.allocated_notional!=null){const h=lookup.get(String(r.hedge_id))?.record;if(r.currency&&h?.notional_currency&&r.currency!==h.notional_currency)throw Error('Hedge allocations must use the contract notional currency');}
  if(['Hedge','RiskExposure','FundingInstrument'].includes(kind))for(const key of ['notional','committed_amount','drawn_amount'])if(r[key]!=null&&decimalUnits(String(r[key]))<0n)throw Error('Financial notionals must be non-negative');
  if(kind==='Condition'&&r.state==='WAIVED'&&r.waiver_permitted===false)throw Error('A condition cannot be waived without permission');
  if(kind==='EconomicLeg'){const values=['amount_min','amount_base','amount_max'].map(k=>r[k]);for(const value of values)if(value!=null&&decimalUnits(String(value))<0n)throw Error('Cash-leg amounts must be non-negative; use payer/payee for direction');if(values[0]!=null&&values[1]!=null&&decimalUnits(String(values[0]))>decimalUnits(String(values[1]))||values[1]!=null&&values[2]!=null&&decimalUnits(String(values[1]))>decimalUnits(String(values[2]))||values[0]!=null&&values[2]!=null&&decimalUnits(String(values[0]))>decimalUnits(String(values[2])))throw Error('Inverted economic-leg amount range');}
  if(kind==='EventRelationship'&&r.from_event_id===r.to_event_id)throw Error('An event cannot relate to itself');
  if(kind==='ClaimSupport'&&lookup.get(String(r.target_id))?.kind!==r.target_type)throw Error('Claim-support target type mismatch');
  if(kind==='Claim'&&r.value!=null){const domains:Record<string,string>={EVENT_TYPE:'event_types',LIFECYCLE_PHASE:'lifecycle_phases',FUNDING_STATUS:'funding_certainties',MILESTONE_STATUS:'milestone_statuses',CONDITION_STATUS:'condition_states',PARTY_ROLE:'party_roles',CONSIDERATION_CURRENCY:'iso_currencies',BUYER_FUNDING_CURRENCY:'iso_currencies',SELLER_PROCEEDS_CURRENCY:'iso_currencies'};const domain=domains[String(r.predicate)];if(domain&&(!EVENT_SCHEMA.enums[domain].includes(String(r.value))||typeof r.value!=='string'))throw Error('Claim value does not belong to its predicate enum');if(r.predicate==='EVENT_COMPLETION'&&typeof r.value!=='boolean')throw Error('Event completion claim must be boolean');}
  if(kind==='Forecast'&&r.estimate_unit){const type=r.estimate_unit==='PROBABILITY'?'probability':r.estimate_unit==='DATE'?'datetime':'decimal';for(const key of ['estimate','low','high'])if(r[key]!=null)check(r[key],{type},r,'Forecast.'+key);}
  if(kind==='Forecast'&&r.target==='COMPLETION_PROBABILITY'){if(r.estimate_unit!=null&&r.estimate_unit!=='PROBABILITY')throw Error('Completion probability needs an explicit probability unit');for(const k of ['estimate','low','high'])if(r[k]!=null)check(r[k],{type:'probability'},r,'Forecast.'+k);}
 }
 if(lookup.get(model.root_event_id)?.kind!=='CorporateEvent')throw Error('Root must reference a CorporateEvent');
 if(options.approval)for(const event of model.records.CorporateEvent)for(const field of ['event_type_id','lifecycle_phase','disposition'])if(!event[field])throw Error(`Corporate event: ${field.replaceAll('_',' ')} is required`);
 // Detect cycles in hierarchical legs and milestone dependencies, not in parallel workstream ordering.
 for(const kind of ['EconomicLeg','Claim','MilestoneOccurrence','StateTransition']){const field={EconomicLeg:'parent_leg_id',Claim:'supersedes_claim_id',MilestoneOccurrence:'supersedes_occurrence_id',StateTransition:'supersedes_transition_id'}[kind]!;for(const r of model.records[kind]){const seen=new Set([String(r[EVENT_SCHEMA.schemas[kind].idField])]);let parent=r[field];while(parent){if(seen.has(String(parent)))throw Error('Cyclic '+kind+' relationship');seen.add(String(parent));parent=lookup.get(String(parent))?.record[field];}}}
 const edges=new Map<string,string[]>();for(const d of model.records.Dependency){if(!d.predecessor_id||!d.successor_id)continue;const a=String(d.predecessor_id),b=String(d.successor_id);edges.set(a,[...(edges.get(a)||[]),b]);}const done=new Set<string>(),visiting=new Set<string>();function visit(id:string){if(visiting.has(id))throw Error('Cyclic milestone dependencies');if(done.has(id))return;visiting.add(id);for(const target of edges.get(id)||[])visit(target);visiting.delete(id);done.add(id);}for(const id of edges.keys())visit(id);
 for(const h of model.records.Hedge){const currencies=(h.currencies||[]) as string[];if(new Set(currencies).size!==currencies.length)throw Error('Hedge currencies must be distinct');if(['FX_FORWARD','FX_OPTION','CONTINGENT_FX','CROSS_CURRENCY_SWAP'].includes(String(h.product))&&currencies.length>0&&currencies.length!==2)throw Error('FX hedge requires a base and quote currency');if(['IRS','RATE_CAP','RATE_COLLAR','INFLATION_SWAP','COMMODITY_HEDGE'].includes(String(h.product))&&currencies.length>1)throw Error('This hedge product uses one currency');if(h.notional_currency&&currencies.length&&!currencies.includes(String(h.notional_currency)))throw Error('Notional currency must belong to the hedge currencies');const allocated=model.records.HedgeExposureAllocation.filter(a=>a.hedge_id===h.hedge_id&&a.currency&&a.currency===h.notional_currency).reduce((n,a)=>n+(a.allocated_notional==null?0n:decimalUnits(String(a.allocated_notional))),0n);if(h.notional!=null&&allocated>decimalUnits(String(h.notional)))throw Error('Hedge allocations exceed contract notional');}
 return model;
}
export function corporateState(model:CorporateEventModel){return model.records.CorporateEvent.find(e=>e.event_id===model.root_event_id)!;}
export function economicTotals(model:CorporateEventModel,selections:Record<string,string>={}){
 const parents=new Set(model.records.EconomicLeg.map(l=>l.parent_leg_id).filter(Boolean));const totals=new Map<string,bigint>();let excluded=0;
 for(const l of model.records.EconomicLeg){if(parents.has(l.leg_id)||!l.payer_id||!l.payee_id||l.internal_group_flag!==false||l.amount_base==null||!l.currency||l.gross_net_basis!=='GROSS'||l.mutually_exclusive_group_id&&selections[String(l.mutually_exclusive_group_id)]!==l.leg_id){excluded++;continue;}const key=[l.payer_id||'unknown payer',l.payee_id||'unknown payee',l.currency,l.flow_type||'unknown flow'].join('|');totals.set(key,(totals.get(key)||0n)+decimalUnits(String(l.amount_base)));}
 return {grossCashFlows:[...totals].map(([key,n])=>({key,amount:formatUnits(n)})),excluded,notice:'Gross scenario cash flows only; no net exposure, probability weighting, currency conversion or financing-instrument amounts included.'};
}
export type CorporateModelRow={model_id:string;graph:CorporateEventModel;revision:number;updated_at:string};
export function blankCorporateEvent(source?:{id:string;headline:string;url:string;published_at:string;excerpt?:string;source?:string;created_at?:string}):CorporateEventModel{
 const records=Object.fromEntries(Object.keys(EVENT_SCHEMA.schemas).map(kind=>[kind,[]])) as CorporateEventModel['records'];
 const model:CorporateEventModel={ontology_version:ONTOLOGY_VERSION,root_event_id:'event-main',records};
 records.CorporateEvent=[{event_id:'event-main',title:source?.headline||'Unclassified corporate event',event_type_id:null,lifecycle_phase:null,disposition:null,outcome:'UNKNOWN',model_version:ONTOLOGY_VERSION}];
 if(source){records.SourceDocument=[{source_id:'source-current',url_or_internal_ref:source.url,publication_at:source.published_at,source_type:'UNKNOWN',issuer:source.source||(/news\.cision\.com/i.test(source.url)?'Cision':'Source'),retrieved_at:source.created_at||new Date().toISOString(),access_scope:'PUBLIC'}];records.EventSource=[{event_source_id:'event-source',event_id:'event-main',source_id:'source-current'}];}

 if(source){model.records.Claim=[{claim_id:'source-excerpt',source_id:'source-current',subject_id:model.root_event_id,predicate:'SOURCE_EXCERPT',value:(source.excerpt||source.headline).slice(0,12000),assertion_type:'REPORTED_FACT',review_state:'UNREVIEWED',observed_at:new Date().toISOString()}];}
 return model;
}
export function attachCorporateSource(model:CorporateEventModel,source:{id:string;headline:string;url:string;published_at:string;excerpt?:string;source?:string;created_at?:string}){
 const g=structuredClone(model),id='source-'+source.id.replace(/[^A-Za-z0-9._:/-]/g,'-').slice(0,120);
 if(!g.records.SourceDocument.some(s=>s.url_or_internal_ref===source.url)){g.records.SourceDocument.push({source_id:id,url_or_internal_ref:source.url,publication_at:source.published_at,source_type:'ISSUER_ANNOUNCEMENT',issuer:source.source||(/news\.cision\.com/i.test(source.url)?'Cision':'Source'),retrieved_at:source.created_at||new Date().toISOString(),access_scope:'PUBLIC'});g.records.EventSource.push({event_source_id:'link-'+id,event_id:g.root_event_id,source_id:id});g.records.Claim.push({claim_id:'claim-'+id,source_id:id,subject_id:g.root_event_id,predicate:'SOURCE_EXCERPT',value:(source.excerpt||source.headline).slice(0,12000),assertion_type:'REPORTED_FACT',review_state:'UNREVIEWED',observed_at:new Date().toISOString()});}
 return g;
}
export function eventScore(g:CorporateEventModel){return Math.max(0,...g.records.Opportunity.map(o=>Number(o.ficc_score)||0));}
export function eventSummary(g:CorporateEventModel){const root=corporateState(g);return {title:String(root.title||'Untitled event'),type:String(root.event_type_id||'UNCLASSIFIED'),phase:String(root.lifecycle_phase||'UNKNOWN'),disposition:String(root.disposition||'UNKNOWN'),score:eventScore(g),countries:[...new Set(g.records.EventJurisdiction.map(j=>String(j.country)))],parties:g.records.EventParty.map(p=>({role:String(p.role||'UNKNOWN'),name:String(g.records.Entity.find(e=>e.entity_id===p.entity_id)?.legal_name||'Unknown party')}))};}
