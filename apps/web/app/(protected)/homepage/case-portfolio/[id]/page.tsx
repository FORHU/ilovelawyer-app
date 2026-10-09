"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, LayoutGrid, PanelsTopLeft, Scale, Loader2,
  FileText, Plus, Clock, MessageSquare, Pencil, Menu, ArchiveRestore, AlertCircle, Users, Lock,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { CaseWorkspace } from "@/components/case-workspace/case-workspace";
import { KeyIssuesList } from "@/components/cases/key-issues-list";
import { useOverviewParties } from "@/components/cases/overview-parties";
import {
  useCaseQuery,
  useCaseDocumentsQuery,
  useUpdateCaseMutation,
  useUnarchiveCaseMutation,
  useMarkCaseOpened,
  type ClientSide,
  type UserDocument,
} from "@/lib/cases/mutations";
import { useCaseSnapshotQuery } from "@/lib/terminal/mutations";
import type { SnapshotRisk } from "@/lib/terminal/types";
import { openFindings } from "@/lib/terminal/case-summary-view";
import { useConsultationsQuery, useMessagesQuery, type Consultation } from "@/lib/chat/mutations";
import { AUTO_AUDIO_OVERVIEW_PROMPT, AUTO_MINDMAP_PROMPT } from "@/lib/chat/auto-prompts";
import { DRAFT_CONSULTATION_PARAM } from "@/lib/chat/consultation-param";
import { useMobileNavStore } from "@/lib/store/mobile-nav.store";
import { useAuthStore } from "@/lib/store/auth.store";
import { useCanContributeToCase, useCanEditCase } from "@/lib/cases/permissions";
import { getTenantCodeConfig } from "@/config/tenant-codes";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { SampleTourAutoStart } from "@/components/sample-case/sample-tour-autostart";
import { dateLocale } from "@/lib/i18n/date-locale";
import { CaseOrigin, OpenOriginalButton } from "@/components/cases/case-origin";
import { CaseUnavailable, isCaseUnavailableError } from "@/components/cases/case-unavailable";
import { ShareCaseDialog } from "@/components/cases/share-case-dialog";

type DetailTab = "overview" | "workspace";

export default function CaseDetailPage() {
  const { t } = useTranslation(["case-portfolio", "common"]);
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;
  const toggleMobileMenu = useMobileNavStore((s) => s.toggle);
  const canEdit = useCanEditCase(id);
  const [sharing, setSharing] = useState(false);

  const activeTab: DetailTab = searchParams.get("tab") === "overview" ? "overview" : "workspace";

  // `consultationId` lands the workspace on that thread — CaseWorkspace reads the active one
  // off `?c=`, same param ConsultationChat/ThreadPicker navigate with — and `promptNumber`
  // (`?p=`) on one prompt within it rather than the bottom.
  const switchTab = (next: DetailTab, consultationId?: string, promptNumber?: number) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (next === "workspace") nextParams.delete("tab");
    else nextParams.set("tab", next);
    if (consultationId) nextParams.set("c", consultationId);
    if (promptNumber !== undefined) nextParams.set("p", String(promptNumber));
    else nextParams.delete("p");
    const qs = nextParams.toString();
    router.push(`/homepage/case-portfolio/${id}${qs ? `?${qs}` : ""}`);
  };

  const { data: caseRecord, error: caseError } = useCaseQuery(id);
  const { data: snapshot } = useCaseSnapshotQuery(id);
  useMarkCaseOpened(id);

  const filedLine = [
    snapshot?.case.actionType,
    snapshot?.case.jurisdiction,
    caseRecord ? t("overview.filed", { date: new Date(caseRecord.createdAt).toLocaleDateString(dateLocale()) }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (isCaseUnavailableError(caseError)) {
    return (
      <PageShell>
        <CaseUnavailable />
      </PageShell>
    );
  }

  return (
    <PageShell mobileHeaderMerged className="h-screen overflow-hidden">

      {/* No pt reservation below lg — GlobalHeader renders nothing there itself
       * (mobileHeaderMerged), so there's no bar to clear until it reappears at lg (now
       * h-16, per GlobalHeader's own redesigned height). */}
      <div className="lg:pt-16 flex flex-col min-h-0 flex-1">
        <div className="shrink-0 border-b border-border px-6 md:px-10 pt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6 pb-1">
            {/* Dot + meta sits above the title as its own small line (same eyebrow pattern the
             * list page uses above "Case Portfolio"), rather than inline beside it — a status
             * dot glued to a large serif heading, with an edit icon crowding the other end,
             * read as cluttered. This also gives the title its own full-width line to truncate
             * or wrap against, and the edit icon proper room to sit next to it. */}
            <div className="flex flex-col gap-1.5 min-w-0">
              {/* Back link leads the eyebrow line (same "← Cases" link Create Case uses) so the
               * title below keeps its flush-left edge instead of being pushed in by an icon. */}
              <div className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href="/homepage/case-portfolio"
                      className="-my-1 -ml-1 flex shrink-0 items-center gap-1.5 rounded-md px-1 py-1 text-[10px] font-semibold tracking-[1.2px] uppercase hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("nav.cases", { ns: "common" })}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>{t("detail.backToPortfolio")}</TooltipContent>
                </Tooltip>
                {filedLine && (
                  <>
                    <span className="h-3 w-px shrink-0 bg-border" aria-hidden="true" />
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-gold shrink-0" aria-hidden="true" />
                      <span className="truncate">{filedLine}</span>
                    </span>
                  </>
                )}
                {caseRecord && (
                  <>
                    <span className="hidden h-3 w-px shrink-0 bg-border sm:block" aria-hidden="true" />
                    <CaseOrigin caseRecord={caseRecord} className="hidden text-xs sm:inline-flex" />
                    <OpenOriginalButton caseRecord={caseRecord} />
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <EditableCaseTitle id={id} caseName={caseRecord?.caseName} />
                  {caseRecord?.confidential && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex shrink-0 items-center gap-1 text-[9.5px] font-semibold tracking-[1px] uppercase text-brand-gold border border-brand-gold/40 rounded-md px-1.5 py-0.5">
                          <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                          {t("confidentialBadge")}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{t("confidentialTooltip")}</TooltipContent>
                    </Tooltip>
                  )}
                  {caseRecord?.status === "ARCHIVED" && (
                    <>
                      <span className="shrink-0 text-[9.5px] font-semibold tracking-[1px] uppercase text-muted-foreground border border-border rounded-md px-1.5 py-0.5">
                        {t("archivedBadge")}
                      </span>
                      {canEdit && <UnarchiveButton id={id} caseName={caseRecord.caseName} />}
                    </>
                  )}
                  {caseRecord && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setSharing(true)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          <Users className="h-3 w-3" aria-hidden="true" />
                          {t("share.button")}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t("share.buttonTooltip")}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {/* Stands in for GlobalHeader's own hamburger (hidden here via
                 * mobileHeaderMerged) — opens the exact same drawer. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleMobileMenu}
                      className="lg:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted dark:hover:bg-overlay-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      aria-label={t("mobileMenu.open", { ns: "common" })}
                    >
                      <Menu className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("mobileMenu.open", { ns: "common" })}</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Horizontally scrollable (no visible scrollbar) instead of wrapping/shrinking —
             * three tabs at their normal size don't fit a 320px viewport otherwise. */}
            <nav className="flex gap-3.5 sm:gap-7 overflow-x-auto scrollbar-none text-[9.5px] sm:text-[10px] font-semibold tracking-[1px] sm:tracking-[1.2px] uppercase -mx-6 px-6 sm:mx-0 sm:px-0">
              <TabButton active={activeTab === "workspace"} onClick={() => switchTab("workspace")} icon={PanelsTopLeft}>
                {t("overview.tabWorkspace")}
              </TabButton>
              <TabButton active={activeTab === "overview"} onClick={() => switchTab("overview")} icon={LayoutGrid}>
                {t("overview.tabOverview")}
              </TabButton>
              <Link
                href={`/homepage/terminal/${id}`}
                className="pb-3 flex shrink-0 items-center gap-1.5 sm:gap-2 uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                <Scale className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                {t("overview.tabTerminal")}
              </Link>
            </nav>
          </div>
        </div>

        {activeTab === "overview" ? (
          <OverviewTab
            id={id}
            caseId={id}
            onOpenWorkspace={() => switchTab("workspace")}
            onOpenConsultation={(consultationId, promptNumber) => switchTab("workspace", consultationId, promptNumber)}
          />
        ) : (
          <div className="min-h-0 flex-1">
            <CaseWorkspace caseId={id} />
            {/* First visit to any case's Workspace: its tour, on the sample case. */}
            <SampleTourAutoStart track="studio" />
          </div>
        )}
      </div>
      {sharing && caseRecord && (
        <ShareCaseDialog caseId={id} caseName={caseRecord.caseName} onClose={() => setSharing(false)} />
      )}
    </PageShell>
  );
}

/** Which side the lawyer acts for. The findings (Weaknesses, Strengths, …) are written from it, and
 * the API regenerates them when it changes. */
function ClientSideSelect({ id, value }: { id: string; value: ClientSide | null }) {
  const { t } = useTranslation("case-portfolio");
  const { mutate: updateCase, isPending } = useUpdateCaseMutation();
  const canEdit = useCanEditCase(id);
  return (
    <label className="mt-4 flex flex-col gap-1 border-t border-border pt-3">
      <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
        {t("overview.clientSide")}
      </span>
      <select
        value={value ?? ""}
        disabled={isPending || !canEdit}
        onChange={(e) => updateCase({ id, payload: { clientSide: (e.target.value || null) as ClientSide | null } })}
        className="h-9 rounded-md border border-border bg-background px-2 text-[13px] text-foreground disabled:opacity-50"
      >
        <option value="">{t("overview.clientSideUnset")}</option>
        <option value="CLAIMANT">{t("overview.clientSideClaimant")}</option>
        <option value="RESPONDENT">{t("overview.clientSideRespondent")}</option>
      </select>
      <span className="text-[12px] text-muted-foreground">{t("overview.clientSideHint")}</span>
    </label>
  );
}

function EditableCaseTitle({ id, caseName }: { id: string; caseName: string | undefined }) {
  const { t } = useTranslation("case-portfolio");
  const { mutate: updateCase, isPending } = useUpdateCaseMutation();
  const canEdit = useCanEditCase(id);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEditing = () => {
    if (!caseName) return;
    setDraft(caseName);
    setIsEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    setIsEditing(false);
    if (!trimmed || trimmed === caseName) return;
    updateCase({ id, payload: { caseName: trimmed } });
  };

  const heading = (
    <h1 className="font-['Libre_Caslon_Text'] text-base sm:text-2xl font-normal tracking-[-0.01em] text-foreground truncate">
      {caseName ?? "…"}
    </h1>
  );

  if (!canEdit) return <div className="min-w-0">{heading}</div>;

  if (isEditing) {
    return (
      <input
        autoFocus
        value={draft}
        disabled={isPending}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setIsEditing(false);
          }
        }}
        aria-label={t("detail.editCaseTitle")}
        className="min-w-0 flex-1 bg-transparent border-b border-brand-gold outline-none font-['Libre_Caslon_Text'] text-base sm:text-2xl font-normal tracking-[-0.01em] text-foreground"
      />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={startEditing}
          className="group/title flex min-w-0 items-center gap-1 text-left cursor-text"
        >
          {heading}
          <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-60 transition-opacity hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground md:opacity-0 md:group-hover/title:opacity-100">
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{t("detail.editCaseTitle")}</TooltipContent>
    </Tooltip>
  );
}

function UnarchiveButton({ id, caseName }: { id: string; caseName: string }) {
  const { t } = useTranslation("case-portfolio");
  const { mutate: unarchiveCase, isPending } = useUnarchiveCaseMutation();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => unarchiveCase(id)}
          disabled={isPending}
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-muted dark:hover:bg-overlay-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label={t("unarchiveCase", { caseName })}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{isPending ? t("restoring") : t("unarchiveCase", { caseName })}</TooltipContent>
    </Tooltip>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative pb-3 flex shrink-0 items-center gap-1.5 sm:gap-2 uppercase font-semibold transition-colors cursor-pointer ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
      {children}
      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-gold" aria-hidden="true" />}
    </button>
  );
}

function riskLevelClasses(level: "HIGH" | "MEDIUM" | "LOW") {
  if (level === "HIGH") return "text-red-500 border-red-500/40";
  if (level === "MEDIUM") return "text-amber-500 border-amber-500/40";
  return "text-emerald-500 border-emerald-500/40";
}

function ragStatusLabel(t: (key: string) => string, status: UserDocument["ragStatus"]) {
  if (status === "PENDING") return t("detail.ragIndexing");
  if (status === "FAILED") return t("detail.ragFailed");
  return t("detail.ragReady");
}

function riskLevelLabel(t: (key: string) => string, level: "HIGH" | "MEDIUM" | "LOW") {
  if (level === "HIGH") return t("overview.riskLevelHigh");
  if (level === "MEDIUM") return t("overview.riskLevelMedium");
  return t("overview.riskLevelLow");
}

function OverviewTab({
  id,
  onOpenWorkspace,
  onOpenConsultation,
}: {
  id: string;
  caseId: string;
  onOpenWorkspace: () => void;
  onOpenConsultation: (consultationId: string, promptNumber?: number) => void;
}) {
  const { t } = useTranslation("case-portfolio");
  const { data: caseRecord } = useCaseQuery(id);
  const { data: snapshot, isLoading: isSnapshotLoading } = useCaseSnapshotQuery(id);
  const { data: documents, isLoading: isDocsLoading } = useCaseDocumentsQuery(id);
  const { data: consultations, isLoading: isConsultationsLoading } = useConsultationsQuery(id);
  // A view-only person on a confidential case can read its consultations but not start one.
  const canStartConsultation = useCanContributeToCase(id);
  const parties = useOverviewParties(caseRecord);

  const countryName = getTenantCodeConfig(useAuthStore((s) => s.organization?.tenantCode)).countryName;
  // UK cases store a sub-jurisdiction (England and Wales / Scotland / Northern Ireland); PH cases
  // have none, so the tenant's country stands in. The court/venue line only shows once the
  // snapshot actually carries one.
  const ukJurisdiction = caseRecord?.ukJurisdiction?.trim() || null;
  const court = snapshot?.case.jurisdiction?.trim() || null;

  const risks: SnapshotRisk[] = snapshot?.risks ?? [];
  // A case's analysis often lands only in Legal Issues / Weaknesses, never the risk register —
  // list those rather than claiming there's no analysis.
  const findings = snapshot && risks.length === 0 ? openFindings(snapshot) : [];
  // Calendar dates plus the case's procedural deadlines, today onward.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingDates = [
    ...(snapshot?.dates ?? []).map((d) => ({ id: d.id, title: d.title, dateTime: d.dateTime, type: d.type })),
    ...(snapshot?.procedure.deadlines ?? []).map((d) => ({
      id: d.id,
      title: d.label,
      dateTime: d.computedDueDate,
      type: t("overview.deadline"),
    })),
  ]
    .filter((d) => new Date(d.dateTime) >= today)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .slice(0, 5);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 md:px-10 py-8">
      {/* One grid (not two independent columns) so every row's cards share a height: the three
          summary cards, then each wide card paired with the narrow card beside it. */}
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={t("overview.parties")} headerRight={parties.addButton}>
          {parties.body}
          {caseRecord && <ClientSideSelect id={id} value={caseRecord.clientSide ?? null} />}
        </Card>

        <Card
          title={t("overview.risk")}
          headerRight={
            snapshot?.riskAnalysis ? (
              <span
                className={`text-[9.5px] font-semibold tracking-[1px] uppercase px-2 py-1 rounded-md border ${riskLevelClasses(snapshot.riskAnalysis.overall.level)}`}
              >
                {riskLevelLabel(t, snapshot.riskAnalysis.overall.level)} · {snapshot.riskAnalysis.overall.score}
              </span>
            ) : undefined
          }
        >
          {isSnapshotLoading ? (
            <LoadingRow />
          ) : snapshot?.riskAnalysis ? (
            <div className="flex flex-col gap-3">
              <RiskBar label={t("overview.riskOverall")} score={snapshot.riskAnalysis.overall.score} />
              <RiskBar label={t("overview.riskLiability")} score={snapshot.riskAnalysis.liability.score} />
            </div>
          ) : (
            <span className="text-[13px] text-muted-foreground leading-relaxed">{t("overview.noRisk")}</span>
          )}
        </Card>

        <Card title={t("overview.jurisdiction")}>
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-medium text-foreground">{ukJurisdiction ?? countryName}</span>
            {ukJurisdiction && (
              <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">{countryName}</span>
            )}
            {court && <span className="mt-1.5 text-[13px] text-muted-foreground">{court}</span>}
          </div>
        </Card>

        <Card title={t("overview.keyIssues")} className="lg:col-span-2">
          {isSnapshotLoading ? (
            <LoadingRow />
          ) : risks.length > 0 ? (
            <KeyIssuesList caseId={id} risks={risks.slice(0, 6)} />
          ) : findings.length > 0 ? (
            <div className="flex flex-col gap-1">
              {findings.slice(0, 6).map((f) => (
                <div key={f.id} className="flex items-start gap-2.5 py-1.5 text-[14px] leading-relaxed text-foreground">
                  <AlertCircle className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{f.label}</span>
                  <span className="mt-0.5 shrink-0 text-[9.5px] font-semibold tracking-[1px] uppercase text-muted-foreground">
                    {f.category === "WEAKNESS" ? t("overview.weakness") : t("overview.legalIssue")}
                  </span>
                </div>
              ))}
              {findings.length > 6 && (
                <span className="text-[12px] text-muted-foreground">{t("overview.moreIssues", { count: findings.length - 6 })}</span>
              )}
            </div>
          ) : (
            <span className="text-[13px] text-muted-foreground leading-relaxed">{t("overview.noRisk")}</span>
          )}
        </Card>

        <Card title={t("overview.upcoming")}>
          {isSnapshotLoading ? (
            <LoadingRow />
          ) : upcomingDates.length > 0 ? (
            <div className="flex flex-col gap-4">
              {upcomingDates.map((d) => {
                const dt = new Date(d.dateTime);
                return (
                  <div key={d.id} className="flex gap-3.5 items-start">
                    <div className="flex flex-col items-center w-9 shrink-0">
                      <span className="font-['Libre_Caslon_Text'] text-lg leading-none text-foreground">
                        {dt.toLocaleDateString(dateLocale(), { day: "2-digit" })}
                      </span>
                      <span className="text-[9.5px] font-semibold tracking-[1px] uppercase text-muted-foreground">
                        {dt.toLocaleDateString(dateLocale(), { month: "short" })}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[13.5px] leading-snug text-foreground">{d.title}</span>
                      {d.type && <span className="text-[11px] text-muted-foreground">{d.type}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {t("overview.noUpcoming")}
            </span>
          )}
        </Card>

        <Card
          className="lg:col-span-2"
          title={`${t("overview.documents")}${documents ? ` · ${documents.length}` : ""}`}
          headerRight={
            <button
              type="button"
              onClick={onOpenWorkspace}
              className="inline-flex items-center gap-1.5 p-2 -m-2 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" aria-hidden="true" />
              {t("overview.manageDocuments")}
            </button>
          }
          noPadding
        >
          {isDocsLoading ? (
            <LoadingRow className="px-5 py-4" />
          ) : documents && documents.length > 0 ? (
            // Was capped to the first 6 with no way to reach the rest, so the header's real
            // total (documents.length) never matched what was actually visible below it.
            // Scrolling the full list here (instead of paging it) keeps this a lightweight
            // preview card rather than turning it into a second document manager — "Manage in
            // Workspace" above is still where full management (delete, re-upload, etc.) lives.
            <div className="flex flex-col max-h-76 overflow-y-auto">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3 border-t border-border first:border-t-0 text-[13px]">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate">{doc.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : "—"}
                  </span>
                  <span className="text-[9.5px] font-semibold tracking-[1px] uppercase text-muted-foreground border border-border rounded-md px-1.5 py-0.5">
                    {ragStatusLabel(t, doc.ragStatus)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="block px-5 py-4 text-[13px] text-muted-foreground">{t("overview.noDocuments")}</span>
          )}
        </Card>

        <Card
          title={t("overview.consultations")}
          headerRight={
            <div className="flex items-center gap-4">
              {/* Opens the Case's draft Consultation in the Workspace (`?c=new`) — nothing is
               * saved until its first message. */}
              {canStartConsultation && (
              <button
                type="button"
                onClick={() => onOpenConsultation(DRAFT_CONSULTATION_PARAM)}
                className="p-2 -m-2 flex items-center gap-1 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                {t("overview.newConsultation")}
              </button>
              )}
              <button
                type="button"
                onClick={onOpenWorkspace}
                className="p-2 -m-2 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {t("overview.openWorkspace")}
              </button>
            </div>
          }
        >
          {isConsultationsLoading ? (
            <LoadingRow />
          ) : consultations && consultations.length > 0 ? (
            // Full list, scrolled — same reason as the Documents card: a `slice(0, 5)` cap left
            // the header's total (consultations.length) out of step with what was visible.
            <div className="flex flex-col gap-2 max-h-76 overflow-y-auto">
              {consultations.map((c: Consultation) => (
                <ConsultationRow
                  key={c.id}
                  consultation={c}
                  fallbackTitle={t("overview.consultations")}
                  onOpen={(promptNumber) => onOpenConsultation(c.id, promptNumber)}
                />
              ))}
            </div>
          ) : (
            <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {t("overview.noConsultations")}
            </span>
          )}
        </Card>
      </div>
    </div>
  );
}

/** One consultation plus every prompt asked in it — each prompt opens the chat scrolled to
 * that prompt (`promptNumber`), the title opens it at the latest reply as before. Prompts are
 * counted over the same visible list ConsultationChat renders (auto Mind Map / Audio Overview
 * turns dropped), so a prompt's number here is the same prompt there. */
function ConsultationRow({
  consultation,
  fallbackTitle,
  onOpen,
}: {
  consultation: Consultation;
  fallbackTitle: string;
  onOpen: (promptNumber?: number) => void;
}) {
  const { data: messages } = useMessagesQuery(consultation.id);
  const prompts = (messages ?? []).filter(
    (m) => m.role === "user" && m.content !== AUTO_MINDMAP_PROMPT && m.content !== AUTO_AUDIO_OVERVIEW_PROMPT,
  );

  return (
    <div className="flex flex-col border border-border rounded-lg">
      <button
        type="button"
        onClick={() => onOpen()}
        className="flex flex-col gap-0.5 px-3 py-2.5 text-left rounded-lg hover:bg-muted/40 transition-colors cursor-pointer"
      >
        <span className="text-[13.5px] font-medium text-foreground truncate">{consultation.title || fallbackTitle}</span>
        <span className="text-[11px] text-muted-foreground">{new Date(consultation.createdAt).toLocaleDateString(dateLocale())}</span>
      </button>
      {prompts.length > 0 && (
        <ul className="flex flex-col border-t border-border py-1">
          {prompts.map((m, promptNumber) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onOpen(promptNumber)}
                title={m.content}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{m.content.trim()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({
  title,
  headerRight,
  noPadding,
  className,
  children,
}: {
  title: string;
  headerRight?: ReactNode;
  noPadding?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`min-w-0 border border-border rounded-2xl bg-card overflow-hidden flex flex-col ${className ?? ""}`}>
      <div className={`flex items-center justify-between gap-3 ${noPadding ? "px-5 py-4 border-b border-border" : "px-5 pt-5"}`}>
        <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">{title}</span>
        {headerRight}
      </div>
      <div className={noPadding ? "" : "px-5 pb-5 pt-3.5"}>{children}</div>
    </section>
  );
}

function RiskBar({ label, score }: { label: string; score: number }) {
  const color = score >= 66 ? "bg-red-500" : score >= 33 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[12px]">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">{score}</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
    </div>
  );
}

function LoadingRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-muted-foreground text-xs ${className}`}>
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
    </div>
  );
}
