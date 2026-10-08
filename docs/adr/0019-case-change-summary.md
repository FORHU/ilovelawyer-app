# 0019: Show what each case analysis changed

## Status

Accepted and built. Builds on [0014](0014-legal-terminal-auto-refresh.md) and [0017](0017-auto-regenerate-red-team-theories-reconstruction.md).

## Context

The case analysis (`caseRefresh`, run after a document change or from "Refresh analysis") already rewrites every AI pane when new evidence lands. Nothing told the lawyer what that run changed: each pane just swapped its content. A lawyer had to remember what Red Team or the outlook said before and compare it by eye.

## Decision

The refresh records, for every pane it rewrites, what it said before its step and after it, and saves the difference as one `CaseChangeSummary` row per run (API `CaseChangeRun`, `utils/case-change-delta.ts`). The Terminal shows the latest one in a "What changed" modal (`components/terminal/change-summary-modal.tsx`): "Based on 2 new documents, 7 things changed", one line per pane, each with an Open link that closes the modal and brings that pane into view. The modal opens by itself for a summary this viewer hasn't seen, once the run that wrote it has finished; the case row's **What changed** button (with a dot while one is unseen) opens it again at any time.

| Pane | What counts as a change |
|---|---|
| Case Summary (outlook) | The band moving; a factor added or dropped. A confidence change is shown, not counted. |
| Evidence & Timeline (contradictions) | A contradiction found that wasn't before, or one no longer found (`contradictionKey`). The scan returns this itself. |
| Legal Issues, Strengths, Weaknesses, Attack, Defense | A finding added, removed or re-rated (tag or impact), matched by category and label. |
| Red Team | An argument added, dropped or re-strengthened; risk of loss moving 5 points or more. |
| Case Reconstruction | A gap opened or closed. Rewriting the narrative alone doesn't count, or no run could ever change nothing. |
| Case Strategy (and the timeline's key dates) | A plan step, to-do or key date added or removed. Key dates show under Evidence & Timeline. |
| Witnesses | A witness found or removed; a shown credibility score moving 10 points or more. Compared from before the reading step (wave 1) to after scoring (wave 2). |
| Damages & Remedies | An entry added or removed; an amount changed. AI entries are proposals, so the claimed total only moves when a lawyer accepts one. |
| Theories (the AI draft) | Its title changing; a claim added or dropped. Assumptions and open questions are shown, not counted. A first draft counts nothing. |
| Visual Strategy Map | A branch added or removed. Points below the branches are shown, not counted: a rebuild rewords many. A map kept because someone expanded it says so. |
| Audio Overview | A new overview, shown as "New overview in History" and never counted: one is written every run. |

Rules:

- The comparison is a read of the pane before its step and after it, inside the refresh. The writers' own return values are unchanged, except the contradictions scan, which returns `{ rows, delta }`. A failed read or comparison loses that pane's entry; it never changes how the step runs or fails, and a summary that can't be saved never fails the refresh.
- A tracked pane's own Regenerate ([0018](0018-per-pane-regenerate.md)) also saves a summary, of that pane alone (`reason: "regenerate"`, no documents): "Red Team regenerated: 2 things changed". Otherwise the modal would keep describing what the last refresh said about a pane the lawyer has since rewritten. It is saved inside the job's `finishWith`, so it exists before the job reads as done and the snapshot refetches. A Regenerate that fails saves nothing. "New documents" for the next refresh are counted from the last refresh's summary, never a Regenerate's.
- A step that throws records the pane as failed ("Not updated this time"); a 409 or nothing to work from records it as skipped and the modal says nothing about it. A narrative left alone because a lawyer edited it says so.
- "Based on N new documents" compares the run's READY, unarchived documents with the previous summary's. A manual run with no document change says "This refresh: …", never "new evidence".
- A case's first analysis (no earlier summary, never refreshed) is flagged `firstAnalysis`; the modal doesn't open and the What changed button isn't shown: every pane's first content would read as a change.
- The summary rides on the snapshot (`latestChangeSummary`), which every viewer already refetches when the `caseRefresh` job finishes. `GET /:caseId/change-summaries` lists past runs for a later history view.
- The modal's header has a date picker (‹ / › and a list of the days with runs: "Today · 4 runs", "Yesterday · 7 runs", "Oct 6, 2026 · 2 runs"). Days are the viewer's own calendar days: the API groups them in the browser's time zone (`GET /:caseId/change-summaries/days?tz=`, up to 366 days) and lists one day's runs with `GET /:caseId/change-summaries?day=YYYY-MM-DD&tz=` (up to 50). The History list beside the selected run shows that day's runs, newest first, each named by what ran ("After 2 new documents", "Red Team regenerated", "Refresh analysis") with its time and change count. The modal opens on the latest run's day; picking a day selects its newest run. Runs are never merged into a per-day total: Regenerates keep rewriting the same panes, so a day's net change isn't meaningful. An earlier run notes that Open shows each pane as it is now, not as it was then. Rows are kept for the life of the case.
- Closing the modal marks that summary seen for that viewer in that browser (`change-summary-dismissal.ts`), not for the team; it won't open by itself again until a newer one arrives.
- The summary is its own table rather than the `case.refresh` audit row's payload: audit rows outlive a deleted case, and these hold case content. The audit row carries `changeSummaryId` and `totalChanges`.

## Consequences

- Wording drift between runs reads as change: a finding or contradiction value the model phrases differently shows as one removed and one added. Watch real summaries before trusting the count.
- A pane written by two steps (Witnesses, Damages) is compared from before the first to after the last. If one step failed but the pane still changed, what changed is shown; otherwise it says it wasn't updated.
- Per-row "New" markers inside each pane are not built.
