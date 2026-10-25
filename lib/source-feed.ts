import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { createHash } from 'node:crypto';
export const CISION_FEED_URL='https://news.cision.com/ListItems?format=rss';
export type SourceItem={id:string;headline:string;url:string;published_at:string;excerpt:string;source:string;state?:string;deal_id?:string|null};
const plain=(v:unknown)=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function feedEntries(xml:string):Record<string,unknown>[] {
 if(xml.length>2000000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Unsupported or oversized feed');
 if(XMLValidator.validate(xml)!==true)throw Error('Invalid RSS XML');
 const parsed=new XMLParser({ignoreAttributes:false,processEntities:true,parseTagValue:false}).parse(xml);
 if(!parsed.rss?.channel||typeof parsed.rss.channel!=='object')throw Error('Expected an RSS channel from Cision');
 const raw=parsed.rss.channel.item;return raw?(Array.isArray(raw)?raw:[raw]).slice(0,200):[];
}
export function isCisionStory(url:URL){return url.protocol==='https:'&&url.hostname==='news.cision.com'&&!url.username&&!url.password&&!url.port&&/^\/(?:[a-z]{2}\/)?[^/]+\/r\/[^/]+$/i.test(url.pathname);}
export function parseFeed(xml:string,now=Date.now()):SourceItem[]{
 const result:SourceItem[]=[];
 for(const row of feedEntries(xml)){
  const headline=plain(row.title).slice(0,500),excerpt=plain(row.description||row['content:encoded']).slice(0,16000),time=Date.parse(String(row.pubDate||''));
  if(!headline||!Number.isFinite(time)||time>now+60000||time<now-7*86400000)continue;
  let url:URL;try{url=new URL(plain(row.link));}catch{continue;}
  if(!isCisionStory(url))continue;
  // Broad process candidate screen, not a factual M&A classification or Nordic claim.
  const text=headline+' '+excerpt;
  if(!/acquir|acquis|förvär|divest|avyttr|merger|takeover|public offer|tender offer|strategic review|sale process|exclusive talks|competing bid|fusion|opkøb|oppkjøp|yritysosto|\bIPO\b|initial public offering|rights issue|bond issu|refinanc|project financ|restructur|spin.off|demerger|capital return|special dividend/i.test(text))continue;
  // Routine own-share trades can mention "acquired" but are not corporate M&A.
  if(/transaction[s]? in own shares|repurchase[s]? of (?:own |treasury )?shares|share buyback/i.test(headline)&&!/merger|takeover|acquisition of (?:a |the )?(?:business|company|stake|subsidiary)/i.test(headline))continue;
  const published_at=new Date(time).toISOString();
  const id=createHash('sha256').update(JSON.stringify([url.href,published_at,headline,excerpt])).digest('hex');
  result.push({id,headline,url:url.href,published_at,excerpt,source:'Cision News / issuer announcement'});
 }
 return [...new Map(result.map(r=>[r.id,r])).values()];
}
export function configuredFeedUrl(){
 const url=new URL(process.env.SOURCE_FEED_URL||CISION_FEED_URL);
 if(url.protocol!=='https:'||url.hostname!=='news.cision.com'||url.username||url.password||url.port||url.pathname!=='/ListItems'||url.searchParams.get('format')!=='rss'||url.hash)throw Error('Use https://news.cision.com/ListItems?format=rss');
 // Search filters can silently narrow coverage. The pilot uses the general feed only.
 for(const key of url.searchParams.keys())if(!['format','pageIx','pageSize'].includes(key))throw Error('Use the unfiltered Cision feed for this pilot');
 return url;
}
export async function fetchCisionFeed(){
 const base=configuredFeedUrl(),items=new Map<string,SourceItem>();
 const maxPages=5,pageSize=100;let fetched=0,pages=0,oldest:number|null=null,coverageLimited=false;
 const deadline=AbortSignal.timeout(20000),since=Date.now()-7*86400000;
 for(let page=1;page<=maxPages;page++){
  const url=new URL(base);url.searchParams.set('pageIx',String(page));url.searchParams.set('pageSize',String(pageSize));
  const response=await fetch(url,{redirect:'error',headers:{Accept:'application/rss+xml, application/xml, text/xml'},signal:deadline,cache:'no-store'});
  if(!response.ok)throw Error(`Cision feed returned HTTP ${response.status}`);
  const reader=response.body?.getReader();if(!reader)throw Error('Feed returned no body');
  const chunks:Uint8Array[]=[];let length=0;
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2000000){await reader.cancel();throw Error('Feed is too large');}chunks.push(value);}
  const xml=Buffer.concat(chunks).toString('utf8'),entries=feedEntries(xml);
  pages++;fetched+=entries.length;
  const dates=entries.map(e=>Date.parse(String(e.pubDate||''))).filter(Number.isFinite);
  if(dates.length)oldest=Math.min(oldest??Infinity,...dates);
  for(const item of parseFeed(xml))items.set(item.id,item);
  if(entries.length<pageSize||(oldest!==null&&oldest<since))break;
  if(page===maxPages)coverageLimited=true;
 }
 return {items:[...items.values()],fetched,pages,oldestPublishedAt:oldest===null?null:new Date(oldest).toISOString(),coverageLimited};
}
