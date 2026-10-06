# 0017: The analysis refresh also regenerates witnesses, Red Team, the AI draft theory and Case Reconstruction

## Status

Accepted. Changes part of [0014](0014-legal-terminal-auto-refresh.md), which kept these panes lawyer-triggered.

## Context

After an upload, "Updating analysis…" rewrote findings, strategy, the timeline, the outlook, the mind map and damages, but Red Team, Theories and Case Reconstruction stayed as they were. A lawyer saw fresh Strengths and Weaknesses next to a Red Team assessment and a theory built from the old findings, and had to remember to regenerate each one.

## Decision

The refresh (`CaseRefreshSvc`) runs every case-level AI step in three waves. Within a wave the steps run side by side; a wave starts when every step of the one before it has finished, because it reads what that wave wrote:

1. What reads only the documents: contradictions, case strategy (with the timeline's dates), findings, reading new documents for witnesses, reading new documents for damages, Case Reconstruction.
2. What reads wave 1: the outlook, damages re-rating, witness scoring, the AI draft theory, the mind map.
3. Red Team, which attacks all of the above.

Chat Wonder takes several calls for one case at once, so a run lasts about as long as the slowest step of each wave rather than the sum of every step. Each step holds its own lock: a 409 means that piece's own job is already reading the same documents, and the step is skipped. A failed step never stops the others or fails the refresh. Case-graph node and edge upserts retry once on a duplicate key, since two steps can create the same node at the same moment.

What each step may replace:

- **Witnesses** are read from every document not read before, inline, so scoring sees all of them (past 25 batches the rest goes to the queued `witnessExtract` job). Damages are read the same way, so the re-rating sees every new entry. Scoring then rewrites only the AI columns; a lawyer's status, score override and factor answers are re-applied on top. The witness step comes before Red Team, whose prompt reads the witness list. The upload trigger only schedules the separate witness and damages extraction jobs when the refresh doesn't run.

- **Red Team** is always rebuilt, since nobody can edit it. A case with no findings and no contradictions is skipped.
- **Theories** keep one AI draft per case (`authorUserId: null`), rewritten in place so its id, forks and notes survive. Cached diffs against it are dropped. Theories a lawyer wrote or forked never change.
- **Case Reconstruction** is regenerated only while nobody has edited it. `CaseReconstruction.narrativeEditedAt` is set by any register edit and cleared by every generate. While it is set, the refresh skips the narrative and the pane says so. Narration is re-synthesized only when the narrative had audio before. Scenes, the table read and events are not regenerated: they are built from the documents and timeline, not the narrative.

The timeline needed no new step: the case strategy step already rewrites its AI dates. It stays inside Evidence & Timeline; the hidden Timeline pane stays hidden.

### One manual trigger: "Refresh analysis"

The Terminal header has a single "Refresh analysis" button, where "Download case brief" used to be (the brief stays in the Case Workspace's Studio). It runs the whole analysis — the same `caseRefresh` job, through `POST /:caseId/refresh` — even when no document changed, after a confirmation modal, since a run is a dozen AI calls. While any run is going, automatic or manual, the button is the gold "Updating analysis…" status instead and can't be clicked; it is the Terminal's one analysis indicator. A manual run rebuilds the map even with unchanged documents (still never one a lawyer expanded or edited) and keeps every protection below.

### No manual regenerate in the Terminal

A pane the analysis refresh rewrites has no Generate/Regenerate/Update control of its own in the Terminal: Strengths, Weaknesses, Red Team, Theories ("Propose a theory"), the Case Reconstruction narrative, Case Strategy ("Update plan", with the stale-plan banner that asked for it), Damages & Remedies ("Propose from documents"), the Visual Strategy Map (Regenerate and "Build from documents") and the timeline in Evidence & Timeline. The refresh is the one way these change, and each pane shows `PaneUpdatingNote` (`panel-kit.tsx`) while it runs.

Witnesses lose "Score with AI" the same way. Actions the refresh doesn't run keep their buttons: reconstruction scenes, events, table read and narration, theory diffs, and Jev checks on single rows. Studio and the chat's timeline keep their own Generate/Regenerate controls. The API routes behind the removed buttons stay, unused by the Terminal.

## Consequences

- A refresh makes more Chat Wonder calls (witness extraction per batch of new documents, witness scoring, Red Team with its Jev check, the theory, the reconstruction), so "Updating analysis…" stays on longer.
- Older cases may hold several AI drafts from the old Propose button. Only the newest is rewritten; the others stay until someone retires them.
- A lawyer editing the narrative while a refresh lands keeps their unsaved draft; the other registers take the new text.
- Some content can no longer be brought back up to date from the Terminal: an edited reconstruction narrative is never rewritten again, an expanded or edited case map is never rebuilt, and a Case Strategy plan only catches up with a lawyer's own edits (findings, evidence, witnesses) at the next document change. A case whose first map failed to build retries only when its documents next change.
