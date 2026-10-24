import { createHash } from 'node:crypto';
export const ENGINE_VERSION='ficc-cases-v1';
export type FeedbackRow={id:string;source_id:string;decision:'useful'|'not_useful'|'exclude';reason:string;score:number|null;note:string;created_at:string;analysis_snapshot?:Record<string,unknown>|null;changed_fields?:string[];source_snapshot:{headline:string;excerpt:string;url:string;published_at:string;deal_id?:string|null}};
export type LearningCase={id:string;sourceId:string;group:string;at:string;publishedAt:string;headline:string;features:string[];useful:boolean;score:number|null;reason:string;correctionFields?:string[]};
export type Prediction={priority:number;suggestedFiccScore:number|null;support:number;status:'cold'|'limited'|'supported';explanation:string;neighbors:{feedbackId:string;headline:string;reason:string;useful:boolean;score:number|null;similarity:number;correctionFields?:string[]}[]};
const signals:Record<string,RegExp>={
 acquisition:/acquir|acquis|förvär|oppkjøp|opkøb|yritysosto/i,
 sale_process:/sale process|strategic review|auction|carve.out|divest|avyttr|exclusiv|shortlist|final bid/i,
 takeover:/takeover|take.private|public offer|tender offer|competing bid|offer revised/i,
 merger:/merger|fusion|business combination/i,
 completion:/completed|completion|closing|closed acquisition/i,
 failure:/withdrawn|withdraws|deal fail|collaps|termination of.*(?:offer|acquis)/i,
 approval:/merger control|regulatory clearance|fdi|antitrust|competition authority|remedies/i,
 nordic_text:/swed(?:en|ish)|norw(?:ay|egian)|finland|finnish|denmark|danish|nordic|stockholm|oslo|helsinki|copenhagen/i,
 sek_nok:/\b(?:SEK|NOK|Swedish kron|Norwegian kron)/i,
 eur_usd_gbp:/\b(?:EUR|USD|GBP|euros?|dollars?|sterling)\b/i,
 funding:/funding|financing|purchase price|cash consideration|proceeds/i,
 bridge:/bridge financ|acquisition financ|bridge loan/i,
 refinance:/refinanc|bond take.out|debt take.out|debt financ/i,
 floating_debt:/floating.rate|variable.rate|euribor|nibor|stibor|sofr/i,
 hedge:/hedg|cross.currency|interest.rate swap|currency swap|rate cap|rate collar/i,
 sponsor:/private equity|sponsor|infrastructure fund|buyout fund/i,
 infrastructure:/infrastructure|renewable|wind farm|solar|energy asset/i,
 property:/real estate|propert(?:y|ies)|lease portfolio/i,
 finance:/insurance|insur(?:er|ance)|financial services|banking|pension/i,
 minority:/minority stake|minority interest|partial stake/i,
 shares_issued:/share capital increase|issuance of.*shares|new shares.*acquisition|share consideration/i,
 holdings:/holdings? in company|form 8\.3|dealing disclosure|major shareholding|voting rights/i,
 own_shares:/own shares|share buyback|treasury shares/i,
};
export function features(text:string){const bounded=text.slice(0,17000);return Object.entries(signals).filter(([,r])=>r.test(bounded)).map(([name])=>name).sort();}
const signalLabels:Record<string,string>={acquisition:'acquisition wording',sale_process:'sale process',takeover:'public offer/takeover',merger:'merger',completion:'closing/completion',failure:'deal failure',approval:'regulatory approval',nordic_text:'Nordic location words',sek_nok:'SEK/NOK mention',eur_usd_gbp:'EUR/USD/GBP mention',funding:'funding or proceeds wording',bridge:'acquisition bridge',refinance:'refinancing',floating_debt:'floating-rate debt',hedge:'hedging',sponsor:'sponsor/fund',infrastructure:'infrastructure/energy',property:'real estate',finance:'financial services',minority:'minority stake',shares_issued:'share consideration',holdings:'shareholding disclosure',own_shares:'own-share trades'};
const weight=(f:string)=>['bridge','refinance','floating_debt','hedge','shares_issued','holdings','own_shares'].includes(f)?2:1;
function similarity(a:string[],b:string[]){const A=new Set(a),B=new Set(b),union=new Set([...a,...b]);let inter=0,total=0;for(const f of union){total+=weight(f);if(A.has(f)&&B.has(f))inter+=weight(f);}return total?inter/total:0;}
export function predict(text:string,cases:LearningCase[]):Prediction{return predictFeatures(features(text),cases);}
function predictFeatures(input:string[],cases:LearningCase[]):Prediction{
 const seen=new Set<string>();
 const near=cases.map(c=>({c,s:similarity(input,c.features)})).filter(x=>input.length>=2&&x.c.features.length>=2&&x.s>=0.25).sort((a,b)=>b.s-a.s||b.c.at.localeCompare(a.c.at)).filter(x=>{if(seen.has(x.c.group))return false;seen.add(x.c.group);return true;}).slice(0,5);
 const support=near.length,ready=support>=3,total=near.reduce((n,x)=>n+x.s,0),positive=near.reduce((n,x)=>n+(x.c.useful?x.s:0),0);
 const shared=input.filter(f=>near.some(x=>x.c.features.includes(f))).map(f=>signalLabels[f]||f);
 const scored=near.filter(x=>x.c.score!==null);
 const estimated=ready&&scored.length>=3?Math.max(1,Math.min(5,Math.round(scored.reduce((n,x)=>n+x.s*x.c.score!,0)/scored.reduce((n,x)=>n+x.s,0)))):null;
 return {priority:ready?Math.round(100*(1+positive)/(2+total)):50,suggestedFiccScore:estimated,support,status:support===0?'cold':ready?'supported':'limited',explanation:ready?`Priority reflects ${support} comparable reviewed cases. Shared text signals: ${shared.slice(0,8).join(', ')}${shared.length>8?' and other cues':''}. These are cues, not verified exposures.`:support?`${support} comparable cases; at least 3 are required before suggesting a priority.`:'No comparable reviewed cases yet; neutral priority.',neighbors:near.map(({c,s})=>({feedbackId:c.id,headline:c.headline,reason:c.reason,useful:c.useful,score:c.score,correctionFields:c.correctionFields||[],similarity:Math.round(s*100)}))};
}
function canonical(url:string){try{const u=new URL(url);return u.hostname+u.pathname.replace(/^\/[a-z]{2}\//,'/').toLowerCase();}catch{return url;}}
export function currentCases(rows:FeedbackRow[]):LearningCase[]{
 const latest=new Map<string,FeedbackRow>();for(const row of [...rows].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id)))if(!latest.has(row.source_id))latest.set(row.source_id,row);
 return [...latest.values()].filter(r=>r.decision!=='exclude'&&!['duplicate','stale','other'].includes(r.reason)).map(r=>({id:r.id,sourceId:r.source_id,group:r.source_snapshot.deal_id||canonical(r.source_snapshot.url),at:r.created_at,publishedAt:r.source_snapshot.published_at,headline:r.source_snapshot.headline,features:features(r.source_snapshot.headline+'\n'+r.source_snapshot.excerpt),useful:r.decision==='useful',score:r.score,reason:r.reason,correctionFields:(r.changed_fields||[]).filter(f=>['score','pair','buyerFx','sellerFx','classification','angle','rates','evidence'].includes(f))}));
}
export type Model={algorithm:typeof ENGINE_VERSION;id:string;examples:LearningCase[];feedbackCount:number;evaluation:{eligible:boolean;reason:string;trainingCount:number;holdoutCount:number;scoredHoldouts:number;trainingIds:string[];holdoutIds:string[];precisionAt3:number|null;baselinePrecisionAt3:number|null;split:'newest-known-groups-held-out'}};
export function buildModel(rows:FeedbackRow[]):Model{
 const examples=currentCases(rows),groups=new Map<string,LearningCase[]>();for(const c of examples){const g=groups.get(c.group)||[];g.push(c);groups.set(c.group,g);}
 const ordered=[...groups.values()].sort((a,b)=>b.map(x=>x.at).sort().at(-1)!.localeCompare(a.map(x=>x.at).sort().at(-1)!));
 const holdGroups=new Set(ordered.slice(0,Math.max(1,Math.ceil(ordered.length/3))).map(g=>g[0].group));
 const train=examples.filter(c=>!holdGroups.has(c.group)),hold=ordered.filter(g=>holdGroups.has(g[0].group)).map(g=>[...g].sort((a,b)=>b.at.localeCompare(a.at))[0]).sort((a,b)=>b.at.localeCompare(a.at));
 // Holdout ranking uses features captured from the original source, never corrected deal facts.
 const predictions=hold.map(c=>({c,p:predictFeatures(c.features,train)}));
 const ranked=[...predictions].sort((a,b)=>b.p.priority-a.p.priority||b.c.publishedAt.localeCompare(a.c.publishedAt));
 const baselineHold=[...hold].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
 const k=Math.min(3,hold.length),precision=k?ranked.slice(0,k).filter(x=>x.c.useful).length/k:null,baseline=k?baselineHold.slice(0,k).filter(c=>c.useful).length/k:null;
 const scoredHoldouts=predictions.filter(x=>x.p.support>=3).length;
 let reason='Pilot evaluation passed; inspect the small holdout before activating.';
 if(examples.length<12||train.length<8||hold.length<4||groups.size<12)reason='Need at least 12 distinct labelled groups, including 8 training and 4 held-out cases.';
 else if(examples.filter(c=>c.useful).length<3||examples.filter(c=>!c.useful).length<3||!hold.some(c=>c.useful)||!hold.some(c=>!c.useful))reason='Need both useful and not-useful cases, including both outcomes in the holdout.';
 else if(scoredHoldouts<2)reason='Too few held-out cases have comparable training examples.';
 else if(precision!<baseline!)reason='Learned precision@3 is below the newest-first baseline. Keep shadow mode.';
 const evaluation={eligible:reason.startsWith('Pilot evaluation passed'),reason,trainingCount:train.length,holdoutCount:hold.length,scoredHoldouts,trainingIds:train.map(c=>c.id),holdoutIds:hold.map(c=>c.id),precisionAt3:precision,baselinePrecisionAt3:baseline,split:'newest-known-groups-held-out' as const};
 const data:Omit<Model,'id'>={algorithm:ENGINE_VERSION,examples:examples.sort((a,b)=>a.id.localeCompare(b.id)),feedbackCount:rows.length,evaluation};
 return {...data,id:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
}
