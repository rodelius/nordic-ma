import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { pilotConfig } from '../pilot-config';
export async function supabaseServer(){
 const config=pilotConfig(),jar=await cookies();
 return createServerClient(config.url,config.key,{cookies:{
  getAll:()=>jar.getAll(),
  setAll:values=>{for(const {name,value,options} of values)jar.set(name,value,options);},
 }});
}
export async function requirePilotMember(){
 const client=await supabaseServer();
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)throw Error('Authentication required');
 const {data:member,error:membershipError}=await client.from('pilot_members').select('user_id').eq('user_id',user.id).eq('enabled',true).maybeSingle();
 if(membershipError||!member)throw Error('Pilot access required');
 return {client,user};
}
