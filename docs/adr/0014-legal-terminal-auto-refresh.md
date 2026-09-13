# 0014: Auto-refresh Legal Terminal analysis when the case corpus progresses

## Status

Proposed. Not built. Pickup spec (current triggers, pane inventory, phases, code map) lives in `ilovelawyer-api/docs/legal-terminal-auto-refresh.md`.

GitHub: [API epic #73](https://github.com/FORHU/ilovelawyer-api/issues/73) · [app UX #110](https://github.com/FORHU/ilovelawyer-app/issues/110)

## Context

Legal Terminal mixed two ways of filling AI panes:

- **Refresh analysis** (lawyer click) runs contradictions, case strategy, and case findings, then copies chat timeline tags into Evidence.
- **Post-extraction** (after a bulk upload goes quiet) runs contradictions and case strategy, then **always** regenerates Case Reconstruction + Polly. It does **not** run findings, so Legal Issues / Strengths / Weaknesses / Attack / Defense stay empty until someone clicks Refresh.

Chat timeline tags already promote automatically. Risk meters and deadlines are formulas/rules, not Chat Wonder. Red Team, mind map, and Audio Overview are on-demand.

Lawyers expect the terminal to catch up when documents finish indexing, without a hidden extra click, and without clobbering rows they typed themselves.

## Decision (proposed)

Treat a **corpus change** (documents becoming READY, or READY documents removed) as the trigger. Coalesce with the existing ~45s quiet window so a large dump is one Chat Wonder batch, not one per file.

Run the **same job** as Refresh analysis (`caseRefresh` / `CaseRefreshSvc`), so findings are included. Keep replacing **only** AI-tagged findings and strategy items.

Do **not** auto-run Red Team, mind map, Audio Overview, or (after the first narrative exists) Case Reconstruction — those stay lawyer-triggered. Chat stays a conversation.

Open terminals already poll `caseRefresh` job status; reuse that instead of a new push channel.

## Consequences

- First ship is unifying post-extraction with `CaseRefreshSvc` (findings catch up after upload). Durable multi-instance debounce and fingerprint-skip are follow-ups.
- Three sequential Chat Wonder calls per coalesced refresh — skip if the READY document set has not changed.
- In-memory `setTimeout` debounce can miss work across API processes until the queue-based quiet window ships.
- Snapshot lists of AI findings will swap when a background job finishes; a header “Updating analysis…” state is the v1 UX, a stale chip is optional later.
