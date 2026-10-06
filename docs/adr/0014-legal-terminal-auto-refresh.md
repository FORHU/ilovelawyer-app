# 0014: Auto-refresh Legal Terminal analysis when the case corpus progresses

## Status

Accepted and built. A corpus change triggers the analysis; the Terminal header also has a "Refresh analysis" button (with a confirmation step) for a run without one — see 0017. Partly superseded by [0017](0017-auto-regenerate-red-team-theories-reconstruction.md), which adds Red Team, the AI draft theory and Case Reconstruction to the refresh.

GitHub: [API epic #73](https://github.com/FORHU/ilovelawyer-api/issues/73) · [app UX #110](https://github.com/FORHU/ilovelawyer-app/issues/110)

## Context

Legal Terminal mixed two ways of filling AI panes:

- **Refresh analysis** (lawyer click) runs contradictions, case strategy, and case findings, then copies chat timeline tags into Evidence.
- **Post-extraction** (after a bulk upload goes quiet) runs contradictions and case strategy, then **always** regenerates Case Reconstruction + Polly. It does **not** run findings, so Legal Issues / Strengths / Weaknesses / Attack / Defense stay empty until someone clicks Refresh.

Chat timeline tags already promote automatically. Risk meters and deadlines are formulas/rules, not Chat Wonder. Red Team, mind map, and Audio Overview are on-demand.

Lawyers expect the terminal to catch up when documents finish indexing, without a hidden extra click, and without clobbering rows they typed themselves.

## Decision

Treat a **corpus change** (documents becoming READY, or READY documents removed) as the trigger. Coalesce with the existing ~45s quiet window so a large dump is one Chat Wonder batch, not one per file.

Run the **same job** as Refresh analysis (`caseRefresh` / `CaseRefreshSvc`), so findings are included. Keep replacing **only** AI-tagged findings and strategy items.

Do **not** auto-run Red Team, mind map, Audio Overview, or (after the first narrative exists) Case Reconstruction — those stay lawyer-triggered. Chat stays a conversation. (Since changed: the mind map rebuilds in the refresh, and 0017 adds Red Team and Case Reconstruction.)

Open terminals already poll `caseRefresh` job status; reuse that instead of a new push channel.

## Consequences

- Post-extraction runs `CaseRefreshSvc`, so findings catch up after an upload. The quiet window is a delayed queue message (it survives restarts and multiple API instances), and the run is skipped when the READY set's fingerprint hasn't changed.
- Three sequential Chat Wonder calls per coalesced refresh — skip if the READY document set has not changed.
- Snapshot lists of AI findings will swap when a background job finishes; a header “Updating analysis…” state is the v1 UX, a stale chip is optional later.
