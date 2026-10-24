'use client';
import {useEffect,useRef,type ReactNode} from 'react';
export default function ReviewDrawer({title,onClose,children,footer,locked=false}:{title:string;onClose:()=>void;children:ReactNode;footer?:ReactNode;locked?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current,previous=document.activeElement,overflow=document.body.style.overflow,position=window.scrollY;document.body.style.overflow='hidden';if(dialog){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}window.scrollTo(0,position);const frame=requestAnimationFrame(()=>window.scrollTo(0,position));return()=>{cancelAnimationFrame(frame);document.body.style.overflow=overflow;if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});window.scrollTo(0,position);};},[]);
 return <dialog ref={ref} className="review-drawer" role="dialog" aria-modal="true" aria-label={title} onCancel={e=>{e.preventDefault();if(!locked)onClose();}}><header className="review-drawer-header"><h2>{title}</h2><button type="button" className="button secondary" aria-label="Close review pane" disabled={locked} onClick={onClose}>Close</button></header><div className="review-drawer-body">{children}</div>{footer&&<footer className="review-drawer-footer">{footer}</footer>}</dialog>;
}
