import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { createHash } from 'node:crypto';
export type SourceItem={id:string;headline:string;url:string;published_at:string;excerpt:string;source:string;state?:string;deal_id?:string|null};
const plain=(v:unknown)=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function parseFeed(xml:string,now=Date.now()):SourceItem[]{
 if(xml.length>2000000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Unsupported or oversized feed');
 if(XMLValidator.validate(xml)!==true)throw Error('Invalid RSS XML');
 const parsed=new XMLParser({ignoreAttributes:false,processEntities:true,parseTagValue:false}).parse(xml);
 if(!parsed.rss?.channel||typeof parsed.rss.channel!=='object')throw Error('Expected an RSS channel from the official feed');
 const raw=parsed.rss.channel.item;if(!raw)return [];
 const result:SourceItem[]=[];
 for(const row of (Array.isArray(raw)?raw:[raw]).slice(0,200)){
  const headline=plain(row.title).slice(0,500),excerpt=plain(row.description||row['content:encoded']).slice(0,16000),time=Date.parse(String(row.pubDate||''));
  if(!headline||!Number.isFinite(time)||time>now+60000||time<now-7*86400000)continue;
  let url:URL;try{url=new URL(plain(row.link));}catch{continue;}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hostname!=='news.cision.com'||!url.pathname.toLowerCase().startsWith('/addtech/'))continue;
  // Deliberately broad candidate filter; an analyst decides whether this is M&A.
  if(!/acquir|acquis|förvär|förv[aä]rv|divest|avyttr|merger|takeover|offer|strategic review|sale process/i.test(headline+' '+excerpt))continue;
  const published_at=new Date(time).toISOString();
  const id=createHash('sha256').update(JSON.stringify([url.href,published_at,headline,excerpt])).digest('hex');
  result.push({id,headline,url:url.href,published_at,excerpt,source:'Addtech / Cision'});
 }
 return [...new Map(result.map(r=>[r.id,r])).values()];
}
export async function fetchAddtechFeed(){
 if(!process.env.SOURCE_FEED_URL)throw Error('SOURCE_FEED_URL is not configured. Supply the verified Addtech RSS URL.');
 const url=new URL(process.env.SOURCE_FEED_URL);
 if(url.protocol!=='https:'||url.hostname!=='news.cision.com'||url.username||url.password||url.port||!url.pathname.toLowerCase().startsWith('/addtech/'))throw Error('Use the Addtech HTTPS RSS URL on news.cision.com');
 const response=await fetch(url,{redirect:'error',headers:{Accept:'application/rss+xml, application/xml, text/xml'},signal:AbortSignal.timeout(15000),cache:'no-store'});
 if(!response.ok)throw Error(`Official feed returned HTTP ${response.status}`);
 const reader=response.body?.getReader();if(!reader)throw Error('Feed returned no body');
 const chunks:Uint8Array[]=[];let length=0;
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2000000){await reader.cancel();throw Error('Feed is too large');}chunks.push(value);}
 return parseFeed(Buffer.concat(chunks).toString('utf8'));
}
