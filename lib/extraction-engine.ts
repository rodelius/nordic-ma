import {createHash,createHmac} from 'node:crypto';
import {execFile} from 'node:child_process';
import {resolve} from 'node:path';
import {EXTRACTION_VERSION,validateExtraction} from './extraction';
import type {ArticleSnapshot} from './article-source';
export const RULE_ENGINE='python-rules';
export function parserSignature(body:string,timestamp:string,secret:string){const key=createHash('sha256').update('corporate-rule-parser:'+secret).digest();return createHmac('sha256',key).update(timestamp+'.'+body).digest('hex');}
export async function pythonRules(text:string,fetcher:typeof fetch=fetch){
 const payload=JSON.stringify({text});
 if(process.env.VERCEL){
  const origin=process.env.APP_URL,secret=process.env.SUPABASE_SECRET_KEY;if(!origin||!secret)throw Error('APP_URL and SUPABASE_SECRET_KEY are required for the Python parser');
  const url=new URL('/api/rule_parser',origin);if(url.protocol!=='https:')throw Error('Python parser requires the configured HTTPS application origin');
  const timestamp=String(Math.floor(Date.now()/1000));const response=await fetcher(url,{method:'POST',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json','X-Parser-Time':timestamp,'X-Parser-Signature':parserSignature(payload,timestamp,secret)},body:payload,signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Python parser returned HTTP '+response.status+'; check that api/rule_parser.py is deployed');return response.json();
 }
 // Codespaces/local execution uses the exact same Python implementation as Vercel.
 return new Promise<unknown>((accept,reject)=>{const child=execFile('python3',[resolve(process.cwd(),'python/corporate_parser.py')],{timeout:5000,maxBuffer:500000},(error,stdout)=>{if(error){reject(Error('Python parser failed; ensure Python 3 is installed'));return;}try{accept(JSON.parse(stdout));}catch{reject(Error('Python parser returned invalid JSON'));}});child.stdin?.end(payload);});
}
export async function extractArticle(article:ArticleSnapshot,source:{id:string;headline:string;url:string;published_at:string;source?:string},runId:string,fetcher:typeof fetch=fetch){
 const raw=await pythonRules(article.text,fetcher) as {ruleVersion?:string;notes?:unknown;rulesMatched?:unknown};
 if(raw.ruleVersion!==EXTRACTION_VERSION)throw Error('Python parser version mismatch; deploy Node and Python functions together');
 return {...validateExtraction(raw,article,source,runId),engineName:RULE_ENGINE,requestHash:createHash('sha256').update(EXTRACTION_VERSION+'\n'+article.text).digest('hex'),notes:Array.isArray(raw.notes)?raw.notes.filter((n):n is string=>typeof n==='string').slice(0,25):[],rulesMatched:Array.isArray(raw.rulesMatched)?raw.rulesMatched.filter((n):n is string=>typeof n==='string').slice(0,60):[]};
}
