import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Nordic / FICC Intelligence',description:'Evidence-led Nordic transaction intelligence',icons:{apple:'/icon-192.png'},appleWebApp:{capable:true,title:'Nordic FICC',statusBarStyle:'default'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#102e28'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
