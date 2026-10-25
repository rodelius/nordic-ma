import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Deal, DealEvent } from './model';
import { seed } from './seed';
const dir=process.env.DATA_DIR || join(process.cwd(),'data'); mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(join(dir,'monitor.sqlite'));
db.exec('PRAGMA busy_timeout=10000');
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS deals(id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subscriptions(endpoint TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
if (!db.prepare('SELECT value FROM meta WHERE key=?').get('seeded')) {
 db.exec('BEGIN IMMEDIATE'); try { if(!db.prepare('SELECT value FROM meta WHERE key=?').get('seeded')) { for(const d of seed) db.prepare('INSERT OR IGNORE INTO deals VALUES (?,?)').run(d.id,JSON.stringify(d)); db.prepare('INSERT INTO meta VALUES (?,?)').run('seeded',new Date().toISOString()); } db.exec('COMMIT'); } catch(e){db.exec('ROLLBACK');throw e;}
}
export function deals(): Deal[] { return db.prepare('SELECT body FROM deals').all().map(r=>JSON.parse(r.body as string)); }
export function events(): DealEvent[] { return db.prepare('SELECT body FROM events ORDER BY rowid DESC LIMIT 200').all().map(r=>JSON.parse(r.body as string)); }
export function addEvent(input: Omit<DealEvent,'id'|'material'>) {
 const row=db.prepare('SELECT body FROM deals WHERE id=?').get(input.dealId); if(!row) throw Error('Unknown transaction');
 const d:Deal=JSON.parse(row.body as string);
 const id=createHash('sha256').update(JSON.stringify([input.dealId,input.sourceUrl,input.timestamp,input.headline.trim(),input.delta.trim(),input.stage,input.type])).digest('hex');
 if(db.prepare('SELECT id FROM events WHERE id=?').get(id)) return {duplicate:true,event:null};
 const oldTimestamp=Date.parse(d.source.timestamp);
 const stale=Date.parse(input.timestamp)<oldTimestamp;
 const terminal=['Closed','Failed'].includes(d.status);
 const unchanged=input.delta.trim().toLowerCase()==='no material update' || (d.delta===input.delta && d.stage===input.stage);
 const material=!stale && !terminal && !unchanged;
 const e:DealEvent={...input,id,material};
 db.exec('BEGIN IMMEDIATE'); try {
 db.prepare('INSERT INTO events VALUES (?,?,?)').run(id,input.dealId,JSON.stringify(e));
 if(material){d.delta=input.delta;d.stage=input.type==='Closed'?'Closed':input.type==='Failed'?'Failed':input.stage;
 d.status=input.type==='Closed'?'Closed':input.type==='Failed'?'Failed':'Updated';d.source={headline:input.headline,url:input.sourceUrl,timestamp:input.timestamp};
 db.prepare('UPDATE deals SET body=? WHERE id=?').run(JSON.stringify(d),d.id);}
 db.exec('COMMIT'); }catch(err){db.exec('ROLLBACK');throw err;}
 return {duplicate:false,event:e};
}
export function saveSubscription(s:{endpoint:string;keys:{p256dh:string;auth:string}}){db.prepare('INSERT OR REPLACE INTO subscriptions VALUES (?,?)').run(s.endpoint,JSON.stringify(s));}
export function subscriptions(){return db.prepare('SELECT body FROM subscriptions').all().map(r=>JSON.parse(r.body as string));}
export function removeSubscription(endpoint:string){db.prepare('DELETE FROM subscriptions WHERE endpoint=?').run(endpoint);}
export function lastScan(){return db.prepare('SELECT value FROM meta WHERE key=?').get('lastScan')?.value as string|undefined;}
export function markScan(){db.prepare('INSERT OR REPLACE INTO meta VALUES (?,?)').run('lastScan',new Date().toISOString());}
export function createDeal(d:Deal){ const id=createHash('sha256').update(JSON.stringify([d.target.trim().toLowerCase(),d.buyer.trim().toLowerCase(),d.seller.trim().toLowerCase(),d.source.url])).digest('hex').slice(0,24); if(db.prepare('SELECT id FROM deals WHERE id=?').get(id))throw Error('Transaction already imported; record an event against its existing id'); db.prepare('INSERT INTO deals VALUES (?,?)').run(id,JSON.stringify({...d,id,synthetic:false}));return id; }
