// Feed contract: JSON array of approved structured events, as documented in README.
// Intended for cron or a scheduler; never scrapes arbitrary sources or invents facts.
const {APP_URL='http://127.0.0.1:3000',EVENT_FEED_URL,INGEST_TOKEN}=process.env;
if(!EVENT_FEED_URL||!INGEST_TOKEN)throw Error('Set EVENT_FEED_URL and INGEST_TOKEN in the scheduler environment');
const source=new URL(EVENT_FEED_URL);if(source.protocol!=='https:')throw Error('Feed must use HTTPS');
const response=await fetch(source,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Feed HTTP ${response.status}`);
const events=await response.json();if(!Array.isArray(events)||events.length>500)throw Error('Expected at most 500 approved events');
let count=0,duplicates=0;
for(const event of events){const r=await fetch(new URL('/api/events',APP_URL),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${INGEST_TOKEN}`},body:JSON.stringify(event),signal:AbortSignal.timeout(30000)});const result=await r.json();if(!r.ok)throw Error(`Event ${count+duplicates+1}: ${result.error||r.status}`);if(result.duplicate)duplicates++;else count++;}
console.log(JSON.stringify({accepted:count,duplicates,completedAt:new Date().toISOString()}));
