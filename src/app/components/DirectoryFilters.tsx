'use client';
import Link from 'next/link';
import { useState } from 'react';
export default function DirectoryFilters({data,lang}:{data:any;lang:string}) {
  const [filters,setFilters]=useState({category:'todos',area:'todos',location:'todos',name:''});
  const update=(key:string,value:string)=>setFilters(f=>({...f,[key]:value}));
  const members=data.members.filter((m:any)=> (filters.category==='todos'||m.category===filters.category)&&(filters.area==='todos'||m.area===filters.area)&&(filters.location==='todos'||m.location===filters.location)&&m.name.toLowerCase().includes(filters.name.toLowerCase()));
  return <section className="container content-below-diagonal"><div className="filters"><select value={filters.category} onChange={e=>update('category',e.target.value)}>{data.filters.categories.map((x:any)=><option key={x.id} value={x.id}>{x[lang]}</option>)}</select><select value={filters.area} onChange={e=>update('area',e.target.value)}>{data.filters.areas.map((x:any)=><option key={x.id} value={x.id}>{x[lang]}</option>)}</select><select value={filters.location} onChange={e=>update('location',e.target.value)}>{data.filters.locations.map((x:any)=><option key={x.id} value={x.id}>{x[lang]}</option>)}</select><input placeholder={lang==='en'?'Search by name...':'¿Buscas a alguien en especial?'} value={filters.name} onChange={e=>update('name',e.target.value)}/></div><div className="team-grid">{members.map((m:any)=><Link className="team-card" href={`/${lang}/directorio/${m.id}`} key={m.id}><ImageFallback src={m.image} alt={m.name}/><h3>{m.name}</h3><p>{m.role[lang]}</p></Link>)}</div></section>;
}
function ImageFallback({src,alt}:{src:string;alt:string}) { return <img src={src} alt={alt} loading="lazy"/>; }
