import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"

/**
 * Grounding verification rows — what the API's grounding verifier found when it checked an
 * answer's claims against the case bundle (ilovelawyer-api docs/plans/grounding-verifier.md).
 *
 * Written automatically after a legal chat turn on a case, never generated on demand, so this is
 * read-only from here. Nothing appears until USE_GROUNDING_VERIFIER is enabled on the API — an
 * empty panel means "not switched on or nothing checked yet", not "everything is fine".
 */

/** Verdicts about a claim the answer made that material was unavailable to it. */
export type AbsenceVerdict =
  /** The document was in the case AND its text was sent to the model — it had it and said it didn't. */
  | "FALSE_ABSENCE"
  /** In the case, but its text never reached the model. Honest about what it saw; the gap is ours. */
  | "NOT_SUPPLIED"
  /** Genuinely not in the case. The answer was right, and something is missing from the bundle. */
  | "CORRECT_ABSENCE"

/** Verdicts about a fact the answer asserted and pinned to a document. */
export type AssertionVerdict = "SUPPORTED" | "UNSUPPORTED" | "CONTRADICTED"

export type GroundingVerdict = AbsenceVerdict | AssertionVerdict | "UNRESOLVED"

/** What the cited passage actually amounts to, as against what the answer treated it as. */
export type EvidenceKind = "ASSERTED_BY_PARTY" | "STATED_BY_WITNESS" | "SHOWN_BY_DOCUMENT" | "ESTABLISHED"

export interface GroundingCheck {
  id: string
  messageId: string
  kind: "ABSENCE_CLAIM" | "ASSERTION"
  /** The sentence from the answer this verdict is about. */
  assertion: string
  /** The bundle reference exactly as the answer wrote it: "D14 Part 2", "D20.1 para. 6". */
  citation: string | null
  documentId: string | null
  verdict: GroundingVerdict
  /** Null when the verdict was reached by lookup rather than by the model. */
  confidence: number | null
  evidenceKind: EvidenceKind | null
  createdAt: string
  message?: { consultationId: string } | null
}

export interface GroundingResponse {
  /** Row counts per verdict, for the panel header. */
  counts: Partial<Record<GroundingVerdict, number>>
  /** Worst-first: contradictions and false absences before anything that checked out. */
  rows: GroundingCheck[]
}

/** Verdicts a lawyer needs to act on, as against those that simply confirm the answer was sound. */
export const PROBLEM_VERDICTS: GroundingVerdict[] = ["CONTRADICTED", "FALSE_ABSENCE", "UNSUPPORTED"]

export function isProblem(verdict: GroundingVerdict) {
  return PROBLEM_VERDICTS.includes(verdict)
}

export const groundingKeys = {
  all: ["grounding"] as const,
  forCase: (caseId: string) => [...groundingKeys.all, "case", caseId] as const,
}

export function useGroundingChecksQuery(caseId: string, enabled = true) {
  return useQuery({
    queryKey: groundingKeys.forCase(caseId),
    queryFn: () => apiFetch<GroundingResponse>(`/api/my-cases/${caseId}/grounding-checks`),
    enabled: !!caseId && enabled,
  })
}
