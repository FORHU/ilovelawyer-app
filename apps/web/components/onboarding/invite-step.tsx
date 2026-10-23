"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useInviteMemberMutation } from "@/lib/organizations/mutations";
import { setupHeadingClass, setupPrimaryButtonClass, setupSecondaryButtonClass, setupSubtitleClass } from "@/components/onboarding/styles";
import { inviteInputClass, inviteLabelClass, inviteMailIconClass, inviteOptionClass, inviteSelectClass } from "@/components/organization/invite-styles";

type InviteRole = "MEMBER" | "ADMIN";
interface Row {
  key: number;
  email: string;
  role: InviteRole;
  /** Set once this address's invite went out, so a retry after a partial failure skips it. */
  sent: boolean;
  error: string | null;
}

/** Ten keeps this a quick form; more people can be invited from the Organization page. */
const MAX_ROWS = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Onboarding's invite step, for a firm's founder: several addresses at once, each a Member or an
 * Admin. They're the organization's ordinary invites (the same email, accepted on the Organization
 * page). Sent one after another; a failed address keeps its row with the reason, the rest go out.
 * The fields look like the Organization page's invite form (invite-styles.ts).
 */
export function InviteStep({ organizationId, firmName, onDone }: { organizationId: string; firmName: string; onDone: () => void }) {
  const { t } = useTranslation("onboarding");
  const invite = useInviteMemberMutation(organizationId);
  const [rows, setRows] = useState<Row[]>([{ key: 0, email: "", role: "MEMBER", sent: false, error: null }]);
  const [sending, setSending] = useState(false);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.email.trim() && !r.sent);

  async function send() {
    let failed = false;
    setSending(true);
    for (const row of filled) {
      const email = row.email.trim();
      if (!EMAIL.test(email)) {
        update(row.key, { error: t("invite.invalidEmail") });
        failed = true;
        continue;
      }
      try {
        await invite.mutateAsync({ email, role: row.role });
        update(row.key, { sent: true, error: null });
      } catch (err) {
        update(row.key, { error: (err as Error).message });
        failed = true;
      }
    }
    setSending(false);
    if (!failed) onDone();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className={setupHeadingClass}>{t("invite.title")}</h1>
        <p className={setupSubtitleClass}>{t("invite.subtitle", { firm: firmName })}</p>
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <li key={row.key} className="flex flex-col gap-1">
            {/* The labels show over the first row only, as column headings; the rest keep them for screen readers. */}
            <div className="flex items-end gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <label className={i === 0 ? inviteLabelClass : "sr-only"} htmlFor={`invite-email-${row.key}`}>
                  {t("invite.email")}
                </label>
                <div className="relative">
                  <Mail className={inviteMailIconClass} aria-hidden="true" />
                  <input
                    id={`invite-email-${row.key}`}
                    type="email"
                    autoComplete="off"
                    placeholder={t("invite.emailPlaceholder")}
                    value={row.email}
                    disabled={sending || row.sent}
                    onChange={(e) => update(row.key, { email: e.target.value, error: null })}
                    aria-invalid={!!row.error}
                    className={inviteInputClass}
                    autoFocus={i === 0}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className={i === 0 ? inviteLabelClass : "sr-only"} htmlFor={`invite-role-${row.key}`}>
                  {t("invite.role")}
                </label>
                <select
                  id={`invite-role-${row.key}`}
                  value={row.role}
                  disabled={sending || row.sent}
                  onChange={(e) => update(row.key, { role: e.target.value as InviteRole })}
                  className={inviteSelectClass}
                >
                  <option value="MEMBER" className={inviteOptionClass}>
                    {t("invite.roleMEMBER")}
                  </option>
                  <option value="ADMIN" className={inviteOptionClass}>
                    {t("invite.roleADMIN")}
                  </option>
                </select>
              </div>
              {row.sent ? (
                <span className="flex h-[42px] w-9 shrink-0 items-center justify-center text-emerald-600" aria-label={t("invite.sent")}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== row.key) : [{ ...rs[0]!, email: "", error: null }]))}
                      disabled={sending}
                      aria-label={t("invite.remove")}
                      className="flex h-[42px] w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("invite.remove")}</TooltipContent>
                </Tooltip>
              )}
            </div>
            {row.error && (
              <p className="text-xs text-red-600" role="alert">
                {row.error}
              </p>
            )}
          </li>
        ))}
      </ul>

      {rows.length < MAX_ROWS && (
        <button
          type="button"
          disabled={sending}
          onClick={() => setRows((rs) => [...rs, { key: Math.max(...rs.map((r) => r.key)) + 1, email: "", role: "MEMBER", sent: false, error: null }])}
          className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("invite.addAnother")}
        </button>
      )}

      <div className="flex flex-col gap-3">
        <button type="button" onClick={send} disabled={sending || filled.length === 0} className={setupPrimaryButtonClass}>
          {sending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
          {sending ? t("invite.sending") : t("invite.send")}
        </button>
        <button type="button" onClick={onDone} disabled={sending} className={setupSecondaryButtonClass}>
          {t("invite.skip")}
        </button>
      </div>
    </div>
  );
}
