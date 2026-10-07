# 0018: Each pane the case analysis updates also has its own Regenerate

## Status

Accepted. Changes part of [0017](0017-auto-regenerate-red-team-theories-reconstruction.md), which removed every per-pane control.

## Context

The case analysis ("Refresh analysis", or a document change) keeps 16 Terminal panes up to date. Redoing one pane meant paying for a full run of about a dozen AI calls. Most panes had a single-pane API action from before 0017 removed their buttons.

## Decision

Each of the 16 panes gets the gold ↻ Regenerate at the right of its intro row (`RegenerateButton` in `panel-kit.tsx`, driven by `usePaneRegenerate` in `lib/terminal/mutations.ts`). Evidence & Timeline has one per section (contradictions, timeline). The button always reads "Regenerate", in every pane and in Studio; its tooltip says what that pane's run does.

| Pane | Route | Job kind |
|---|---|---|
| Case Summary (outlook) | `POST /outlook/generate` (new) | `caseOutlook` |
| Case Strategy, and the timeline | `POST /strategy/refresh`, `POST /timeline/generate` | `caseStrategyRefresh`, `timelineGenerate` |
| Evidence & Timeline contradictions | `POST /evidence/contradictions/scan` | `contradictions` |
| Legal Issues, Strengths, Weaknesses, Attack, Defense | `POST /findings/regenerate` with the category (now all five) | `legalIssueRegenerate`, `strengthRegenerate`, `weaknessRegenerate`, `attackRegenerate`, `defenseRegenerate` |
| Law & Precedent | Legal Issues' action (its grounds are the legal-issue findings) | `legalIssueRegenerate` |
| Witnesses | `POST /witnesses/refresh` (new): read new documents, then score | `witnessRefresh` |
| Damages & Remedies | `POST /damages/refresh` (new): read new documents, then re-rate | `damagesRefresh` |
| Case Reconstruction | `POST /reconstruction/generate` | `caseReconstruction` |
| Theories | `POST /theories/propose` (rewrites the one AI draft) | `caseTheoryPropose` |
| Visual Strategy Map | `POST /mind-map/generate` | `caseMindMap` |
| Red Team | `POST /red-team/generate` | `redTeam` |
| Audio Overview | `POST /audio-overview/generate` (new) | `audioOverviewScript` |

Rules:

- **No cascade.** A pane regenerates only itself; panes built on it catch up at the next "Refresh analysis". The button's tooltip says so.
- **A pane run and the case analysis never overlap.** While the analysis runs, every pane button is disabled and every pane route refuses with a 409 (`AiGenerationLockSvc.assertAnalysisIdle`). While any pane runs (`PANE_REGENERATE_KINDS`), "Refresh analysis" is disabled with a tooltip naming the pane, `POST /refresh` refuses with a 409 `PANE_REGENERATING` whose `details.kind` names the pane's job (`assertNoPaneRunning`), and an automatic run after a document change reschedules itself (the usual 45-second backoff) until the pane is done. One rule, so a pane never shows two states and two runs never write the same rows.
- **Same protections.** A pane's run replaces what its analysis step would and no more. Only the two that can overwrite a lawyer's work ask first: an edited reconstruction narrative (an in-pane confirm) and an expanded map (MindMap's existing confirm).
- **Case Strategy and the timeline share one pass.** Both keep a button; each tooltip says it updates the other.

### The Case Workspace's Studio follows the same rules

Studio's Visual Strategy Map, Timeline and Audio Overview are the same pieces of the case, so they behave the same way as their Terminal panes:

- **Timeline:** the header has the same gold Regenerate (`usePaneRegenerate("timeline")`), disabled while the case analysis runs, with the same updating line.
- **Visual Strategy Map:** Regenerate and "Build from documents" are held back while the case analysis runs; a chat-made map (a case with no documents) can still be regenerated through chat. Its tile only opens the view, like Timeline's and Data Table's; it never starts a build. An empty view offers "Build from documents" (or "Generate" for a chat-made map).
- **Audio Overview:** shows the case's newest overview from any source (`useLatestAudioOverviewQuery`), not a consultation's newest message. Regenerate writes a case-owned overview and records it (`usePaneRegenerate("audioOverview")`); there is no hidden chat turn any more. Recording, "Retry recording" and "Render audio" work as in the Terminal pane.

- **Data Table:** a view over rows the analysis already rewrites (findings, witnesses, damages; deadlines are rule-based), so it has no Regenerate: that would be most of a full run, which is what "Refresh analysis" is. It reloads its rows as wave 1 and wave 2 end, and its tile opens the table without reloading.
- **Loading states match the Terminal.** While the case analysis runs, the Timeline, Data Table, Visual Strategy Map and Audio Overview tiles and views show they are loading for the whole run, as their Terminal panes do, not only until the wave that rewrites them ends. The waves decide only when data reloads early (the timeline after wave 1, `caseRefreshRewriting(job, "timeline")`).

### One loading state, in place of the content

The Terminal's Panel Library marks the same panes: while a pane is loading, its row's badge reads "Updating…" in gold with a spinner instead of its count (`useLoadingPanes` in `lib/terminal/mutations.ts`: the analysis's panes for its whole run, a pane's own Regenerate, and the background findings, witness and damages jobs).

In Studio, the Mind Map, Timeline, Data Table and Audio Overview tiles show loading the same way: the tile keeps its name, its icon spins, and its note reads "Updating…".

While a run writes a pane (the case analysis, the pane's own Regenerate, or a build), the pane keeps its header and its disabled Regenerate, and everything below is replaced by one centered gold spinner and line (`PaneLoadingState` in `panel-kit.tsx`; the line comes from `usePaneLoadingLabel`). Every pane and Studio view uses the same two lines: "Updating with the latest analysis…" for the case analysis and other background updates, and "Regenerating this pane…" for its own Regenerate or build. The previous result is not shown under an "Updating…" line, and there is no second spinner on the content (the map's ↻ included). Every Terminal pane and every Studio view (Timeline, Data Table, Visual Strategy Map, Audio Overview) does this, so a pane that is loading looks the same everywhere. The trade-off: the previous result can't be read or edited until the run finishes (about a minute or two for a pane, a few minutes for the case analysis). Exceptions: Law & Precedent's citation check, which the analysis doesn't write, stays usable; an edited reconstruction narrative that the analysis keeps is not hidden; and an Audio Overview being recorded (not rewritten) keeps its own notice over the script.

The chat-based `useAudioOverview` hook and its step indicator had no users left and were removed.

## Consequences

- Five new job kinds (`legalIssueRegenerate`, `attackRegenerate`, `defenseRegenerate`, `witnessRefresh`, `damagesRefresh`) and seven new queue kinds, in both repos.
- Panes can drift apart between full runs (for example a regenerated Legal Issues next to an outlook built on the old ones) until the next "Refresh analysis".
- A pane's run that fails shows an inline error under its button; a failure of the same kind during the analysis shows there too, since they share the job.
- A lawyer waits for a pane run (about a minute or two) before "Refresh analysis", and vice versa. Map builds and chat/Studio Audio Overview requests hold pane kinds too, so they also make "Refresh analysis" wait briefly.
