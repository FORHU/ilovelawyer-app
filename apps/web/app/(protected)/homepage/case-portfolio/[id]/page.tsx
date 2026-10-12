"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, LayoutGrid, PanelsTopLeft, Scale, Loader2,
  FileText, Plus, Clock, MessageSquare, Pencil, Menu, ArchiveRestore, AlertCircle, Users, Lock, Eye, ArrowRight,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { CaseWorkspace } from "@/components/case-workspace/case-workspace";
import { useIsSharedWorkspace } from "@/lib/cases/shared";
import CustomSelect from "@/components/ui/custom-select";
import { KeyIssuesList } from "@/components/cases/key-issues-list";
import { useOverviewParties } from "@/components/cases/overview-parties";
import { useOverviewNotes } from "@/components/cases/case-notes-card";
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

const DAY_MS = 86_400_000;
// Deadlines have no "met" state yet, so only recent past ones read as overdue.
const OVERDUE_WINDOW_DAYS = 14;
// Rows shown in the Documents / Consultations previews before "View all".
const PREVIEW_COUNT = 5;
const ISSUES_PREVIEW = 6;

export default function CaseDetailPage() {
  const { t } = useTranslation(["case-portfolio", "common"]);
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;
  const toggleMobileMenu = useMobileNavStore((s) => s.toggle);
  const canEdit = useCanEditCase(id);
  const [sharing, setSharing] = useState(false);
  // Reading a case someone shared with this user: everything shows, read-only (the API refuses
  // any change, and canContribute hides the controls), and it can't be shared on.
  const sharedWithMe = useIsSharedWorkspace();

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
                      href={sharedWithMe ? "/homepage/case-portfolio?view=shared" : "/homepage/case-portfolio"}
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
                {caseRecord && !sharedWithMe && (
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
            {/* Share is a case-level action, not a status: it ends the tab row, past a divider
             * (icon-only below sm so the tabs keep their room). */}
            <div className="flex min-w-0 items-start gap-4 sm:gap-6">
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
            {caseRecord && !sharedWithMe && (
              <>
                <span className="mt-0.5 h-4 w-px shrink-0 bg-border" aria-hidden="true" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setSharing(true)}
                      aria-label={t("share.button")}
                      className="-mt-1 mb-2 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]"
                    >
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">{t("share.button")}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("share.buttonTooltip")}</TooltipContent>
                </Tooltip>
              </>
            )}
            </div>
          </div>
        </div>

        {activeTab === "overview" ? (
          <OverviewTab
            id={id}
            caseId={id}
            onOpenWorkspace={() => switchTab("workspace")}
            onOpenConsultation={(consultationId, promptNumber) => switchTab("workspace", consultationId, promptNumber)}
            sharedWithMe={sharedWithMe}
          />
        ) : (
          <div className="min-h-0 flex-1">
            <CaseWorkspace caseId={id} />
            {/* First visit to any case's Workspace: its tour, on the sample case. */}
            {!sharedWithMe && <SampleTourAutoStart track="studio" />}
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
  const [editing, setEditing] = useState(false);
  const options = [
    // Unset on an editable case doubles as the prompt: the findings have no side until it's set.
    { value: "", label: canEdit ? t("overview.clientSideSet") : t("overview.clientSideUnset") },
    { value: "CLAIMANT", label: t("overview.clientSideClaimant") },
    { value: "RESPONDENT", label: t("overview.clientSideRespondent") },
  ];
  // A set value reads as a plain fact (like Jurisdiction); the dropdown only shows while it's
  // unset or being changed.
  const showSelect = canEdit && (value === null || editing);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
        {t("overview.clientSide")}
      </span>
      {showSelect ? (
        <CustomSelect
          value={value ?? ""}
          onChange={(v) => {
            setEditing(false);
            updateCase({ id, payload: { clientSide: (v || null) as ClientSide | null } });
          }}
          options={options}
          triggerTooltip={t("overview.clientSideHint")}
          className={`w-64 ${isPending ? "pointer-events-none opacity-60" : ""}`}
        />
      ) : (
        <span className="flex min-h-[38px] items-center gap-1 text-[15px] font-medium text-foreground">
          {options.find((o) => o.value === (value ?? ""))?.label}
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              title={t("overview.clientSideHint")}
              aria-label={t("overview.clientSide")}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </span>
      )}
    </div>
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
  sharedWithMe,
}: {
  id: string;
  caseId: string;
  onOpenWorkspace: () => void;
  onOpenConsultation: (consultationId: string, promptNumber?: number) => void;
  /** A case shared with this user to view: documents are read there, not managed. */
  sharedWithMe: boolean;
}) {
  const { t } = useTranslation("case-portfolio");
  const { data: caseRecord } = useCaseQuery(id);
  const { data: snapshot, isLoading: isSnapshotLoading } = useCaseSnapshotQuery(id);
  const { data: documents, isLoading: isDocsLoading } = useCaseDocumentsQuery(id);
  const { data: consultations, isLoading: isConsultationsLoading } = useConsultationsQuery(id);
  // A view-only person on a confidential case can read its consultations but not start one.
  const canStartConsultation = useCanContributeToCase(id);
  const parties = useOverviewParties(caseRecord);
  const notes = useOverviewNotes(caseRecord);
  const [showAllIssues, setShowAllIssues] = useState(false);

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
  // Calendar dates plus the case's procedural deadlines. Deadlines carry no "met" state, so a
  // past one only counts as overdue for OVERDUE_WINDOW_DAYS; older ones sit under "Past".
  // ponytail: window heuristic until deadlines get a "mark as met" field (follow-up ticket).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dated = [
    ...(snapshot?.dates ?? []).map((d) => ({ id: d.id, title: d.title, dateTime: d.dateTime, type: d.type })),
    ...(snapshot?.procedure.deadlines ?? []).map((d) => ({
      id: d.id,
      title: d.label,
      dateTime: d.computedDueDate,
      type: t("overview.deadline"),
    })),
  ]
    .map((d) => {
      const due = new Date(d.dateTime);
      due.setHours(0, 0, 0, 0);
      return { ...d, days: Math.round((due.getTime() - today.getTime()) / DAY_MS) };
    })
    .filter((d) => !Number.isNaN(d.days))
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  const overdueDates = dated.filter((d) => d.days < 0 && d.days >= -OVERDUE_WINDOW_DAYS);
  const pastDates = dated.filter((d) => d.days < -OVERDUE_WINDOW_DAYS).reverse();
  const upcomingDates = dated.filter((d) => d.days >= 0).slice(0, 5);
  const shownDates = [...overdueDates, ...upcomingDates];

  const shownDocs = documents?.slice(0, PREVIEW_COUNT) ?? [];
  const shownConsultations = consultations?.slice(0, PREVIEW_COUNT) ?? [];

  const headerAction =
    "inline-flex items-center gap-1.5 p-2 -m-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer";

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 md:px-10 py-8">
      {/* Read order is the lawyer's: case frame, what's due, exposure, then working material.
          Rows 1-2 are cards; the last row is plain columns so it doesn't compete with them. */}
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 flex flex-wrap items-start gap-x-10 gap-y-4 border-b border-border pb-5">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
              {t("overview.jurisdiction")}
            </span>
            {/* min-h matches the "We act for" dropdown beside it so both rows share a baseline. */}
            <span className="flex min-h-[38px] items-center text-[15px] font-medium text-foreground">
              {ukJurisdiction ?? countryName}
              {ukJurisdiction && <span className="font-normal text-muted-foreground">, {countryName}</span>}
            </span>
            {court && <span className="text-[13px] text-muted-foreground">{court}</span>}
          </div>
          {caseRecord && <ClientSideSelect id={id} value={caseRecord.clientSide ?? null} />}
        </div>

        <Card title={t("overview.upcoming")} className="lg:col-span-2">
          {isSnapshotLoading ? (
            <LoadingRow />
          ) : shownDates.length > 0 || pastDates.length > 0 ? (
            <div className="flex flex-col gap-4">
              {shownDates.map((d) => (
                <DeadlineRow key={d.id} d={d} />
              ))}
              {shownDates.length === 0 && (
                <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {t("overview.noUpcoming")}
                </span>
              )}
              {pastDates.length > 0 && (
                <details className="border-t border-border pt-3">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                    {t("overview.pastDeadlines", { count: pastDates.length })}
                  </summary>
                  <div className="mt-4 flex flex-col gap-4 opacity-70">
                    {pastDates.map((d) => (
                      <DeadlineRow key={d.id} d={d} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {t("overview.noUpcoming")}
            </span>
          )}
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

        <Card title={t("overview.keyIssues")} className="lg:col-span-2">
          {isSnapshotLoading ? (
            <LoadingRow />
          ) : risks.length > 0 ? (
            <>
              <KeyIssuesList caseId={id} risks={showAllIssues ? risks : risks.slice(0, ISSUES_PREVIEW)} />
              <IssuesFooter total={risks.length} expanded={showAllIssues} onToggle={() => setShowAllIssues((v) => !v)} onOpenWorkspace={onOpenWorkspace} />
            </>
          ) : findings.length > 0 ? (
            <div className="flex flex-col gap-1">
              {(showAllIssues ? findings : findings.slice(0, ISSUES_PREVIEW)).map((f) => (
                <div key={f.id} className="flex items-start gap-2.5 py-1.5 text-[14px] leading-relaxed text-foreground">
                  <AlertCircle className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{f.label}</span>
                  <span className="mt-0.5 shrink-0 text-[9.5px] font-semibold tracking-[1px] uppercase text-muted-foreground">
                    {f.category === "WEAKNESS" ? t("overview.weakness") : t("overview.legalIssue")}
                  </span>
                </div>
              ))}
              <IssuesFooter total={findings.length} expanded={showAllIssues} onToggle={() => setShowAllIssues((v) => !v)} onOpenWorkspace={onOpenWorkspace} />
            </div>
          ) : (
            <span className="text-[13px] text-muted-foreground leading-relaxed">{t("overview.noIssues")}</span>
          )}
        </Card>

        <Card title={t("overview.parties")} headerRight={parties.addButton}>
          {parties.body}
        </Card>

        <Card
          plain
          title={`${t("overview.documents")}${documents ? ` · ${documents.length}` : ""}`}
          headerRight={
            <button type="button" onClick={onOpenWorkspace} className={headerAction}>
              {sharedWithMe ? <Eye className="w-3.5 h-3.5" aria-hidden="true" /> : <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}
              {sharedWithMe ? t("portfolioView.viewDocuments") : t("overview.manageDocuments")}
            </button>
          }
        >
          {isDocsLoading ? (
            <LoadingRow />
          ) : documents && documents.length > 0 ? (
            <>
              <div className="flex flex-col">
                {shownDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 py-2.5 border-t border-border first:border-t-0 text-[13px]">
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
              <ShowingFooter shown={shownDocs.length} total={documents.length} onViewAll={onOpenWorkspace} />
            </>
          ) : (
            <span className="block text-[13px] text-muted-foreground">{t("overview.noDocuments")}</span>
          )}
        </Card>

        <Card
          plain
          title={t("overview.consultations")}
          headerRight={
            canStartConsultation ? (
              // Opens the Case's draft Consultation in the Workspace (`?c=new`) — nothing is
              // saved until its first message.
              <button type="button" onClick={() => onOpenConsultation(DRAFT_CONSULTATION_PARAM)} className={headerAction}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {t("overview.newConsultation")}
              </button>
            ) : undefined
          }
        >
          {isConsultationsLoading ? (
            <LoadingRow />
          ) : consultations && consultations.length > 0 ? (
            <>
              <div className="flex flex-col gap-2">
                {shownConsultations.map((c: Consultation) => (
                  <ConsultationRow
                    key={c.id}
                    consultation={c}
                    fallbackTitle={t("overview.consultations")}
                    onOpen={(promptNumber) => onOpenConsultation(c.id, promptNumber)}
                  />
                ))}
              </div>
              <ShowingFooter shown={shownConsultations.length} total={consultations.length} onViewAll={onOpenWorkspace} />
            </>
          ) : (
            <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {t("overview.noConsultations")}
            </span>
          )}
        </Card>

        <Card plain title={t("overview.notes")} headerRight={notes.header}>
          {notes.body}
        </Card>
      </div>
    </div>
  );
}

/** One deadline / calendar date: day-month block, title, full date (with year) and a relative
 * label. Overdue gets an icon and weight as well as colour, so it isn't colour-only. */
function DeadlineRow({ d }: { d: { title: string; dateTime: string; type?: string | null; days: number } }) {
  const { t } = useTranslation("case-portfolio");
  const dt = new Date(d.dateTime);
  const overdue = d.days < 0;
  const relative =
    d.days === 0 ? t("overview.dueToday") : overdue ? t("overview.overdueBy", { count: -d.days }) : t("overview.dueIn", { count: d.days });
  return (
    <div className="flex gap-3.5 items-start">
      <div className="flex flex-col items-center w-9 shrink-0">
        <span className="font-['Libre_Caslon_Text'] text-lg leading-none text-foreground">
          {dt.toLocaleDateString(dateLocale(), { day: "2-digit" })}
        </span>
        <span className="text-[9.5px] font-semibold tracking-[1px] uppercase text-muted-foreground">
          {dt.toLocaleDateString(dateLocale(), { month: "short" })}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-[13.5px] leading-snug text-foreground">{d.title}</span>
        <span className="text-[11px] text-muted-foreground">
          {[d.type, dt.toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" })].filter(Boolean).join(" · ")}
        </span>
      </div>
      <span
        className={`shrink-0 inline-flex items-center gap-1 text-[12px] ${overdue ? "font-semibold text-red-500" : "text-muted-foreground"}`}
      >
        {overdue && <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />}
        {relative}
      </span>
    </div>
  );
}

/** Key Issues footer: "View all" expands the list in place; once everything is shown, a link
 * to the Workspace (where issues are managed) sits beside "Show less". */
function IssuesFooter({
  total,
  expanded,
  onToggle,
  onOpenWorkspace,
}: {
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onOpenWorkspace: () => void;
}) {
  const { t } = useTranslation("case-portfolio");
  const collapsible = total > ISSUES_PREVIEW;
  const allShown = !collapsible || expanded;
  const linkClass = "font-medium text-foreground hover:underline cursor-pointer";
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>{t("overview.showingOf", { shown: allShown ? total : ISSUES_PREVIEW, total })}</span>
      <div className="flex items-center gap-4">
        {collapsible && (
          <button type="button" onClick={onToggle} aria-expanded={expanded} className={linkClass}>
            {expanded ? t("overview.showLess") : t("overview.viewAll")}
          </button>
        )}
        {allShown && (
          <button type="button" onClick={onOpenWorkspace} className={linkClass}>
            {t("overview.openWorkspace")}
          </button>
        )}
      </div>
    </div>
  );
}

/** "Showing 5 of 12 · View all" — keeps the visible rows honest against the header total. */
function ShowingFooter({ shown, total, onViewAll }: { shown: number; total: number; onViewAll: () => void }) {
  const { t } = useTranslation("case-portfolio");
  if (total <= shown) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>{t("overview.showingOf", { shown, total })}</span>
      <button type="button" onClick={onViewAll} className="font-medium text-foreground hover:underline cursor-pointer">
        {t("overview.viewAll")}
      </button>
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
  plain,
  className,
  children,
}: {
  title: string;
  headerRight?: ReactNode;
  /** Unboxed: a top rule instead of a card, for secondary material. */
  plain?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`min-w-0 flex flex-col ${
        plain ? "border-t border-border pt-5" : "border border-border rounded-2xl bg-card overflow-hidden"
      } ${className ?? ""}`}
    >
      <div className={`flex items-center justify-between gap-3 ${plain ? "" : "px-5 pt-5"}`}>
        <h2 className="text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">{title}</h2>
        {headerRight}
      </div>
      <div className={plain ? "pt-3.5" : "px-5 pb-5 pt-3.5"}>{children}</div>
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
    <div className={`flex flex-col gap-2.5 motion-safe:animate-pulse ${className}`} aria-busy="true">
      <div className="h-3 w-3/4 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
    </div>
  );
}
