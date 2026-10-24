import { requestSignIn } from './actions';
import { pilotMode } from '@/lib/pilot-config';
import Link from 'next/link';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{status?:string}>}){
 const {status}=await searchParams;
 if(pilotMode()==='demo')return <main className="auth-page"><h1>Local demonstration</h1><p>Sign-in is enabled only for the production pilot.</p><Link href="/">Open dashboard</Link></main>;
 const messages:Record<string,string>={'check-email':'If your pilot account is enabled, a sign-in link will arrive shortly. Open it in this same browser.','invalid-email':'Enter a valid email address.','not-authorized':'This account is not enabled for the pilot. Ask the project owner to grant access.','link-expired':'This sign-in link is invalid or expired. Request a new one.'};
 return <main className="auth-page"><div className="eyebrow">NORDIC / FICC INTELLIGENCE</div><h1>Sign in to the pilot.</h1><p>Invite-only access. Stage 1 validates sign-in and persistent storage; monitoring and notifications are disabled.</p>{status&&<p role="status" className="auth-status">{messages[status]||'Please sign in again.'}</p>}<form action={requestSignIn}><label htmlFor="email">Pilot email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254}/><button className="button" type="submit">Email a sign-in link</button></form></main>;
}
