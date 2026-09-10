"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, LayoutGrid, PanelsTopLeft, Scale, AlertCircle, Loader2,
  FileText, Plus, Clock, MessageSquare, Pencil, Menu,
} from "lucide-react";
import GlobalHeader from "@/components/global-header";
import { CaseWorkspace } from "@/components/case-workspace/case-workspace";
import { useCaseQuery, useCaseDocumentsQuery, useUpdateCaseMutation, type UserDocument } from "@/lib/cases/mutations";
import { useCaseSnapshotQuery } from "@/lib/terminal/mutations";
import type { SnapshotRisk } from "@/lib/terminal/types";
import { useConsultationsQuery, type Consultation } from "@/lib/chat/mutations";
import { useMobileNavStore } from "@/lib/store/mobile-nav.store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

type DetailTab = "overview" | "workspace";

export default function CaseDetailPage() {
  const { t } = useTranslation(["case-portfolio", "common"]);
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;
  const toggleMobileMenu = useMobileNavStore((s) => s.toggle);

  const activeTab: DetailTab = searchParams.get("tab") === "overview" ? "overview" : "workspace";

  const switchTab = (next: DetailTab) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (next === "workspace") nextParams.delete("tab");
    else nextParams.set("tab", next);
    const qs = nextParams.toString();
    router.push(`/homepage/case-portfolio/${id}${qs ? `?${qs}` : ""}`);
  };

  const { data: caseRecord } = useCaseQuery(id);
  const { data: snapshot } = useCaseSnapshotQuery(id);

  const filedLine = [
    snapshot?.case.actionType,
    snapshot?.case.jurisdiction,
    caseRecord ? t("overview.filed", { date: new Date(caseRecord.createdAt).toLocaleDateString() }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="landing-theme h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      <GlobalHeader activeTab="case-portfolio" mobileHeaderMerged />

      {/* No pt reservation below lg — GlobalHeader renders nothing there itself
       * (mobileHeaderMerged), so there's no bar to clear until it reappears at lg (now
       * h-16, per GlobalHeader's own redesigned height). */}
      <div className="lg:pt-16 flex flex-col min-h-0 flex-1">
        <div className="shrink-0 border-b border-border px-6 md:px-10 pt-4 flex flex-col gap-4">
          <Link
            href="/homepage/case-portfolio"
            aria-label={t("detail.backToPortfolio")}
            className="self-start flex items-center gap-2 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t("detail.backToPortfolio")}</span>
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6 pb-1">
            {/* Dot + meta sits above the title as its own small line (same eyebrow pattern the
             * list page uses above "Case Portfolio"), rather than inline beside it — a status
             * dot glued to a large serif heading, with an edit icon crowding the other end,
             * read as cluttered. This also gives the title its own full-width line to truncate
             * or wrap against, and the edit icon proper room to sit next to it. */}
            <div className="flex flex-col gap-1.5 min-w-0">
              {filedLine && (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-gold shrink-0" aria-hidden="true" />
                  {filedLine}
                </span>
              )}
              <div className="flex items-center justify-between gap-3">
                <EditableCaseTitle id={id} caseName={caseRecord?.caseName} />
                {/* Stands in for GlobalHeader's own hamburger (hidden here via
                 * mobileHeaderMerged) — opens the exact same drawer. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleMobileMenu}
                      className="lg:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
          <OverviewTab id={id} caseId={id} onOpenWorkspace={() => switchTab("workspace")} />
        ) : (
          <div className="min-h-0 flex-1">
            <CaseWorkspace caseId={id} />
          </div>
        )}
      </div>
    </div>
  );
}

function EditableCaseTitle({ id, caseName }: { id: string; caseName: string | undefined }) {
  const { t } = useTranslation("case-portfolio");
  const { mutate: updateCase, isPending } = useUpdateCaseMutation();
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
          <h1 className="font-['Libre_Caslon_Text'] text-base sm:text-2xl font-normal tracking-[-0.01em] text-foreground truncate">
            {caseName ?? "…"}
          </h1>
          <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-60 transition-opacity hover:bg-muted hover:text-foreground md:opacity-0 md:group-hover/title:opacity-100">
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{t("detail.editCaseTitle")}</TooltipContent>
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

function OverviewTab({ id, onOpenWorkspace }: { id: string; caseId: string; onOpenWorkspace: () => void }) {
  const { t } = useTranslation("case-portfolio");
  const { data: caseRecord } = useCaseQuery(id);
  const { data: snapshot, isLoading: isSnapshotLoading } = useCaseSnapshotQuery(id);
  const { data: documents, isLoading: isDocsLoading } = useCaseDocumentsQuery(id);
  const { data: consultations, isLoading: isConsultationsLoading } = useConsultationsQuery(id);

  const risks: SnapshotRisk[] = snapshot?.risks ?? [];
  const upcomingDates = [...(snapshot?.dates ?? [])]
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .slice(0, 5);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 md:px-10 py-8">
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card title={t("overview.parties")}>
              {caseRecord && caseRecord.parties.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {caseRecord.parties.map((p) => (
                    <div key={p.id} className="flex flex-col gap-0.5">
                      <span className="text-[15px] font-medium text-foreground">{p.name}</span>
                      <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">{p.designation}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">{t("noPartyListed")}</span>
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
          </div>

          <Card title={t("overview.keyIssues")}>
            {isSnapshotLoading ? (
              <LoadingRow />
            ) : risks.length > 0 ? (
              <div className="flex flex-col gap-3">
                {risks.slice(0, 6).map((risk) => (
                  <div key={risk.id} className="flex gap-2.5 items-start text-[14px] leading-relaxed text-foreground">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-brand-gold" aria-hidden="true" />
                    {risk.title}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[13px] text-muted-foreground leading-relaxed">{t("overview.noRisk")}</span>
            )}
          </Card>

          <Card
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
              <div className="flex flex-col">
                {documents.slice(0, 6).map((doc) => (
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
        </div>

        <div className="flex flex-col gap-6 min-w-0">
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
                          {dt.toLocaleDateString(undefined, { day: "2-digit" })}
                        </span>
                        <span className="text-[9.5px] font-semibold tracking-[1px] uppercase text-muted-foreground">
                          {dt.toLocaleDateString(undefined, { month: "short" })}
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
            title={`${t("overview.consultations")}${consultations ? ` · ${consultations.length}` : ""}`}
            headerRight={
              <button
                type="button"
                onClick={onOpenWorkspace}
                className="p-2 -m-2 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {t("overview.openWorkspace")}
              </button>
            }
          >
            {isConsultationsLoading ? (
              <LoadingRow />
            ) : consultations && consultations.length > 0 ? (
              <div className="flex flex-col gap-2">
                {consultations.slice(0, 5).map((c: Consultation) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={onOpenWorkspace}
                    className="flex flex-col gap-0.5 px-3 py-2.5 border border-border rounded-lg text-left hover:border-foreground/40 transition-colors cursor-pointer"
                  >
                    <span className="text-[13.5px] font-medium text-foreground truncate">
                      {c.title || t("overview.consultations")}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {t("overview.noConsultations")}
              </span>
            )}
          </Card>

          <Link
            href={`/homepage/terminal/${id}`}
            className="flex items-center justify-center gap-2.5 h-11 rounded-full border border-border text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground hover:border-brand-gold hover:text-brand-gold transition-colors"
          >
            <Scale className="w-3.5 h-3.5" aria-hidden="true" />
            {t("overview.openTerminal")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  headerRight,
  noPadding,
  children,
}: {
  title: string;
  headerRight?: ReactNode;
  noPadding?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="border border-border rounded-2xl bg-card overflow-hidden flex flex-col">
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
