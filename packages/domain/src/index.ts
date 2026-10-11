export type PublicPage = {
  slug: string;
  navLabel: string;
  eyebrow: string;
  title: string;
  introduction: string;
  paragraphs: readonly string[];
  cautions: readonly string[];
  sourceHref?: string;
  sourceNote?: string;
  sourceLabel?: string;
  status: "proposal" | "research-planned" | "participation-planned";
};
export const PUBLIC_PAGES: readonly PublicPage[] = [
  {
    slug:"how-it-works",navLabel:"How it works",eyebrow:"The proposed institutions",
    title:"How would The Garden work?",
    introduction:"An act of Congress would be necessary before any proposed nation, affiliation, institution or enterprise could operate under this plan.",
    paragraphs:[
      "The first phase calls for an independently assessable historical census, published with citations, corrections and unresolved questions about historic political communities.",
      "Eligible descendants would be able to choose whether to participate. The proposal does not replace United States citizenship and a website account is never enrollment.",
      "Communities would establish constitutions and governance institutions. Future commercial opportunities depend on applicable law and voluntary negotiations rather than automatic awards.",
      "Oversight, independent accounting, privacy and meaningful appeals would require implementing processes and genuine review."
    ],
    cautions:["Proposed law, not existing authorization.","Constitutional and legislative-counsel review remains outstanding."],
    sourceNote:"Source: Proposed Garden Act v1.0, September 28, 2026. The full text is not yet published in this preview. Private Library links are not public citations.",status:"proposal"
  },
  {
    slug:"history",navLabel:"History & Atlas",eyebrow:"Recovering fuller histories",
    title:"People whose stories exceed captivity",
    introduction:"Historical work begins with complex human lives—families, laws, languages, institutions, beliefs, trades and communities—not merely the records of their enslavement.",
    paragraphs:[
      "A long-term atlas aims to connect communities, places, people, events, artifacts and original sources using careful identifications and explicit uncertainty.",
      "The surviving record is incomplete. A similar name, trading port, modern region or image cannot alone establish an individual or a political community.",
      "Disagreement, displacement, transformation and historical continuity all require their own evidence and should not be collapsed into a single predetermined outcome."
    ],
    cautions:["The existing atlas is an incomplete working research edition, not a verified comprehensive canon.","Unverified images and generated reconstructions are not presented as archival evidence."],
    sourceNote:"Source: Not From Nowhere, Working Research Edition 1.29-alpha, October 9, 2026. Public release of the corpus awaits record-level review and rights clearance.",status:"research-planned"
  },
  {
    slug:"research",navLabel:"Research",eyebrow:"Open evidence · accountable scholarship",
    title:"Examine the sources behind a claim",
    introduction:"The eventual public research library will make cleared documents searchable, with citations, competing explanations, correction histories and independent review states.",
    paragraphs:[
      "Researchers will be able to inspect transcriptions alongside source images, translations and provenance, and differentiate recorded statements from verified historical interpretations.",
      "Advanced search, maps, timelines and relationship exploration are planned, but have not been integrated into this preview.",
      "Collaboration and restricted records will require a separately secured, authorized researcher environment. Reviewing history will never require endorsing the Garden policy."
    ],
    cautions:["No public historical index is live in this preview.","Rights and private-record controls precede any publication of original research materials."],
    status:"research-planned"
  },
  {
    slug:"funding",navLabel:"Funding & risk",eyebrow:"Public fiscal accountability",
    title:"A proposed cost-recovery model—not a guarantee",
    introduction:"The draft aims to recover public founding expenditures through specified enterprise-related repayments. Recovery depends on outcomes and is not assured.",
    paragraphs:[
      "A serious fiscal model must include the founding and administration costs, delayed or unsuccessful enterprises, legal restrictions, repayment terms and possible unrecovered public expenditures.",
      "The current legislative draft does not substantiate an unconditional claim of zero taxpayer cost. The website must show the intended repayment design and its residual public exposure.",
      "Reproducible scenarios and independent fiscal assessment are required before quantitative savings or revenue projections can be published."
    ],
    cautions:["No audited program receipts or expenditures exist; this is a proposed federal program.","An expected repayment is not equivalent to no fiscal exposure."],
    sourceNote:"Source: Proposed Garden Act v1.0, September 28, 2026. The full text is not yet published in this preview. Private Library links are not public citations.",status:"proposal"
  },
  {
    slug:"legislation",navLabel:"Legislation",eyebrow:"The legislative proposal",
    title:"The proposed Garden Act",
    introduction:"This is a legislative proposal, not enacted federal law. Its definitions, governing structure and limitations require examination before forming a conclusion.",
    paragraphs:[
      "The draft proposes voluntary descendant-founded nations, distinct domestic governmental powers, a historical census, intergovernmental compacts and conditional economic opportunities.",
      "Its references to the Mohegan and Mashantucket Pequot governments provide an institutional analogy, not automatic recognition as an Indian tribe or automatic possession of treaty rights.",
      "Constitutional questions, fiscal provisions and implementing regulations require specialist review and possible legislative revision."
    ],
    cautions:["Draft v1.0 dated September 28, 2026.","Legislative counsel and independent legal review not yet completed."],
    sourceNote:"Source: Proposed Garden Act v1.0, September 28, 2026. The full text is not yet published in this preview. Private Library links are not public citations.",status:"proposal"
  },
  {
    slug:"questions",navLabel:"Questions & objections",eyebrow:"Serious questions deserve serious answers",
    title:"A proposal that should withstand scrutiny",
    introduction:"The Garden must be evaluated on its legal authority, fairness, costs, safeguards, feasibility and effects—not solely the strength of its moral argument.",
    paragraphs:[
      "How would constitutional authority and the rights of other residents and communities be protected? What occurs if a state declines negotiations?",
      "How would enterprise failure or unequal outcomes be handled? Who oversees governance, accounting and appeals?",
      "How will public founding expenditures and possible failure to recover them be reported? Would alternative remedies be more effective?",
      "These are live questions, not manufactured objections. The website will retain independent legal, fiscal and scholarly responses as they become available."
    ],
    cautions:["Independent expert analysis is pending, not certified complete.","Criticism and new historical evidence should remain inspectable even when they challenge the proposed policy."],status:"proposal"
  },
  {
    slug:"participate",navLabel:"Participate",eyebrow:"Questions · scholarship · voluntary contribution",
    title:"Contribute without surrendering control",
    introduction:"Anyone should be able to explore the proposal and its evidence. Family and community historians must have meaningful choices over how their material is used.",
    paragraphs:[
      "Planned contributions include public questions, correction submissions, research collaboration and family archives. Each will need appropriate consent and rights processes.",
      "Preserving a family record is not consent to publication, political messaging or official enrollment. Researchers need not endorse the legislation.",
      "No upload, identity verification, donation, registration or official citizenship service is available on this preliminary site."
    ],
    cautions:["Sensitive contribution channels are not yet open.","No profile or family-history information is collected on these public pages."],status:"participation-planned"
  },
  {
    slug:"about",navLabel:"About",eyebrow:"A public proposal and independent research",
    title:"A public case that can be examined",
    introduction:"The Garden combines a proposed collective institutional remedy with historical research that must remain independently correctable and accountable.",
    paragraphs:[
      "This website is in development. It is neither an administrative government portal nor an exhaustive historical archive.",
      "The long-term goal is clear explanation, public access to reviewed evidence, responsible collaboration and transparent correction of mistakes.",
      "Software progress, historical review, rights clearance, constitutional analysis and actual production operations have separate acceptance records."
    ],
    cautions:["Initial public experience is an engineering preview with provisional editorial content.","Visit the repository for the actual development status and open issues."],
    sourceHref:"https://github.com/neophilism/The-Garden",sourceLabel:"Project source and development plan",status:"proposal"
  }
] as const;

export const TOP_NAV: readonly {label:string; href:string}[]=[
 {label:"The Garden",href:"/"},
 {label:"How it works",href:"/how-it-works/"},
 {label:"History & Atlas",href:"/history/"},
 {label:"Research",href:"/research/"},
 {label:"Participate",href:"/participate/"},
 {label:"About",href:"/about/"}
];
export const SECONDARY_NAV: readonly {label:string; href:string}[]=[
 {label:"Funding & risk",href:"/funding/"},
 {label:"Questions",href:"/questions/"},
 {label:"The draft Act",href:"/legislation/"}
];
export function findPublicPage(slug:string):PublicPage|undefined{return PUBLIC_PAGES.find(p=>p.slug===slug);}
export const PUBLIC_RELEASE_STATUS="unreviewed-design-preview" as const;
export const RESEARCH_AVAILABILITY="authentication_not_provisioned" as const;
