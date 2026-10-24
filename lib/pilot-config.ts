export type PilotMode = 'demo' | 'pilot';
export function pilotMode(env:Record<string,string|undefined>=process.env):PilotMode {
 const value=env.APP_MODE||'demo';
 if(!['demo','pilot'].includes(value))throw Error('APP_MODE must be demo or pilot');
 // An unconfigured Vercel deployment must never expose the public demo.
 if(env.VERCEL && value!=='pilot')throw Error('Set APP_MODE=pilot before deploying to Vercel');
 return value as PilotMode;
}
export function pilotConfig(env:Record<string,string|undefined>=process.env){
 if(pilotMode(env)!=='pilot')throw Error('Pilot mode is not enabled');
 for(const name of ['APP_URL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'])if(!env[name])throw Error(`Missing ${name}`);
 const key=env.SUPABASE_PUBLISHABLE_KEY!;
 let publicKey=/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key);
 if(!publicKey){try{const parts=key.split('.');publicKey=parts.length===3 && JSON.parse(Buffer.from(parts[1],'base64url').toString()).role==='anon';}catch{publicKey=false;}}
 if(!publicKey)throw Error('Use a Supabase publishable or legacy anon key, never a secret/service-role key');
 const app=new URL(env.APP_URL!),supabase=new URL(env.SUPABASE_URL!);
 if(app.protocol!=='https:'||app.username||app.password||app.pathname!=='/'||app.search||app.hash)throw Error('APP_URL must be an HTTPS origin');
 if(supabase.protocol!=='https:'||supabase.username||supabase.password||supabase.pathname!=='/'||supabase.search||supabase.hash)throw Error('SUPABASE_URL must be an HTTPS origin');
 return {appUrl:app.origin,url:supabase.origin,key:env.SUPABASE_PUBLISHABLE_KEY!};
}
