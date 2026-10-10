from pathlib import Path
from datetime import datetime, timezone
import json, re, html, shutil
from markdown_it import MarkdownIt
from bs4 import BeautifulSoup, NavigableString
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT
BASE='Garden_Website_Development_Plan_v1.0_2026-10-10'
plan=json.loads((ROOT/'plan/plan.json').read_text())
raw=(ROOT/'docs/architecture-and-delivery.md').read_text()+'\n'+(ROOT/'docs/coverage-section.md').read_text()+'\n'+(ROOT/'docs/pr-catalog.md').read_text()+'\n'+(ROOT/'docs/risk-register.md').read_text()+'\n'+(ROOT/'docs/sources/register-section.md').read_text()
# Embed the source-table summary in the portable reading edition; full field mapping stays in package.
mp=json.loads((ROOT/'docs/migration/table-disposition.json').read_text())
raw+='\n## 21. Complete source-table accounting\n\nAll 106 tables were inspected in the read-only CORE database. This is a proposed migration disposition, not an executed website import. Preserve all 923,292 rows, including historical snapshots and unreviewed candidates. The repository package adds exact columns, original SQL, hashes, per-table mapping rules and semantic tests.\n\n| Source table | Observed rows | Proposed normalized domain | Initial access |\n|---|---:|---|---|\n'
for t in mp['tables']:raw+=f"| `{t['source_table']}` | {t['source_rows']:,} | {t['normalized_domain']} | {t['initial_classification']} |\n"
raw+='''

## 22. Package contents and preparation verification

The repository-ready package includes this complete plan, one file per planned PR, machine-readable scope/dependencies, a full 43-feature crosswalk, release closures, JSON schemas, a 106-table disposition matrix, the inspected source schema, the preserved research charter, 12 ADRs, the standing development instructions, security and integration contracts, credential names without values, PR template, test/evidence requirements, deployment/restore/incident runbooks and developer handoff instructions.

The local plan validator checks unique identifiers, feature coverage, dependency existence and cycles, release closures, current-versus-conditional scope, acceptance/test identifiers, source-table accounting, per-PR document parity and honest initial progress. Its 21 automated tests include intentionally broken dependency, fabricated evidence, missing mapping and false-progress cases. The preparation validation passed with 210 PR specifications, 630 acceptance criteria, 630 specified future test scenarios, 960 dependency edges, 43 mapped functions and all 106 source tables accounted for. This is validation of the plan and its tooling, not execution of those future application tests.

The current CORE ZIP was checksum-verified and its enclosed SQLite database reopened read-only. The observed database has 106 tables, 186 indexes, zero triggers and 923,292 rows; integrity_check returned ok and foreign_key_check returned no violations. Those observations do not close inherited recovery gaps or certify historical facts, citations, images, rights or the full research edition.

The browser reader is a portable documentation interface, not the Garden application. Local browser inspection and package checks are recorded under validation/ in the repository bundle. No GitHub repository was inspected or updated; no real PR was opened/merged; no application CI, production deployment, Engine Room synchronization or canonical-security certification occurred during this planning task. All application work items remain planned or conditional.
'''
(ROOT/'DEVELOPMENT_PLAN.md').write_text(raw)
(OUT/(BASE+'.md')).write_text(raw)
shutil.copy2(ROOT/'plan/plan.json',OUT/'Garden_Website_PR_Plan_v1.0_2026-10-10.json')
# Convert citations to internal reference links; technical facts remain tied to the sources register.
render_text=re.sub(r'\[([PSV]\d{2})\]',lambda m:f'[{m.group(1)}](#source-{m.group(1).lower()})',raw)
md=MarkdownIt('commonmark',{'html':False}).enable('table')
soup=BeautifulSoup(md.render(render_text),'html.parser')
used=set();toc=[]
for heading in soup.find_all(re.compile('^h[1-6]$')):
    txt=heading.get_text(' ',strip=True)
    pm=re.match(r'(GDN-\d{3})\s*-',txt)
    sm=re.match(r'([PSV]\d{2})\s*-',txt)
    if pm:anchor=pm.group(1).lower()
    elif sm:anchor='source-'+sm.group(1).lower()
    else:anchor=re.sub('[^a-z0-9]+','-',txt.lower()).strip('-')
    stem=anchor;n=2
    while anchor in used:anchor=stem+'-'+str(n);n+=1
    used.add(anchor);heading['id']=anchor
    if heading.name=='h2':toc.append((anchor,txt))
# Wrap catalog specifications in native details cards.
for h in list(soup.find_all('h4')):
    pm=re.match(r'(GDN-\d{3})\s*-\s*(.*)',h.get_text(' ',strip=True))
    if not pm:continue
    pid,title=pm.groups();p=next(x for x in plan['prs'] if x['id']==pid)
    d=soup.new_tag('details');d['class']='pr-card';d['id']=pid.lower();d['data-phase']=p['workstream'];d['data-features']=' '.join(p['features']);d['data-status']=p['status']
    summary=soup.new_tag('summary')
    ident=soup.new_tag('span');ident['class']='pr-id';ident.string=pid
    label=soup.new_tag('span');label['class']='pr-title';label.string=title
    badge=soup.new_tag('span');badge['class']='badge '+p['status'];badge.string=p['status']
    summary.extend([ident,label,badge]);d.append(summary)
    body=soup.new_tag('div');body['class']='pr-body'
    node=h.next_sibling
    while node is not None and not (getattr(node,'name',None) in ['h1','h2','h3','h4']):
        nxt=node.next_sibling;body.append(node.extract());node=nxt
    d.append(body);h.replace_with(d)
# Make numbered PR references navigable, while retaining code/URLs unmodified.
for node in list(soup.find_all(string=True)):
    if node.parent.name in ['code','pre','a','script','style','summary'] or node.find_parent('summary'):continue
    text=str(node)
    if not re.search(r'\bGDN-\d{3}\b(?!-)',text):continue
    pieces=[];last=0
    for m in re.finditer(r'\bGDN-\d{3}\b(?!-)',text):
        pieces.append(NavigableString(text[last:m.start()]))
        a=soup.new_tag('a',href='#'+m.group().lower());a.string=m.group();a['class']='pr-ref';pieces.append(a);last=m.end()
    pieces.append(NavigableString(text[last:]))
    for piece in pieces:node.insert_before(piece)
    node.extract()
for table in list(soup.find_all('table')):
    wrap=soup.new_tag('div');wrap['class']='table-scroll';wrap['tabindex']='0';wrap['role']='region';wrap['aria-label']='Scrollable reference table';table.wrap(wrap)
# Remove duplicate manuscript title; masthead provides h1.
first=soup.find('h1')
if first:first.decompose()
nav=''.join(f'<a href="#{html.escape(a)}">{html.escape(t)}</a>' for a,t in toc)
phase_options=''.join(f'<option value="{x["id"]}">{x["id"]} - {html.escape(x["title"])}</option>' for x in plan['workstreams'])
feat_options=''.join(f'<option value="{x["id"]}">{x["id"]} - {html.escape(x["title"])}</option>' for x in plan['features'])
toolbar=f'''<section class="catalog-tools" aria-label="Filter planned pull requests"><h3>Find a planned PR</h3><div class="filters"><label>Keywords or PR ID<input id="pr-query" type="search" placeholder="For example: transcription or GDN-126"></label><label>Workstream<select id="phase-filter"><option value="">All 16 workstreams</option>{phase_options}</select></label><label>Function<select id="feature-filter"><option value="">All 43 functions</option>{feat_options}</select></label><label>Scope<select id="status-filter"><option value="">All scope</option><option value="planned">Current public / research</option><option value="conditional">Conditional government</option></select></label></div><div class="filter-actions"><p id="pr-count" aria-live="polite">210 planned PRs shown</p><button id="clear-filters" type="button">Clear filters</button><button id="expand-prs" type="button">Expand visible PRs</button><button id="collapse-prs" type="button">Collapse PRs</button></div></section>'''
cathead=soup.find(id='18-complete-pull-request-execution-catalog')
assert cathead
cathead.insert_after(BeautifulSoup(toolbar,'html.parser'))
content=str(soup)
css='''
:root{--ink:#193b31;--body:#253c35;--muted:#596b62;--paper:#fbfaf5;--panel:#fff;--line:#dbe1d7;--accent:#2f6752;--gold:#9e7031;--warn:#fff2d7}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:96px}body{margin:0;background:var(--paper);color:var(--body);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:#245f4d;text-decoration-thickness:1px;text-underline-offset:3px}a:hover{color:#17382e}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #b98537;outline-offset:4px}h1,h2,h3,h4{color:var(--ink);line-height:1.25;text-wrap:balance}h1{font-family:Georgia,serif;font-size:clamp(2.3rem,5vw,4.7rem);font-weight:500;letter-spacing:-.035em;margin:.6rem 0 1rem}h2{font-family:Georgia,serif;font-size:2rem;margin:4rem 0 1.4rem;padding-top:1rem;border-top:1px solid var(--line)}h3{font-size:1.24rem;margin:2.3rem 0 1rem}h4{font-size:1.1rem;margin:1.8rem 0 .8rem}p{margin:.9rem 0 1.2rem}li{margin:.45rem 0}strong{color:#193b31}code{font-size:.85em;background:#eef2e9;border-radius:4px;padding:.13em .32em;overflow-wrap:anywhere}pre{padding:1.25rem;background:#eef2e9;border:1px solid var(--line);border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere}pre code{background:none;padding:0}button,input,select{font:inherit}button{border:1px solid #9dad9f;background:#fff;color:var(--ink);padding:.55rem .85rem;border-radius:6px;cursor:pointer}button:hover{background:#eef2e9}input,select{width:100%;min-height:43px;border:1px solid #abb9ac;border-radius:6px;padding:.5rem .7rem;background:white;color:var(--body)}label{display:block;font-size:.84rem;font-weight:650}label input,label select{margin-top:.35rem;font-weight:400;font-size:.92rem}.skip{position:absolute;left:8px;top:-90px;background:white;padding:10px;z-index:20}.skip:focus{top:6px}.topbar{position:sticky;top:0;z-index:10;background:#f9faf5f5;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:12px 3.2vw;backdrop-filter:blur(10px)}.brand{font-family:Georgia,serif;font-size:1.45rem;font-weight:700;white-space:nowrap;text-decoration:none}.top-label{font-size:.74rem;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}.global-search{width:min(510px,47vw)}.global-search label{display:flex;align-items:center;gap:.6rem}.global-search input{margin:0}.top-actions{display:flex;gap:.6rem;align-items:center}.layout{display:grid;grid-template-columns:270px minmax(0,1fr);max-width:1550px;margin:0 auto;gap:36px;padding:32px 36px 80px}.sidebar{position:sticky;top:104px;height:calc(100vh - 130px);overflow:auto;padding:0 14px 20px 0;font-size:.84rem}.sidebar summary{font-weight:700;padding:.4rem 0 .8rem;color:var(--ink);cursor:pointer}.sidebar nav{display:flex;flex-direction:column;gap:2px}.sidebar a{display:block;text-decoration:none;padding:.4rem .55rem;border-left:2px solid transparent;line-height:1.45}.sidebar a:hover,.sidebar a:focus{background:#eaf0e6;border-left-color:var(--accent)}.nav-note{font-size:.78rem;color:var(--muted);padding:.8rem .55rem;border-top:1px solid var(--line);margin-top:1rem}.main{min-width:0;max-width:1050px}.hero{padding:1.5rem 0 2.3rem;border-bottom:1px solid var(--line)}.eyebrow{font-size:.75rem;text-transform:uppercase;letter-spacing:.17em;font-weight:700;color:var(--accent)}.lede{font:1.15rem/1.65 Georgia,serif;max-width:760px}.hero-meta{color:var(--muted);font-size:.88rem}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:1.8rem 0}.stat{border-top:2px solid #8aa78e;padding:.9rem .3rem}.stat strong{display:block;font-family:Georgia,serif;font-size:2.35rem;font-weight:500;line-height:1.1}.stat span{display:block;font-size:.78rem;margin-top:.4rem;color:var(--muted)}.notice{background:var(--warn);border-left:4px solid var(--gold);padding:1rem 1.2rem;font-size:.91rem}.jump-links{display:flex;gap:.65rem;flex-wrap:wrap;margin-top:1.4rem}.jump-links a{border:1px solid var(--line);background:white;padding:.45rem .7rem;border-radius:5px;text-decoration:none;font-size:.86rem}.table-scroll{overflow-x:auto;margin:1.2rem 0;border:1px solid var(--line);border-radius:7px}table{border-collapse:collapse;width:100%;font-size:.86rem;line-height:1.5;background:white}th,td{text-align:left;vertical-align:top;padding:.8rem;border-bottom:1px solid var(--line);overflow-wrap:anywhere;min-width:100px}th{background:#e8eee4;color:var(--ink);font-weight:700}tr:last-child td{border-bottom:0}.pr-ref{white-space:nowrap}.catalog-tools{background:#edf2e9;border:1px solid #cbd7c7;border-radius:9px;padding:1.2rem;margin:1.5rem 0}.catalog-tools h3{margin:0 0 1rem}.filters{display:grid;grid-template-columns:1.5fr 1fr;gap:.9rem}.filter-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;margin-top:.85rem;font-size:.82rem}.filter-actions p{margin:.3rem auto .3rem 0}.pr-card{background:white;border:1px solid var(--line);border-radius:8px;margin:.85rem 0;scroll-margin-top:100px}.pr-card[open]{border-color:#9cb299;box-shadow:0 3px 14px #17382e08}.pr-card summary{display:flex;gap:.75rem;align-items:baseline;cursor:pointer;list-style:none;padding:1rem 1.1rem}.pr-card summary::-webkit-details-marker{display:none}.pr-card summary:before{content:'+';color:var(--accent);font-weight:700}.pr-card[open] summary:before{content:'-'} .pr-id{font:700 .8rem/1.4 ui-monospace,SFMono-Regular,monospace;color:var(--accent);white-space:nowrap}.pr-title{font-weight:650;flex:1;line-height:1.4}.badge{font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border:1px solid #d9e2d3;border-radius:20px;padding:2px 7px;color:#496344;background:#f1f6eb;white-space:nowrap}.badge.conditional{background:#fff4de;color:#805820;border-color:#eddaaf}.pr-body{border-top:1px solid var(--line);padding:.8rem 1.35rem 1.1rem;font-size:.94rem}.pr-body ul{padding-left:1.35rem}.pr-body p{margin:.9rem 0}.search-results{background:white;border:1px solid var(--line);border-radius:8px;padding:1.3rem;margin:0 0 1.8rem}.search-results h2{margin:0 0 .7rem;border:0;padding:0;font:700 1.2rem/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.search-results ul{max-height:55vh;overflow:auto;padding-left:1.25rem}.search-results li{padding:.25rem 0}.search-results small{display:block;color:var(--muted)}.search-results[hidden],.pr-card[hidden]{display:none!important}.footer{padding:2rem 0;border-top:1px solid var(--line);margin-top:3rem;font-size:.85rem;color:var(--muted)}
@media(max-width:1050px){.layout{grid-template-columns:215px minmax(0,1fr);gap:24px;padding:24px}.top-label{display:none}.sidebar{font-size:.8rem}.stats{gap:8px}.stat strong{font-size:2rem}.pr-card summary{flex-wrap:wrap}.badge{margin-left:auto}}
@media(max-width:760px){html{scroll-padding-top:112px}.topbar{padding:10px 16px;flex-wrap:wrap;gap:8px}.brand{font-size:1.25rem}.top-actions button{padding:.3rem .6rem;font-size:.8rem}.global-search{width:100%;order:3}.global-search label span{font-size:.78rem}.global-search input{min-height:38px;font-size:.9rem}.layout{display:block;padding:18px 18px 50px}.sidebar{position:static;height:auto;padding:0;margin-bottom:16px;border-bottom:1px solid var(--line)}.sidebar nav{max-height:45vh;overflow:auto}.sidebar summary{font-size:.9rem}.hero{padding:.8rem 0 1.8rem}h1{font-size:2.6rem}h2{font-size:1.6rem;margin-top:3rem}.lede{font-size:1.06rem}.stats{grid-template-columns:repeat(2,1fr)}.stat strong{font-size:2rem}.filters{grid-template-columns:1fr}.pr-card summary{padding:.8rem;gap:.5rem}.pr-title{font-size:.94rem;flex-basis:65%}.pr-body{padding:.65rem .9rem;font-size:.91rem}.notice{padding:.8rem 1rem}.table-scroll{max-width:100%}.filter-actions{gap:.45rem}.filter-actions p{width:100%}.badge{font-size:.6rem}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation:none!important;transition:none!important}}
@media print{.topbar,.sidebar,.catalog-tools,.search-results,.jump-links{display:none!important}.layout{display:block;padding:0;max-width:none}.main{max-width:none}body{background:white;color:black;font-size:10pt}.hero{padding:0}h1{font-size:30pt}h2{break-before:page;font-size:19pt}.pr-card{break-inside:auto;box-shadow:none}.pr-card[hidden]{display:block!important}.pr-card .pr-body{display:block!important}.pr-card summary{break-after:avoid}.table-scroll{overflow:visible}.badge{border:1px solid #777}.notice{background:white}a{color:inherit;text-decoration:none}pre{white-space:pre-wrap}.stats{grid-template-columns:repeat(4,1fr)}}
'''
js='''
(()=>{'use strict';
 const cards=[...document.querySelectorAll('.pr-card')];
 const q=document.querySelector('#pr-query'),phase=document.querySelector('#phase-filter'),feature=document.querySelector('#feature-filter'),status=document.querySelector('#status-filter'),count=document.querySelector('#pr-count');
 cards.forEach(c=>c.dataset.search=c.textContent.toLowerCase());
 function filter(){let n=0;const terms=q.value.toLowerCase().trim().split(/\\s+/).filter(Boolean);cards.forEach(c=>{const exact=/^gdn-[0-9]{3}$/.test(q.value.toLowerCase().trim());const show=(exact?c.id===q.value.toLowerCase().trim():terms.every(t=>c.dataset.search.includes(t)))&&(!phase.value||c.dataset.phase===phase.value)&&(!feature.value||c.dataset.features.split(' ').includes(feature.value))&&(!status.value||c.dataset.status===status.value);c.hidden=!show;if(show)n++});count.textContent=n+' of 210 planned PRs shown';}
 [q,phase,feature,status].forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',filter));
 function clear(){q.value='';phase.value='';feature.value='';status.value='';filter();}
 document.querySelector('#clear-filters').addEventListener('click',clear);
 document.querySelector('#expand-prs').addEventListener('click',()=>cards.filter(c=>!c.hidden).forEach(c=>c.open=true));
 document.querySelector('#collapse-prs').addEventListener('click',()=>cards.forEach(c=>c.open=false));
 const global=document.querySelector('#global-query'),result=document.querySelector('#search-results'),list=document.querySelector('#result-list'),label=document.querySelector('#result-count');
 const units=cards.map(c=>({id:c.id,title:c.querySelector('summary').textContent.trim(),text:c.textContent.toLowerCase()}));
 document.querySelectorAll('#document h2,#document h3').forEach(h=>{if(h.closest('.catalog-tools'))return;let text=h.textContent,n=h.nextElementSibling;while(n&&!/^H[123]$/.test(n.tagName)&&!n.classList.contains('pr-card')){text+=' '+n.textContent;n=n.nextElementSibling}units.push({id:h.id,title:h.textContent,text:text.toLowerCase()});});
 let timer;
 function globalSearch(){const query=global.value.toLowerCase().trim(),terms=query.split(/\\s+/).filter(Boolean);list.replaceChildren();result.hidden=!query;if(!query)return;const hits=units.filter(u=>u.id&&terms.every(t=>u.text.includes(t)));result.scrollIntoView({block:'start'});label.textContent=hits.length+' matching sections or PRs'+(hits.length>60?' (first 60 shown)':'');hits.slice(0,60).forEach(u=>{const li=document.createElement('li'),a=document.createElement('a');a.href='#'+u.id;a.textContent=u.title;li.append(a);list.append(li);});if(!hits.length){const li=document.createElement('li');li.textContent='No match. Try a shorter term, a PR ID, or the feature filters in the catalog.';list.append(li);}}
 global.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(globalSearch,100)});
 document.querySelector('#clear-global').addEventListener('click',()=>{global.value='';globalSearch();global.focus()});
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();global.focus();}if(e.key==='Escape'&&document.activeElement===global){global.value='';globalSearch();}});
 function reveal(){const id=decodeURIComponent(location.hash.slice(1));if(!id)return;const el=document.getElementById(id);if(el&&el.classList.contains('pr-card')){if(el.hidden)clear();el.open=true;requestAnimationFrame(()=>el.scrollIntoView({block:'start'}));}}
 window.addEventListener('hashchange',reveal);reveal();
 document.querySelector('#print-plan').addEventListener('click',()=>window.print());
 let opened=[];window.addEventListener('beforeprint',()=>{opened=cards.map(c=>c.open);cards.forEach(c=>c.open=true)});window.addEventListener('afterprint',()=>cards.forEach((c,i)=>c.open=opened[i]));
 if(window.matchMedia('(max-width:760px)').matches)document.querySelector('#contents').open=false;
})();
'''
html_doc=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="The Garden comprehensive development plan: 210 scoped PRs, 43 functions, architecture, tests, deployment and migration."><title>The Garden - Comprehensive Development Plan</title><style>{css}</style></head><body><a class="skip" href="#main">Skip to plan</a><header class="topbar"><a class="brand" href="#main">The Garden</a><span class="top-label">Development plan / v1.0</span><div class="global-search"><label><span>Search plan</span><input id="global-query" type="search" placeholder="Topic, requirement, or PR ID" aria-describedby="search-help"></label><span id="search-help" hidden>Search all sections and pull-request specifications. Control or Command K focuses this field.</span></div><div class="top-actions"><button id="print-plan" type="button">Print</button></div></header><div class="layout"><aside class="sidebar"><details open id="contents"><summary>Contents</summary><nav aria-label="Plan sections">{nav}</nav><p class="nav-note">43 functions. 16 workstreams.<br>196 current-scope PRs.<br>14 conditional government PRs.<br><br>Planning document only.<br>No implemented application claimed.</p></details></aside><main class="main" id="main"><section class="hero"><div class="eyebrow">A public institution. A research platform. An accountable record.</div><h1>The Garden<br>Development Plan</h1><p class="lede">From the first public explanation to independently reviewed historical evidence, collaborative research, and a durable operational platform.</p><p class="hero-meta">Version 1.0 &middot; 10 October 2026 &middot; GARDEN-WEB-PLAN-001</p><div class="stats"><div class="stat"><strong>210</strong><span>Scoped planned PRs</span></div><div class="stat"><strong>43</strong><span>Functions mapped</span></div><div class="stat"><strong>630</strong><span>Acceptance criteria</span></div><div class="stat"><strong>106</strong><span>Source tables accounted for</span></div></div><div class="notice"><strong>Plan, not a deployed application.</strong> The catalog includes 196 current public/research work items and 14 conditional governmental items. GitHub, production deployment, Engine Room synchronization and canonical security compliance remain unverified. The specified application tests have not yet run.</div><div class="jump-links"><a href="#18-complete-pull-request-execution-catalog">Explore all PRs</a><a href="#17-feature-coverage-release-gates-and-dependency-execution">Feature coverage &amp; releases</a><a href="#9-security-assurance-and-privacy-program">Security architecture</a><a href="#19-risk-register-blockers-and-acceptance-responsibilities">Risks &amp; access gates</a></div></section><section id="search-results" class="search-results" hidden aria-live="polite"><h2>Search results</h2><p id="result-count"></p><button id="clear-global" type="button">Clear search</button><ul id="result-list"></ul></section><article id="document">{content}</article><footer class="footer">The Garden / Planning baseline 1.0. This portable reader uses no external scripts, fonts, trackers or network requests. Source links may require separate authorized access. Implementation and scholarly completion must be verified independently.</footer></main></div><script>{js}</script></body></html>'''
(ROOT/'DEVELOPMENT_PLAN.html').write_text(html_doc)
(OUT/(BASE+'.html')).write_text(html_doc)
# Structural checks independent of browser execution.
parsed=BeautifulSoup(html_doc,'html.parser');allids=[x['id'] for x in parsed.select('[id]')]
assert len(allids)==len(set(allids)), 'Duplicate HTML IDs'
assert len(parsed.select('.pr-card'))==210
bad=[]
for a in parsed.select('a[href^="#"]'):
    target=a['href'][1:]
    if target and target not in set(allids):bad.append(a['href'])
assert not bad,bad[:10]
assert not parsed.select('script[src],link[rel=stylesheet],img[src^="http"]')
print(json.dumps({'markdown_words':len(raw.split()),'html_bytes':len(html_doc.encode()),'pr_cards':210,'anchors':len(allids),'broken_internal_links':len(bad)},indent=2))
