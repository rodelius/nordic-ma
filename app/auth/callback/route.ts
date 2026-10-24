import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { pilotConfig } from '@/lib/pilot-config';
export async function GET(req:Request){
 const config=pilotConfig();const code=new URL(req.url).searchParams.get('code');
 if(code){const client=await supabaseServer();const {error}=await client.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL('/',config.appUrl));}
 return NextResponse.redirect(new URL('/login?status=link-expired',config.appUrl));
}
