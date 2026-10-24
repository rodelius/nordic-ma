// Shared schema for the guided editor; no historical transaction facts are copied.
export const REVIEW_GROUPS=[
 {title:'Transaction facts',fields:[['target','Target'],['buyer','Buyer'],['seller','Seller'],['country','Nordic connection country',['Sweden','Norway','Finland','Denmark']],['sector','Sector'],['stage','Transaction stage',['Rumoured','Exploring','Announced','Signed','Pending approval','Closed','Failed']],['value','Transaction value']]},
 {title:'FICC assessment',fields:[['score','FICC relevance score',['1','2','3','4','5']],['rationale','Score rationale'],['buyerFx','Buyer FX need',['Yes','No','Unclear']],['sellerFx','Seller FX need',['Yes','No','Unclear']],['pair','Currency pair'],['classification','Opportunity classification'],['notional','Confirmed FX notional'],['angle','Advisory hypothesis'],['rates','Rates / financing hypothesis'],['confidence','Confidence',['High','Medium','Low']]]},
 {title:'Timing and next action',fields:[['delta','Material update'],['catalyst','Next catalyst'],['timing','Payment / closing timing'],['regulatory','Regulatory conditions'],['risk','Risks and unknowns'],['action','Next action'],['owner','Owner']]},
] as const;
export const EVIDENCE_OPTIONS:Record<string,string[]>={
 'Transaction relevance':['Qualifying M&A','Uncertain','Not M&A'],
 'Consideration type':['CASH','SHARES','MIXED','Unknown'],
 'Consideration currency':['SEK','NOK','EUR','USD','GBP','DKK','Unknown'],
 'Buyer funding currency':['SEK','NOK','EUR','USD','GBP','DKK','Unknown'],
 'Seller desired proceeds currency':['SEK','NOK','EUR','USD','GBP','DKK','Unknown'],
 'Debt currency':['SEK','NOK','EUR','USD','GBP','DKK','Unknown'],
 'Debt rate type':['FLOATING','FIXED','Unknown'],
};
export type ReviewInput={original:Record<string,unknown>;suggestion:Record<string,unknown>|null;version:string|null;explanation:string;mode:string};
export function reviewObject(text:string):Record<string,unknown>|null{try{const o=JSON.parse(text);return o&&typeof o==='object'&&!Array.isArray(o)?o:null;}catch{return null;}}
export function displayValue(value:unknown){return value===''||value===undefined||value===null?'Empty / unknown':typeof value==='object'?JSON.stringify(value):String(value);}

export function validReviewInput(input:unknown):input is ReviewInput{
 if(!input||typeof input!=='object'||Array.isArray(input))return false;
 const i=input as ReviewInput;
 return !!i.original&&typeof i.original==='object'&&!Array.isArray(i.original)&&(i.suggestion===null||(!!i.suggestion&&typeof i.suggestion==='object'&&typeof i.suggestion.score==='number'&&Number.isInteger(i.suggestion.score)&&i.suggestion.score>=1&&i.suggestion.score<=5))&&(i.version===null||(typeof i.version==='string'&&i.version.length<=128))&&typeof i.explanation==='string'&&i.explanation.length<=2000&&typeof i.mode==='string'&&i.mode.length<=40;
}
