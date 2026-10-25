import {EVENT_SCHEMA,decimalUnits,type CorporateEventModel} from './corporate-events';
import {EXTRACT_FIELDS,matchRecord,type Extraction} from './extraction';
import {populated} from './manual-review';
const known=(v:unknown)=>populated(v)&&!['UNKNOWN','Unclear'].includes(String(v));
function canonical(value:unknown,kind:string,field:string){const spec=EVENT_SCHEMA.schemas[kind].fields[field];if(['decimal','percentage','probability'].includes(spec.type)&&typeof value==='string')return decimalUnits(value).toString();if(spec.type==='datetime'&&typeof value==='string'&&value.includes('T')&&Number.isFinite(Date.parse(value)))return String(Date.parse(value));if(Array.isArray(value))return JSON.stringify([...value].sort());return typeof value==='string'?value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase():JSON.stringify(value);}
export function evaluateExtraction(extraction:Extraction,review:CorporateEventModel){
 const refs:Record<string,string>={event:review.root_event_id};
 for(const r of extraction.records.filter(r=>r.kind==='Entity')){const target=matchRecord(review,r);if(target)refs[r.key]=String(target[EVENT_SCHEMA.schemas[r.kind].idField]);}
 for(const r of extraction.records.filter(r=>r.kind!=='Entity')){const target=matchRecord(review,r,refs);if(target)refs[r.key]=String(target[EVENT_SCHEMA.schemas[r.kind].idField]);}
 let suggested=0,compared=0,correct=0,unadjudicated=0,referenceFields=0;const covered=new Set<string>();const differences:{kind:string;field:string;suggested:unknown;reviewed:unknown;reason:string}[]=[];
 const byKind:Record<string,{referenceFields:number;compared:number;correct:number}>={};
 for(const [kind,fields] of Object.entries(EXTRACT_FIELDS)){byKind[kind]={referenceFields:0,compared:0,correct:0};for(const r of review.records[kind])for(const field of fields)if(known(r[field])){referenceFields++;byKind[kind].referenceFields++;}}
 for(const r of extraction.records){const target=matchRecord(review,r,refs);for(const [field,p] of Object.entries(r.fields)){if(!known(p.value))continue;suggested++;
  if(!target||!known(target[field])){unadjudicated++;differences.push({kind:r.kind,field,suggested:p.value,reviewed:null,reason:target?'No populated review reference':'No unique matching reviewed record'});continue;}
  const referenceKey=r.kind+':'+target[EVENT_SCHEMA.schemas[r.kind].idField]+':'+field;if(covered.has(referenceKey)){unadjudicated++;differences.push({kind:r.kind,field,suggested:p.value,reviewed:target[field],reason:'Duplicate suggestion for the same reviewed field'});continue;}
  let value=p.value;const spec=EVENT_SCHEMA.schemas[r.kind].fields[field];if(spec.type==='ref')value=refs[String(value)]||'unmatched-reference';compared++;byKind[r.kind].compared++;covered.add(referenceKey);
  if(canonical(value,r.kind,field)===canonical(target[field],r.kind,field)){correct++;byKind[r.kind].correct++;}else differences.push({kind:r.kind,field,suggested:p.value,reviewed:target[field],reason:'Differs from saved review'});
 }}
 return {metricVersion:'review-agreement-v1',suggested,compared,correct,unadjudicated,referenceFields,coveredFields:covered.size,agreement:compared?correct/compared:null,coverage:referenceFields?covered.size/referenceFields:null,byKind,differences,notice:'Exact agreement with populated saved-review fields, not independently verified factual accuracy. Unmatched or unknown review fields are unadjudicated. Coverage is reported separately; no automatic activation threshold.'};
}
export function summarizeEvaluations(runs:{id:string;source_id:string;status:string;extractor_version:string;model_name:string;created_at:string}[],evaluations:{run_id:string;source_version:number;programme_group:string;metrics:ReturnType<typeof evaluateExtraction>}[],reviews:{id:string;review_version:number}[]){
 const current=new Map(reviews.map(r=>[r.id,r.review_version])),seen=new Set<string>(),variants=new Map<string,{version:string;model:string;cases:number;groups:Set<string>;compared:number;correct:number;covered:number;reference:number;unadjudicated:number;staleOrMissing:number;failedCases:number;inProgress:number}>();
 for(const run of [...runs].sort((a,b)=>b.created_at.localeCompare(a.created_at))){const variant=run.extractor_version+' / '+run.model_name,key=variant+' / '+run.source_id;if(seen.has(key))continue;seen.add(key);let row=variants.get(variant);if(!row){row={version:run.extractor_version,model:run.model_name,cases:0,groups:new Set(),compared:0,correct:0,covered:0,reference:0,unadjudicated:0,staleOrMissing:0,failedCases:0,inProgress:0};variants.set(variant,row);}
  if(run.status==='failed'){row.failedCases++;continue;}if(run.status!=='succeeded'){row.inProgress++;continue;}
  const evaluation=evaluations.find(e=>e.run_id===run.id&&e.source_version===current.get(run.source_id));if(!evaluation){row.staleOrMissing++;continue;}const m=evaluation.metrics;row.cases++;row.groups.add(evaluation.programme_group);row.compared+=m.compared;row.correct+=m.correct;row.covered+=m.coveredFields;row.reference+=m.referenceFields;row.unadjudicated+=m.unadjudicated;
 }
 return [...variants.values()].map(r=>({...r,groups:r.groups.size,agreement:r.compared?r.correct/r.compared:null,coverage:r.reference?r.covered/r.reference:null}));
}
