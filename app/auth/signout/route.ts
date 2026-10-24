import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { pilotConfig } from '@/lib/pilot-config';
export async function POST(req:Request){
 const config=pilotConfig();if(req.headers.get('origin')!==config.appUrl)return NextResponse.json({error:'Invalid origin'},{status:403});
 const client=await supabaseServer();await client.auth.signOut();return NextResponse.redirect(new URL('/login',config.appUrl),303);
}
