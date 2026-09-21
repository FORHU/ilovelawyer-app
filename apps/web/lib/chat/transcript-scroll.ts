/** Whether the chat transcript should jump to its bottom after `messages` changed.
 *
 * It follows the bottom for things the user needs to see at the bottom: their own new prompt (and
 * the thinking indicator / research steps under it), and a consultation being opened. It does NOT
 * follow a reply that has arrived: the whole answer (with its confidence and explanation) shows at
 * once, and jumping to its end would scroll past the start of what the user is about to read. The
 * screen stays where it is and the user scrolls down themselves.
 *
 * `follow` is the transcript's own "the user is at the bottom, not scrolled up reading" flag. */
export function shouldScrollTranscriptToBottom({
  follow,
  contextChanged,
  lastIsReply,
}: {
  follow: boolean
  /** A new user prompt was added, or a different consultation is on screen. */
  contextChanged: boolean
  /** The last message is an assistant message that already has text. */
  lastIsReply: boolean
}): boolean {
  if (!follow) return false
  return contextChanged || !lastIsReply
}
