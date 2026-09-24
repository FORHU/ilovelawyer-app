import type {
  CaseOutlook,
  CaseSnapshot,
  ConfidenceLevel,
  OutlookBand,
  SnapshotRisk,
  TrendPoint,
} from "@/lib/terminal/types"

// Preview switch for the Case Summary panel: renders a fully populated fake case so the design
// can be reviewed before the backend ships outlook/trends/descriptors. Build-time env, off by
// default, and the panel shows a "Sample data" badge whenever it is on. Never set it in production.
export const CASE_SUMMARY_SAMPLE = process.env.NEXT_PUBLIC_CASE_SUMMARY_SAMPLE === "true"

const DAY = 86_400_000

export interface Kpi {
  value: number
  /** Change since the previous weekly bucket; null when there is no history to compare. */
  delta: number | null
  trend: number[]
}

export interface SummaryView {
  outlook: CaseOutlook | null
  /** Previous assessments only (current one excluded), newest first. */
  outlookHistory: { band: OutlookBand; confidence: ConfidenceLevel; createdAt: string }[]
  health: Kpi | null
  deadline: { days: number; dueISO: string; confirmed: boolean | null } | null
  openIssues: Kpi
  evidence: Kpi
  parties: { id: string; name: string; designation: string; descriptor?: string | null }[]
  claims: string | null
  posture: string | null
  risks: SnapshotRisk[]
}

function kpi(value: number, points?: TrendPoint[]): Kpi {
  // `total` (the running total as of that week) is what's comparable to `value` (the current
  // count) — `added` is just that week's new items, a different quantity.
  const trend = points?.map((p) => p.total) ?? []
  const delta = trend.length > 1 ? trend[trend.length - 1]! - trend[trend.length - 2]! : null
  return { value, delta, trend }
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

function nextDeadline(snapshot: CaseSnapshot, now: Date): SummaryView["deadline"] {
  const rows = snapshot.procedure.deadlines
    .map((d) => ({ due: new Date(d.computedDueDate), confirmations: d.confirmations }))
    .filter((d) => !Number.isNaN(d.due.getTime()))
    .sort((a, b) => a.due.getTime() - b.due.getTime())
  // Soonest upcoming one; if everything is past, the most recent overdue one.
  const pick = rows.find((d) => startOfDay(d.due) >= startOfDay(now)) ?? rows[rows.length - 1]
  if (pick) {
    return {
      days: Math.round((startOfDay(pick.due) - startOfDay(now)) / DAY),
      dueISO: pick.due.toISOString(),
      confirmed: pick.confirmations ? pick.confirmations.some((c) => c.confirmed) : null,
    }
  }
  const next = snapshot.nextDate
  const raw = next ? ("dateTime" in next ? next.dateTime : next.occurredOn) : null
  const due = raw ? new Date(raw) : null
  if (!due || Number.isNaN(due.getTime())) return null
  return {
    days: Math.round((startOfDay(due) - startOfDay(now)) / DAY),
    dueISO: due.toISOString(),
    confirmed: null,
  }
}

export function buildSummaryView(snapshot: CaseSnapshot, now = new Date()): SummaryView {
  const { trends } = snapshot
  return {
    outlook: snapshot.outlook ?? null,
    outlookHistory: (snapshot.outlookHistory ?? []).slice(1, 5),
    // riskAnalysis.overall.score is a risk score (higher is worse), so health is its complement.
    health: snapshot.riskAnalysis ? kpi(100 - snapshot.riskAnalysis.overall.score, trends?.health) : null,
    deadline: nextDeadline(snapshot, now),
    openIssues: kpi(snapshot.risks.filter((r) => r.status === "OPEN").length, trends?.openIssues),
    evidence: kpi(snapshot.documents.length, trends?.evidence),
    parties: snapshot.case.parties,
    claims: snapshot.case.actionType?.trim() || null,
    posture: snapshot.case.jurisdiction?.trim() || null,
    risks: snapshot.risks,
  }
}

export function sampleSummaryView(now = Date.now()): SummaryView {
  const ago = (days: number) => new Date(now - days * DAY).toISOString()
  const risk = (
    id: string,
    title: string,
    severity: SnapshotRisk["severity"],
    confidence: ConfidenceLevel,
  ): SnapshotRisk => ({ id, title, description: null, severity, status: "OPEN", pageNumber: null, confidence })
  return {
    outlook: {
      band: "LEANS_FAVORABLE",
      confidence: "MEDIUM",
      rationale:
        "The termination letter and payroll records support the illegal dismissal claim. The retaliation theory rests on one uncorroborated sworn statement, and the position paper deadline is not yet confirmed.",
      drivers: [],
      createdAt: ago(0),
    },
    outlookHistory: [
      { band: "LEANS_FAVORABLE", confidence: "MEDIUM", createdAt: ago(3) },
      { band: "UNCERTAIN", confidence: "MEDIUM", createdAt: ago(7) },
      { band: "UNCERTAIN", confidence: "LOW", createdAt: ago(30) },
      { band: "LEANS_UNFAVORABLE", confidence: "LOW", createdAt: ago(74) },
    ],
    health: { value: 72, delta: 4, trend: [61, 63, 62, 66, 68, 72] },
    deadline: { days: 1, dueISO: new Date(now + DAY).toISOString(), confirmed: false },
    openIssues: { value: 4, delta: 1, trend: [2, 2, 3, 3, 3, 4] },
    evidence: { value: 6, delta: 2, trend: [2, 3, 3, 4, 4, 6] },
    parties: [
      { id: "p1", name: "Maria Reyes", designation: "Petitioner / Plaintiff", descriptor: "Warehouse coordinator, 2018-2026" },
      { id: "p2", name: "Northbridge Logistics Corp.", designation: "Respondent / Defendant", descriptor: "Rep. by Hollis & Marr" },
    ],
    claims: "Illegal dismissal · retaliatory termination",
    posture: "NLRC NCR Arbitration Branch · No. 2026-0412",
    risks: [
      risk("r1", "Position paper deadline is computed, not confirmed", "MAJOR", "HIGH"),
      risk("r2", "No written protest from client, 4-11 August", "UNVERIFIED", "MEDIUM"),
      risk("r3", "R. Santos sworn statement outstanding", "MISSING_EVIDENCE", "LOW"),
    ],
  }
}

export function relativeLabel(iso: string, lang: string, now = Date.now()): string {
  const days = Math.max(1, Math.round((now - new Date(iso).getTime()) / DAY))
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" })
  if (days < 14) return rtf.format(-days, "day")
  if (days < 60) return rtf.format(-Math.round(days / 7), "week")
  return rtf.format(-Math.round(days / 30), "month")
}
