"use client"

import { Children, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"
import { Check, ChevronDown, CornerDownLeft, GitFork, Loader2, MessageSquareWarning, Pencil, Plus, Send, Sparkles, Trash2, X } from "lucide-react"
import { AnnotationThread } from "@/components/shared/annotation-thread"
import { Badge } from "@workspace/ui/components/badge"
import {
  terminalKeys,
  useAddTheoryAssumptionMutation,
  useAddTheoryClaimMutation,
  useAddTheoryOpenQuestionMutation,
  useAiJobStatus,
  useCreateTheoryMutation,
  useDeleteTheoryItemMutation,
  useDeleteTheoryMutation,
  useForkTheoryMutation,
  useGenerateTheoryDiffMutation,
  usePublishTheoryMutation,
  useProposeTheoryMutation,
  useRetireTheoryMutation,
  useTheoryDiffQuery,
  useUpdateTheoryItemMutation,
  type TheoryItemKind,
} from "@/lib/terminal/mutations"
import type { CaseSnapshot, CaseTheory, TheoryStance } from "@/lib/terminal/types"
import { useAuthStore } from "@/lib/store/auth.store"
import { dangerIconBtnClass, editIconBtnClass, fieldClass, ghostBtnClass, primaryBtnClass, MutationError, PanelBody, SectionLabel, EmptyNote } from "@/components/terminal/panel-kit"

// Rows a section shows before collapsing behind "Show all N" (only when that hides 2+ rows).
const COLLAPSED_ITEM_LIMIT = 4

const STATUS_TONE: Record<CaseTheory["status"], "neutral" | "success" | "danger"> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  RETIRED: "danger",
}

export function TheoriesPanel({ snapshot, caseId }: { snapshot: CaseSnapshot; caseId: string }) {
  const { t } = useTranslation("terminal")
  const userId = useAuthStore((s) => s.user?.id)
  const theories = snapshot.theories ?? []

  const create = useCreateTheoryMutation(caseId)
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState("")
  const [thesis, setThesis] = useState("")
  // Grows with the text (up to the textarea's max-h, then it scrolls) instead of staying at a
  // fixed 3 rows. Resetting to "auto" first lets it shrink again when text is deleted or the
  // form is cleared after submit; runs when the form opens too, since the ref is only set then.
  const thesisRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = thesisRef.current
    if (!el) return
    el.style.height = "auto"
    // scrollHeight excludes the border, which border-box sizing needs added back.
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`
  }, [thesis, showCreate])

  const proposeJob = useAiJobStatus(caseId, "caseTheoryPropose")
  const propose = useProposeTheoryMutation(caseId)
  const isProposing = propose.isPending || proposeJob.data?.status === "IN_PROGRESS"

  const [diffA, setDiffA] = useState("")
  const [diffB, setDiffB] = useState("")
  // A picked theory can disappear (a fork gets deleted) — treat it as unpicked, not a dead id.
  const pickedA = theories.some((th) => th.id === diffA) ? diffA : ""
  const pickedB = theories.some((th) => th.id === diffB) ? diffB : ""

  return (
    <PanelBody gap="4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t("theories")}</SectionLabel>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => propose.mutate()}
            disabled={isProposing}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-semibold tracking-[1px] text-foreground uppercase transition-colors hover:bg-muted/70 dark:hover:bg-overlay-hover disabled:opacity-50"
          >
            {isProposing ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3 w-3" aria-hidden="true" />
            )}
            {t("proposeTheory")}
          </button>
          <button type="button" onClick={() => setShowCreate((s) => !s)} className={primaryBtnClass}>
            {t("newTheory")}
          </button>
        </div>
      </div>

      <MutationError show={propose.isError} />

      {showCreate && (
        <form
          className="flex flex-col gap-2 rounded-md border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            const t1 = title.trim()
            const t2 = thesis.trim()
            if (!t1 || !t2) return
            create.mutate({ title: t1, thesis: t2 })
            setTitle("")
            setThesis("")
            setShowCreate(false)
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("theoryTitlePlaceholder")}
            aria-label={t("theoryTitlePlaceholder")}
            className={fieldClass}
          />
          <textarea
            ref={thesisRef}
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            placeholder={t("theoryThesisPlaceholder")}
            aria-label={t("theoryThesisPlaceholder")}
            rows={3}
            className={`max-h-60 resize-none overflow-y-auto py-1.5 ${fieldClass} h-auto`}
          />
          <button type="submit" disabled={create.isPending} className={`self-start ${primaryBtnClass}`}>
            {t("add")}
          </button>
          <MutationError show={create.isError} />
        </form>
      )}

      {theories.length === 0 ? (
        <EmptyNote>{t("noTheories")}</EmptyNote>
      ) : (
        <ul className="space-y-3">
          {theories.map((theory) => (
            <TheoryCard
              key={theory.id}
              theory={theory}
              caseId={caseId}
              isMine={!!userId && theory.authorUserId === userId}
              parentTitle={theories.find((th) => th.id === theory.forkedFromId)?.title}
            />
          ))}
        </ul>
      )}

      {theories.length >= 2 && (
        <div className="rounded-md border border-border p-3">
          <SectionLabel>{t("diffTheories")}</SectionLabel>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={pickedA}
              onChange={(e) => setDiffA(e.target.value)}
              aria-label={t("theoryA")}
              className={`flex-1 ${fieldClass}`}
            >
              <option value="">{t("theoryA")}</option>
              {theories.map((th) => (
                <option key={th.id} value={th.id} disabled={th.id === pickedB}>
                  {th.title}
                </option>
              ))}
            </select>
            <select
              value={pickedB}
              onChange={(e) => setDiffB(e.target.value)}
              aria-label={t("theoryB")}
              className={`flex-1 ${fieldClass}`}
            >
              <option value="">{t("theoryB")}</option>
              {theories.map((th) => (
                <option key={th.id} value={th.id} disabled={th.id === pickedA}>
                  {th.title}
                </option>
              ))}
            </select>
          </div>
          {pickedA && pickedB && <TheoryDiffSection caseId={caseId} theoryAId={pickedA} theoryBId={pickedB} />}
        </div>
      )}
    </PanelBody>
  )
}

function TheoryCard({
  theory,
  caseId,
  isMine,
  parentTitle,
}: {
  theory: CaseTheory
  caseId: string
  isMine: boolean
  /** Title of the theory this one was forked from, when it's still in the list. */
  parentTitle?: string
}) {
  const { t } = useTranslation("terminal")
  const publish = usePublishTheoryMutation(caseId)
  const retire = useRetireTheoryMutation(caseId)
  const remove = useDeleteTheoryMutation(caseId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isFork = !!theory.forkedFromId
  const fork = useForkTheoryMutation(caseId)
  const addClaim = useAddTheoryClaimMutation(caseId)
  const addAssumption = useAddTheoryAssumptionMutation(caseId)
  const addOpenQuestion = useAddTheoryOpenQuestionMutation(caseId)
  const [showAnnotations, setShowAnnotations] = useState(false)

  const isAiProposed = theory.authorUserId === null
  const bullet = <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden="true" />

  return (
    // Forks get a violet left rail and faint tint so they stand apart from originals at a glance,
    // even with the card scrolled past its header.
    <li
      className={`rounded-md border px-3 py-2.5 ${
        isFork ? "border-fork/35 border-l-[3px] border-l-fork bg-fork/[0.04] pl-2.5" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="leading-5 font-medium text-foreground">{theory.title}</p>
          <p className="mt-1 text-[12px] leading-4 text-muted-foreground">{theory.thesis}</p>
        </div>
        <Badge tone={STATUS_TONE[theory.status]}>{theory.status}</Badge>
      </div>

      {isFork && (
        <span
          className="mt-2 mr-3 inline-flex max-w-full items-center gap-1 rounded-full bg-fork/15 px-2 py-0.5 text-[11px] font-medium text-fork"
          title={parentTitle}
        >
          <GitFork className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{parentTitle ? t("forkedFromTheory", { title: parentTitle }) : t("forkedTheory")}</span>
        </span>
      )}

      {isAiProposed && (
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-brand-gold uppercase">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {t("aiProposed")}
        </span>
      )}

      <div className="mt-3 flex flex-col gap-3">
        <TheorySection
          label={t("theoryClaims")}
          count={theory.claims.length}
          canAdd={isMine}
          withStance
          placeholder={t("addClaimPlaceholder")}
          isPending={addClaim.isPending}
          isError={addClaim.isError}
          onAdd={(text, stance, done) =>
            addClaim.mutate({ theoryId: theory.id, statement: text, stance: stance ?? "ASSERTS" }, { onSuccess: done })
          }
        >
          {theory.claims.map((c) => (
            <TheoryItemRow
              key={c.id}
              caseId={caseId}
              theoryId={theory.id}
              kind="claims"
              id={c.id}
              text={c.statement}
              stance={c.stance}
              editable={isMine}
              lead={
                <Badge tone={c.stance === "ASSERTS" ? "success" : "danger"} className="mt-0.5 w-16 justify-center">
                  {c.stance === "ASSERTS" ? t("asserts") : t("denies")}
                </Badge>
              }
            />
          ))}
        </TheorySection>

        <TheorySection
          label={t("theoryAssumptions")}
          count={theory.assumptions.length}
          canAdd={isMine}
          placeholder={t("addAssumptionPlaceholder")}
          isPending={addAssumption.isPending}
          isError={addAssumption.isError}
          onAdd={(text, _stance, done) => addAssumption.mutate({ theoryId: theory.id, statement: text }, { onSuccess: done })}
        >
          {theory.assumptions.map((a) => (
            <TheoryItemRow
              key={a.id}
              caseId={caseId}
              theoryId={theory.id}
              kind="assumptions"
              id={a.id}
              text={a.statement}
              editable={isMine}
              lead={bullet}
            />
          ))}
        </TheorySection>

        <TheorySection
          label={t("theoryOpenQuestions")}
          count={theory.openQuestions.length}
          canAdd={isMine}
          placeholder={t("addOpenQuestionPlaceholder")}
          isPending={addOpenQuestion.isPending}
          isError={addOpenQuestion.isError}
          onAdd={(text, _stance, done) => addOpenQuestion.mutate({ theoryId: theory.id, question: text }, { onSuccess: done })}
        >
          {theory.openQuestions.map((q) => (
            <TheoryItemRow
              key={q.id}
              caseId={caseId}
              theoryId={theory.id}
              kind="open-questions"
              id={q.id}
              text={q.question}
              editable={isMine}
              lead={bullet}
            />
          ))}
        </TheorySection>
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowAnnotations((s) => !s)}
          className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
        >
          <MessageSquareWarning className="h-3 w-3" aria-hidden="true" />
          {t("notes")}
        </button>
        {isMine && theory.status === "DRAFT" && (
          <button
            type="button"
            onClick={() => publish.mutate(theory.id)}
            disabled={publish.isPending}
            className={primaryBtnClass}
          >
            {t("publish")}
          </button>
        )}
        {isMine && theory.status !== "RETIRED" && (
          <button
            type="button"
            onClick={() => retire.mutate(theory.id)}
            disabled={retire.isPending}
            className={ghostBtnClass}
          >
            {t("retire")}
          </button>
        )}
        {isMine && isFork && !confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className={`inline-flex items-center gap-1.5 ${ghostBtnClass} hover:border-danger/40 hover:text-danger`}
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
            {t("delete")}
          </button>
        )}
        {!isMine && (
          <button
            type="button"
            onClick={() => fork.mutate(theory.id)}
            disabled={fork.isPending}
            className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
          >
            <GitFork className="h-3 w-3" aria-hidden="true" />
            {t("fork")}
          </button>
        )}
      </div>
      {confirmDelete && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-danger/10 px-2.5 py-2">
          <p className="min-w-0 flex-1 text-[12px] text-foreground">{t("deleteForkedTheoryConfirm")}</p>
          <button type="button" onClick={() => setConfirmDelete(false)} disabled={remove.isPending} className={ghostBtnClass}>
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => remove.mutate(theory.id)}
            disabled={remove.isPending}
            className="h-8 shrink-0 rounded-md bg-danger px-3 text-[10px] font-semibold uppercase tracking-[1px] text-white transition-colors hover:bg-danger/85 disabled:opacity-50"
          >
            {remove.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : t("delete")}
          </button>
        </div>
      )}
      <MutationError show={publish.isError || retire.isError || fork.isError || remove.isError} />

      {showAnnotations && (
        <div className="mt-2.5 border-t border-border pt-2.5">
          <AnnotationThread caseId={caseId} targetType="NODE" targetId={theory.id} />
        </div>
      )}
    </li>
  )
}

// A claims/assumptions/open-questions block: label + count, with a quiet "+ Add" beside it that
// opens a single inline composer under the list (instead of three always-open forms stacked at
// the bottom of the card). Enter adds and keeps the composer open for the next one; Esc closes.
// Hidden entirely when there's nothing to show and nothing the viewer can add.
function TheorySection({
  label,
  count,
  canAdd,
  withStance,
  placeholder,
  isPending,
  isError,
  onAdd,
  children,
}: {
  label: string
  count: number
  canAdd: boolean
  withStance?: boolean
  placeholder: string
  isPending: boolean
  isError: boolean
  onAdd: (text: string, stance: TheoryStance | undefined, done: () => void) => void
  children: ReactNode
}) {
  const { t } = useTranslation("terminal")
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [stance, setStance] = useState<TheoryStance>("ASSERTS")

  // Long lists collapse to their first few rows behind a "Show all N" toggle — the pane itself
  // scrolls, so no nested scroll box to fight with. Adding an item expands the list, since new
  // items land at the end and would otherwise be hidden behind the toggle.
  const [expanded, setExpanded] = useState(false)

  // Toggling changes the pane body's height by several rows at once, and the browser moves the
  // scroll position on its own when that happens: scroll anchoring can shift it by the inserted
  // height on expand, and collapsing while scrolled into the list clamps it to the new (shorter)
  // max — either way the pane jumps to its top or bottom, worst in a small pane when several are
  // open. So: expanding keeps the exact scroll position (rows just appear below), collapsing
  // brings the toggle back into view so you stay where you were.
  const toggleRef = useRef<HTMLButtonElement>(null)
  const pendingScroll = useRef<{ scroller: HTMLElement; top: number } | null>(null)
  const toggleExpanded = () => {
    const scroller = toggleRef.current?.closest<HTMLElement>("[data-panel-scroll]")
    pendingScroll.current = scroller ? { scroller, top: scroller.scrollTop } : null
    setExpanded((v) => !v)
  }
  useLayoutEffect(() => {
    const pending = pendingScroll.current
    if (!pending) return
    pendingScroll.current = null
    const { scroller, top } = pending
    scroller.scrollTop = top
    // Adjusts only the pane body — scrollIntoView would also scroll the terminal canvas behind it.
    const toggle = toggleRef.current
    if (!expanded && toggle) {
      const bounds = scroller.getBoundingClientRect()
      const rect = toggle.getBoundingClientRect()
      if (rect.top < bounds.top) scroller.scrollTop -= bounds.top - rect.top + 8
      else if (rect.bottom > bounds.bottom) scroller.scrollTop += rect.bottom - bounds.bottom + 8
    }
  }, [expanded])

  const prevCount = useRef(count)
  useEffect(() => {
    if (count > prevCount.current) setExpanded(true)
    prevCount.current = count
  }, [count])
  const items = Children.toArray(children)
  const collapsible = items.length > COLLAPSED_ITEM_LIMIT + 1
  const visibleItems = collapsible && !expanded ? items.slice(0, COLLAPSED_ITEM_LIMIT) : items

  if (count === 0 && !canAdd) return null

  const close = () => {
    setOpen(false)
    setText("")
  }

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[1.4px] text-muted-foreground uppercase">
          {label}
          {count > 0 && <span className="ml-1.5 tabular-nums text-muted-foreground/60">{count}</span>}
        </p>
        {canAdd && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:outline-none"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {t("add")}
          </button>
        )}
      </div>

      {count > 0 && <ul className="-mx-1.5 flex flex-col">{visibleItems}</ul>}
      {collapsible && (
        <button
          type="button"
          ref={toggleRef}
          onClick={toggleExpanded}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 self-start rounded px-1.5 py-0.5 text-[11px] font-medium text-brand-gold transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:outline-none"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          {expanded ? t("showLess") : t("showAllCount", { count: items.length })}
        </button>
      )}

      {open && (
        <TheoryInlineInput
          value={text}
          onChange={setText}
          stance={withStance ? stance : undefined}
          onStanceChange={setStance}
          placeholder={placeholder}
          isPending={isPending}
          submitLabel={t("add")}
          submitIcon={<CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />}
          onSubmit={(v) => onAdd(v, withStance ? stance : undefined, () => setText(""))}
          onCancel={close}
        />
      )}
      <MutationError show={isError} />
    </section>
  )
}

// The one-line input bar both adding and editing an item use: optional Asserts/Denies toggle,
// borderless input, then submit + cancel icon buttons, all inside one rounded field.
// Enter submits, Esc cancels.
function TheoryInlineInput({
  value,
  onChange,
  stance,
  onStanceChange,
  placeholder,
  isPending,
  submitLabel,
  submitIcon,
  onSubmit,
  onCancel,
}: {
  value: string
  onChange: (value: string) => void
  /** Present only for claims — shows the stance toggle. */
  stance?: TheoryStance
  onStanceChange: (stance: TheoryStance) => void
  placeholder: string
  isPending: boolean
  submitLabel: string
  submitIcon: ReactNode
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation("terminal")
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Opening to edit puts the caret after the existing text rather than at the start.
  useEffect(() => {
    const el = inputRef.current
    if (el) el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  // Grows with the text up to its max-h (then scrolls) — same approach as the new-theory thesis
  // box above. Reset to "auto" first so it shrinks back when text is removed or cleared.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <form
      className="flex items-end gap-1.5 rounded-lg border border-border bg-muted/40 p-1 transition-colors focus-within:border-brand-gold/50"
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      onSubmit={(e) => {
        e.preventDefault()
        const v = value.trim()
        if (!v || isPending) return
        onSubmit(v)
      }}
    >
      {stance && (
        <div role="radiogroup" aria-label={t("claimStance")} className="flex shrink-0 rounded-md bg-background p-0.5">
          {(["ASSERTS", "DENIES"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={stance === option}
              onClick={() => onStanceChange(option)}
              className={`h-6 rounded px-2 text-[10px] font-semibold tracking-[0.8px] uppercase transition-colors ${
                stance === option
                  ? option === "ASSERTS"
                    ? "bg-ok/15 text-ok"
                    : "bg-danger/15 text-danger"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option === "ASSERTS" ? t("asserts") : t("denies")}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter submits (Shift+Enter for a new line); skipped mid-IME-composition so confirming
          // a Korean/Japanese candidate doesn't submit half a word.
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            e.currentTarget.form?.requestSubmit()
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={1}
        autoFocus
        className="max-h-40 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1.5 py-1.5 text-xs leading-4 text-foreground outline-none wrap-break-word placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        disabled={isPending || !value.trim()}
        aria-label={submitLabel}
        title={submitLabel}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-gold text-brand-gold-foreground transition-colors hover:bg-brand-gold/85 disabled:opacity-40"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : submitIcon}
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label={t("cancel")}
        title={t("cancel")}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </form>
  )
}

// One claim/assumption/open question, with in-place edit and a confirm-before-delete — only for
// the theory's author (the API rejects anyone else; see assertAuthor in CaseTheorySvc).
// `lead` renders before the text (a claim's stance badge, or a bullet).
function TheoryItemRow({
  caseId,
  theoryId,
  kind,
  id,
  text,
  stance,
  lead,
  editable,
}: {
  caseId: string
  theoryId: string
  kind: TheoryItemKind
  id: string
  text: string
  stance?: TheoryStance
  lead: ReactNode
  editable: boolean
}) {
  const { t } = useTranslation("terminal")
  const update = useUpdateTheoryItemMutation(caseId, kind)
  const del = useDeleteTheoryItemMutation(caseId, kind)
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view")
  const [draft, setDraft] = useState(text)
  const [draftStance, setDraftStance] = useState<TheoryStance>(stance ?? "ASSERTS")

  if (mode === "edit") {
    return (
      <li className="flex flex-col gap-1.5 py-1">
        <TheoryInlineInput
          value={draft}
          onChange={setDraft}
          stance={kind === "claims" ? draftStance : undefined}
          onStanceChange={setDraftStance}
          placeholder={t("edit")}
          isPending={update.isPending}
          submitLabel={t("save")}
          submitIcon={<Check className="h-3.5 w-3.5" aria-hidden="true" />}
          onSubmit={(v) => {
            const body =
              kind === "claims" ? { statement: v, stance: draftStance } : kind === "assumptions" ? { statement: v } : { question: v }
            update.mutate({ theoryId, id, ...body }, { onSuccess: () => setMode("view") })
          }}
          onCancel={() => !update.isPending && setMode("view")}
        />
        <MutationError show={update.isError} />
      </li>
    )
  }

  return (
    <li className="group/item flex flex-col gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/50">
      <div className="flex items-start gap-2 text-[12px] leading-5 text-muted-foreground">
        {lead}
        <span className="min-w-0 flex-1 wrap-break-word">{text}</span>
        {editable && mode === "view" && (
          <span className="flex shrink-0 items-center -my-0.5 gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
            <button
              type="button"
              onClick={() => {
                setDraft(text)
                setDraftStance(stance ?? "ASSERTS")
                update.reset()
                setMode("edit")
              }}
              className={editIconBtnClass}
              aria-label={t("edit")}
              title={t("edit")}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setMode("confirmDelete")}
              className={dangerIconBtnClass}
              aria-label={t("delete")}
              title={t("delete")}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
      {mode === "confirmDelete" && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-danger/10 px-2.5 py-1.5">
          <p className="min-w-0 flex-1 text-[12px] text-foreground">{t("deleteTheoryItemConfirm")}</p>
          <button type="button" onClick={() => setMode("view")} disabled={del.isPending} className={ghostBtnClass}>
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => del.mutate({ theoryId, id }, { onSuccess: () => setMode("view") })}
            disabled={del.isPending}
            className="h-8 shrink-0 rounded-md bg-danger px-3 text-[10px] font-semibold uppercase tracking-[1px] text-white transition-colors hover:bg-danger/85 disabled:opacity-50"
          >
            {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : t("delete")}
          </button>
        </div>
      )}
      <MutationError show={del.isError} />
    </li>
  )
}

function TheoryDiffSection({ caseId, theoryAId, theoryBId }: { caseId: string; theoryAId: string; theoryBId: string }) {
  const { t } = useTranslation("terminal")
  const queryClient = useQueryClient()
  const { data: diff } = useTheoryDiffQuery(caseId, theoryAId, theoryBId)
  const generate = useGenerateTheoryDiffMutation(caseId)
  const job = useAiJobStatus(caseId, "theoryDiff")
  const isDiffing = generate.isPending || job.data?.status === "IN_PROGRESS"

  // theoryDiff's job status doesn't say which pair just finished — refetch this pair's cached
  // diff whenever the job completes rather than trying to thread the pair through the status.
  useEffect(() => {
    if (job.data?.status === "DONE") {
      queryClient.invalidateQueries({ queryKey: terminalKeys.theoryDiff(caseId, theoryAId, theoryBId) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.data?.status])

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => generate.mutate({ theoryAId, theoryBId })}
        disabled={isDiffing}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-semibold tracking-[1px] text-foreground uppercase transition-colors hover:bg-muted/70 dark:hover:bg-overlay-hover disabled:opacity-50"
      >
        {isDiffing ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Send className="h-3 w-3" aria-hidden="true" />}
        {diff ? t("regenerateDiff") : t("generateDiff")}
      </button>
      <MutationError show={generate.isError} />

      {diff && (
        <div className="mt-2 flex flex-col gap-2">
          {diff.result.sharedClaims.length > 0 && (
            <div>
              <SectionLabel>{t("sharedClaims")}</SectionLabel>
              <ul className="list-disc space-y-0.5 pl-4">
                {diff.result.sharedClaims.map((c, i) => (
                  <li key={i} className="text-[12px] leading-4 text-muted-foreground">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diff.result.divergentClaims.length > 0 && (
            <div>
              <SectionLabel>{t("divergentClaims")}</SectionLabel>
              <ul className="space-y-2">
                {diff.result.divergentClaims.map((d, i) => (
                  <li key={i} className="rounded-md border border-border px-2.5 py-2 text-[12px] leading-4">
                    <p>
                      <span className="font-semibold text-foreground">A: </span>
                      {d.claimA}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">B: </span>
                      {d.claimB}
                    </p>
                    {d.decidingEvidence && (
                      <p className="mt-1 text-muted-foreground">
                        <span className="font-semibold text-foreground">{t("decidingEvidence")}: </span>
                        {d.decidingEvidence}
                      </p>
                    )}
                    {d.missing && (
                      <p className="text-muted-foreground">
                        <span className="font-semibold text-foreground">{t("missingEvidence")}: </span>
                        {d.missing}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diff.result.sharedClaims.length === 0 && diff.result.divergentClaims.length === 0 && (
            <EmptyNote>{t("noDiffFound")}</EmptyNote>
          )}
        </div>
      )}
    </div>
  )
}
