import type { ClientRequest } from "./types"

// Placeholder data until the client-requests API exists — see queries.ts, the only importer.

const HOUR = 3_600_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

/** How long a claimed request is held for the lawyer before it goes back in the pool. */
export const HOLD_DURATION_MS = 23 * HOUR + 41 * 60_000 + 10_000

export const MOCK_CLIENT_REQUESTS: ClientRequest[] = [
  {
    id: "req-employment-whistleblowing",
    practiceArea: "Employment",
    jurisdiction: "England & Wales",
    urgency: "high",
    urgencyNote: "ET1 deadline in 23 days",
    title: "Dismissed three weeks after raising a whistleblowing complaint about falsified driver hours.",
    summary:
      "Client worked as a transport planner for 4 years. Employer says the role was made redundant, but no consultation took place and a junior colleague was kept on. Client has the written complaint and the dismissal letter.",
    receivedAt: ago(2 * HOUR),
    documentCount: 14,
    helperCount: 2,
    status: "open",
    detail: {
      aiSummary:
        "The client, a transport planner with four years’ service at a logistics company, raised a written complaint that driver hours were being falsified to meet delivery targets. Three weeks later they were placed at risk of redundancy and dismissed without consultation, while a less experienced colleague was retained. The complaint is likely to qualify as a protected disclosure; the main question is whether it was the principal reason for dismissal.",
      keyFacts: [
        "4 years’ continuous service",
        "Written complaint to operations director",
        "No redundancy consultation or selection criteria",
        "Junior colleague kept in the same role",
        "Gross salary approx. £38,000",
      ],
      timeline: [
        { date: "21 Jul 2026", label: "Whistleblowing complaint sent" },
        { date: "04 Aug 2026", label: "Placed at risk of redundancy" },
        { date: "14 Aug 2026", label: "Dismissed with notice pay" },
        { date: "12 Nov 2026", label: "ET1 deadline (after ACAS)", isDeadline: true },
      ],
      clientName: "Daniel Okafor",
      opponentName: "Brightline Logistics Ltd",
    },
  },
  {
    id: "req-tenancy-deposit",
    practiceArea: "Landlord & Tenant",
    jurisdiction: "England & Wales",
    urgency: "medium",
    title: "Deposit was never protected and the landlord is withholding £1,850 after the tenancy ended.",
    summary:
      "Assured shorthold tenancy ended six weeks ago. No prescribed information was served. Client wants the deposit back and asks about a penalty.",
    receivedAt: ago(5 * HOUR),
    documentCount: 6,
    helperCount: 0,
    status: "open",
    detail: {
      aiSummary:
        "The client’s assured shorthold tenancy ended six weeks ago and the landlord is withholding a £1,850 deposit that was never protected in an authorised scheme. No prescribed information was served. The client wants the deposit returned and is asking whether a penalty award is available.",
      keyFacts: [
        "Assured shorthold tenancy, now ended",
        "Deposit of £1,850 withheld",
        "Deposit never protected; no prescribed information served",
      ],
      timeline: [
        { date: "Sep 2025", label: "Tenancy began, deposit paid" },
        { date: "Aug 2026", label: "Tenancy ended" },
      ],
      clientName: "Meera Patel",
      opponentName: "Harlow Property Holdings Ltd",
    },
  },
  {
    id: "req-consumer-gearbox",
    practiceArea: "Consumer",
    jurisdiction: "England & Wales",
    urgency: "low",
    title: "Used car developed a gearbox fault within a month and the dealer refuses a £7,400 refund.",
    summary:
      "Bought from an independent dealer in July. An independent inspection found the fault was present at sale. Dealer offers repair only.",
    receivedAt: ago(26 * HOUR),
    documentCount: 9,
    helperCount: 1,
    status: "open",
    detail: {
      aiSummary:
        "The client bought a used car from an independent dealer in July for £7,400. A gearbox fault appeared within a month and an independent inspection found it was present at the point of sale. The dealer will only offer a repair; the client wants a refund.",
      keyFacts: [
        "Purchased from an independent dealer in July",
        "Independent inspection: fault present at sale",
        "Dealer offers repair only",
      ],
      timeline: [
        { date: "Jul 2026", label: "Car purchased" },
        { date: "Aug 2026", label: "Gearbox fault appears" },
      ],
      clientName: "Tom Hughes",
      opponentName: "Eastway Motors Ltd",
    },
  },
  {
    id: "req-employment-maternity",
    practiceArea: "Employment",
    jurisdiction: "England & Wales",
    urgency: "medium",
    title: "Redundancy selection appears to target staff on maternity leave.",
    summary: "",
    receivedAt: ago(30 * HOUR),
    documentCount: 4,
    helperCount: 0,
    status: "taken",
    detail: { aiSummary: "", keyFacts: [], timeline: [], clientName: "", opponentName: "" },
  },
]
