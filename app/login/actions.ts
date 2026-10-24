'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { pilotConfig } from '@/lib/pilot-config';
export async function requestSignIn(form:FormData){
 const email=String(form.get('email')||'').trim();
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))redirect('/login?status=invalid-email');
 const config=pilotConfig();const client=await supabaseServer();
 await client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:`${config.appUrl}/auth/callback`}});
 // Same response for existing and nonexistent accounts; provider rate limits apply.
 redirect('/login?status=check-email');
}
