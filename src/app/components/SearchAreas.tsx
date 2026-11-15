'use client';
import Link from 'next/link';
import { useState } from 'react';
export default function SearchAreas({items,lang,placeholder}:{items:any[];lang:string;placeholder:string}) {
  const [query,setQuery]=useState('');
  return <><div className="areas-search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={placeholder}/></div><div className="areas-grid">{items.filter(a=>a.title.toLowerCase().includes(query.toLowerCase())).map(a=><Link className="area-card" href={`/${lang}/areas/${a.id}`} key={a.id}><h3>{a.title}</h3></Link>)}</div></>;
}
