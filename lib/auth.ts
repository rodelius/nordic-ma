import { pilotMode } from './pilot-config';
import { timingSafeEqual } from 'node:crypto';
export function authorized(request:Request){
 if(pilotMode()==='pilot')return false;
 const expected=process.env.INGEST_TOKEN; if(!expected) return false;
 const actual=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length && timingSafeEqual(a,b);
}
