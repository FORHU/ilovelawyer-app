"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  Loader2,
  Mail,
  Pencil,
  UserCircle2,
  UserX,
  Users,
  Users2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  useOrganizationMembersQuery,
  useMyInviteQuery,
  PACKAGE_SKUS,
  type OrganizationRole,
  type PackageSku,
} from "@/lib/organizations/queries";
import {
  useCreateOrganizationMutation,
  useInviteMemberMutation,
  useLeaveOrganizationMutation,
  useChangeMemberRoleMutation,
  useRemoveMemberMutation,
  useUpdateOrganizationMutation,
  useAcceptInviteMutation,
  useDeclineInviteMutation,
} from "@/lib/organizations/mutations";

const ROLE_RANK: Record<OrganizationRole, number> = { OWNER: 4, ADMIN: 3, MANAGER: 2, MEMBER: 1 };
const INVITABLE_ROLES: OrganizationRole[] = ["MEMBER", "MANAGER", "ADMIN"];
// OWNER is deliberately excluded — ownership only ever moves via the "Make Owner & Leave"
// transfer flow above, never as a quick role-swap on an otherwise-active member.
const GRANTABLE_ROLES: OrganizationRole[] = ["ADMIN", "MANAGER", "MEMBER"];
const PLAN_ICONS: Record<PackageSku, typeof UserCircle2> = {
  SOLO: UserCircle2,
  PROFESSIONAL: Users2,
  ENTERPRISE: Briefcase,
};

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
  // Separate instance from changeRoleMutation (used by the transfer-ownership-and-leave
  // flow above) so editing a row here doesn't also flip that flow's isTransferring state.
  const memberRoleMutation = useChangeMemberRoleMutation(organization?.id ?? "");
  const removeMemberMutation = useRemoveMemberMutation(organization?.id ?? "");
  const updateOrgMutation = useUpdateOrganizationMutation(organization?.id ?? "");
  const myInviteQuery = useMyInviteQuery({ enabled: !organization });
  const acceptInviteMutation = useAcceptInviteMutation();
  const declineInviteMutation = useDeclineInviteMutation();
  const createOrgMutation = useCreateOrganizationMutation();
  const [inviteActionError, setInviteActionError] = useState<string | null>(null);

  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgPlan, setNewOrgPlan] = useState<PackageSku | null>(null);
  const [createOrgError, setCreateOrgError] = useState<string | null>(null);

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
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [roleChangeError, setRoleChangeError] = useState<{ userId: string; message: string } | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    userId: string;
    fromRole: OrganizationRole;
    toRole: OrganizationRole;
    memberName: string;
  } | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{ userId: string; memberName: string } | null>(null);
  const [removeError, setRemoveError] = useState<{ userId: string; message: string } | null>(null);

  const canManageOrg = !!organization && ROLE_RANK[organization.role] >= ROLE_RANK.ADMIN;
  const canInvite = canManageOrg;
  const otherMembers = (membersQuery.data ?? []).filter(
    (m) => m.userId !== currentUserId && m.status === "ACCEPTED",
  );
  const isOwner = organization?.role === "OWNER";
  const isTransferring = changeRoleMutation.isPending || leaveMutation.isPending;
  const acceptedOwnerCount = (membersQuery.data ?? []).filter(
    (m) => m.role === "OWNER" && m.status === "ACCEPTED",
  ).length;
  // Nobody can select OWNER here — see GRANTABLE_ROLES. An OWNER row only appears in this
  // list at all for the (legacy/edge-case) member who is already an OWNER, so their current
  // value still renders correctly; it lets another owner demote them, never promote into it.
  function roleOptionsFor(currentRole: OrganizationRole): OrganizationRole[] {
    return currentRole === "OWNER" ? ["OWNER", ...GRANTABLE_ROLES] : GRANTABLE_ROLES;
  }

  function canEditMemberRole(member: { userId: string; role: OrganizationRole; status: string }): boolean {
    if (!canManageOrg || member.userId === currentUserId || member.status !== "ACCEPTED") return false;
    if (member.role === "OWNER" && (!isOwner || acceptedOwnerCount <= 1)) return false;
    return true;
  }

  // Mirrors the backend's removeMember authorization: an ADMIN may remove a MANAGER/MEMBER,
  // but only an OWNER may remove an ADMIN or another OWNER, and the last OWNER can't be removed.
  function canRemoveMember(member: { userId: string; role: OrganizationRole; status: string }): boolean {
    if (!canManageOrg || member.userId === currentUserId || member.status !== "ACCEPTED") return false;
    if (member.role === "OWNER" && (!isOwner || acceptedOwnerCount <= 1)) return false;
    if (member.role === "ADMIN" && !isOwner) return false;
    return true;
  }

  function applyMemberRoleChange(userId: string, role: OrganizationRole) {
    setRoleChangeError(null);
    setUpdatingRoleUserId(userId);
    memberRoleMutation.mutate(
      { userId, role },
      {
        onError: (err) => setRoleChangeError({ userId, message: (err as Error).message }),
        onSettled: () => setUpdatingRoleUserId(null),
      },
    );
  }

  function handleChangeMemberRole(userId: string, currentRole: OrganizationRole, nextRole: OrganizationRole, memberName: string) {
    if (ROLE_RANK[nextRole] < ROLE_RANK[currentRole]) {
      setPendingRoleChange({ userId, fromRole: currentRole, toRole: nextRole, memberName });
      return;
    }
    applyMemberRoleChange(userId, nextRole);
  }

  function confirmPendingRoleChange() {
    if (!pendingRoleChange) return;
    applyMemberRoleChange(pendingRoleChange.userId, pendingRoleChange.toRole);
    setPendingRoleChange(null);
  }

  function handleRemoveMemberClick(userId: string, memberName: string) {
    setRemoveError(null);
    setPendingRemoval({ userId, memberName });
  }

  function confirmPendingRemoval() {
    if (!pendingRemoval) return;
    const { userId } = pendingRemoval;
    setRemoveError(null);
    removeMemberMutation.mutate(userId, {
      onError: (err) => setRemoveError({ userId, message: (err as Error).message }),
    });
    setPendingRemoval(null);
  }

  useEffect(() => {
    if (!pendingRoleChange && !pendingRemoval) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPendingRoleChange(null);
        setPendingRemoval(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingRoleChange, pendingRemoval]);

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

  function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newOrgName.trim();
    if (!trimmed) {
      setCreateOrgError(t("create.nameRequired"));
      return;
    }
    setCreateOrgError(null);
    createOrgMutation.mutate(
      { name: trimmed, packageSku: newOrgPlan ?? undefined },
      {
        onSuccess: (org) => {
          setOrganization({ id: org.id, name: org.name, slug: org.slug, role: "OWNER", packageSku: org.packageSku });
          setNewOrgName("");
          setNewOrgPlan(null);
        },
        onError: (err) => setCreateOrgError((err as Error).message),
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

  function handleAcceptInvite() {
    if (!myInviteQuery.data) return;
    const invite = myInviteQuery.data;
    setInviteActionError(null);
    acceptInviteMutation.mutate(invite.organizationId, {
      onSuccess: () => {
        setOrganization({
          id: invite.organization.id,
          name: invite.organization.name,
          slug: invite.organization.slug,
          role: invite.role,
          packageSku: invite.organization.packageSku,
        });
      },
      onError: (err) => setInviteActionError((err as Error).message),
    });
  }

  function handleDeclineInvite() {
    if (!myInviteQuery.data) return;
    if (!window.confirm(t("invite.declineConfirm"))) return;
    setInviteActionError(null);
    declineInviteMutation.mutate(myInviteQuery.data.organizationId, {
      onError: (err) => setInviteActionError((err as Error).message),
    });
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
          myInviteQuery.data ? (
            <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/[0.06]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent" aria-hidden="true" />
              <div
                className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand-gold/10 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative px-6 md:px-8 py-8 md:py-10 flex flex-col items-center gap-3 text-center border-b border-border">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 text-amber-600 ring-1 ring-brand-gold/30 dark:text-brand-gold">
                  <Mail className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">{t("invite.pendingHeading")}</h2>
                <p className="text-[14px] text-muted-foreground max-w-[440px] leading-relaxed">
                  {t("invite.pendingPrompt", { orgName: myInviteQuery.data.organization.name })}
                </p>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-foreground/5 rounded-full px-3 py-1">
                  {myInviteQuery.data.role}
                </span>
              </div>

              <div className="relative px-6 md:px-8 py-6 flex flex-col items-center gap-4">
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleAcceptInvite}
                    disabled={acceptInviteMutation.isPending || declineInviteMutation.isPending}
                    className="cursor-pointer rounded-lg bg-brand-gold px-6 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-brand-navy-950 shadow-sm shadow-brand-gold/30 transition-colors hover:bg-brand-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {acceptInviteMutation.isPending ? t("invite.accepting") : t("invite.accept")}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeclineInvite}
                    disabled={acceptInviteMutation.isPending || declineInviteMutation.isPending}
                    className="cursor-pointer rounded-lg border border-border px-6 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {declineInviteMutation.isPending ? t("invite.declining") : t("invite.decline")}
                  </button>
                </div>
                {inviteActionError && <p className="text-[12px] text-red-600 dark:text-red-400 text-center">{inviteActionError}</p>}
              </div>
            </section>
          ) : (
            <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/[0.06]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent" aria-hidden="true" />
              <div
                className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand-gold/10 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative px-6 md:px-8 py-8 md:py-10 flex flex-col items-center gap-3 text-center border-b border-border">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 text-amber-600 ring-1 ring-brand-gold/30 dark:text-brand-gold">
                  <Building2 className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">{t("create.heading")}</h2>
                <p className="text-[14px] text-muted-foreground max-w-[440px] leading-relaxed">{t("create.subheading")}</p>
              </div>

              <form
                onSubmit={handleCreateOrg}
                className="relative px-6 md:px-8 py-6 flex flex-col gap-6 max-w-[640px] mx-auto w-full"
              >
                <div className="flex flex-col gap-2 text-left">
                  <label
                    htmlFor="new-org-name"
                    className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase inline-flex items-center gap-1"
                  >
                    {t("create.nameLabel")}
                    <span aria-hidden="true" className="text-red-500 dark:text-red-400">*</span>
                    <span className="sr-only">{t("create.requiredIndicator")}</span>
                  </label>
                  <input
                    id="new-org-name"
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder={t("create.namePlaceholder")}
                    maxLength={120}
                    required
                    aria-required="true"
                    disabled={createOrgMutation.isPending}
                    className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30 disabled:opacity-50"
                  />
                </div>

                <fieldset className="flex flex-col gap-3 text-left">
                  <legend className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase inline-flex items-center gap-1.5">
                    {t("create.planLabel")}
                    <span className="normal-case tracking-normal font-normal text-muted-foreground/70">
                      {t("create.optionalIndicator")}
                    </span>
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PACKAGE_SKUS.map((sku) => {
                      const key = sku.toLowerCase();
                      const PlanIcon = PLAN_ICONS[sku];
                      const isRecommended = sku === "PROFESSIONAL";
                      return (
                        <label key={sku} className="relative cursor-pointer">
                          {isRecommended && (
                            <span className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-brand-gold px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-navy-950 shadow-sm">
                              {t("create.recommendedBadge")}
                            </span>
                          )}
                          <input
                            type="radio"
                            name="new-org-plan"
                            value={sku}
                            checked={newOrgPlan === sku}
                            onChange={() => setNewOrgPlan(sku)}
                            disabled={createOrgMutation.isPending}
                            className="peer sr-only"
                          />
                          <span className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/40 px-4 py-3.5 h-full transition-colors hover:border-brand-gold/50 peer-checked:border-brand-gold peer-checked:bg-brand-gold/[0.08] peer-checked:ring-1 peer-checked:ring-brand-gold/30 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-gold/40 peer-disabled:opacity-50">
                            <span className="flex items-center gap-1.5">
                              <PlanIcon className="h-3.5 w-3.5 text-muted-foreground peer-checked:text-brand-gold" aria-hidden="true" />
                              <span className="text-[13px] font-semibold text-foreground">{t(`create.plan.${key}.label`)}</span>
                            </span>
                            <span className="text-[12px] text-muted-foreground leading-snug">{t(`create.plan.${key}.description`)}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[12px] text-muted-foreground">{t("create.planHint")}</p>
                </fieldset>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={createOrgMutation.isPending}
                    className="cursor-pointer w-full sm:w-auto rounded-lg bg-brand-gold px-6 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-brand-navy-950 shadow-sm shadow-brand-gold/30 transition-colors hover:bg-brand-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {createOrgMutation.isPending ? t("create.creating") : t("create.submit")}
                  </button>
                </div>
              </form>
              {createOrgError && (
                <p className="relative px-6 md:px-8 pb-6 text-[12px] text-red-600 dark:text-red-400 text-center">{createOrgError}</p>
              )}

              <div className="relative px-6 md:px-8 pb-8 pt-2 border-t border-border">
                <p className="text-[13px] text-muted-foreground text-center leading-relaxed">{t("create.inviteHint")}</p>
              </div>
            </section>
          )
        ) : (
          <>
            {/* Overview */}
            <section className="rounded-2xl border border-border bg-card shadow-xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/[0.06] overflow-hidden">
              <div className="px-6 md:px-8 py-5 border-b border-border">
                <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">{t("overview.heading")}</h2>
              </div>
              <div className="flex flex-col divide-y divide-border">
                <div className="px-6 md:px-8 py-5 flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
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
                            className="flex-1 min-w-0 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-[16px] text-foreground outline-none transition-colors focus:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30 disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={handleSaveName}
                            disabled={updateOrgMutation.isPending}
                            aria-label={t("overview.saveName")}
                            className="cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-600 dark:text-brand-gold transition-colors hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
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
                      className="rounded-lg border border-border bg-background/60 px-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30 [color-scheme:light]"
                    >
                      <option value="" disabled className="text-black">
                        {t("overview.transferSelectPlaceholder")}
                      </option>
                      {otherMembers.map((m) => (
                        <option key={m.userId} value={m.userId} className="text-black">
                          {(m.user.name ?? m.user.username) + ` (${m.role})`}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleConfirmTransferAndLeave}
                        disabled={!successorId || isTransferring}
                        className="cursor-pointer rounded-lg bg-brand-gold px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-brand-navy-950 shadow-sm shadow-brand-gold/30 transition-colors hover:bg-brand-gold/90 disabled:cursor-not-allowed disabled:opacity-50"
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
            <section className="rounded-2xl border border-border bg-card shadow-xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/[0.06] overflow-hidden">
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
                    className="cursor-pointer text-[12px] font-semibold uppercase tracking-wider text-amber-600 dark:text-brand-gold hover:underline"
                  >
                    {t("members.retry")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {membersQuery.data?.map((member) => (
                    <div key={member.id} className="px-6 md:px-8 py-4 flex items-center gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-[12px] font-semibold">
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
                      {member.status === "PENDING" ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-full px-3 py-1">
                          {t("members.pending")}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {canEditMemberRole(member) ? (
                            <div className="flex flex-col items-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="relative">
                                    <select
                                      value={member.role}
                                      disabled={updatingRoleUserId === member.userId}
                                      onChange={(e) =>
                                        handleChangeMemberRole(
                                          member.userId,
                                          member.role,
                                          e.target.value as OrganizationRole,
                                          member.user.name ?? member.user.username,
                                        )
                                      }
                                      aria-label={t("members.changeRoleAriaLabel", { name: member.user.name ?? member.user.username })}
                                      className="cursor-pointer appearance-none rounded-full border border-border bg-foreground/5 pl-3 pr-6 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground outline-none transition-colors hover:border-brand-gold/50 focus-visible:ring-2 focus-visible:ring-brand-gold/30 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light]"
                                    >
                                      {roleOptionsFor(member.role).map((role) => (
                                        <option key={role} value={role} className="text-black">
                                          {role}
                                        </option>
                                      ))}
                                    </select>
                                    {updatingRoleUserId === member.userId ? (
                                      <Loader2 className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
                                    ) : (
                                      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{t("members.changeRoleTooltip")}</TooltipContent>
                              </Tooltip>
                              {roleChangeError?.userId === member.userId && (
                                <p className="text-[11px] text-red-600 dark:text-red-400 max-w-[160px] text-right">{roleChangeError.message}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-foreground/5 rounded-full px-3 py-1">
                              {member.role}
                            </span>
                          )}
                          {canRemoveMember(member) && (
                            <div className="flex flex-col items-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMemberClick(member.userId, member.user.name ?? member.user.username)}
                                    disabled={removeMemberMutation.isPending && removeMemberMutation.variables === member.userId}
                                    aria-label={t("members.removeAriaLabel", { name: member.user.name ?? member.user.username })}
                                    className="cursor-pointer flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-600/10 hover:text-red-600 dark:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {removeMemberMutation.isPending && removeMemberMutation.variables === member.userId ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                    ) : (
                                      <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>{t("members.removeTooltip")}</TooltipContent>
                              </Tooltip>
                              {removeError?.userId === member.userId && (
                                <p className="text-[11px] text-red-600 dark:text-red-400 max-w-[160px] text-right">{removeError.message}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Invite */}
            <section className="rounded-2xl border border-border bg-card shadow-xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/[0.06] overflow-hidden">
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
                        className="w-full rounded-lg border border-border bg-background/60 pl-9 pr-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30"
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
                      className="rounded-lg border border-border bg-background/60 px-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30 [color-scheme:light]"
                    >
                      {INVITABLE_ROLES.map((role) => (
                        <option key={role} value={role} className="text-black">
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
                        className="cursor-pointer rounded-lg bg-brand-gold px-6 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-brand-navy-950 shadow-sm shadow-brand-gold/30 transition-colors hover:bg-brand-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

      {pendingRoleChange && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
          onClick={() => setPendingRoleChange(null)}
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card rounded-2xl border border-border shadow-lg overflow-hidden"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="role-downgrade-title"
            aria-describedby="role-downgrade-desc"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60">
              <h2 id="role-downgrade-title" className="font-['Libre_Caslon_Text',serif] text-lg text-foreground font-normal">
                {t("members.roleDowngradeTitle")}
              </h2>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setPendingRoleChange(null)}
                    className="rounded-full p-1.5 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label={t("members.roleDowngradeCancel")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("members.roleDowngradeCancel")}</TooltipContent>
              </Tooltip>
            </div>

            <div className="px-6 py-6 flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
              </div>
              <p id="role-downgrade-desc" className="text-sm text-foreground leading-relaxed">
                {t("members.roleDowngradeConfirm", {
                  name: pendingRoleChange.memberName,
                  fromRole: pendingRoleChange.fromRole,
                  toRole: pendingRoleChange.toRole,
                })}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setPendingRoleChange(null)}
                    className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    {t("members.roleDowngradeCancel")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Keep the current role and close this dialog</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={confirmPendingRoleChange}
                    className="cursor-pointer rounded-xl bg-brand-gold px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-navy-950 shadow-sm shadow-brand-gold/30 transition-colors hover:bg-brand-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 focus-visible:ring-offset-2"
                  >
                    {t("members.roleDowngradeContinue")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Apply the role change</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {pendingRemoval && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
          onClick={() => setPendingRemoval(null)}
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card rounded-2xl border border-border shadow-lg overflow-hidden"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="remove-member-title"
            aria-describedby="remove-member-desc"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/60">
              <h2 id="remove-member-title" className="font-['Libre_Caslon_Text',serif] text-lg text-foreground font-normal">
                {t("members.removeConfirmTitle")}
              </h2>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setPendingRemoval(null)}
                    className="rounded-full p-1.5 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label={t("members.removeConfirmCancel")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("members.removeConfirmCancel")}</TooltipContent>
              </Tooltip>
            </div>

            <div className="px-6 py-6 flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400">
                <UserX className="h-4.5 w-4.5" aria-hidden="true" />
              </div>
              <p id="remove-member-desc" className="text-sm text-foreground leading-relaxed">
                {t("members.removeConfirmBody", { name: pendingRemoval.memberName })}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setPendingRemoval(null)}
                    className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    {t("members.removeConfirmCancel")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("members.removeConfirmCancelTooltip")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={confirmPendingRemoval}
                    className="cursor-pointer rounded-xl bg-red-600 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white shadow-sm shadow-red-600/30 transition-colors hover:bg-red-600/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/50 focus-visible:ring-offset-2"
                  >
                    {t("members.removeConfirmContinue")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("members.removeConfirmContinueTooltip")}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
