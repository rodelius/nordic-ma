import {EVENT_SCHEMA,blankCorporateEvent,parseCorporateEventModel,type CorporateEventModel,type EventRecord} from './corporate-events';
import type {ArticleSnapshot} from './article-source';
import {populated,display} from './manual-review';
export const EXTRACTION_VERSION='python-rules-v1';
export const EXTRACT_FIELDS:Record<string,string[]>={
 CorporateEvent:['title','event_type_id','lifecycle_phase','disposition','outcome','legal_structure','expected_close_start','expected_close_end','actual_completion_at','economic_purpose','execution_route','ownership_outcome','ownership_transition','financing_structure','initiation','board_support','offer_obligation','scope','consideration_types','separation_method'],
 Entity:['legal_name','LEI','registration_number','domicile','reporting_currency','entity_type'],
 EventParty:['entity_id','role','ownership_before','ownership_after','control_rights','valid_from','valid_to','party_class'],
 EventJurisdiction:['country','nexus_entity_id','nexus_role'],
 FundingInstrument:['borrower_id','instrument_type','currency','committed_amount','drawn_amount','availability_end','maturity','rate_index','margin','fixed_rate','priority','certainty_status','rate_profile'],
 EconomicLeg:['funding_id','payer_id','payee_id','flow_type','asset_or_instrument','currency','amount_min','amount_base','amount_max','measurement_basis','gross_net_basis','expected_settlement_start','expected_settlement_end','internal_group_flag'],
 WorkstreamInstance:['workstream_type','status'],
 Condition:['condition_type','authority_or_counterparty','state','waiver_permitted','jurisdiction','deadline','approval_expiry'],
};
export type EvidenceField={value:unknown;quote:string;start:number;end:number;ruleId?:string};
export type ExtractedRecord={key:string;kind:string;fields:Record<string,EvidenceField>};
export type Extraction={version:string;records:ExtractedRecord[];providerModel?:string;engineName?:string;notes?:string[];rulesMatched?:string[];requestHash?:string};
const keyPattern=/^[a-z][a-z0-9_-]{0,49}$/;
export function validateExtraction(raw:unknown,article:ArticleSnapshot,source:{id:string;headline:string;url:string;published_at:string;source?:string},runId:string):Extraction{
 if(!raw||typeof raw!=='object'||!Array.isArray((raw as {records:unknown}).records))throw Error('Parser response must contain evidence-linked records');
 const rows=(raw as {records:unknown[]}).records;if(rows.length>25)throw Error('Too many proposed records');const keys=new Set<string>();let count=0;
 const records=rows.map(value=>{
  if(!value||typeof value!=='object')throw Error('Invalid proposed record');const r=value as ExtractedRecord;
  if(!EXTRACT_FIELDS[r.kind]||typeof r.key!=='string'||!keyPattern.test(r.key)||keys.has(r.key)||r.kind==='CorporateEvent'&&r.key!=='event'||r.kind!=='CorporateEvent'&&r.key==='event')throw Error('Invalid or duplicate extraction record');keys.add(r.key);
  if(!r.fields||typeof r.fields!=='object'||Array.isArray(r.fields))throw Error('Invalid proposed fields');const fields:Record<string,EvidenceField>={};
  for(const [field,untrusted] of Object.entries(r.fields)){
   if(!EXTRACT_FIELDS[r.kind].includes(field)||!untrusted||typeof untrusted!=='object')throw Error('Unsupported extraction field: '+r.kind+'.'+field);
   const {value,quote}=untrusted;if(!populated(value))continue;if(typeof quote!=='string'||quote.trim().length<12||quote.length>800)throw Error('Each proposed field needs a 12–800 character article quotation');
   const start=article.text.indexOf(quote);if(start<0)throw Error('Evidence quotation does not occur in the retrieved article');if(++count>60)throw Error('Too many proposed fields');const ruleId=typeof untrusted.ruleId==='string'&&/^[a-z0-9-]{1,80}$/.test(untrusted.ruleId)?untrusted.ruleId:undefined;fields[field]={value,quote,start,end:start+quote.length,...(ruleId?{ruleId}:{})};
  }
  if(!Object.keys(fields).length)throw Error('Empty proposed record');return {key:r.key,kind:r.kind,fields};
 });
 const extraction={version:EXTRACTION_VERSION,records};
 // Schema and cross-record validation are independent of what the model claims.
 const base=blankCorporateEvent(source);applyExtraction(base,extraction,article,runId,records.flatMap(r=>Object.keys(r.fields).map(f=>r.key+'.'+f)),true);
 return extraction;
}
export function suggestedGraph(source:{id:string;headline:string;url:string;published_at:string;source?:string},extraction:Extraction,article:ArticleSnapshot,runId:string){return applyExtraction(blankCorporateEvent(source),extraction,article,runId,extraction.records.flatMap(r=>Object.keys(r.fields).map(f=>r.key+'.'+f)));}
const norm=(v:unknown)=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
// Deliberately conservative. Ambiguous records are left for manual matching.
export function matchRecord(graph:CorporateEventModel,record:ExtractedRecord,refs:Record<string,string>={}):EventRecord|undefined{
 const rows=graph.records[record.kind]||[];if(record.kind==='CorporateEvent')return rows.find(r=>r.event_id===graph.root_event_id);
 const identity:Record<string,string[]>={Entity:['legal_name'],EventParty:['entity_id','role'],EventJurisdiction:['country','nexus_entity_id'],FundingInstrument:['instrument_type','borrower_id'],EconomicLeg:['flow_type','payer_id','payee_id'],WorkstreamInstance:['workstream_type'],Condition:['condition_type','authority_or_counterparty']};
 const keys=(identity[record.kind]||[]).filter(k=>populated(record.fields[k]?.value));if(!keys.length)return;
 const candidates=rows.filter(r=>keys.every(k=>{const v=record.fields[k].value;const spec=EVENT_SCHEMA.schemas[record.kind].fields[k];return norm(r[k])===norm(spec.type==='ref'?refs[String(v)]:v);}));return candidates.length===1?candidates[0]:undefined;
}
export function applyExtraction(base:CorporateEventModel,extraction:Extraction,article:ArticleSnapshot,runId:string,selected:string[],validateOnly=false){
 validateSelectedFields(extraction,selected);
 const g=structuredClone(base),selection=new Set(selected),refs:Record<string,string>={event:g.root_event_id};const active=extraction.records.filter(r=>Object.keys(r.fields).some(f=>selection.has(r.key+'.'+f)));
 for(const r of active){const existing=validateOnly?undefined:matchRecord(g,r,refs);refs[r.key]=r.kind==='CorporateEvent'?g.root_event_id:String(existing?.[EVENT_SCHEMA.schemas[r.kind].idField]||`extract-${runId}-${r.key}`);}
 // Re-evaluate references after parties are mapped; response ordering must not change identity.
 for(const r of active)if(r.kind!=='Entity'&&r.kind!=='CorporateEvent'&&!validateOnly){const existing=matchRecord(g,r,refs);if(existing)refs[r.key]=String(existing[EVENT_SCHEMA.schemas[r.kind].idField]);}
 let source=g.records.SourceDocument.find(d=>d.url_or_internal_ref===article.url);if(!source){source={source_id:`extract-${runId}-source`,url_or_internal_ref:article.url,access_scope:'PUBLIC'};g.records.SourceDocument.push(source);g.records.EventSource.push({event_source_id:`extract-${runId}-event-source`,event_id:g.root_event_id,source_id:source.source_id});}
 source.document_hash=article.hash;source.retrieved_at=article.retrievedAt;source.source_type='ISSUER_ANNOUNCEMENT';
 for(const r of active){const id=refs[r.key],idField=EVENT_SCHEMA.schemas[r.kind].idField;let target=g.records[r.kind].find(row=>row[idField]===id);if(!target){target={[idField]:id};if(EVENT_SCHEMA.schemas[r.kind].fields.event_id)target.event_id=g.root_event_id;g.records[r.kind].push(target);}
  for(const [field,evidence] of Object.entries(r.fields)){if(!selection.has(r.key+'.'+field))continue;const spec=EVENT_SCHEMA.schemas[r.kind].fields[field];let value=evidence.value;if(spec.type==='ref'){const reference=extraction.records.find(x=>x.key===value);if(!reference||reference.kind!==spec.ref||!refs[String(value)])throw Error('Select the referenced '+String(spec.ref)+' record before applying '+field);value=refs[String(value)];}
   target[field]=value;
   const claimId=`extract-${runId}-${r.key}-${field}`;g.records.Claim=g.records.Claim.filter(c=>c.claim_id!==claimId);g.records.ClaimSupport=g.records.ClaimSupport.filter(c=>c.claim_id!==claimId);
   const predicate=({'CorporateEvent.event_type_id':'EVENT_TYPE','CorporateEvent.lifecycle_phase':'LIFECYCLE_PHASE','CorporateEvent.actual_completion_at':'EVENT_COMPLETION','EventParty.role':'PARTY_ROLE','FundingInstrument.certainty_status':'FUNDING_STATUS','Condition.state':'CONDITION_STATUS'} as Record<string,string>)[r.kind+'.'+field]||'OTHER';g.records.Claim.push({claim_id:claimId,source_id:source.source_id,subject_id:id,predicate,value:predicate==='OTHER'?{field,value,extraction_run_id:runId,article_hash:article.hash,start:evidence.start,end:evidence.end}:predicate==='EVENT_COMPLETION'?true:value,...(predicate==='EVENT_COMPLETION'?{effective_at:value}:{}),evidence_excerpt:evidence.quote,assertion_type:'REPORTED_FACT',review_state:'UNREVIEWED',observed_at:article.retrievedAt});g.records.ClaimSupport.push({support_id:claimId+'-support',claim_id:claimId,target_type:r.kind,target_id:id});
  }
 }
 return parseCorporateEventModel(g);
}
export function proposalLabel(record:ExtractedRecord){return record.kind==='CorporateEvent'?'Corporate event':record.fields.legal_name?display(record.fields.legal_name.value):record.kind.replace(/([a-z])([A-Z])/g,'$1 $2');}
export function validateSelectedFields(extraction:Extraction,selected:unknown):asserts selected is string[]{
 const fields=new Set(extraction.records.flatMap(r=>Object.keys(r.fields).map(f=>r.key+'.'+f)));if(!Array.isArray(selected)||selected.length>60||new Set(selected).size!==selected.length||selected.some(s=>typeof s!=='string'||!fields.has(s)))throw Error('Invalid extraction field selection');
}
