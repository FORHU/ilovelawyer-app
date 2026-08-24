"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Loader2, Mail, UserCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useAuthStore } from "@/lib/store/auth.store";
import { useMyInviteQuery, type OrganizationRole } from "@/lib/organizations/queries";
import {
  useAcceptInviteMutation,
  useCreateOrganizationMutation,
  useDeclineInviteMutation,
  useInviteMemberMutation,
} from "@/lib/organizations/mutations";

// OWNER is deliberately excluded — the creator is already the owner, and ownership
// only ever moves via the transfer flow on the Organization settings page.
const INVITABLE_ROLES: OrganizationRole[] = ["MEMBER", "MANAGER", "ADMIN"];

type Choice = "solo" | "createOrg" | "inviteTeam" | "joinOrg" | null;

const inputClass =
  "w-full border border-border rounded-xl border-b-2 bg-transparent px-3 py-4 text-base text-foreground placeholder-muted-foreground outline-none focus:border-brand-gold transition-colors";

const primaryButtonClass =
  "w-full bg-primary text-primary-foreground rounded-xl text-base tracking-[1.6px] uppercase font-semibold py-4 cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-50 disabled:cursor-not-allowed";

const secondaryButtonClass =
  "w-full bg-background border border-border rounded-xl text-base tracking-[1.6px] uppercase font-semibold py-4 cursor-pointer hover:bg-accent transition-colors border disabled:opacity-50 disabled:cursor-not-allowed";

/** Shown right after a new signup verifies their email — lets them declare intent
 * (solo / create a firm org / accept a pending invite) before landing in the app.
 * Reuses the same organization endpoints the Organization settings page uses, so
 * this is purely a frontend onboarding step: no new backend surface. */
export function WorkspaceSetup({ defaultOrgName, onDone }: { defaultOrgName: string; onDone: () => void }) {
  const { t } = useTranslation(["auth", "organization"]);
  const setOrganization = useAuthStore((s) => s.setOrganization);
  const [choice, setChoice] = useState<Choice>(null);
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Populated once handleCreateOrg succeeds, so the follow-up "invite your team" step
  // (choice === "inviteTeam") knows which org to invite members into.
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("MEMBER");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  const createOrgMutation = useCreateOrganizationMutation();
  const myInviteQuery = useMyInviteQuery({ enabled: choice === "joinOrg" });
  const acceptInviteMutation = useAcceptInviteMutation();
  const declineInviteMutation = useDeclineInviteMutation();
  const inviteMemberMutation = useInviteMemberMutation(createdOrgId ?? "");

  const isPending =
    createOrgMutation.isPending || acceptInviteMutation.isPending || declineInviteMutation.isPending;

  function selectChoice(next: Choice) {
    setChoice(next);
    setError(null);
    setOrgName("");
  }

  function handleContinueSolo() {
    setError(null);
    createOrgMutation.mutate(
      { name: defaultOrgName || "My Practice", packageSku: "SOLO" },
      {
        onSuccess: (org) => {
          setOrganization({ id: org.id, name: org.name, slug: org.slug, role: "OWNER", packageSku: org.packageSku });
          onDone();
        },
        onError: (err) => setError((err as Error).message),
      }
    );
  }

  function handleCreateOrg(e: React.SyntheticEvent) {
    e.preventDefault();
    setError(null);
    createOrgMutation.mutate(
      { name: orgName },
      {
        onSuccess: (org) => {
          setOrganization({ id: org.id, name: org.name, slug: org.slug, role: "OWNER", packageSku: org.packageSku });
          setCreatedOrgId(org.id);
          setChoice("inviteTeam");
        },
        onError: (err) => setError((err as Error).message),
      }
    );
  }

  function handleAccept() {
    if (!myInviteQuery.data) return;
    setError(null);
    const invite = myInviteQuery.data;
    acceptInviteMutation.mutate(invite.organizationId, {
      onSuccess: () => {
        setOrganization({
          id: invite.organization.id,
          name: invite.organization.name,
          slug: invite.organization.slug,
          role: invite.role,
          packageSku: invite.organization.packageSku,
        });
        onDone();
      },
      onError: (err) => setError((err as Error).message),
    });
  }

  function handleDecline() {
    if (!myInviteQuery.data) return;
    setError(null);
    declineInviteMutation.mutate(myInviteQuery.data.organizationId, {
      onSuccess: () => selectChoice(null),
      onError: (err) => setError((err as Error).message),
    });
  }

  function handleSendInvite(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!createdOrgId) return;
    setInviteError(null);
    setInviteSent(false);
    inviteMemberMutation.mutate(
      { email: inviteEmail, role: inviteRole },
      {
        onSuccess: () => {
          setInviteEmail("");
          setInviteSent(true);
        },
        onError: (err) => setInviteError((err as Error).message),
      }
    );
  }

  const cards: { key: Exclude<Choice, null>; icon: typeof UserCircle2; titleKey: string; descKey: string; tooltipKey: string }[] = [
    { key: "solo", icon: UserCircle2, titleKey: "workspace.solo.title", descKey: "workspace.solo.description", tooltipKey: "workspace.solo.tooltip" },
    { key: "createOrg", icon: Building2, titleKey: "workspace.createOrg.title", descKey: "workspace.createOrg.description", tooltipKey: "workspace.createOrg.tooltip" },
    { key: "joinOrg", icon: Mail, titleKey: "workspace.joinOrg.title", descKey: "workspace.joinOrg.description", tooltipKey: "workspace.joinOrg.tooltip" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1
          className="text-[40px] text-foreground leading-12"
          style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}
        >
          {t("workspace.heading")}
        </h1>
        <p className="text-muted-foreground text-base leading-6" style={{ fontFamily: "Inter, sans-serif" }}>
          {t("workspace.subheading")}
        </p>
      </div>

      {choice === null && (
        <div className="flex flex-col gap-3">
          {cards.map(({ key, icon: Icon, titleKey, descKey, tooltipKey }) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => selectChoice(key)}
                  className="w-full flex items-start gap-4 border border-border rounded-xl p-5 text-left cursor-pointer hover:border-brand-gold transition-colors bg-transparent"
                >
                  <div className="flex items-center justify-center size-10 rounded-lg bg-accent shrink-0 text-brand-gold">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-foreground text-base font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                      {t(titleKey)}
                    </span>
                    <span className="text-muted-foreground text-sm leading-5" style={{ fontFamily: "Inter, sans-serif" }}>
                      {t(descKey)}
                    </span>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent>{t(tooltipKey)}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {choice === "solo" && (
        <div className="flex flex-col gap-5">
          {error && (
            <p className="text-red-500 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
              {error}
            </p>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" disabled={isPending} onClick={handleContinueSolo} className={primaryButtonClass}>
                {createOrgMutation.isPending ? t("workspace.settingUp") : t("workspace.continueSolo")}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("workspace.continueSoloTooltip")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" disabled={isPending} onClick={() => selectChoice(null)} className={secondaryButtonClass}>
                {t("workspace.back")}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("workspace.backTooltip")}</TooltipContent>
          </Tooltip>
        </div>
      )}

      {choice === "createOrg" && (
        <form onSubmit={handleCreateOrg} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label
              className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {t("workspace.orgNameLabel")}
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={t("workspace.orgNamePlaceholder")}
              required
              maxLength={120}
              disabled={isPending}
              className={inputClass}
              style={{ fontFamily: "Inter, sans-serif" }}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
              {error}
            </p>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button type="submit" disabled={isPending} className={primaryButtonClass}>
                {createOrgMutation.isPending ? t("workspace.creating") : t("workspace.createAndContinue")}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("workspace.createAndContinueTooltip")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" disabled={isPending} onClick={() => selectChoice(null)} className={secondaryButtonClass}>
                {t("workspace.back")}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("workspace.backTooltip")}</TooltipContent>
          </Tooltip>
        </form>
      )}

      {choice === "inviteTeam" && (
        <div className="flex flex-col gap-5">
          <p className="text-muted-foreground text-sm leading-5" style={{ fontFamily: "Inter, sans-serif" }}>
            {t("workspace.inviteTeam.subheading")}
          </p>

          <form onSubmit={handleSendInvite} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label
                className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {t("organization:invite.emailLabel")}
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("organization:invite.emailPlaceholder")}
                required
                disabled={inviteMemberMutation.isPending}
                className={inputClass}
                style={{ fontFamily: "Inter, sans-serif" }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                className="text-muted-foreground text-xs tracking-[1.2px] uppercase font-semibold"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {t("organization:invite.roleLabel")}
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                disabled={inviteMemberMutation.isPending}
                className={inputClass}
                style={{ fontFamily: "Inter, sans-serif", colorScheme: "light" }}
              >
                {INVITABLE_ROLES.map((role) => (
                  <option key={role} value={role} className="text-black">
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {inviteError && (
              <p className="text-red-500 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                {inviteError}
              </p>
            )}
            {inviteSent && !inviteError && (
              <p className="text-emerald-600 dark:text-emerald-400 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                {t("organization:invite.success")}
              </p>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button type="submit" disabled={inviteMemberMutation.isPending} className={secondaryButtonClass}>
                  {inviteMemberMutation.isPending ? t("organization:invite.sending") : t("organization:invite.submit")}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("workspace.inviteTeam.sendTooltip")}</TooltipContent>
            </Tooltip>
          </form>

          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={onDone} className={primaryButtonClass}>
                {t("workspace.inviteTeam.continue")}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("workspace.inviteTeam.continueTooltip")}</TooltipContent>
          </Tooltip>
        </div>
      )}

      {choice === "joinOrg" && (
        <div className="flex flex-col gap-5">
          {myInviteQuery.isLoading ? (
            <p className="text-muted-foreground text-sm flex items-center gap-2" style={{ fontFamily: "Inter, sans-serif" }}>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              {t("workspace.checkingInvite")}
            </p>
          ) : myInviteQuery.data ? (
            <>
              <p className="text-foreground text-base leading-6.5" style={{ fontFamily: "Inter, sans-serif" }}>
                {t("workspace.inviteFoundPrompt", {
                  orgName: myInviteQuery.data.organization.name,
                  role: myInviteQuery.data.role,
                })}
              </p>
              {error && (
                <p className="text-red-500 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                  {error}
                </p>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" disabled={isPending} onClick={handleAccept} className={primaryButtonClass}>
                    {acceptInviteMutation.isPending ? t("workspace.accepting") : t("workspace.accept")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("workspace.acceptTooltip")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" disabled={isPending} onClick={handleDecline} className={secondaryButtonClass}>
                    {declineInviteMutation.isPending ? t("workspace.declining") : t("workspace.decline")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("workspace.declineTooltip")}</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-foreground text-base font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                  {t("workspace.noInviteHeading")}
                </p>
                <p className="text-muted-foreground text-sm leading-5" style={{ fontFamily: "Inter, sans-serif" }}>
                  {t("workspace.noInviteBody")}
                </p>
              </div>
              {error && (
                <p className="text-red-500 text-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                  {error}
                </p>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => myInviteQuery.refetch()}
                    disabled={myInviteQuery.isFetching || isPending}
                    className={primaryButtonClass}
                  >
                    {t("workspace.checkAgain")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("workspace.checkAgainTooltip")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" disabled={isPending} onClick={handleContinueSolo} className={secondaryButtonClass}>
                    {createOrgMutation.isPending ? t("workspace.settingUp") : t("workspace.continueSoloForNow")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("workspace.continueSoloForNowTooltip")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" disabled={isPending} onClick={() => selectChoice(null)} className={secondaryButtonClass}>
                    {t("workspace.back")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("workspace.backTooltip")}</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      )}
    </div>
  );
}
