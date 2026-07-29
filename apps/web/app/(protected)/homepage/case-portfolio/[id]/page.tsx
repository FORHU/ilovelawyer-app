"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import ConsultationChat from "@/components/chat/consultation-chat";
import CaseDetailsPanel from "@/components/cases/case-details-panel";
import { useCaseQuery } from "@/lib/cases/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export default function CaseDetailPage() {
  const { t } = useTranslation("case-portfolio");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Only used here for the empty-state heading (the case name) — CaseDetailsPanel below
  // fetches the same query independently, so this is a cache hit, not a duplicate request.
  const { data: caseRecord } = useCaseQuery(id);

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      <GlobalHeader activeTab="case-portfolio" />
      <ConsultationChat
        basePath={`/homepage/case-portfolio/${id}`}
        caseId={id}
        emptyStateHeading={caseRecord ? t("chat.emptyHeading", { caseName: caseRecord.caseName }) : undefined}
        emptyStateSubheading={t("chat.emptySubheading")}
        headerSlot={
          // Back link pinned left, case chip pinned right, one hairline underneath —
          // a single compact header row instead of a stacked block competing with the
          // chat input's own card below it.
          <div className="flex items-center justify-between gap-4 pb-4 mb-2 border-b border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/homepage/case-portfolio"
                  className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("detail.backToPortfolio")}
                </Link>
              </TooltipTrigger>
              <TooltipContent>Return to your case portfolio list</TooltipContent>
            </Tooltip>
            <CaseDetailsPanel caseId={id} />
          </div>
        }
      />
    </div>
  );
}
