"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { ApplyStep } from "@/components/onboarding/apply-step";
import { FirmStep } from "@/components/onboarding/firm-step";
import { InviteStep } from "@/components/onboarding/invite-step";
import { PlanStep } from "@/components/onboarding/plan-step";
import { WorkspaceSetup, type WorkspaceSetupStep } from "@/app/(auth)/_components/workspace-setup";
import { OnboardingLoading, OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { StepIndicator, type SetupStepId } from "@/components/onboarding/step-indicator";
import { isFeatureEnabled } from "@/config/tenant-codes/capabilities";
import { useClientRequestProfileQuery } from "@/lib/client-requests/profile";
import { useDiscardOrganizationMutation } from "@/lib/organizations/mutations";
import { useAuthStore, type ActiveOrganization } from "@/lib/store/auth.store";
import { useCompleteSetupMutation, useCurrentUserQuery } from "@/lib/user/mutations";

type StepId = SetupStepId;

/**
 * Account setup after sign-up: the protected layout sends a lawyer here while setupCompletedAt is
 * empty, whether the account is approved yet or not. Approval comes last: a pending account
 * finishes these steps first and then waits on /account-pending, so it's never sent back here. The workspace choice (and a firm's details) already happened
 * before this, at verification; what's left is inviting the team (a firm's founder only) and the
 * Lawyer Application (on sites that have one, if not yet submitted). Both can be skipped. Finishing
 * or skipping the last step sets setupCompletedAt, and the lawyer isn't sent here again. A reload
 * starts again at the first step that still applies.
 *
 * A Solo practitioner can go back from their first step to the choice, as a firm can from its
 * details: picking Solo again changes nothing (a solo lawyer has no organization), and picking Law
 * firm creates the firm (what they made solo stays theirs, as their portfolio), and the steps start
 * over for it. A founder can go back from their firm's details too: that removes the firm they just
 * made (after they confirm), and they choose again.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const organization = useAuthStore((s) => s.organization);
  const user = useAuthStore((s) => s.user);
  const { data: currentUser } = useCurrentUserQuery();
  const [rechoosing, setRechoosing] = useState(false);
  // Back at the choice after removing their firm: there's no step to return to any more.
  const [discarded, setDiscarded] = useState(false);
  const [setupStep, setSetupStep] = useState<WorkspaceSetupStep>("choose");

  useEffect(() => {
    if (currentUser?.setupCompletedAt) router.replace(afterSetupPath(currentUser.approvalStatus));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.setupCompletedAt]);

  // Before the organization check: after removing their firm the store still holds it until they
  // choose again (Solo or a new firm replaces it), and nothing on this screen uses it.
  if (rechoosing)
    return (
      // Back from the firm's details returns to the choice; back from the choice returns to the
      // step they came from, nothing changed (unless that firm was removed).
      <OnboardingShell
        onBack={setupStep === "firm" ? () => setSetupStep("choose") : discarded ? undefined : () => setRechoosing(false)}
      >
        <WorkspaceSetup
          defaultOrgName={user?.name ?? ""}
          step={setupStep}
          onStepChange={setSetupStep}
          onDone={() => {
            setRechoosing(false);
            setDiscarded(false);
            setSetupStep("choose");
          }}
        />
      </OnboardingShell>
    );

  if (!organization) return <OnboardingLoading />;

  // Keyed by the workspace: going back and creating a firm starts its steps (Invite, Apply) afresh.
  return (
    <SetupSteps
      key={organization.id}
      organization={organization}
      pending={currentUser?.approvalStatus === "PENDING"}
      onRechoose={organization.isPersonal ? () => setRechoosing(true) : undefined}
      onFirmRemoved={() => {
        setDiscarded(true);
        setSetupStep("choose");
        setRechoosing(true);
      }}
    />
  );
}

/** Where a finished setup goes: into the app, or to wait for approval when the account isn't approved yet. */
function afterSetupPath(approvalStatus: string | undefined) {
  return approvalStatus && approvalStatus !== "ACTIVE" ? "/account-pending" : "/homepage";
}

function SetupSteps({
  organization,
  pending,
  onRechoose,
  onFirmRemoved,
}: {
  organization: ActiveOrganization;
  pending: boolean;
  onRechoose?: () => void;
  onFirmRemoved: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation("onboarding");
  const completeSetup = useCompleteSetupMutation();
  const discard = useDiscardOrganizationMutation();
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const applies = isFeatureEnabled(organization?.tenantCode, "lawyerApplication");
  const profileQuery = useClientRequestProfileQuery(applies);
  const isFirmOwner = !organization.isPersonal && organization.role === "OWNER";
  // Who chooses a subscription plan: a solo lawyer, and a firm's founder for the firm. Someone who
  // joined a firm is on the firm's.
  const choosesPlan = organization.isPersonal || isFirmOwner;

  const [index, setIndex] = useState(0);
  // Fixed on first load, so submitting the application (which changes its status) doesn't
  // reshuffle the steps under the lawyer.
  const [steps, setSteps] = useState<StepId[] | null>(null);
  const profileReady = !applies || profileQuery.isFetched;

  if (steps === null && profileReady) {
    const needsApplication = applies && profileQuery.data?.verification.status === "UNSUBMITTED";
    // A founder's firm already exists, so they start at Invite; Firm is there to go back to. The
    // plan comes last.
    setSteps([
      ...(isFirmOwner ? (["firm", "invite"] as const) : []),
      ...(needsApplication ? (["apply"] as const) : []),
      ...(choosesPlan ? (["plan"] as const) : []),
    ]);
    if (isFirmOwner) setIndex(1);
  }

  const finished = steps !== null && index >= steps.length;

  useEffect(() => {
    if (!finished || completeSetup.isPending || completeSetup.isSuccess) return;
    completeSetup.mutate(undefined, { onSettled: (updated) => router.replace(afterSetupPath(updated?.approvalStatus ?? (pending ? "PENDING" : "ACTIVE"))) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (steps === null || finished) return <OnboardingLoading />;

  const current = steps[index]!;
  const next = () => setIndex((i) => i + 1);
  // The whole path after the choice (which isn't a step in it), the steps already behind the lawyer
  // included, so the indicator shows where they are. A pending account ends with Review (the
  // admin's approval), so it's clear that comes last.
  const path: StepId[] = [...steps, ...(pending ? (["review"] as const) : [])];
  // Back goes one step at a time. From the first step, the choice: a Solo practitioner just returns
  // to it; a founder's first step is their firm's details, and going further removes the firm, so
  // they're asked first.
  const askToRemoveFirm = isFirmOwner ? () => setConfirmingDiscard(true) : undefined;
  const back = index > 0 ? () => setIndex((i) => i - 1) : (onRechoose ?? askToRemoveFirm);

  function removeFirm() {
    discard.mutate(organization.id, {
      onSuccess: () => {
        setConfirmingDiscard(false);
        onFirmRemoved();
      },
    });
  }

  return (
    <OnboardingShell onBack={back} wide={current === "plan"}>
      {/* A solo lawyer (Apply, Plan) and a firm's founder (Firm, Invite, Apply, Plan) have a path to
          follow. Someone who joined a firm only has the application: no indicator for that. */}
      {choosesPlan && <StepIndicator steps={path} current={current} />}
      {/* Every step stays mounted, only the current one shown, so going back and forward keeps what
          was typed and which invites went out. */}
      {steps.map((step, i) => (
        <div key={step} hidden={i !== index}>
          {step === "firm" && <FirmStep organization={organization} onDone={next} onBackToChoice={askToRemoveFirm} />}
          {step === "invite" && <InviteStep organizationId={organization.id} firmName={organization.name} onDone={next} />}
          {step === "apply" && profileQuery.data && <ApplyStep profile={profileQuery.data} onDone={next} />}
          {step === "plan" && <PlanStep onDone={next} />}
        </div>
      ))}

      <Dialog open={confirmingDiscard} onOpenChange={(open) => !open && !discard.isPending && setConfirmingDiscard(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("discard.title")}</DialogTitle>
            <DialogDescription>{t("discard.body", { firm: organization.name })}</DialogDescription>
          </DialogHeader>
          {discard.isError && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {(discard.error as Error).message}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={discard.isPending} onClick={() => setConfirmingDiscard(false)}>
              {t("discard.keep")}
            </Button>
            <Button variant="destructive" disabled={discard.isPending} onClick={removeFirm}>
              {discard.isPending ? t("discard.removing") : t("discard.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OnboardingShell>
  );
}
