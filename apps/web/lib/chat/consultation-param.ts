/** `?c=new` — a Case's draft Consultation: opened by "New consultation", saved nowhere but this
 * browser (see lib/store/consultation-drafts.store.ts) until its first message creates the real
 * row. Never a real id, so every reader of `?c=` goes through consultationIdFromParam. */
export const DRAFT_CONSULTATION_PARAM = "new";

/** The real consultation id a `?c=` value names — null for none and for the draft. */
export function consultationIdFromParam(param: string | null | undefined): string | null {
  if (!param || param === DRAFT_CONSULTATION_PARAM) return null;
  return param;
}

export function isDraftConsultationParam(param: string | null | undefined): boolean {
  return param === DRAFT_CONSULTATION_PARAM;
}

/** Whether `?c=` names a consultation this Case's list doesn't contain — another Case's (a pasted
 * or stale link), or one deleted since. Only answered once the list is loaded and settled: a
 * consultation created a moment ago (first message, a Studio tile) is seeded into the list by
 * useCreateConsultationMutation, and `recentlyCreatedIds` covers the gap before that lands. */
export function isForeignConsultation(
  consultationId: string | null,
  caseConsultations: ReadonlyArray<{ id: string }> | undefined,
  recentlyCreatedIds: ReadonlyArray<string | null | undefined> = [],
): boolean {
  if (!consultationId || !caseConsultations) return false;
  if (recentlyCreatedIds.includes(consultationId)) return false;
  return !caseConsultations.some((c) => c.id === consultationId);
}
