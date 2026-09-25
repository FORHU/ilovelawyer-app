import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FileText, Loader2, ShieldCheck, Sparkles, Trash2 } from "lucide-react"
import {
  useCreateFindingMutation,
  useDeleteFindingMutation,
  useJevCheckFindingMutation,
  useUpdateFindingMutation,
} from "@/lib/terminal/mutations"
import { useGraphViewQuery } from "@/lib/graph-view/mutations"
import type { CaseFinding, FindingTag, LegalIssueJevCheck } from "@/lib/terminal/types"
import {
  EmptyNote,
  JevCheck,
  JevFlag,
  JevNotChecked,
  MutationError,
  PanelBody,
  PanelRow,
  PanelRowList,
  TONE_STYLE,
  TagMixSummary,
  TonePill,
  dangerIconBtnClass,
  fieldClass,
  ghostBtnClass,
  labelTextClass,
  primaryBtnClass,
  type Tone,
} from "@/components/terminal/panel-kit"
import { cn } from "@workspace/ui/lib/utils"

type IssueTag = "CONTESTED" | "BRIEFING" | "OPEN" | "RESOLVED"
const ISSUE_TAGS: IssueTag[] = ["CONTESTED", "BRIEFING", "OPEN", "RESOLVED"]
const TAG_STYLE: Record<IssueTag | "UNRATED", { tone: Tone; label: string }> = {
  CONTESTED: { tone: "riskmed", label: "issueContested" },
  BRIEFING: { tone: "warn", label: "issueBriefing" },
  OPEN: { tone: "neutral", label: "issueOpen" },
  RESOLVED: { tone: "ok", label: "issueResolved" },
  // Issues saved before tags existed, or ones the model gave no status.
  UNRATED: { tone: "neutral", label: "issueUnrated" },
}
const tagOf = (f: CaseFinding): IssueTag | "UNRATED" =>
  f.tag && (ISSUE_TAGS as FindingTag[]).includes(f.tag) ? (f.tag as IssueTag) : "UNRATED"

// Resolved sinks to the bottom; otherwise the model's order (position), then newest first — the
// same order the API lists them in, which the graph-view projection doesn't keep.
function byPanelOrder(a: CaseFinding, b: CaseFinding) {
  const resolved = Number(a.tag === "RESOLVED") - Number(b.tag === "RESOLVED")
  if (resolved) return resolved
  if (a.position !== null && b.position !== null) return a.position - b.position
  if (a.position !== null) return -1
  if (b.position !== null) return 1
  return b.createdAt.localeCompare(a.createdAt)
}

// The one CaseFinding category the case graph tracks as its own node type (view_type=issues also
// carries CLAIM nodes) — reads the graph-view projection instead of slicing CaseSnapshot, unlike
// the other category panels, which stay snapshot-driven.
export function LegalIssuesPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const create = useCreateFindingMutation(caseId)
  const update = useUpdateFindingMutation(caseId)
  const del = useDeleteFindingMutation(caseId)
  const jevCheck = useJevCheckFindingMutation(caseId)
  const graphView = useGraphViewQuery(caseId, "issues")
  const [label, setLabel] = useState("")
  const [newTag, setNewTag] = useState<IssueTag | "">("")
  const [open, setOpen] = useState<string | null>(null)
  const [detail, setDetail] = useState("")

  const items = (graphView.data?.nodes ?? [])
    .filter((node) => node.type === "FINDING")
    .map((node) => node.data as unknown as CaseFinding)
    .sort(byPanelOrder)
  // Some rows Jev-checked and an AI row not means its call failed — say so on that row.
  const anyJev = items.some((f) => f.jev)
  const counts = new Map<IssueTag | "UNRATED", number>()
  items.forEach((f) => counts.set(tagOf(f), (counts.get(tagOf(f)) ?? 0) + 1))
  const resolved = counts.get("RESOLVED") ?? 0

  const toggle = (f: CaseFinding) => {
    setOpen(open === f.id ? null : f.id)
    setDetail(f.detail ?? "")
    jevCheck.reset()
  }
  const jevError = jevCheck.error as (Error & { status?: number }) | null

  return (
    <PanelBody gap="4">
      <p className="text-[13px] text-muted-foreground">{t("legalIssuesIntro")}</p>

      {items.length > 1 ? (
        <TagMixSummary
          ring={{ pct: Math.round((resolved / items.length) * 100), tone: "ok", title: t("issueResolvedCount", { done: resolved, total: items.length }) }}
          segments={[...ISSUE_TAGS, "UNRATED" as const].map((tag) => ({
            key: tag,
            label: t(TAG_STYLE[tag].label),
            count: counts.get(tag) ?? 0,
            tone: TAG_STYLE[tag].tone,
          }))}
        />
      ) : null}

      {/* Same shrink-0 wrapper as WitnessPanel: PanelRowList's <ul> is overflow-hidden. */}
      <div className="shrink-0">
        <PanelRowList empty={<EmptyNote>{t("noFindings")}</EmptyNote>}>
          {items.map((f) => {
            const tag = tagOf(f)
            const style = TAG_STYLE[tag]
            const jev = f.jev as unknown as LegalIssueJevCheck | null
            const isOpen = open === f.id
            const isAi = f.notes === "AI"
            const isResolved = tag === "RESOLVED"
            return (
              <PanelRow key={f.id} className="flex-col items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => toggle(f)}
                  aria-expanded={isOpen}
                  className={cn("flex w-full items-center justify-between gap-3 text-left", isResolved && "opacity-60")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                      {f.label}
                      {jev && jev.flags.length > 0 ? (
                        <JevFlag title={jev.flags.map((flag) => t(`issueJevFlag.${flag}`)).join(" · ")} />
                      ) : null}
                    </span>
                    {f.detail ? <span className={`mt-0.5 block ${labelTextClass}`}>{f.detail}</span> : null}
                  </span>
                  <TonePill tone={style.tone}>{t(style.label)}</TonePill>
                </button>

                {isOpen ? (
                  <div className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2 text-[12px] text-foreground">
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("issueStatus")}>
                      {ISSUE_TAGS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => update.mutate({ id: f.id, tag: option === f.tag ? null : option })}
                          disabled={update.isPending}
                          aria-pressed={option === f.tag}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[1.2px] transition-colors disabled:opacity-50",
                            option !== f.tag
                              ? "border-border text-muted-foreground hover:text-foreground"
                              : TAG_STYLE[option].tone === "neutral"
                                ? // The neutral pill's bg-muted would vanish on this bg-muted box.
                                  "border-foreground/30 bg-background text-foreground"
                                : TONE_STYLE[TAG_STYLE[option].tone].badge,
                          )}
                        >
                          {t(TAG_STYLE[option].label)}
                        </button>
                      ))}
                    </div>

                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        update.mutate({ id: f.id, detail: detail.trim() || null })
                      }}
                    >
                      <input
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                        placeholder={t("issueDetailPlaceholder")}
                        aria-label={t("issueDetailPlaceholder")}
                        className={`flex-1 ${fieldClass}`}
                      />
                      <button
                        type="submit"
                        disabled={update.isPending || detail.trim() === (f.detail ?? "")}
                        className={ghostBtnClass}
                      >
                        {t("save")}
                      </button>
                    </form>

                    {isAi || f.sourceLabel ? (
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {isAi ? (
                          <span className="inline-flex items-center gap-1 font-semibold tracking-[1px] text-brand-gold uppercase">
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                            {t("aiGenerated")}
                          </span>
                        ) : null}
                        {f.sourceLabel ? (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate" title={f.sourceLabel}>
                              {t("groundedIn", { doc: f.sourceLabel })}
                            </span>
                          </span>
                        ) : null}
                      </p>
                    ) : null}

                    {jev ? (
                      <JevCheck
                        verdict={t(`issueJevContested.${jev.contested}`)}
                        confidence={jev.contestedConfidence}
                        uncertain={jev.uncertain}
                        modelRating={
                          f.modelTag && f.modelTag !== f.tag
                            ? t("issueJevModelRating", { tag: t(TAG_STYLE[f.modelTag as IssueTag]?.label ?? "issueUnrated") })
                            : null
                        }
                      >
                        <p>
                          {t("issueJevRaisedLine", {
                            verdict: t(`issueJevRaised.${jev.raised}`),
                            pct: Math.round(jev.raisedConfidence * 100),
                          })}
                        </p>
                        <p>
                          {t("issueJevBurdenLine", {
                            party: t(`issueJevBurden.${jev.burden}`),
                            pct: Math.round(jev.burdenConfidence * 100),
                          })}
                          {jev.flags.includes("BURDEN_DISPUTED") && jev.modelBurden ? (
                            <span className="text-warn">
                              {" "}
                              {t("issueJevBurdenDisputed", { party: t(`issueJevBurden.${jev.modelBurden}`) })}
                            </span>
                          ) : null}
                        </p>
                      </JevCheck>
                    ) : anyJev && isAi ? (
                      <JevNotChecked />
                    ) : null}

                    <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                      {/* Lawyer-entered issues get Jev's read on request; AI ones were read when generated. */}
                      {!isAi ? (
                        <button
                          type="button"
                          onClick={() => jevCheck.mutate(f.id)}
                          disabled={jevCheck.isPending}
                          className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
                        >
                          {jevCheck.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          ) : (
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          )}
                          {jevCheck.isPending ? t("issueJevChecking") : t("issueJevCheck")}
                        </button>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        onClick={() => del.mutate(f.id)}
                        disabled={del.isPending}
                        className={dangerIconBtnClass}
                        aria-label={t("delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <MutationError show={jevCheck.isError}>
                      {jevError?.status === 409 ? t("issueJevOff") : t("issueJevFailed")}
                    </MutationError>
                  </div>
                ) : null}
              </PanelRow>
            )
          })}
        </PanelRowList>
      </div>

      <form
        className="mt-auto flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const value = label.trim()
          if (!value) return
          create.mutate({ category: "LEGAL_ISSUE", label: value, tag: newTag || null })
          setLabel("")
          setNewTag("")
        }}
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("addLegalIssue")}
          aria-label={t("addLegalIssue")}
          className={`min-w-0 flex-1 ${fieldClass}`}
        />
        <select
          value={newTag}
          onChange={(e) => setNewTag(e.target.value as IssueTag | "")}
          aria-label={t("issueStatus")}
          className={`w-28 shrink-0 ${fieldClass}`}
        >
          <option value="">{t("issueStatus")}</option>
          {ISSUE_TAGS.map((option) => (
            <option key={option} value={option}>
              {t(TAG_STYLE[option].label)}
            </option>
          ))}
        </select>
        <button type="submit" disabled={create.isPending} className={primaryBtnClass}>
          {t("add")}
        </button>
      </form>
      <MutationError show={create.isError || update.isError || del.isError} />
    </PanelBody>
  )
}
