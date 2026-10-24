import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { pilotConfig, pilotMode } from './lib/pilot-config';
function privateResponse(response:NextResponse){response.headers.set('Cache-Control','private, no-store');return response;}
export async function proxy(request:NextRequest){
 try{
 if(pilotMode()==='demo')return NextResponse.next();
 const config=pilotConfig();
 const path=request.nextUrl.pathname;
 if(path==='/login'||path==='/auth/callback'||path==='/auth/signout')return privateResponse(NextResponse.next());
 let response=NextResponse.next({request});
 const client=createServerClient(config.url,config.key,{cookies:{
  getAll:()=>request.cookies.getAll(),
  setAll:values=>{for(const v of values)request.cookies.set(v.name,v.value);response=NextResponse.next({request});for(const v of values)response.cookies.set(v.name,v.value,v.options);},
 }});
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user){return privateResponse(path.startsWith('/api/')?NextResponse.json({error:'Sign in required'},{status:401}):NextResponse.redirect(new URL('/login',config.appUrl)));}
 const {data:member,error:memberError}=await client.from('pilot_members').select('user_id').eq('user_id',user.id).eq('enabled',true).maybeSingle();
 if(memberError)return privateResponse(NextResponse.json({error:'Pilot access could not be verified. Check database setup.'},{status:503}));
 if(!member)return privateResponse(path.startsWith('/api/')?NextResponse.json({error:'Pilot access required'},{status:403}):NextResponse.redirect(new URL('/login?status=not-authorized',config.appUrl)));
 // Stage 1 is deliberately read-only; bearer tokens cannot bypass this gate.
 if(path.startsWith('/api/')&&!['GET','HEAD'].includes(request.method))return privateResponse(NextResponse.json({error:'Stage 1 is read-only. Ingestion and notifications require the next validation stage.'},{status:403}));
 return privateResponse(response);
 }catch{return privateResponse(NextResponse.json({error:'Pilot configuration is incomplete. Follow docs/production-pilot.md.'},{status:503}));}
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|manifest.webmanifest|sw.js).*)']};
