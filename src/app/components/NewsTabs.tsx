'use client';
import { useState } from 'react';
export default function NewsTabs({data}:{data:any}) {
  const [tab,setTab]=useState('eventos'); const tabs=['eventos','noticias','youtube','publicaciones'];
  return <div className="news-content container content-below-diagonal"><div className="news-tabs">{tabs.map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{data.tabs[x]}</button>)}</div>{tab==='eventos'&&<div className="events-grid">{data.eventos.map((x:any)=><article className="event-card" key={x.title}><img src={x.image} alt={x.title}/><div className="event-info"><span>{x.date}</span><h3>{x.title}</h3><p>{x.description}</p></div></article>)}</div>}{tab==='noticias'&&data.noticias.map((x:any)=><article className="news-item" key={x.title}><span>{x.date}</span><h3>{x.title}</h3><p>{x.description}</p></article>)}{tab==='publicaciones'&&data.publicaciones.map((x:any)=><article className="pub-item" key={x.title}><h3>{x.title}</h3><p>{x.description}</p></article>)}</div>;
}
