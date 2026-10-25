import {createHash} from 'node:crypto';
import {load} from 'cheerio';
import {isCisionStory} from './source-feed';
export type ArticleSnapshot={url:string;finalUrl:string;title:string;text:string;retrievedAt:string;hash:string;parserVersion:string;method:string};
export const ARTICLE_PARSER_VERSION='cision-article-v1';
export function articleUrl(value:string){const u=new URL(value);if(!isCisionStory(u)||u.hash)throw Error('Full-text retrieval supports public Cision announcement links only');return u;}
const normalize=(s:string)=>s.replace(/\u00a0/g,' ').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
export function parseArticle(html:string,url:string,retrievedAt=new Date().toISOString()):ArticleSnapshot{
 articleUrl(url);if(Buffer.byteLength(html)>2_000_000)throw Error('Article page exceeds 2 MB');
 const $=load(html);const title=normalize($('article h1').first().text()||$('h1').first().text()||$('title').text());let text='',method='';
 // Prefer the article body over a page-wide scrape (menus and related stories are not evidence).
 for(const el of $('script[type="application/ld+json"]').toArray()){
  try{const value=JSON.parse($(el).text());const visit=(v:unknown):void=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(visit);return;}const r=v as Record<string,unknown>;if(typeof r.articleBody==='string'&&String(r['@type']).match(/Article|NewsArticle|PressRelease/)){const body=load(r.articleBody);text=normalize(body.text());method='jsonld-articleBody';}if(r['@graph'])visit(r['@graph']);};visit(value);}catch{}
  if(text)break;
 }
 if(!text){const article=$('[itemprop="articleBody"], .release-item-details article, article').first().clone();article.find('script,style,nav,form,button,.share,.social-link,.hidden-print,time,h1').remove();article.find('p,div,br,li,h2,h3,tr').each((_,el)=>{$(el).append('\n');});text=normalize(article.text());method='article-element';}
 if(text.length<100)throw Error('No usable article body found; the feed excerpt was not substituted');
 text=normalize((title?title+'\n\n':'')+text);
 if(text.length<100||/^(?:404|page (?:not found|cannot be found))/i.test(title))throw Error('No usable article body found; the feed excerpt was not substituted');
 if(text.length>80_000)throw Error('Article text exceeds 80,000 characters; use a manually scoped review');
 return {url,finalUrl:url,title,text,retrievedAt,hash:createHash('sha256').update(text).digest('hex'),parserVersion:ARTICLE_PARSER_VERSION,method};
}
export async function retrieveArticle(value:string,fetcher:typeof fetch=fetch){
 const original=articleUrl(value);let current=original;const signal=AbortSignal.timeout(15000);
 for(let hop=0;hop<4;hop++){
  const response=await fetcher(current,{redirect:'manual',cache:'no-store',headers:{Accept:'text/html, application/xhtml+xml'},signal});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Article redirect has no destination');current=articleUrl(new URL(location,current).href);continue;}
  if(!response.ok)throw Error('Article retrieval returned HTTP '+response.status);
  if(!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type')||''))throw Error('Article did not return HTML');
  const reader=response.body?.getReader();if(!reader)throw Error('Article returned no body');const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000)throw Error('Article page exceeds 2 MB');chunks.push(value);}}finally{await reader.cancel();}
  const article=parseArticle(Buffer.concat(chunks).toString('utf8'),original.href);article.finalUrl=current.href;return article;
 }
 throw Error('Too many article redirects');
}
