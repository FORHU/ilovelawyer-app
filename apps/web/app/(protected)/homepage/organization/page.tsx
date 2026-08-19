"use client";

import { useState } from "react";
import { AlertCircle, Check, Loader2, Mail, Pencil, UserCircle2, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useAuthStore } from "@/lib/store/auth.store";
import { useOrganizationMembersQuery, type OrganizationRole } from "@/lib/organizations/queries";
import {
  useInviteMemberMutation,
  useLeaveOrganizationMutation,
  useChangeMemberRoleMutation,
  useUpdateOrganizationMutation,
} from "@/lib/organizations/mutations";

const ROLE_RANK: Record<OrganizationRole, number> = { OWNER: 4, ADMIN: 3, MANAGER: 2, MEMBER: 1 };
const INVITABLE_ROLES: OrganizationRole[] = ["MEMBER", "MANAGER", "ADMIN"];

function getInitials(value: string): string {
  const [first, second] = value.split(/[.\s_-]+/).filter(Boolean);
  if (!first) return "?";
  if (!second) return first.slice(0, 2).toUpperCase();
  return `${first[0]}${second[0]}`.toUpperCase();
}

export default function OrganizationPage() {
  const { t } = useTranslation("organization");
  const organization = useAuthStore((s) => s.organization);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const setOrganization = useAuthStore((s) => s.setOrganization);

  const membersQuery = useOrganizationMembersQuery(organization?.id ?? "");
  const inviteMutation = useInviteMemberMutation(organization?.id ?? "");
  const leaveMutation = useLeaveOrganizationMutation(organization?.id ?? "");
  const changeRoleMutation = useChangeMemberRoleMutation(organization?.id ?? "");
  const updateOrgMutation = useUpdateOrganizationMutation(organization?.id ?? "");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("MEMBER");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [showTransferPicker, setShowTransferPicker] = useState(false);
  const [successorId, setSuccessorId] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const canManageOrg = !!organization && ROLE_RANK[organization.role] >= ROLE_RANK.ADMIN;
  const canInvite = canManageOrg;
  const otherMembers = (membersQuery.data ?? []).filter((m) => m.userId !== currentUserId);
  const isOwner = organization?.role === "OWNER";
  const isTransferring = changeRoleMutation.isPending || leaveMutation.isPending;

  function handleStartEditName() {
    if (!organization) return;
    setNameError(null);
    setNameDraft(organization.name);
    setIsEditingName(true);
  }

  function handleCancelEditName() {
    setIsEditingName(false);
    setNameError(null);
  }

  function handleSaveName() {
    if (!organization) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError(t("overview.nameRequired"));
      return;
    }
    if (trimmed === organization.name) {
      setIsEditingName(false);
      return;
    }
    setNameError(null);
    updateOrgMutation.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          setOrganization({ ...organization, name: trimmed });
          setIsEditingName(false);
        },
        onError: (err) => setNameError((err as Error).message),
      },
    );
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;
    setInviteError(null);
    setInviteSuccess(false);
    inviteMutation.mutate(
      { email: inviteEmail, role: inviteRole },
      {
        onSuccess: () => {
          setInviteEmail("");
          setInviteSuccess(true);
        },
        onError: (err) => setInviteError((err as Error).message),
      },
    );
  }

  function handleLeaveClick() {
    if (!organization) return;
    if (isOwner && otherMembers.length > 0) {
      setLeaveError(null);
      setShowTransferPicker(true);
      return;
    }
    if (!window.confirm(t("overview.leaveConfirm"))) return;
    setLeaveError(null);
    leaveMutation.mutate(undefined, {
      onSuccess: () => setOrganization(null),
      onError: (err) => setLeaveError((err as Error).message),
    });
  }

  function handleConfirmTransferAndLeave() {
    if (!organization || !successorId) return;
    setLeaveError(null);
    changeRoleMutation.mutate(
      { userId: successorId, role: "OWNER" },
      {
        onSuccess: () => {
          leaveMutation.mutate(undefined, {
            onSuccess: () => setOrganization(null),
            onError: (err) =>
              setLeaveError(
                `${t("overview.transferSucceededLeaveFailed")} (${(err as Error).message})`,
              ),
          });
        },
        onError: (err) => setLeaveError((err as Error).message),
      },
    );
  }

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="organization" />

      <main className="max-w-[1000px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-10">
        <div className="w-full flex flex-col gap-2">
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">{t("subtitle")}</p>
        </div>

        {!organization ? (
          <section className="bg-card rounded-xl border border-border shadow-sm p-8 text-center text-muted-foreground">
            {t("noOrganization")}
          </section>
        ) : (
          <>
            {/* Overview */}
            <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 md:px-8 py-5 border-b border-border">
                <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">{t("overview.heading")}</h2>
              </div>
              <div className="flex flex-col divide-y divide-border">
                <div className="px-6 md:px-8 py-5 flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                    <Users className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                      {t("overview.nameLabel")}
                    </span>
                    {isEditingName ? (
                      <div className="mt-1 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveName();
                              if (e.key === "Escape") handleCancelEditName();
                            }}
                            autoFocus
                            maxLength={120}
                            disabled={updateOrgMutation.isPending}
                            className="flex-1 min-w-0 rounded-lg border border-border bg-card px-3 py-1.5 text-[16px] text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={handleSaveName}
                            disabled={updateOrgMutation.isPending}
                            aria-label={t("overview.saveName")}
                            className="cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updateOrgMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Check className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditName}
                            disabled={updateOrgMutation.isPending}
                            aria-label={t("overview.cancelName")}
                            className="cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        {nameError && <p className="text-[12px] text-red-600 dark:text-red-400">{nameError}</p>}
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-[16px] text-foreground truncate">{organization.name}</p>
                        {canManageOrg && (
                          <button
                            type="button"
                            onClick={handleStartEditName}
                            aria-label={t("overview.editName")}
                            className="cursor-pointer flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-6 md:px-8 py-5 flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                    <UserCircle2 className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                      {t("overview.yourRoleLabel")}
                    </span>
                    <p className="text-[16px] text-foreground mt-1">{organization.role}</p>
                  </div>
                </div>
              </div>
              <div className="px-6 md:px-8 py-5 border-t border-border flex flex-col gap-3">
                {!showTransferPicker ? (
                  <button
                    type="button"
                    onClick={handleLeaveClick}
                    disabled={leaveMutation.isPending}
                    className="cursor-pointer self-start rounded-lg border border-border px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 transition-colors hover:bg-red-600/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {leaveMutation.isPending ? t("overview.leaving") : t("overview.leaveButton")}
                  </button>
                ) : (
                  <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                    <p className="text-[13px] text-foreground">{t("overview.transferPrompt")}</p>
                    <select
                      value={successorId}
                      onChange={(e) => setSuccessorId(e.target.value)}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                    >
                      <option value="" disabled>
                        {t("overview.transferSelectPlaceholder")}
                      </option>
                      {otherMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {(m.user.name ?? m.user.username) + ` (${m.role})`}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleConfirmTransferAndLeave}
                        disabled={!successorId || isTransferring}
                        className="cursor-pointer rounded-lg bg-brand-navy-900 px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-brand-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isTransferring ? t("overview.leaving") : t("overview.transferConfirm")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTransferPicker(false);
                          setSuccessorId("");
                          setLeaveError(null);
                        }}
                        disabled={isTransferring}
                        className="cursor-pointer rounded-lg border border-border px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t("overview.transferCancel")}
                      </button>
                    </div>
                  </div>
                )}
                {leaveError && <p className="text-[12px] text-red-600 dark:text-red-400">{leaveError}</p>}
              </div>
            </section>

            {/* Members */}
            <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 md:px-8 py-5 border-b border-border">
                <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">{t("members.heading")}</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">{t("members.subheading")}</p>
              </div>

              {membersQuery.isLoading ? (
                <div className="px-6 md:px-8 py-8 flex items-center gap-2 text-muted-foreground text-[14px]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t("members.loading")}
                </div>
              ) : membersQuery.isError ? (
                <div className="px-6 md:px-8 py-8 flex items-center justify-between gap-4 text-[14px]">
                  <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    {t("members.error")}
                  </span>
                  <button
                    type="button"
                    onClick={() => membersQuery.refetch()}
                    className="cursor-pointer text-[12px] font-semibold uppercase tracking-wider text-primary hover:underline"
                  >
                    {t("members.retry")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {membersQuery.data?.map((member) => (
                    <div key={member.id} className="px-6 md:px-8 py-4 flex items-center gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary text-[12px] font-semibold">
                        {getInitials(member.user.name ?? member.user.username)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-foreground truncate">
                          {member.user.name ?? member.user.username}
                          {member.userId === currentUserId && (
                            <span className="ml-2 text-[11px] text-muted-foreground">({t("members.you")})</span>
                          )}
                        </p>
                        <p className="text-[13px] text-muted-foreground truncate">{member.user.email}</p>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-foreground/5 rounded-full px-3 py-1">
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Invite */}
            <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 md:px-8 py-5 border-b border-border">
                <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">{t("invite.heading")}</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">{t("invite.subheading")}</p>
              </div>

              {!canInvite ? (
                <div className="px-6 md:px-8 py-6 text-[14px] text-muted-foreground">{t("invite.onlyAdmins")}</div>
              ) : (
                <form onSubmit={handleInvite} className="px-6 md:px-8 py-6 flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                      {t("invite.emailLabel")}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder={t("invite.emailPlaceholder")}
                        required
                        className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                      {t("invite.roleLabel")}
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                    >
                      {INVITABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="submit"
                        disabled={inviteMutation.isPending}
                        className="cursor-pointer rounded-lg bg-brand-navy-900 px-6 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-brand-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {inviteMutation.isPending ? t("invite.sending") : t("invite.submit")}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Send an invitation email to this address</TooltipContent>
                  </Tooltip>
                </form>
              )}

              {inviteError && <p className="px-6 md:px-8 pb-6 text-[12px] text-red-600 dark:text-red-400">{inviteError}</p>}
              {inviteSuccess && !inviteError && (
                <p className="px-6 md:px-8 pb-6 text-[12px] text-emerald-600 dark:text-emerald-400">{t("invite.success")}</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
