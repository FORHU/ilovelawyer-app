"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"
import { GitFork, Loader2, MessageSquareWarning, Send, Sparkles } from "lucide-react"
import { AnnotationThread } from "@/components/shared/annotation-thread"
import {
  terminalKeys,
  useAddTheoryAssumptionMutation,
  useAddTheoryClaimMutation,
  useAddTheoryOpenQuestionMutation,
  useAiJobStatus,
  useCreateTheoryMutation,
  useForkTheoryMutation,
  useGenerateTheoryDiffMutation,
  usePublishTheoryMutation,
  useProposeTheoryMutation,
  useRetireTheoryMutation,
  useTheoryDiffQuery,
} from "@/lib/terminal/mutations"
import type { CaseSnapshot, CaseTheory, TheoryStance } from "@/lib/terminal/types"
import { useAuthStore } from "@/lib/store/auth.store"
import { fieldClass, primaryBtnClass, PanelBody, SectionLabel, EmptyNote } from "@/components/terminal/terminal-panels"

const STATUS_BADGE_CLASS: Record<CaseTheory["status"], string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  RETIRED: "bg-red-500/15 text-red-300",
}

export function TheoriesPanel({ snapshot, caseId }: { snapshot: CaseSnapshot; caseId: string }) {
  const { t } = useTranslation("terminal")
  const userId = useAuthStore((s) => s.user?.id)
  const theories = snapshot.theories ?? []

  const create = useCreateTheoryMutation(caseId)
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState("")
  const [thesis, setThesis] = useState("")

  const proposeJob = useAiJobStatus(caseId, "caseTheoryPropose")
  const propose = useProposeTheoryMutation(caseId)
  const isProposing = propose.isPending || proposeJob.data?.status === "IN_PROGRESS"

  const [diffA, setDiffA] = useState("")
  const [diffB, setDiffB] = useState("")

  return (
    <PanelBody gap="4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t("theories")}</SectionLabel>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => propose.mutate()}
            disabled={isProposing}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-semibold tracking-[1px] text-foreground uppercase transition-colors hover:bg-muted/70 disabled:opacity-50"
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
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("theoryTitlePlaceholder")} className={fieldClass} />
          <textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            placeholder={t("theoryThesisPlaceholder")}
            rows={3}
            className={`resize-none py-1.5 ${fieldClass} h-auto`}
          />
          <button type="submit" disabled={create.isPending} className={`self-start ${primaryBtnClass}`}>
            {t("add")}
          </button>
        </form>
      )}

      {theories.length === 0 ? (
        <EmptyNote>{t("noTheories")}</EmptyNote>
      ) : (
        <ul className="space-y-3">
          {theories.map((theory) => (
            <TheoryCard key={theory.id} theory={theory} caseId={caseId} isMine={!!userId && theory.authorUserId === userId} />
          ))}
        </ul>
      )}

      {theories.length >= 2 && (
        <div className="rounded-md border border-border p-3">
          <SectionLabel>{t("diffTheories")}</SectionLabel>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={diffA} onChange={(e) => setDiffA(e.target.value)} className={`flex-1 ${fieldClass}`}>
              <option value="">{t("theoryA")}</option>
              {theories.map((th) => (
                <option key={th.id} value={th.id} disabled={th.id === diffB}>
                  {th.title}
                </option>
              ))}
            </select>
            <select value={diffB} onChange={(e) => setDiffB(e.target.value)} className={`flex-1 ${fieldClass}`}>
              <option value="">{t("theoryB")}</option>
              {theories.map((th) => (
                <option key={th.id} value={th.id} disabled={th.id === diffA}>
                  {th.title}
                </option>
              ))}
            </select>
          </div>
          {diffA && diffB && <TheoryDiffSection caseId={caseId} theoryAId={diffA} theoryBId={diffB} />}
        </div>
      )}
    </PanelBody>
  )
}

function TheoryCard({ theory, caseId, isMine }: { theory: CaseTheory; caseId: string; isMine: boolean }) {
  const { t } = useTranslation("terminal")
  const publish = usePublishTheoryMutation(caseId)
  const retire = useRetireTheoryMutation(caseId)
  const fork = useForkTheoryMutation(caseId)
  const addClaim = useAddTheoryClaimMutation(caseId)
  const addAssumption = useAddTheoryAssumptionMutation(caseId)
  const addOpenQuestion = useAddTheoryOpenQuestionMutation(caseId)

  const [claimStatement, setClaimStatement] = useState("")
  const [claimStance, setClaimStance] = useState<TheoryStance>("ASSERTS")
  const [assumptionText, setAssumptionText] = useState("")
  const [questionText, setQuestionText] = useState("")
  const [showAnnotations, setShowAnnotations] = useState(false)

  const isAiProposed = theory.authorUserId === null

  return (
    <li className="rounded-md border border-border px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="leading-5 font-medium text-foreground">{theory.title}</p>
          <p className="mt-1 text-[12px] leading-4 text-muted-foreground">{theory.thesis}</p>
        </div>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[1px] uppercase ${STATUS_BADGE_CLASS[theory.status]}`}
        >
          {theory.status}
        </span>
      </div>

      {isAiProposed && (
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-brand-gold uppercase">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {t("aiProposed")}
        </span>
      )}

      {theory.claims.length > 0 && (
        <div className="mt-2">
          <SectionLabel>{t("theoryClaims")}</SectionLabel>
          <ul className="space-y-1">
            {theory.claims.map((c) => (
              <li key={c.id} className="text-[12px] leading-4 text-muted-foreground">
                <span
                  className={`mr-1.5 rounded px-1 py-0.5 font-mono text-[9px] font-semibold uppercase ${c.stance === "ASSERTS" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-300"}`}
                >
                  {c.stance}
                </span>
                {c.statement}
              </li>
            ))}
          </ul>
        </div>
      )}

      {theory.assumptions.length > 0 && (
        <div className="mt-2">
          <SectionLabel>{t("theoryAssumptions")}</SectionLabel>
          <ul className="list-disc space-y-0.5 pl-4">
            {theory.assumptions.map((a) => (
              <li key={a.id} className="text-[12px] leading-4 text-muted-foreground">
                {a.statement}
              </li>
            ))}
          </ul>
        </div>
      )}

      {theory.openQuestions.length > 0 && (
        <div className="mt-2">
          <SectionLabel>{t("theoryOpenQuestions")}</SectionLabel>
          <ul className="list-disc space-y-0.5 pl-4">
            {theory.openQuestions.map((q) => (
              <li key={q.id} className="text-[12px] leading-4 text-muted-foreground">
                {q.question}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isMine && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              const v = claimStatement.trim()
              if (!v) return
              addClaim.mutate({ theoryId: theory.id, statement: v, stance: claimStance })
              setClaimStatement("")
            }}
          >
            <select value={claimStance} onChange={(e) => setClaimStance(e.target.value as TheoryStance)} className={fieldClass}>
              <option value="ASSERTS">{t("asserts")}</option>
              <option value="DENIES">{t("denies")}</option>
            </select>
            <input
              value={claimStatement}
              onChange={(e) => setClaimStatement(e.target.value)}
              placeholder={t("addClaimPlaceholder")}
              className={`flex-1 ${fieldClass}`}
            />
            <button type="submit" disabled={addClaim.isPending} className={primaryBtnClass}>
              {t("add")}
            </button>
          </form>
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              const v = assumptionText.trim()
              if (!v) return
              addAssumption.mutate({ theoryId: theory.id, statement: v })
              setAssumptionText("")
            }}
          >
            <input
              value={assumptionText}
              onChange={(e) => setAssumptionText(e.target.value)}
              placeholder={t("addAssumptionPlaceholder")}
              className={`flex-1 ${fieldClass}`}
            />
            <button type="submit" disabled={addAssumption.isPending} className={primaryBtnClass}>
              {t("add")}
            </button>
          </form>
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              const v = questionText.trim()
              if (!v) return
              addOpenQuestion.mutate({ theoryId: theory.id, question: v })
              setQuestionText("")
            }}
          >
            <input
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder={t("addOpenQuestionPlaceholder")}
              className={`flex-1 ${fieldClass}`}
            />
            <button type="submit" disabled={addOpenQuestion.isPending} className={primaryBtnClass}>
              {t("add")}
            </button>
          </form>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowAnnotations((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase transition-colors hover:border-foreground/20 hover:text-foreground"
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
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            {t("retire")}
          </button>
        )}
        {!isMine && (
          <button
            type="button"
            onClick={() => fork.mutate(theory.id)}
            disabled={fork.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            <GitFork className="h-3 w-3" aria-hidden="true" />
            {t("fork")}
          </button>
        )}
      </div>

      {showAnnotations && (
        <div className="mt-2.5 border-t border-border pt-2.5">
          <AnnotationThread caseId={caseId} targetType="NODE" targetId={theory.id} />
        </div>
      )}
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
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-semibold tracking-[1px] text-foreground uppercase transition-colors hover:bg-muted/70 disabled:opacity-50"
      >
        {isDiffing ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Send className="h-3 w-3" aria-hidden="true" />}
        {diff ? t("regenerateDiff") : t("generateDiff")}
      </button>

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
