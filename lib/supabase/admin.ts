import { createClient } from '@supabase/supabase-js';
import { pilotConfig } from '../pilot-config';
export function supabaseAdmin(){
 const config=pilotConfig(),key=process.env.SUPABASE_SECRET_KEY;
 if(!key)throw Error('Server worker credential SUPABASE_SECRET_KEY is missing');
 return createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
