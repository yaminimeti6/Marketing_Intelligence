'use client';
import { useEffect,useTransition } from 'react';
import { useRouter } from 'next/navigation';
export default function ImportRefresh({active,intervalMs=5000}:{active:boolean;intervalMs?:number}){
 const router=useRouter();const [pending,startTransition]=useTransition();
 useEffect(()=>{
  if(!active)return;
  const timer=setInterval(()=>{if(!pending&&document.visibilityState==='visible')startTransition(()=>router.refresh());},intervalMs);
  return ()=>clearInterval(timer);
 },[active,pending,router,intervalMs]);
 return active?<p className="foundation-muted" role="status">Status refreshes every {intervalMs/1000} seconds while this page is visible.</p>:null;
}
