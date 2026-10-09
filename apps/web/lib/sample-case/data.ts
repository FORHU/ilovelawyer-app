// The built-in sample case that every user can open read-only to see the Workspace and Legal
// Terminal filled in (/homepage/sample-case). One per tenant, so a user only ever sees their own
// jurisdiction's law, courts, procedure and currency:
//
// - PH: People v. Dela Cruz — estafa under the Revised Penal Code, RTC Quezon City.
// - UK: Whitfield v Harding Developments Ltd — a misrepresentation claim, County Court at Central
//   London, run under the CPR.
//
// Both are fictional: the parties, numbers and documents are invented, and an authority marked
// "(sample)" is too. The content is fixed and in English — it's a sample document set, not
// interface copy, so it lives here rather than in locales/.

import type { TenantCode } from "@/lib/tenant-code/resolve-host"
import type { PanelId } from "@/lib/terminal/types"
import type { PaneCategory } from "@/components/terminal/terminal-pane-categories"

export type RagStatus = "indexed" | "indexing" | "failed"
export type Severity = "high" | "med" | "low" | "neutral"

/** One line in a sample pane: a severity chip, a heading and an optional detail line. */
export interface SampleRow {
  tag?: { label: string; sev: Severity }
  title: string
  detail?: string
  /** Right-aligned figure (a score, an amount, a date). */
  value?: string
  /** 0–100, drawn as a bar under the row. */
  meter?: number
}

export interface SampleCase {
  title: string
  number: string
  court: string
  type: string
  nextDate: string
  nextDateLabel: string
  risk: { label: string; sev: Severity }
  documents: { folder: string; files: { name: string; status: RagStatus }[] }[]
  chat: { question: string; answer: ({ text: string } | { cite: string })[] }
  audioScript: ["A" | "B", string][]
  mindMap: { branch: string; nodes: string[] }[]
  timeline: { date: string; event: string; source: string }[]
  dataTable: { type: "Witness" | "Damage" | "Deadline" | "Finding"; label: string; detail: string }[]
  decisions: { claim: string; why: string; status: "Active" | "Disputed" }[]
  brief: { facts: string; issues: string[]; arguments: string[]; relief: string }
  /** What the panes on the sample grid show. */
  panes: Partial<Record<PanelId, SampleRow[]>>
}

// ── PH: People v. Dela Cruz ─────────────────────────────────────────────────

const PH_CASE: SampleCase = {
  title: "People v. Dela Cruz",
  number: "Crim. Case No. R-QZN-26-01452",
  court: "RTC Quezon City, Branch 88",
  type: "Criminal · Estafa",
  nextDate: "14 Oct",
  nextDateLabel: "Pre-trial",
  risk: { label: "High", sev: "high" },
  documents: [
    {
      folder: "Pleadings",
      files: [
        { name: "Information.pdf", status: "indexed" },
        { name: "Complaint-Affidavit-Ong.pdf", status: "indexed" },
        { name: "Counter-Affidavit-DelaCruz.pdf", status: "indexed" },
        { name: "Pre-trial-brief-draft.txt", status: "indexed" },
      ],
    },
    {
      folder: "Evidence",
      files: [
        { name: "Bank-transfer-records.xlsx", status: "indexed" },
        { name: "Viber-screenshots.png", status: "indexing" },
        { name: "Registry-return-card.jpg", status: "failed" },
      ],
    },
    { folder: "Correspondence", files: [{ name: "Demand-letter-03Mar.pdf", status: "indexed" }] },
    { folder: "Court Orders", files: [{ name: "Order-arraignment.pdf", status: "indexed" }] },
  ],
  chat: {
    question: "Was the false pretense made before Ms. Ong released the money?",
    answer: [
      { text: "The record points to yes. On 2 November 2025, two days before the transfer, Dela Cruz told Ms. Ong over Viber that the building permit was “already approved”" },
      { cite: "Viber-screenshots.png · p.3" },
      { text: ". The bank records show the ₱2,400,000 left her account on 4 November" },
      { cite: "Bank-transfer-records.xlsx · row 14" },
      { text: ". No permit application was ever filed" },
      { cite: "Complaint-Affidavit-Ong.pdf · p.6" },
      { text: ", which supports deceit that came before the delivery of funds, as Art. 315(2)(a) requires." },
    ],
  },
  audioScript: [
    ["A", "Today: People versus Dela Cruz, an estafa case out of Quezon City. Two point four million pesos, and a warehouse that was never built."],
    ["B", "The whole case turns on timing. Estafa under Article 315(2)(a) needs the lie to come before the money moves."],
    ["A", "And here the Viber messages matter. On 2 November, Dela Cruz says the permit is already approved. The transfer is 4 November."],
    ["B", "The defense says it was a joint venture that failed, which would make it a civil debt, not a crime."],
    ["A", "Which is why the permit records are so important. No application was ever filed. That's hard to square with a good-faith venture."],
    ["B", "One soft spot: the registry return card for the demand letter has an unclear signature. Expect a fight over receipt."],
  ],
  mindMap: [
    { branch: "Facts", nodes: ["Transfer on 4 Nov 2025", "Viber representations", "Demand on 3 Mar"] },
    { branch: "Law", nodes: ["RPC Art. 315(2)(a)", "RA 10951 penalty brackets"] },
    { branch: "Defense theory", nodes: ["Failed joint venture", "No prior deceit"] },
    { branch: "Evidence gaps", nodes: ["Registry card signature", "Bank officer as witness"] },
    { branch: "Next steps", nodes: ["Subpoena bank records", "Pre-trial brief"] },
  ],
  timeline: [
    { date: "28 Oct 2025", event: "First meeting between Ong and Dela Cruz", source: "Complaint-Affidavit-Ong.pdf" },
    { date: "2 Nov 2025", event: "“Permit already approved” sent over Viber", source: "Viber-screenshots.png" },
    { date: "4 Nov 2025", event: "₱2,400,000 transferred to Dela Cruz", source: "Bank-transfer-records.xlsx" },
    { date: "20 Jan 2026", event: "Project fails to start", source: "Complaint-Affidavit-Ong.pdf" },
    { date: "14 Feb 2026", event: "Information filed", source: "Information.pdf" },
    { date: "3 Mar 2026", event: "Demand letter sent", source: "Demand-letter-03Mar.pdf" },
    { date: "2 Jun 2026", event: "Arraignment; plea of not guilty", source: "Order-arraignment.pdf" },
    { date: "14 Oct 2026", event: "Pre-trial conference", source: "Calendar" },
  ],
  dataTable: [
    { type: "Witness", label: "Celia Ong", detail: "Private complainant; testifies to the Viber messages and the transfer" },
    { type: "Witness", label: "Bank officer (to be subpoenaed)", detail: "Authenticates the 4 Nov transfer records" },
    { type: "Damage", label: "Principal", detail: "₱2,400,000" },
    { type: "Damage", label: "Legal interest", detail: "6% a year from the 3 Mar 2026 demand" },
    { type: "Deadline", label: "Pre-trial brief", detail: "Due 7 Oct 2026" },
    { type: "Finding", label: "No permit application", detail: "No record with the city building office" },
  ],
  decisions: [
    { claim: "Deceit came before the transfer", why: "The Viber message of 2 Nov is two days before the 4 Nov transfer.", status: "Active" },
    { claim: "Demand was received", why: "Relies on the registry return card. Disputed: the signature is unclear.", status: "Disputed" },
    { claim: "Penalty bracket follows RA 10951", why: "An amount over ₱2.4M falls in the bracket under Sec. 85.", status: "Active" },
  ],
  brief: {
    facts:
      "Celia Ong released ₱2,400,000 to Ramon Dela Cruz on 4 November 2025 for a warehouse project that never began. Dela Cruz had said the permits were secured. Nothing was returned after a written demand on 3 March 2026.",
    issues: ["Whether deceit preceded the delivery of funds", "Whether the transaction is a civil joint venture", "The amount defrauded, for the penalty"],
    arguments: [
      "The 2 November Viber messages show the false pretense before the transfer",
      "No permit was ever applied for, which shows the statement was false",
      "Not returning the money after demand shows intent",
    ],
    relief: "Conviction for estafa under Art. 315(2)(a), and civil indemnity of ₱2,400,000 with legal interest.",
  },
  panes: {
    command: [
      { tag: { label: "High", sev: "high" }, title: "Overall risk", detail: "Deceit timing and the civil-debt defense both rated high" },
      { tag: { label: "Next", sev: "high" }, title: "File the pre-trial brief by 7 Oct", detail: "From Case Strategy · at least 3 days before pre-trial" },
      { tag: { label: "Next", sev: "med" }, title: "Re-upload the registry return card", detail: "The scan failed to index" },
    ],
    evidence: [
      { tag: { label: "Verified", sev: "low" }, title: "Bank transfer records", detail: "4 Nov 2025 · ₱2.4M" },
      { tag: { label: "Authenticate", sev: "med" }, title: "Viber screenshots", detail: "2 Nov 2025" },
      { tag: { label: "Verified", sev: "low" }, title: "Demand letter", detail: "3 Mar 2026" },
      { tag: { label: "Disputed", sev: "high" }, title: "Registry return card", detail: "Signature unclear" },
    ],
    witnesses: [
      { title: "Celia Ong", detail: "Private complainant", value: "78", meter: 78 },
      { title: "Bank officer", detail: "To be subpoenaed", value: "85", meter: 85 },
      { title: "Process server", detail: "Served the demand letter", value: "62", meter: 62 },
    ],
    law: [
      { tag: { label: "Statute", sev: "neutral" }, title: "RPC Art. 315(2)(a)", detail: "Estafa by false pretenses made before or at the time of the fraud" },
      { tag: { label: "Statute", sev: "neutral" }, title: "RA 10951, Sec. 85", detail: "Penalty brackets by amount defrauded" },
      { tag: { label: "For", sev: "low" }, title: "People v. Santos (sample)", detail: "Prior deceit inferred from representations made before payment" },
    ],
    legalIssues: [
      { tag: { label: "High", sev: "high" }, title: "Deceit preceded the delivery of funds", detail: "Burden: Prosecution" },
      { tag: { label: "High", sev: "high" }, title: "Civil vs. criminal character", detail: "Burden: Defense" },
      { tag: { label: "Med", sev: "med" }, title: "Demand letter receipt", detail: "Burden: Prosecution" },
      { tag: { label: "Low", sev: "low" }, title: "Amount and penalty bracket", detail: "Burden: Prosecution" },
    ],
    procedure: [
      { tag: { label: "Soon", sev: "high" }, title: "Pre-trial brief due", value: "7 Oct" },
      { tag: { label: "Upcoming", sev: "med" }, title: "Pre-trial conference", value: "14 Oct" },
      { tag: { label: "Upcoming", sev: "med" }, title: "Subpoena the bank officer", value: "21 Oct" },
      { tag: { label: "Later", sev: "low" }, title: "Initial trial hearing", value: "14 Nov" },
    ],
    redTeam: [
      {
        tag: { label: "High", sev: "high" },
        title: "The joint-venture framing is plausible",
        detail: "Ong signed a one-page “partnership” note on 30 Oct. Expect the defense to lead with it.",
      },
      {
        tag: { label: "Med", sev: "med" },
        title: "The Viber screenshots need authenticating",
        detail: "Without the phone or a forensic copy, admissibility can be challenged.",
      },
    ],
    damages: [
      { title: "Principal", value: "₱2,400,000.00" },
      { title: "Legal interest, 6% a year, 3 Mar to 2 Oct 2026", value: "₱84,032.88" },
      { title: "Total to date", value: "₱2,484,032.88" },
    ],
  },
}

// ── UK: Whitfield v Harding Developments Ltd ────────────────────────────────

const UK_CASE: SampleCase = {
  title: "Whitfield v Harding Developments Ltd",
  number: "Claim No. K40CL214",
  court: "County Court at Central London",
  type: "Civil · Misrepresentation",
  nextDate: "28 Oct",
  nextDateLabel: "CCMC",
  risk: { label: "Medium", sev: "med" },
  documents: [
    {
      folder: "Pleadings",
      files: [
        { name: "Particulars-of-Claim.pdf", status: "indexed" },
        { name: "Witness-Statement-Whitfield.pdf", status: "indexed" },
        { name: "Defence-Harding.pdf", status: "indexed" },
        { name: "Draft-directions.txt", status: "indexed" },
      ],
    },
    {
      folder: "Evidence",
      files: [
        { name: "Bank-statements.xlsx", status: "indexed" },
        { name: "WhatsApp-screenshots.png", status: "indexing" },
        { name: "Planning-portal-search.jpg", status: "failed" },
      ],
    },
    { folder: "Correspondence", files: [{ name: "Letter-before-claim-03Feb.pdf", status: "indexed" }] },
    { folder: "Court Orders", files: [{ name: "Notice-of-CCMC.pdf", status: "indexed" }] },
  ],
  chat: {
    question: "Was the planning statement made before Ms Whitfield paid?",
    answer: [
      { text: "Yes, on the documents. On 2 November 2025, two days before the payment, Mr Harding told Ms Whitfield on WhatsApp that planning permission had “already been granted”" },
      { cite: "WhatsApp-screenshots.png · p.3" },
      { text: ". Her bank statement shows the £240,000 left her account on 4 November" },
      { cite: "Bank-statements.xlsx · row 14" },
      { text: ". The council's planning portal shows no application for the site" },
      { cite: "Witness-Statement-Whitfield.pdf · para 18" },
      { text: ". That supports a false statement of fact made before payment, which is the basis of the claim under s.2(1) of the Misrepresentation Act 1967." },
    ],
  },
  audioScript: [
    ["A", "Today: Whitfield versus Harding Developments, a misrepresentation claim in the County Court at Central London. Two hundred and forty thousand pounds, and a warehouse fit-out that never started."],
    ["B", "It turns on one WhatsApp message. On 2 November, Harding says planning permission has already been granted. The money moves on 4 November."],
    ["A", "And the planning portal shows no application at all. That makes it look like a false statement of fact, not just a broken promise."],
    ["B", "The defence says this was a joint venture that went wrong, so the claim is really about a failed contract."],
    ["A", "Under section 2(1) of the 1967 Act, the burden shifts to Harding to prove he had reasonable grounds to believe what he said. That's a hard burden here."],
    ["B", "One soft spot: the portal search was a screenshot. Expect them to ask for a certified search from the council."],
  ],
  mindMap: [
    { branch: "Facts", nodes: ["Payment on 4 Nov 2025", "WhatsApp statements", "Letter before claim, 3 Feb"] },
    { branch: "Law", nodes: ["Misrepresentation Act 1967, s.2(1)", "Deceit: Derry v Peek"] },
    { branch: "Defence theory", nodes: ["Failed joint venture", "Statement of intention, not fact"] },
    { branch: "Evidence gaps", nodes: ["Certified planning search", "Planning officer as witness"] },
    { branch: "Next steps", nodes: ["Costs budget (Precedent H)", "Disclosure list"] },
  ],
  timeline: [
    { date: "28 Oct 2025", event: "First meeting between Whitfield and Harding", source: "Witness-Statement-Whitfield.pdf" },
    { date: "2 Nov 2025", event: "“Planning already granted” sent on WhatsApp", source: "WhatsApp-screenshots.png" },
    { date: "4 Nov 2025", event: "£240,000 paid to Harding Developments", source: "Bank-statements.xlsx" },
    { date: "20 Jan 2026", event: "Fit-out fails to start", source: "Witness-Statement-Whitfield.pdf" },
    { date: "3 Feb 2026", event: "Letter before claim sent", source: "Letter-before-claim-03Feb.pdf" },
    { date: "14 Mar 2026", event: "Claim issued", source: "Particulars-of-Claim.pdf" },
    { date: "28 Apr 2026", event: "Defence filed", source: "Defence-Harding.pdf" },
    { date: "28 Oct 2026", event: "Costs and case management conference", source: "Calendar" },
  ],
  dataTable: [
    { type: "Witness", label: "Claire Whitfield", detail: "Claimant; gives evidence of the WhatsApp messages and the payment" },
    { type: "Witness", label: "Council planning officer", detail: "Confirms no planning application was made for the site" },
    { type: "Damage", label: "Sum paid", detail: "£240,000" },
    { type: "Damage", label: "Interest", detail: "8% a year under s.69 County Courts Act 1984" },
    { type: "Deadline", label: "Costs budget (Precedent H)", detail: "Due 7 Oct 2026, 21 days before the CCMC" },
    { type: "Finding", label: "No planning application", detail: "Nothing on the council's planning portal for the site" },
  ],
  decisions: [
    { claim: "The statement was made before payment", why: "The WhatsApp message of 2 Nov is two days before the 4 Nov payment.", status: "Active" },
    { claim: "No planning application was ever made", why: "Relies on a portal screenshot. Disputed: the defence wants a certified search.", status: "Disputed" },
    { claim: "Interest runs from the date of payment", why: "Claimed under s.69 County Courts Act 1984 from 4 Nov 2025.", status: "Active" },
  ],
  brief: {
    facts:
      "Claire Whitfield paid £240,000 to Harding Developments Ltd on 4 November 2025 for a warehouse fit-out that never began. Daniel Harding had told her that planning permission was already granted. No application was ever made, and nothing was repaid after a letter before claim on 3 February 2026.",
    issues: [
      "Whether the planning statement was a false statement of fact",
      "Whether Harding had reasonable grounds to believe it (s.2(1) Misrepresentation Act 1967)",
      "Whether the dealings were a joint venture rather than a contract induced by the statement",
    ],
    arguments: [
      "The 2 November WhatsApp messages state, as a fact, that permission had been granted",
      "The planning portal shows no application, so the statement was false when made",
      "Ms Whitfield paid two days later, in reliance on it",
    ],
    relief: "Rescission and repayment of £240,000, or damages under s.2(1) of the Misrepresentation Act 1967, with interest under s.69 County Courts Act 1984 and costs.",
  },
  panes: {
    command: [
      { tag: { label: "Medium", sev: "med" }, title: "Overall risk", detail: "Misrepresentation is strong; proving dishonesty for deceit is harder" },
      { tag: { label: "Next", sev: "high" }, title: "File the costs budget by 7 Oct", detail: "Precedent H · 21 days before the CCMC" },
      { tag: { label: "Next", sev: "med" }, title: "Re-upload the planning portal search", detail: "The scan failed to index" },
    ],
    evidence: [
      { tag: { label: "Verified", sev: "low" }, title: "Bank statements", detail: "4 Nov 2025 · £240,000" },
      { tag: { label: "Authenticate", sev: "med" }, title: "WhatsApp screenshots", detail: "2 Nov 2025" },
      { tag: { label: "Verified", sev: "low" }, title: "Letter before claim", detail: "3 Feb 2026" },
      { tag: { label: "Disputed", sev: "high" }, title: "Planning portal search", detail: "Screenshot only; no certified search" },
    ],
    witnesses: [
      { title: "Claire Whitfield", detail: "Claimant", value: "78", meter: 78 },
      { title: "Council planning officer", detail: "Witness summons to be sought", value: "85", meter: 85 },
      { title: "Site manager", detail: "Visited the site in January", value: "62", meter: 62 },
    ],
    law: [
      { tag: { label: "Statute", sev: "neutral" }, title: "Misrepresentation Act 1967, s.2(1)", detail: "Damages for a false statement unless the maker proves reasonable grounds to believe it" },
      { tag: { label: "For", sev: "low" }, title: "Derry v Peek (1889) 14 App Cas 337", detail: "Deceit: a false statement made knowingly, without belief in its truth, or recklessly" },
      { tag: { label: "Rules", sev: "neutral" }, title: "CPR 3.13", detail: "Costs budgets before the first case management conference" },
    ],
    legalIssues: [
      { tag: { label: "High", sev: "high" }, title: "A false statement of fact, made before payment", detail: "Burden: Claimant" },
      { tag: { label: "High", sev: "high" }, title: "Reasonable grounds to believe the statement", detail: "Burden: Defendant (s.2(1))" },
      { tag: { label: "Med", sev: "med" }, title: "Joint venture or contract", detail: "Burden: Defendant" },
      { tag: { label: "Low", sev: "low" }, title: "Interest and quantum", detail: "Burden: Claimant" },
    ],
    procedure: [
      { tag: { label: "Soon", sev: "high" }, title: "Costs budget (Precedent H) due", value: "7 Oct" },
      { tag: { label: "Upcoming", sev: "med" }, title: "Budget discussion report (Precedent R) due", value: "21 Oct" },
      { tag: { label: "Upcoming", sev: "med" }, title: "Costs and case management conference", value: "28 Oct" },
      { tag: { label: "Later", sev: "low" }, title: "Disclosure, as directed at the CCMC", value: "9 Dec" },
    ],
    redTeam: [
      {
        tag: { label: "High", sev: "high" },
        title: "The joint-venture framing is plausible",
        detail: "Ms Whitfield signed one-page heads of terms on 30 Oct. Expect the defence to lead with it.",
      },
      {
        tag: { label: "Med", sev: "med" },
        title: "The planning evidence is only a screenshot",
        detail: "Get a certified search from the council before the CCMC.",
      },
    ],
    damages: [
      { title: "Sum paid", value: "£240,000.00" },
      { title: "Interest, 8% a year under s.69 CCA 1984, 4 Nov 2025 to 2 Oct 2026", value: "£17,464.11" },
      { title: "Total to date", value: "£257,464.11" },
    ],
  },
}

const SAMPLE_CASES: Record<TenantCode, SampleCase> = { PH: PH_CASE, UK: UK_CASE }

/** The sample case for the user's tenant. PH when it isn't known yet, matching
 * getTenantCodeConfig's display default. */
export function sampleCaseFor(tenantCode: TenantCode | null | undefined): SampleCase {
  return SAMPLE_CASES[tenantCode ?? "PH"]
}

// ── Legal Terminal ──────────────────────────────────────────────────────────

/** What each pane does — the same in every jurisdiction. Shown in Add pane, and on panes that
 * have no sample rows. */
export const PANE_INFO: Partial<Record<PanelId, { category: PaneCategory; description: string }>> = {
  command: { category: "facts", description: "Case health, the next date and your next actions on one card." },
  evidence: { category: "facts", description: "Every document, linked to its source and placed in time." },
  witnesses: { category: "facts", description: "Each witness, their statement and a credibility score." },
  caseReconstruction: { category: "facts", description: "The events retold as scenes, with a read-aloud you can listen to." },
  law: { category: "law", description: "Statutes and decisions for this case. Check a quote or look for adverse rulings." },
  legalIssues: { category: "law", description: "What the court must decide, and who carries the burden." },
  procedure: { category: "strategy", description: "Filing checklist and deadlines that move when key dates move." },
  mindMap: { category: "strategy", description: "The case strategy as a map you can expand node by node." },
  attackStrategy: { category: "strategy", description: "Lines of attack on the other side's case, with the evidence for each." },
  defenseStrategy: { category: "strategy", description: "How the other side is likely to answer, and your reply." },
  audioOverview: { category: "strategy", description: "The two-host audio overview, playable inside the Terminal." },
  theories: { category: "strategy", description: "Compare ways to tell the case and see what evidence would decide." },
  decisions: { category: "strategy", description: "The reasoning behind each legal answer. Dispute it if a fact is wrong." },
  redTeam: { category: "risk", description: "The strongest case against your position, so nothing surprises you." },
  weaknesses: { category: "risk", description: "Gaps in your own case, rated by how much they hurt." },
  strengths: { category: "risk", description: "What your case does well, with the evidence behind it." },
  damages: { category: "risk", description: "Each damages head with its figure, source and total." },
  chat: { category: "team", description: "Chat that already knows this case's documents, parties and issues." },
  trace: { category: "team", description: "How the AI reached each answer, one run at a time." },
}

/** The panes on the sample grid when it opens, in order — the same in every jurisdiction. */
export const SAMPLE_GRID: PanelId[] = ["command", "evidence", "law", "legalIssues", "procedure", "witnesses", "redTeam", "damages"]
