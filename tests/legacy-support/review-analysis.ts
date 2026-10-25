import {parseDeal,type Deal} from './model';
import {assessFicc} from './ficc-advisory';
export type ReviewSource={id:string;headline:string;excerpt?:string;url:string;published_at:string;state:string;analysis:Deal|null;assessment?:ReturnType<typeof assessFicc>|null;review_version:number;deal_id:string|null};
export function canonicalAnalysis(input:unknown,source:Pick<ReviewSource,'headline'|'url'|'published_at'>){
 const object=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const deal=parseDeal({...object,source:{headline:source.headline,url:source.url,timestamp:source.published_at}});
 if(!deal.evidence.some(e=>e.label.trim().toLowerCase()==='nordic connection'&&e.kind==='Fact'&&e.value.trim().length>=8&&!/^(unknown|unconfirmed|not verified|unclear)$/i.test(e.value.trim())))throw Error('Document a source-supported Nordic connection as a Fact evidence entry labelled Nordic connection');
 if(deal.evidence.some(e=>e.label.trim().toLowerCase()==='transaction relevance'&&e.value.trim().toLowerCase()==='not m&a'))throw Error('Dismiss this announcement as Not an M&A situation rather than approving a transaction');
 deal.status=deal.stage==='Closed'?'Closed':deal.stage==='Failed'?'Failed':'Updated';return deal;
}
export function previewAssessment(text:string){
 try{const d=JSON.parse(text);if(!d||!Array.isArray(d.evidence)||!d.evidence.every((e:unknown)=>!!e&&typeof e==='object'&&typeof (e as {label?:unknown}).label==='string'&&typeof (e as {value?:unknown}).value==='string'))return null;return assessFicc(d);}catch{return null;}
}
export function emptyReview(source:Pick<ReviewSource,'headline'|'url'|'published_at'>){return {target:'',country:'',sector:'',buyer:'Unknown',seller:'Unknown',stage:'Announced',value:'Undisclosed',score:2,rationale:'Currency and funding need verification',pair:'Unclear',buyerFx:'Unclear',sellerFx:'Unclear',classification:'Unclear',notional:'Unconfirmed',angle:'Monitor',rates:'Unknown',delta:source.headline,action:'Monitor only',owner:'Coverage banker',confidence:'Low',catalyst:'Closing conditions review',timing:'Not verified',regulatory:'Not verified',risk:'No confirmed FX or debt exposure',evidence:[{label:'Nordic connection',value:'Unknown',kind:'Unknown'},{label:'Consideration type',value:'Unknown',kind:'Unknown'},{label:'Consideration currency',value:'Unknown',kind:'Unknown'},{label:'Buyer funding currency',value:'Unknown',kind:'Unknown'},{label:'Seller desired proceeds currency',value:'Unknown',kind:'Unknown'}],source:{headline:source.headline,url:source.url,timestamp:source.published_at}};}
