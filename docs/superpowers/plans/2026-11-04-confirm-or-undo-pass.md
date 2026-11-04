# Confirm or Undo "Pass" on Client Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stray click on Pass no longer silently costs a lawyer a client request.

**Architecture:** Two alternative fixes for one bug. **Option A** puts a confirmation dialog in front of Pass, mirroring the existing Accept dialog (frontend only). **Option B** drops the dialog idea and instead lets the lawyer undo a pass from a toast, which needs a new API route that takes the lawyer back off `excludedLawyerIds`. Pick one; they are not stacked (an Undo toast makes a dialog redundant).

**Tech Stack:** `ilovelawyer-app` (Next.js, `apps/web`, react-query, sonner, i18next, vitest). `ilovelawyer-api` (Express, Prisma/Postgres, mocha).

**Spec:** the bug report "FE/BE - Pass has no confirmation or undo" (pasted in the session, 2026-11-04). It has no file; its facts are restated under Global Constraints.

## Decision needed before building

The report leaves "ask first vs undo" to product. **Recommendation: Option A.** It fully meets "a stray click shouldn't cost a request", matches Accept's behaviour next to it, touches one repo, and has no data-integrity risk. Option B is the nicer UX but is cross-repo, and its hard part is that `excludedLawyerIds` is also written by non-pass paths (see Review Focus 1). Build B only if product wants an Undo or a "Passed" list. Task numbers below are A = 1-2, B = 3-5.

## Global Constraints

- Repo rules (user memory): do **not** commit, create branches, push or open PRs. Leave all changes uncommitted in the current checkout; there are no commit steps below.
- Repo rules (user memory): no DB-writing command (migrations, shadow-DB drift checks, Postgres-backed specs) without asking the user first. Never point a Prisma shadow database at the real local DB.
- `ilovelawyer-app/AGENTS.md`: this Next.js has breaking changes. Before writing any page/route code, read the relevant guide in `node_modules/next/dist/docs/`. (Neither option adds routes or pages, but both edit App Router pages.)
- Pass today: `POST /api/client-requests/:id/pass` → `ClientRequestLawyerSvc.pass` → `ClientRequestRepo.exclude` pushes the lawyer onto `ClientRequest.excludedLawyerIds`. Status is untouched. Afterwards the request is gone from Inbox, Mine and History, `GET /:id` and `claim` answer 404.
- The client-request strings live only in `apps/web/locales/en/client-request.json` (there is no ko/tl file for this namespace).
- Accept's dialog is the model to copy: `components/client-requests/confirm-accept-modal.tsx` (`role="alertdialog"`, blocks close while pending, `useTranslation("client-request")`).
- Frontend has no component-render test setup (`vitest.render.config.ts` is a throwaway pinned to one chat spec), so Option A is verified by `typecheck`, `lint` and a manual run, not by a new automated test. Say so in the handoff.

## Review Focus

1. **Undo must not resurrect other exclusions (Option B).** `excludedLawyerIds` is also pushed by `afterClaimEnded` (release/lapse), `lapseUnpaid`, quotation rejection and `organization-charge` "not chosen". All of those lawyers have a claim on the request; a pure pass never does. Undo for a lawyer who has any claim must be refused, so a released lawyer can't undo their way back to a request they gave up.
2. **Undo after the request moved on (B).** Request no longer ROUTED, or `routingExpiresAt` passed, or full with 3 claimants: Undo must answer a clean 409 and the list must refresh, not 204 over a request nobody can open.
3. **Undo when never passed (B).** Not in `excludedLawyerIds` → 404 (no probing), not a silent 204.
4. **Pass fails (A and B).** `onPass` in the inbox has no `onError`, so a failed pass is silent today. With a dialog it would close and show nothing. Failure must toast and the dialog must close.
5. **Double submit and Escape/overlay close while pending (A).** Confirm must be disabled while the mutation is pending and the dialog must not dismiss mid-request, like `ConfirmAcceptModal`.

---

## Option A: Ask first (frontend only)

### Task 1: ConfirmPassModal and copy

**Files:**
- Create: `apps/web/components/client-requests/confirm-pass-modal.tsx`
- Modify: `apps/web/locales/en/client-request.json` (add `confirmPass`, fix `card.passTooltip`)

**Interfaces:**
- Produces: `export function ConfirmPassModal(props: { open: boolean; isPending: boolean; onConfirm: () => void; onClose: () => void }): JSX.Element`

- [ ] **Step 1: Add copy to `client-request.json`.** Add a `confirmPass` object with `title` ("Pass on this request?"), `description` (says it leaves the inbox, can't be reopened or accepted by them again, and other lawyers can still take it), `cancel` ("Keep request"), `confirm` ("Pass"). Change `card.passTooltip` from "Hide this request from your inbox" to wording that says it is permanent, e.g. "Remove this request from your inbox for good".
- [ ] **Step 2: Create `ConfirmPassModal`** in the file above as a copy of `ConfirmAcceptModal`'s structure with the `confirmPass.*` keys. Same `onOpenChange` guard (`!next && !isPending && onClose()`), same `role="alertdialog"`, Cancel disabled while pending, confirm button `isPending={isPending}`.
- [ ] **Step 3: Verify.** Run the `typecheck` and `lint` scripts in `apps/web`. Expected: no new errors.

### Task 2: Gate both Pass buttons behind it

**Files:**
- Modify: `apps/web/app/(protected)/homepage/client-requests/page.tsx:95-97` (`onPass`), plus state beside `confirmAcceptFor` (line 79) and a second modal beside `ConfirmAcceptModal` (line 247)
- Modify: `apps/web/app/(protected)/homepage/client-requests/[id]/page.tsx:431-439` (`OpenRequestActions`)

**Interfaces:**
- Consumes: `ConfirmPassModal` (Task 1); `usePassClientRequestMutation()` from `lib/client-requests/inbox.ts` (`mutate(id: string, opts)`).

- [ ] **Step 1: Inbox.** Add `confirmPassFor: string | null` state. `onPass(id)` now only sets it. Add `confirmPass(id)` which calls `pass.mutate(id, { onSuccess: close, onError: (err) => { close; showError(err) } })`. Render `<ConfirmPassModal open={!!confirmPassFor} isPending={pass.isPending} ... />` next to the Accept modal. The row's `passPending` prop keeps working as is.
- [ ] **Step 2: Detail page.** In `OpenRequestActions`, the Pass button opens a local `confirmingPass` state instead of mutating; the modal's confirm calls `pass.mutate(request.id, { onSuccess: () => router.push("/homepage/client-requests"), onError: toast.error(...) })` using the same error helper the Accept button beside it uses (`toastRequestError`).
- [ ] **Step 3: Verify statically.** `typecheck` and `lint` in `apps/web`. Expected: clean.
- [ ] **Step 4: Verify in the running app** (use the `run` skill). Inbox: Pass opens the dialog; Cancel/Escape/overlay leave the request in place; confirm removes it and the dialog closes. Detail page: same, and confirm returns to the inbox. Force a failure (stop the API) and confirm an error toast shows and the dialog closes.

---

## Option B: Undo (new API route + toast)

### Task 3: `ClientRequestRepo.unexclude`

**Files:**
- Modify: `ilovelawyer-api/src/repositories/client-request.repository.ts` (next to `exclude`, ~line 355)
- Test: `ilovelawyer-api/test/client-request-claim-repository.spec.ts` (the Postgres-backed spec that already asserts `excludedLawyerIds`, ~lines 105, 148)

**Interfaces:**
- Produces: `static async unexclude(id: string, lawyerId: string, now?: Date): Promise<boolean>`, true only if a row changed.

- [ ] **Step 1: Write failing specs** (names exact): `"unexclude takes a passing lawyer back off and leaves the others"` (excluded `[a, b]`, unexclude `a` → `[b]`, returns true); `"unexclude refuses a lawyer who holds or held a claim"` (claim row for the lawyer, any outcome → false, array unchanged); `"unexclude refuses once the request is no longer ROUTED or the 48h are over"` (→ false); `"unexclude is false for a lawyer who was never excluded"`.
- [ ] **Step 2: Run them** (ask the user first: these write to Postgres). Expected: FAIL, `unexclude is not a function`.
- [ ] **Step 3: Implement as one atomic statement.** Prisma has no array-remove, so use `prisma.$executeRaw` (precedent: `$queryRaw` in `case-area.repository.ts`) with `array_remove("excludedLawyerIds", ${lawyerId})`, guarded in the same `WHERE` by `id`, `status = 'ROUTED'`, `"routingExpiresAt" > now`, `${lawyerId} = ANY("excludedLawyerIds")` and `NOT EXISTS` a `ClientRequestClaim` row for that request and lawyer. Return `count === 1`. Confirm the actual table/column names against `prisma/schema.prisma` (model at line 1357) and whether `updatedAt` needs bumping by hand since raw SQL skips `@updatedAt`.
- [ ] **Step 4: Run the specs.** Expected: PASS.

### Task 4: Service, controller and route

**Files:**
- Modify: `ilovelawyer-api/src/services/client-request-lawyer.service.ts` (after `pass`, ~line 673)
- Modify: `ilovelawyer-api/src/controllers/client-request-lawyer.controller.ts` (after `pass`, ~line 116)
- Modify: `ilovelawyer-api/src/routes/client-request.route.ts:16`
- Test: `ilovelawyer-api/test/client-request-lawyer.spec.ts`, inside `describe("pass")` (~line 319); the in-memory repo stub at ~line 158 needs an `unexclude` twin of its `exclude` stub

**Interfaces:**
- Consumes: `ClientRequestRepo.unexclude` (Task 3).
- Produces: `ClientRequestLawyerSvc.unpass(lawyer: LawyerContext, id: string): Promise<void>`; `DELETE /api/client-requests/:id/pass` → 204.

- [ ] **Step 1: Write failing specs** in `describe("pass")` (reuse its `inboxIds` helper): `"undo puts the request back in that lawyer's inbox only"`; `"undo is 404 if the lawyer never passed"`; `"undo is 404 if the lawyer released a claim (their exclusion isn't a pass)"`; `"undo is 409 INVALID_REQUEST_STATUS once the routing window has ended"`; `"undo is 404 if the request no longer matches the lawyer"`. Add the `unexclude` stub to the in-memory repo mirroring the SQL guards.
- [ ] **Step 2: Run** `npm test` for that file. Expected: FAIL, `unpass is not a function`.
- [ ] **Step 3: Implement `unpass`.** `assertVerifiedLawyer`; load via `findForLawyer`; 404 (`NOT_FOUND()`) unless the lawyer is in `excludedLawyerIds`, has no claim on it, and `ClientRequestMatchingSvc.matches(profile, criteriaOf(r))` (note `isFor` cannot be reused: it rejects excluded lawyers); then `unexclude`, and if it returns false throw `HttpError("This request is no longer open.", 409, "INVALID_REQUEST_STATUS", { status })`. Controller `unpass` returns 204; route `router.delete("/:id/pass", asyncHandler(ClientRequestLawyerCtrl.unpass))`.
- [ ] **Step 4: Run** the lawyer spec, then the full API suite. Expected: PASS, no regressions in the `pass` and `claim` cases.

### Task 5: Undo toast in the app (replaces Task 1-2's dialog)

**Files:**
- Modify: `apps/web/lib/client-requests/api.ts:27` (add `unpassClientRequest(id: string)` → `DELETE /api/client-requests/${id}/pass`)
- Modify: `apps/web/lib/client-requests/inbox.ts:36` (add `useUnpassClientRequestMutation`, invalidating `clientRequestKeys.lists()` like `usePassClientRequestMutation`; also invalidate the detail key if one exists in `lib/query-keys`)
- Modify: the two Pass call sites from Task 2, and `locales/en/client-request.json` (`passed.toast`, `passed.undo`)

**Interfaces:**
- Consumes: `DELETE /api/client-requests/:id/pass` (Task 4).
- Produces: `useUnpassClientRequestMutation(): UseMutationResult<void, Error, string>`.

- [ ] **Step 1:** If Option A shipped first, remove its `ConfirmPassModal` wiring; Pass mutates immediately again. Keep the `onError` toast from Task 2.
- [ ] **Step 2:** On pass success, `toast(t("passed.toast"), { duration: 8000, action: { label: t("passed.undo"), onClick: () => unpass.mutate(id, { onError: showError }) } })`. Sonner's toast is global, so on the detail page it survives the `router.push` back to the inbox; the unpass mutation must live somewhere that outlives that unmount (the hook's `mutate` still resolves; verify the list refreshes).
- [ ] **Step 3:** `typecheck` and `lint`, then manual run: Pass → toast → Undo → request back in Inbox; wait out the toast → stays gone; undo after the request is taken or expires → error toast and the list refreshes.
- [ ] **Step 4:** Update the pass tooltip to say it can be undone briefly, not "for good".

---

## Self-review notes

- Coverage: confirmation (A) and undo (B) both trace to the report's two options; the misleading tooltip is fixed in Task 1 and revisited in Task 5.
- Types: `ConfirmPassModal`, `unexclude`, `unpass`, `unpassClientRequest` and `useUnpassClientRequestMutation` are named identically wherever used.
- Open item for the reader: B's Task 5 Step 2 assumes sonner's `action` option; no existing call site in the app uses it, so confirm against the installed version when implementing.
