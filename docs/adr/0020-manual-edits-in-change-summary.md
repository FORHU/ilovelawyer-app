# 0020: Lawyers' manual edits in the Case Change Summary

## Status

Accepted and built. Extends [0019](0019-case-change-summary.md).

## Context

The "What changed" modal (0019) showed what each AI run changed and nothing a lawyer changed by hand: a weakness re-rated, a contradiction resolved, a witness added, a to-do ticked. The audit log couldn't fill the gap. It records no deletes (findings, witnesses, damages, timeline entries) and no to-do or timeline edits, its payloads hold only ids (a deleted item can't be named), and its rows outlive the case, so it mustn't hold case content.

## Decision

Every lawyer edit in a Terminal pane is recorded at the moment it's saved, in its own table, `CaseManualEdit` (API `ManualEditLog`). Nothing is diffed: the edit method already knows what it changed. Each row has the pane (an app `PanelId`), what was edited, the action (added, edited, removed, resolved, dismissed, reopened, ticked, unticked, accepted, awarded, disputed, reactivated, published, retired, forked, confirmed, unconfirmed, recomputed, expanded, reverted), the item's name when edited, and for an edit the fields it changed. Short values keep `from`/`to`; long text (a detail, a note, a narrative) only names the field.

| Pane | Edits recorded |
|---|---|
| Case Summary | Risks added, edited, removed |
| Evidence & Timeline | Contradictions resolved, dismissed, reopened; timeline entries added, edited, removed; evidence matrix ratings; custody events added, removed; missing evidence resolved, dismissed, reopened |
| Case Strategy | To-dos added, ticked, unticked, renamed; deadlines added, confirmed, unconfirmed, recomputed |
| Witnesses | Added, edited (status, credibility, statement, contact, notes, what's needed), rubric factor changes, removed |
| Damages & Remedies | Added, edited (amount, due date, title), accepted, marked awarded, removed |
| Legal Issues, Strengths, Weaknesses, Attack, Defense | Findings added, edited (name, detail, tag, impact), removed |
| Law & Precedent | Authorities added, edited, removed; citations edited, removed; citation grounds added, removed |
| Decisions | Disputed, reactivated |
| Theories | Theories added, edited, published, retired, forked, removed; claims, assumptions and open questions added, edited, removed |
| Case Reconstruction | Narrative registers edited |
| Visual Strategy Map | Points added, renamed, removed; branches expanded; map reverted |

Rules:

- Recorded right after the write succeeds, by the edit methods only. The AI's own writes never are; they show up as runs. A failed log write is warned and never fails the edit.
- The same person editing the same item again within 5 minutes folds into one row (each field keeps its first `from` and latest `to`), so autosave reads as one edit. An edit that ends where it began disappears.
- Edits are grouped when read into **editing sessions**: one person's edits with no gap over 30 minutes and no AI run in between. A session counts on the day it started.
- The modal's History lists a day's runs and sessions together, newest first, with an **All · Analysis · Edits** filter remembered per browser. A session shows its edits by pane, up to four named per pane, each with an Open link. The date picker counts each day's runs and edit sessions.
- A run's view says how many edits lawyers made since the previous run ("5 edits since the previous run, by Ana Cruz and you"), linking to the first of those sessions. The window is from the previous run's save to this run's start (`CaseChangeSummary.startedAt`), so edits made while the run worked aren't in it.
- Edits never open the modal, and a teammate's edits don't light the What changed dot (first release). The headline count stays the AI's.
- Rows go with the case (`Cascade`); a deleted user's rows keep the edits with no author ("Someone").

## Consequences

- `ManualEditLog.record` is called from 56 places across 16 services and controllers. A new edit route must call it too, or its edits silently won't show. `test/manual-edit-wiring.spec.ts` covers the main panes.
- The refresh's deltas still count an item a lawyer edited while the run worked as an AI change. Dropping those, using this log, is a planned follow-up.
- Annotations, reordering findings, document uploads (already "After N new documents") and pane Regenerates (already runs) are not recorded as edits.
