export type Confidence = 'High' | 'Medium' | 'Low';
export type Status = 'New' | 'Updated' | 'No Change' | 'Closed' | 'Failed';
export type Evidence = { label: string; value: string; kind: 'Fact' | 'Inference' | 'Unknown' };
export type Deal = {
 id: string; target: string; country: string; sector: string; seller: string; buyer: string;
 stage: string; status: Status; value: string; score: number; rationale: string; pair: string;
 buyerFx: 'Yes' | 'No' | 'Unclear'; sellerFx: 'Yes' | 'No' | 'Unclear'; classification: string;
 notional: string; angle: string; rates: string; delta: string; action: string; owner: string;
 confidence: Confidence; catalyst: string; timing: string; regulatory: string; risk: string;
 evidence: Evidence[]; source: { headline: string; url: string; timestamp: string };
 synthetic: boolean;
};
export type DealEvent = { id: string; dealId: string; headline: string; delta: string; stage: string;
 timestamp: string; sourceUrl: string; type: 'Process' | 'Financing' | 'Regulatory' | 'Closed' | 'Failed'; material: boolean };
export function ranked(deals: Deal[]) { return [...deals].sort((a,b) => b.score-a.score || Date.parse(b.source.timestamp)-Date.parse(a.source.timestamp)); }
export function inWindow(timestamp: string, hours: number, now = Date.now()) { const t = Date.parse(timestamp); return Number.isFinite(t) && t <= now && t >= now - hours*3600000; }
export function sections(deals: Deal[], hours: number, now = Date.now()) {
 const recent = deals.filter(d => inWindow(d.source.timestamp,hours,now));
 return {
 A: ranked(recent.filter(d=>d.status==='New' && d.score>=4)),
 B: ranked(recent.filter(d=>d.status==='Updated' && !['Closed','Failed'].includes(d.stage))),
 C: ranked(recent.filter(d=>/clearance|regulatory|FDI|delay|remed|opposition|approval/i.test(d.delta))),
 D: ranked(recent.filter(d=>['Closed','Failed'].includes(d.status))),
 E: ranked(deals.filter(d=>!['Closed','Failed'].includes(d.status) && (!recent.includes(d) || d.status==='No Change'))),
 F: ranked(recent.filter(d=>d.score>=3 && !['Closed','Failed'].includes(d.status))).slice(0,5)
 };
}
export function parseEvent(input: unknown): Omit<DealEvent,'id'|'material'> {
 if (!input || typeof input !== 'object') throw Error('A JSON event is required');
 const o = input as Record<string, unknown>;
 for (const k of ['dealId','headline','delta','stage','timestamp','sourceUrl','type'])
  if (typeof o[k] !== 'string' || !(o[k] as string).trim() || (o[k] as string).length>2000) throw Error(`Invalid ${k}`);
 if (!['Process','Financing','Regulatory','Closed','Failed'].includes(o.type as string)) throw Error('Invalid event type');
 if (!Number.isFinite(Date.parse(o.timestamp as string)) || Date.parse(o.timestamp as string)>Date.now()+60000) throw Error('Invalid or future timestamp');
 const u=new URL(o.sourceUrl as string); if(u.protocol!=='https:' || u.username || u.password) throw Error('Source must be a public HTTPS URL');
 return { dealId:o.dealId as string,headline:o.headline as string,delta:o.delta as string,stage:o.stage as string,timestamp:new Date(o.timestamp as string).toISOString(),sourceUrl:u.href,type:o.type as DealEvent['type'] };
}
export function parseDeal(input:unknown):Deal {
 if(!input||typeof input!=='object')throw Error('A structured deal object is required');
 const o=input as Record<string,unknown>;
 const required=['target','country','sector','seller','buyer','stage','value','rationale','pair','classification','notional','angle','rates','delta','action','owner','catalyst','timing','regulatory','risk'];
 for(const k of required)if(typeof o[k]!=='string'||(o[k] as string).length>4000)throw Error(`Invalid ${k}`);
 for(const k of ['stage','delta'])if(!(o[k] as string).trim())throw Error(`Invalid ${k}`);
 if(!['Sweden','Norway','Finland','Denmark'].includes(o.country as string))throw Error('Nordic connection country is required');
 if(!['High','Medium','Low'].includes(o.confidence as string))throw Error('Invalid confidence');
 if(!['Yes','No','Unclear'].includes(o.buyerFx as string)||!['Yes','No','Unclear'].includes(o.sellerFx as string))throw Error('Invalid FX classification');
 if(typeof o.score!=='number'||!Number.isInteger(o.score)||o.score<1||o.score>5)throw Error('Score must be 1–5');
 if(!Array.isArray(o.evidence)||!o.evidence.length||o.evidence.length>30)throw Error('Evidence and assumptions must be supplied');
 for(const e of o.evidence)if(!e||typeof e.label!=='string'||typeof e.value!=='string'||!e.label||!e.value||e.value.length>4000||!['Fact','Inference','Unknown'].includes(e.kind))throw Error('Invalid evidence');
 const src=o.source as Record<string,unknown>;if(!src)throw Error('Source required');
 parseEvent({dealId:'new',headline:src.headline,delta:o.delta,stage:o.stage,timestamp:src.timestamp,sourceUrl:src.url,type:'Process'});
 return {...o,id:'',synthetic:false,status:'New'} as unknown as Deal;
}
