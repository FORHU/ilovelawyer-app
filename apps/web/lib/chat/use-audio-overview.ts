import { useLatestAudioOverviewQuery } from "@/lib/terminal/mutations";

/** Whether this case's Audio Overview pane has anything to show — the same lookup AudioOverviewPanel
 * does (the case's newest overview, whether the case analysis or a chat/Studio request wrote it),
 * over the same cached query, so the Terminal's pane-library badge agrees with the pane. It used to
 * read only the newest consultation's messages, which never sees an overview the analysis wrote
 * (those belong to the case, with no chat message) and reported Empty beside a full pane. */
export function useHasAudioOverview(caseId: string | null) {
  const latest = useLatestAudioOverviewQuery(caseId ?? "");
  return !!latest.data;
}
