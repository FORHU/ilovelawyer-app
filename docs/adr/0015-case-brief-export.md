# 0015: Export a Case Brief (Word first, then PDF) from the case snapshot

## Status

Proposed. Not built. Pickup spec: `ilovelawyer-api/docs/case-brief-export.md`.

GitHub: [API epic #77](https://github.com/FORHU/ilovelawyer-api/issues/77) · [app #111](https://github.com/FORHU/ilovelawyer-app/issues/111)

## Context

Legal Terminal and Case Workspace are where analysis is generated and edited. Partners do not live there. They live in Word, PDF, and email. There is no export today. Screenshotting the 19-pane UI or asking Chat Wonder to write a fresh memo at download time would drift from the panes and violate the zero-hallucination stance.

## Decision (proposed)

One **Case Brief** download, generated on the API from `CaseSnapshotSvc.get()` — the same stored reconstruction, findings, strategy, and Red Team the panes already show. Word (`.docx`) ships first so partners can mark it up; PDF is a second format from the same renderer. One button on the Terminal header and Case Workspace, not a button on every pane. Stamp `lastRefreshedAt` and an AI-draft disclaimer on the cover and footer.

## Consequences

- New export endpoint and a `docx` (or equivalent) writer in `ilovelawyer-api`; the app only triggers download.
- Empty sections (no reconstruction yet) are omitted or shown as “not generated,” not invented.
- Court e-filing and emailing the pack are follow-ups, not v1.
