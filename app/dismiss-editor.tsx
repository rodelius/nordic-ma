'use client';
import {useState} from 'react';
import ReviewDrawer from './review-drawer';
import {DISMISS_REASONS} from '@/lib/feedback-labels';
import type {SourceItem} from '@/lib/source-feed';
export default function DismissEditor({item,onClose,onSaved}:{item:SourceItem;onClose:()=>void;onSaved:(message:string)=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <ReviewDrawer title="Dismiss announcement" onClose={onClose} locked={busy}><h3>{item.headline}</h3><p>{item.excerpt.slice(0,500)}</p>{error&&<p role="alert" className="error">{error}</p>}<form noValidate onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(!f.get('reason')){setError('Choose a dismissal reason before saving.');return;}setBusy(true);setError('');try{const r=await fetch('/api/pilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'dismiss',sourceId:item.id,reason:String(f.get('reason')),note:String(f.get('note')||'')})});const j=await r.json();if(!r.ok)throw Error(j.error);await onSaved('Dismissal and feedback saved.');onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><label>Dismissal reason<select name="reason" defaultValue="" disabled={busy}><option value="">Choose a reason</option>{Object.entries(DISMISS_REASONS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Feedback note (optional)<textarea name="note" maxLength={1000} disabled={busy}/></label><p>Stale, duplicate and uncertain cases are excluded from relevance learning. Consider a score of 1–2 and approval if a deal should remain on the watchlist.</p><button className="button" disabled={busy}>Dismiss and record feedback</button></form></ReviewDrawer>;
}
