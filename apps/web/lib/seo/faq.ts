import type { TenantCode } from "@/lib/tenant-code/resolve-host"

export interface FaqItem {
  question: string
  /** The direct, self-contained answer (1–2 sentences) — shown as the lead line and the part
   * answer engines quote. Always names the product ("ilovelawyer …") so it still makes sense
   * when lifted out of the page. */
  answer: string
  /** Optional supporting detail, shown beneath the lead. */
  detail?: string
}

// Single source of truth for the visible FAQ section AND its FAQPage JSON-LD — Google and
// answer engines expect the markup to match the on-page text, so both are built from this.
// Questions are phrased the way people ask them; answers are answer-first and entity-rich
// (product, jurisdiction, named sources). Only claims the product actually supports (see
// public/llms.txt) — no invented stats, pricing, rankings or ratings.

const SHARED: FaqItem[] = [
  {
    question: "What is ilovelawyer?",
    answer:
      "ilovelawyer (also written “I Love Lawyer”) is an AI legal intelligence platform for lawyers, developed by Forhu AI. It combines case management, an AI assistant that answers with cited case law, a research library and a configurable Legal Terminal in one workspace.",
    detail:
      "It is available as separate jurisdiction-specific sites for the Philippines and the United Kingdom.",
  },
  {
    question: "Is ilovelawyer a law firm, and does it give legal advice?",
    answer:
      "No. ilovelawyer is a software application used by legal professionals — it is not a law firm and does not provide legal advice or legal services to the public.",
    detail: "Its output is a research and drafting aid and should be reviewed by a qualified lawyer before it is relied on.",
  },
  {
    question: "Can AI legal research be trusted? How does ilovelawyer prevent made-up citations?",
    answer:
      "ilovelawyer checks every authority the assistant quotes against a real source document before showing it, which reduces hallucinated citations.",
    detail:
      "Related case law is listed alongside each answer with its title, citation, source link and excerpt, marked as vetted or unvetted. A contradiction scan also flags inconsistencies across a case's documents and testimony.",
  },
  {
    question: "Can I upload my own case documents and ask questions about them?",
    answer:
      "Yes. Attach a document to a consultation and the ilovelawyer assistant searches inside it, and documents added to a case become Sources the case's chat and Studio can draw on.",
    detail: "Case files, transcription and deadline tracking are managed per case in the same workspace.",
  },
  {
    question: "What is the ilovelawyer Legal Terminal?",
    answer:
      "The Legal Terminal is a configurable litigation cockpit where you arrange up to nineteen panes of case intelligence, save the layout and reload it on any machine.",
    detail:
      "Panes include Red Team (the argument the opposing side will likely make), Case Reconstruction (client, court and opposing narratives of the same case), Decisions (the conclusions the AI reached, the rule applied and the evidence for and against), Visual Strategy Map, Mind Map and Timeline.",
  },
  {
    question: "What can the ilovelawyer Case Workspace generate?",
    answer:
      "The Case Workspace combines Sources, Chat and Studio in one view, and Studio generates a Mind Map, Timeline, Data Table, Audio Overview and a downloadable Word or PDF Case Brief.",
    detail: "Each artifact is built on demand from that case's own chat and documents.",
  },
  {
    question: "Can a whole law firm or team use ilovelawyer?",
    answer:
      "Yes. ilovelawyer offers multi-user firm accounts on Solo, Professional and Enterprise plans, with role-based invites for Owners, Admins and Members.",
  },
  {
    question: "Is ilovelawyer the same as “I Love Lawyers” merchandise or a lawyer community?",
    answer:
      "No. ilovelawyer is legal software for case management, cited AI research and litigation analysis — it is not an apparel brand, social account or networking group.",
  },
]

const BY_TENANT: Record<TenantCode, FaqItem[]> = {
  PH: [
    {
      question: "Is there AI legal research software built for Philippine lawyers?",
      answer:
        "Yes. ilovelawyer Philippines answers legal questions with cited Philippine jurisprudence and includes a Philippine statutory code library, so research stays grounded in Philippine sources.",
      detail: "It also tracks case deadlines and calendars, and every quoted authority is checked against a real source document.",
    },
    ...SHARED,
  ],
  UK: [
    {
      question: "Is there AI legal research software for UK solicitors and barristers?",
      answer:
        "Yes. ilovelawyer UK answers with cited UK precedent across England and Wales, Scotland and Northern Ireland, and searches live case law and legislation from TNA Find Case Law and legislation.gov.uk.",
    },
    {
      question: "How does ilovelawyer handle Civil Procedure Rules (CPR) deadlines?",
      answer:
        "ilovelawyer UK provides provisional CPR deadline tracking, and a deadline is not treated as final until two attorneys have confirmed it.",
      detail: "This dual-attorney confirmation gate exists so that a calculated date is checked by people before anyone relies on it.",
    },
    ...SHARED,
  ],
}

export function getFaqItems(tenantCode: TenantCode): FaqItem[] {
  return BY_TENANT[tenantCode]
}

const LEDE: Record<TenantCode, string> = {
  PH: "Short, direct answers about ilovelawyer Philippines: cited Philippine jurisprudence, the statutory code library, and how citations are checked.",
  UK: "Short, direct answers about ilovelawyer UK: cited UK precedent, live TNA and legislation.gov.uk search, and how deadlines are confirmed.",
}

export function getFaqLede(tenantCode: TenantCode): string {
  return LEDE[tenantCode]
}

export function buildFaqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      // Same text as the visible lead + detail, so markup and page never disagree.
      acceptedAnswer: { "@type": "Answer", text: item.detail ? `${item.answer} ${item.detail}` : item.answer },
    })),
  }
}
