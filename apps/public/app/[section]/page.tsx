import Link from "next/link";
import type { Metadata } from "next";
import { PUBLIC_PAGES, findPublicPage } from "@garden/domain";
import { notFound } from "next/navigation";
export const dynamicParams = false;
export function generateStaticParams(){return PUBLIC_PAGES.map(p=>({section:p.slug}));}
export async function generateMetadata({params}:{params:Promise<{section:string}>}):Promise<Metadata>{
  const page=findPublicPage((await params).section);
  return {title:page?.title??"Not found",robots:{index:false,follow:false}};
}
export default async function SectionPage({params}:{params:Promise<{section:string}>}){
  const page=findPublicPage((await params).section);
  if(!page)notFound();
  return <>
    <div className="section-heading"><div className="wrap">
      <p className="eyebrow gold">{page.eyebrow}</p>
      <h1>{page.title}</h1>
      <p className="hero-context">{page.introduction}</p>
      <span className="release-state">{page.status==="proposal"?"Draft policy":page.status==="research-planned"?"Research in development":"Participation in development"}</span>
    </div></div>
    <div className="section wrap reading">
      {page.paragraphs.map((text,index)=><p key={index}>{text}</p>)}
      {page.cautions.length>0&&<aside aria-label="Limitations and review status" className="caution"><h2>What remains uncertain</h2><ul>{page.cautions.map(note=><li key={note}>{note}</li>)}</ul></aside>}
      {page.sourceNote&&<p className="source-note">{page.sourceNote}</p>}
      {page.sourceHref&&<p><a className="text-link" href={page.sourceHref}>{page.sourceLabel??"Consult the source"} <span aria-hidden="true">↗</span></a></p>}
      <p><Link className="text-link" href="/">← Return to the overview</Link></p>
    </div>
  </>;
}
