# 0016: Retire Contradictions, Citation Map, Team & Audit and Verification as Terminal panes

## Status

Accepted.

## Context

The Legal Terminal had 22 panes a lawyer could add. Four of them were removed from the Terminal: Contradictions, Citation Map, Team & Audit and Verification. The data behind each is used elsewhere, so removing the features outright would break other panes and the AI:

- Contradictions feed Red Team, the case risk score, Case Reconstruction's events, the case mind map, the Case Brief and Jev's checks.
- Citation Map's pleaded claims are read by Jev when it checks findings.
- The audit log behind Team & Audit is written by every save.
- The grounding verifier behind Verification also feeds the one-line check summary under each AI chat answer.

## Decision

Remove the panes, keep the data and the API (option A of the removal plan).

- The four ids leave `PANEL_IDS` and `PANEL_CATALOG` in both repos. A saved Terminal Workspace that still lists one loses it on load (`normalizeLayout` drops unknown ids, and shows Case Summary when nothing else is left visible). Stored screen presets are filtered the same way when listed (`dropUnknownPanelIds`), and the seeded system presets were rewritten: Contradictions became Evidence & Timeline, Citation Map became Law & Precedent, Team & Audit and Verification were dropped.
- Contradiction triage moved into Evidence & Timeline as a section (resolve, dismiss with a note, reopen), so a false conflict can still be dismissed. The manual "Scan contradictions" button did not move: the scan runs in every analysis refresh.
- The adverse-citation sweep loses its buttons with Citation Map. Its API routes and job stay, so it can be given a new home later.
- No API route, job or table was removed.

## Consequences

- Lawyers can no longer map authorities to claims, run the adverse sweep, or read the audit log or the verifier's full results inside the Terminal.
- Some API routes are now called by nothing in the app (citation map seed, claim and ground editing, sweep and adverse decisions, contradiction scan, team, grounding list). Removing them is a separate change.
- Whether the grounding verifier keeps running is a deployment setting (`USE_GROUNDING_VERIFIER`), not part of this change.

## Follow-up: adverse sweep retired

The adverse-citation sweep never got the new home this ADR left room for, so it was removed outright (ilovelawyer-api #380). Its routes, job, Jev check (`USE_JEV_ADVERSE_SWEEP`), the `AdverseCitationHit` table and `Case.adverseSweptAt` are gone. Weaknesses a lawyer created by accepting a hit are ordinary findings and were kept.
