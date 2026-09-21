/** What the composer's action button should be. "stop" only while the AI is still WRITING the
 * answer. Once the answer text has fully streamed but the turn is still finishing its extras
 * (timeline, mind map, reasoning, decisions - see ilovelawyer-api's chat:answer-complete), there
 * is nothing left to stop that the user can see, so it shows the (still disabled) Send button
 * instead of a Stop that looks like the answer is still generating. Send stays disabled until the
 * turn is fully saved: a new prompt sent earlier could land before the unfinished reply. */
export function composerAction({ isBusy, isFinalizing }: { isBusy: boolean; isFinalizing: boolean }): "send" | "stop" {
  return isBusy && !isFinalizing ? "stop" : "send"
}

/** How long a finished answer is held back while the rest of its turn (confidence, "why this
 * answer", timeline, mind map) is still being produced. The answer, its confidence and its
 * explanation then appear together instead of the answer showing first and the rest popping in
 * seconds later. It is a cap, not a wait-for-sure: past it the answer is shown anyway and the
 * extras follow, so one slow or stuck extra can never hide a finished answer. */
export const ANSWER_HOLD_CAP_MS = 20_000

/** Whether the in-flight assistant reply should be masked by the "thinking" placeholder instead
 * of showing its text yet. Never after a Stop - the user asked to see what had streamed. */
export function shouldHoldAnswer({
  isStreaming,
  stopped,
  revealed,
}: {
  isStreaming: boolean
  stopped: boolean
  revealed: boolean
}): boolean {
  return isStreaming && !stopped && !revealed
}
