"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import CustomSelect from "@/components/ui/custom-select";
import { CharCount } from "@/components/ui/char-count";
import { PARTY_NAME_MAX_LENGTH } from "@/lib/cases/limits";
import { useUpdateCaseMutation, type CaseRecord, type Party } from "@/lib/cases/mutations";
import { useCanEditCases } from "@/lib/cases/permissions";

// Same values the API validates against (PARTY_DESIGNATIONS) and the create/edit-case forms offer.
const DESIGNATION_OPTIONS = [
  { value: "Petitioner / Plaintiff", labelKey: "designations.petitionerPlaintiff" },
  { value: "Respondent / Defendant", labelKey: "designations.respondentDefendant" },
  { value: "Intervenor / Third-Party", labelKey: "designations.intervenorThirdParty" },
] as const;

const NEW_PARTY = "new";

/** The case Overview's Parties card: its header "Add party" action and a body listing the
 * parties with in-place add / edit / remove.
 * The API replaces a case's whole party list on every PATCH, so each save sends the full list —
 * carrying each party's descriptor along, which would otherwise be wiped. Read-only for a user
 * who can't edit the case (see canEditCases): no add, edit or remove controls. */
export function useOverviewParties(caseRecord: CaseRecord | undefined) {
  const { t } = useTranslation(["case-portfolio", "create-case"]);
  const update = useUpdateCaseMutation();
  const canEdit = useCanEditCases();
  // Which row is open in the editor: a party id, NEW_PARTY for the add form, or none.
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState<string>(DESIGNATION_OPTIONS[0].value);

  const parties = caseRecord?.parties ?? [];

  const designationLabel = (value: string) => {
    const option = DESIGNATION_OPTIONS.find((o) => o.value === value);
    return option ? t(option.labelKey, { ns: "create-case" }) : value;
  };

  const save = (next: Party[], onDone: () => void) => {
    if (!caseRecord) return;
    update.mutate(
      {
        id: caseRecord.id,
        payload: {
          parties: next.map((p) => ({
            name: p.name,
            designation: p.designation,
            ...(p.descriptor ? { descriptor: p.descriptor } : {}),
          })),
        },
      },
      { onSuccess: onDone },
    );
  };

  const openEditor = (party?: Party) => {
    update.reset();
    setConfirmRemove(null);
    setEditing(party?.id ?? NEW_PARTY);
    setName(party?.name ?? "");
    // A first party is usually the client's side; later ones default to the other side.
    setDesignation(party?.designation ?? (parties.length === 0 ? DESIGNATION_OPTIONS[0].value : DESIGNATION_OPTIONS[1].value));
  };

  const closeEditor = () => {
    if (update.isPending) return;
    setEditing(null);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || update.isPending) return;
    const next =
      editing === NEW_PARTY
        ? [...parties, { id: NEW_PARTY, name: trimmed, designation }]
        : parties.map((p) => (p.id === editing ? { ...p, name: trimmed, designation } : p));
    save(next, () => setEditing(null));
  };

  const remove = (id: string) => {
    save(
      parties.filter((p) => p.id !== id),
      () => setConfirmRemove(null),
    );
  };

  const editor = (
    <form
      className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => e.key === "Escape" && closeEditor()}
    >
      <input
        autoFocus
        value={name}
        maxLength={PARTY_NAME_MAX_LENGTH}
        aria-describedby="overview-party-name-count"
        onChange={(e) => setName(e.target.value)}
        placeholder={t("overview.partyNamePlaceholder")}
        aria-label={t("sectionParties.fullNameLabel", { ns: "create-case" })}
        disabled={update.isPending}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-base sm:text-sm outline-none transition-colors hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5"
      />
      <CharCount id="overview-party-name-count" length={name.length} max={PARTY_NAME_MAX_LENGTH} />
      <CustomSelect
        value={designation}
        onChange={setDesignation}
        options={DESIGNATION_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey, { ns: "create-case" }) }))}
        triggerTooltip={t("overview.partyDesignation")}
      />
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={closeEditor}
          disabled={update.isPending}
          className="px-3 py-1.5 rounded-full text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
        >
          {t("overview.cancel")}
        </button>
        <button
          type="submit"
          disabled={update.isPending || !name.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-gold text-brand-gold-foreground text-[10px] font-semibold tracking-[1.2px] uppercase hover:bg-brand-gold-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Check className="h-3 w-3" aria-hidden="true" />}
          {t("overview.saveParty")}
        </button>
      </div>
    </form>
  );

  const error = update.isError ? (
    <p role="alert" className="text-[12px] text-danger">
      {t("overview.partySaveError")}
    </p>
  ) : null;

  const addButton =
    canEdit && caseRecord && editing !== NEW_PARTY ? (
      <button
        type="button"
        onClick={() => openEditor()}
        className="inline-flex items-center gap-1.5 p-2 -m-2 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <Plus className="w-3 h-3" aria-hidden="true" />
        {t("overview.addParty")}
      </button>
    ) : undefined;

  // Past a handful of parties the list scrolls inside the card (scrollbar hidden) instead of
  // stretching the whole first row of Overview cards; the bottom fade says there's more below.
  // -mx-2/px-2 leave room for the rows' -mx-2 hover background, which overflow would clip.
  const scrolls = parties.length > 4;
  const body = (
    <div
      className={`-mx-2 flex max-h-72 flex-col gap-3 overflow-y-auto overscroll-contain px-2 scrollbar-none [-ms-overflow-style:none] ${
        scrolls ? "pb-6 mask-[linear-gradient(to_bottom,#000_calc(100%-24px),transparent)]" : ""
      }`}
    >
      {parties.length === 0 && editing !== NEW_PARTY && (
        <span className="text-sm text-muted-foreground">{t("noPartyListed")}</span>
      )}

      {parties.map((p) =>
        editing === p.id ? (
          <div key={p.id}>{editor}</div>
        ) : (
          <div key={p.id} className="flex flex-col gap-2">
            <div className="group/party -mx-2 flex items-start gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/40">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-medium text-foreground wrap-break-word">{p.name}</span>
                <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
                  {designationLabel(p.designation)}
                </span>
              </div>
              {/* Hover-revealed on pointer devices; always shown on touch, where there's no hover. */}
              {canEdit && (
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/party:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEditor(p)}
                    aria-label={t("overview.editParty", { name: p.name })}
                    title={t("overview.editParty", { name: p.name })}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      update.reset();
                      setEditing(null);
                      setConfirmRemove(p.id);
                    }}
                    aria-label={t("overview.removeParty", { name: p.name })}
                    title={t("overview.removeParty", { name: p.name })}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
            {confirmRemove === p.id && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-danger/10 px-3 py-2">
                <p className="min-w-0 flex-1 text-[12.5px] text-foreground">{t("overview.removePartyConfirm", { name: p.name })}</p>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(null)}
                  disabled={update.isPending}
                  className="px-3 py-1.5 rounded-full text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
                >
                  {t("overview.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  disabled={update.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full bg-danger px-3 py-1.5 text-[10px] font-semibold tracking-[1.2px] uppercase text-white hover:bg-danger/85 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {update.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                  {t("overview.remove")}
                </button>
              </div>
            )}
          </div>
        ),
      )}

      {editing === NEW_PARTY && editor}
      {error}
    </div>
  );

  return { addButton, body };
}
