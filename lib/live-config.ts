import { timingSafeEqual } from 'node:crypto';
import { pilotMode } from './pilot-config';
export function stage2Enabled(){return pilotMode()==='pilot'&&process.env.PILOT_STAGE==='2';}
export function jobsAuthorized(req:Request){
 const expected=process.env.CRON_SECRET||'',actual=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 return stage2Enabled()&&expected.length>=32&&Buffer.byteLength(expected)===Buffer.byteLength(actual)&&timingSafeEqual(Buffer.from(expected),Buffer.from(actual));
}
export function livePushReady(){return stage2Enabled()&&process.env.NOTIFICATIONS_ENABLED==='true'&&!!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);}
export function monitoringEnabled(){return stage2Enabled()&&process.env.MONITORING_ENABLED==='true';}
