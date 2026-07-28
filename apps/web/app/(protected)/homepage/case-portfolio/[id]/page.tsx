"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Briefcase, Loader2, AlertCircle, Pencil, Trash2 } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import EditCaseModal from "@/components/cases/edit-case-modal";
import DeleteCaseModal from "@/components/cases/delete-case-modal";
import { useCaseQuery, useUpdateCaseMutation, useDeleteCaseMutation, type UpdateCasePayload } from "@/lib/cases/mutations";

export default function CaseDetailPage() {
  const { t } = useTranslation("case-portfolio");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const { data: caseRecord, isLoading, isError, error } = useCaseQuery(id);
  const notFound = isError && error instanceof Error && error.message.toLowerCase().includes("not found");

  const { mutateAsync: updateCase, isPending: isUpdating } = useUpdateCaseMutation();
  const { mutateAsync: deleteCase, isPending: isDeleting } = useDeleteCaseMutation();

  const handleSaveEdit = async (payload: UpdateCasePayload) => {
    await updateCase({ id, payload });
    setIsEditing(false);
  };

  const handleConfirmDelete = async () => {
    await deleteCase(id);
    router.push("/homepage/case-portfolio");
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="case-portfolio" />

      <main className="max-w-4xl w-full mx-auto px-6 md:px-12 pt-20 pb-12 flex flex-col gap-8 flex-1">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/homepage/case-portfolio"
            className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t("detail.backToPortfolio")}
          </Link>

          {caseRecord && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                {t("Edit")}
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(true)}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 dark:hover:border-red-500/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {t("Delete")}
              </button>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("detail.loading")}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
            <p className="text-sm text-red-600">{notFound ? t("detail.notFound") : t("detail.loadError")}</p>
          </div>
        )}

        {caseRecord && (
          <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 md:px-8 py-5 border-b border-border bg-muted/60">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                <Briefcase className="h-4 w-4" aria-hidden="true" />
              </div>
              <h1 className="font-['Libre_Caslon_Text'] text-2xl text-foreground font-normal">
                {caseRecord.caseName}
              </h1>
            </div>

            <div className="px-6 md:px-8 py-6 flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {t("detail.party")}
                  </span>
                  <span className="text-sm text-foreground">
                    {caseRecord.partyInvolved || t("noPartyListed")}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {t("detail.created")}
                  </span>
                  <span className="text-sm text-foreground">
                    {new Date(caseRecord.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {t("detail.updated")}
                  </span>
                  <span className="text-sm text-foreground">
                    {new Date(caseRecord.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 border-t border-border pt-6">
                <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  {t("detail.notes")}
                </span>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {caseRecord.notes || t("detail.noNotes")}
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      {isEditing && caseRecord && (
        <EditCaseModal
          key={caseRecord.id}
          caseRecord={caseRecord}
          isSubmitting={isUpdating}
          onSubmit={handleSaveEdit}
          onClose={() => setIsEditing(false)}
        />
      )}

      {isDeleteConfirmOpen && caseRecord && (
        <DeleteCaseModal
          key={caseRecord.id}
          caseRecord={caseRecord}
          isDeleting={isDeleting}
          onConfirm={() => void handleConfirmDelete()}
          onClose={() => setIsDeleteConfirmOpen(false)}
        />
      )}
    </div>
  );
}
