import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseCorporateEventModel,type CorporateEventModel,type CorporateModelRow} from './corporate-events';
import {demoCorporateModels} from './corporate-demo';
const dir=process.env.DATA_DIR||join(process.cwd(),'data');mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(join(dir,'corporate-events.sqlite'));db.exec('create table if not exists corporate_models(id text primary key,graph text not null,revision integer not null,updated_at text not null);create table if not exists corporate_history(id integer primary key,model_id text,graph text,recorded_at text)');
if(!(db.prepare('select count(*) as n from corporate_models').get() as {n:number}).n)for(const r of demoCorporateModels())db.prepare('insert into corporate_models values(?,?,?,?)').run(r.model_id,JSON.stringify(r.graph),r.revision,r.updated_at);
export function readCorporateModels():CorporateModelRow[]{return (db.prepare('select * from corporate_models order by updated_at desc').all() as {id:string;graph:string;revision:number;updated_at:string}[]).map(r=>({model_id:r.id,graph:JSON.parse(r.graph),revision:r.revision,updated_at:r.updated_at}));}
export function writeCorporateModel(model:CorporateEventModel,id?:string,expected=0){const g=parseCorporateEventModel(model),mid=id||createHash('sha256').update(JSON.stringify(g)).digest('hex').slice(0,24);db.exec('begin immediate');try{const old=db.prepare('select revision from corporate_models where id=?').get(mid) as {revision:number}|undefined;if((old?.revision||0)!==expected)throw Error('Model version conflict');const now=new Date().toISOString();db.prepare('insert into corporate_models values(?,?,?,?) on conflict(id) do update set graph=excluded.graph,revision=excluded.revision,updated_at=excluded.updated_at').run(mid,JSON.stringify(g),expected+1,now);db.prepare('insert into corporate_history(model_id,graph,recorded_at) values(?,?,?)').run(mid,JSON.stringify(g),now);db.exec('commit');return {modelId:mid,revision:expected+1};}catch(e){db.exec('rollback');throw e;}}
db.exec('create table if not exists corporate_subscriptions(endpoint text primary key,body text not null)');
export function saveSubscription(s:{endpoint:string;keys:{p256dh:string;auth:string}}){db.prepare('insert into corporate_subscriptions values(?,?) on conflict(endpoint) do update set body=excluded.body').run(s.endpoint,JSON.stringify(s));}
export function removeSubscription(endpoint:string){db.prepare('delete from corporate_subscriptions where endpoint=?').run(endpoint);}
export function subscriptions(){return (db.prepare('select body from corporate_subscriptions').all() as {body:string}[]).map(r=>JSON.parse(r.body) as {endpoint:string;keys:{p256dh:string;auth:string}});}
