import Link from "next/link";
import { SECONDARY_NAV } from "@garden/domain";
export default function Home(){
  return <>
    <section className="hero">
      <div className="wrap hero-inner">
        <p className="eyebrow gold">A proposal for collective renewal</p>
        <h1>History deserves <em>a future.</em></h1>
        <p className="hero-lead">The Garden proposes a new path toward voluntary self-government and lasting economic institutions for descendants of people enslaved in the United States.</p>
        <p className="hero-context">It is a proposal for Congress, not an existing federal program. Its full purpose, finances and historical foundations should be open to scrutiny.</p>
        <div className="actions">
          <Link className="btn primary" href="/how-it-works/">Understand the proposal <span aria-hidden="true">↗</span></Link>
          <Link className="btn outline" href="/history/">Explore the history</Link>
        </div>
      </div>
    </section>
    <section className="section wrap">
      <p className="eyebrow">Beyond a single story</p>
      <h2>People, societies and the capacity to govern.</h2>
      <p className="intro">The history of slavery is not only a history of captivity. It is also a history of people whose families, communities, institutions, languages and possibilities existed long before—and continued in many forms afterward.</p>
      <div className="three-col">
        <article className="editorial-card"><p className="card-num">01 / HISTORY</p><h3>Understand what came before.</h3><p>Investigate African societies and the full lives that archival records can illuminate, without turning uncertain identifications into facts.</p><Link href="/history/">The historical atlas <span aria-hidden="true">→</span></Link></article>
        <article className="editorial-card"><p className="card-num">02 / INSTITUTIONS</p><h3>Consider a collective remedy.</h3><p>The proposed framework would allow eligible descendants to voluntarily form new self-governing communities, subject to enacted law.</p><Link href="/how-it-works/">How the proposal works <span aria-hidden="true">→</span></Link></article>
        <article className="editorial-card"><p className="card-num">03 / ACCOUNTABILITY</p><h3>Examine the claims.</h3><p>Public finances, legal powers, historical evidence and meaningful objections all require transparency and independent review.</p><Link href="/questions/">Questions and concerns <span aria-hidden="true">→</span></Link></article>
      </div>
    </section>
    <section className="section mist">
      <div className="wrap split">
        <div><p className="eyebrow">The proposed process</p><h2>A pathway, not a promise.</h2><p>The draft proposes a historical census, voluntary participation, community constitutions, and conditional agreements with states. It cannot confer rights, citizenship or commercial privileges before legislation and authorized processes exist.</p><Link className="text-link" href="/legislation/">Explore the legislative proposal <span aria-hidden="true">→</span></Link></div>
        <div className="steps" aria-label="Four proposed steps">
          {["Historical evidence and correction","Voluntary descendant participation","Self-governing institutions","Negotiated opportunities and accountability"].map((label,i)=><div key={label} className="step"><b>{String(i+1).padStart(2,"0")}</b><span>{label}</span></div>)}
        </div>
      </div>
    </section>
    <section className="section wrap">
      <div className="split">
        <div><p className="eyebrow">The financial question</p><h2>Built around cost recovery. Not guaranteed cost-free.</h2></div>
        <div><p>The legislation aims to recover eligible public founding expenditures, but enterprise revenue can fall short, administration costs exist and repayments cannot be guaranteed. A categorical zero-taxpayer-cost claim is not established by the current draft.</p><Link href="/funding/" className="text-link">Understand the repayment design and risks <span aria-hidden="true">→</span></Link></div>
      </div>
    </section>
    <section className="section dark-panel">
      <div className="wrap split">
        <div><p className="eyebrow gold">The evidence must endure</p><h2>Findings that can be examined, corrected and questioned.</h2></div>
        <div><p>Our long-term aim is a public library of traceable historical records and a protected collaboration environment for researchers and families. Research must remain independent of any policy argument.</p><Link className="btn outline" href="/research/">See the research roadmap</Link></div>
      </div>
    </section>
    <section className="section wrap"><p className="eyebrow">Explore further</p>
      <div className="three-col">{SECONDARY_NAV.map(x=><article key={x.href} className="mini-card"><h3>{x.label}</h3><Link href={x.href}>Read more <span aria-hidden="true">→</span></Link></article>)}</div>
    </section>
    <section className="section notice" id="workspace-notice"><div className="wrap"><h2>Researcher access is in development.</h2><p>There is no active account service or protected research upload facility on this preview. No information about ancestry, political views or family records is collected here.</p><Link href="/research/">See future research capabilities</Link></div></section>
  </>;
}
