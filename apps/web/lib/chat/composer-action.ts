/** How long a finished answer is held back while the rest of its turn (confidence, "why this
 * answer", timeline, mind map) is still being produced. The answer, its confidence and its
 * explanation then appear together instead of the answer showing first and the rest popping in
 * seconds later. It is a cap, not a wait-for-sure: past it the answer is shown anyway and the
 * extras follow, so one slow or stuck extra can never hide a finished answer.
 *
 * Must stay >= ilovelawyer-api's STRUCTURED_DATA_WAIT_MS (src/constants/chatWonder.constants.ts;
 * currently 60_000) plus headroom for socket/round-trip time. That's how long the API itself
 * waits for Chat Wonder to deliver reasoning/decisions after the answer text ends - a shorter
 * cap here fires before the API could ever have finished, guaranteeing the exact split reveal
 * this hold exists to prevent (answer shown alone, reasoning/confidence popping in later once
 * the turn finally finishes saving). If that API constant changes, revisit this one too. */
export const ANSWER_HOLD_CAP_MS = 65_000

/** Whether the in-flight assistant reply should be masked by the "thinking" placeholder instead
 * of showing its text yet, so the answer, its confidence badge and its "why this answer"
 * explanation all render together in one pass instead of the answer appearing first and the
 * rest popping in once they finish generating/saving. See ANSWER_HOLD_CAP_MS for the safety
 * cap that still reveals `revealed` after a bounded wait. */
export function shouldHoldAnswer({
  isStreaming,
  revealed,
}: {
  isStreaming: boolean
  revealed: boolean
}): boolean {
  return isStreaming && !revealed
}
