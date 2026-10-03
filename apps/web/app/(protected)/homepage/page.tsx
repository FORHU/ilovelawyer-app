"use client";

import { PageShell } from "@/components/page-shell";
import ConsultationChat from "@/components/chat/consultation-chat";
import { useAuthStore } from "@/lib/store/auth.store";

// Fallback pool ConsultationChat draws a random handful from whenever the user has no
// consultation history yet to suggest from instead (see suggestedPrompts in
// consultation-chat.tsx) — kept as a list rather than a fixed four so the empty state doesn't
// show the exact same pills to every first-time user every time. Per tenant: UK practice says
// "letter before claim", "limitation period", "unfair dismissal", "possession claim".
const PH_PROMPTS = [
  "Draft a demand letter",
  "Check a citation",
  "Assess illegal-dismissal remedies",
  "Summarize an attached contract",
  "Explain the elements of breach of contract",
  "Draft a cease-and-desist letter",
  "Review a non-disclosure agreement",
  "Outline the small-claims filing process",
  "Explain a tenant's rights in an eviction",
  "Draft an employment termination notice",
  "Explain the statute of limitations for a claim",
  "Summarize a court decision",
];

const UK_PROMPTS = [
  "Draft a letter before claim",
  "Check a citation",
  "Assess unfair dismissal remedies",
  "Summarise an attached contract",
  "Explain the elements of breach of contract",
  "Draft a cease and desist letter",
  "Review a non-disclosure agreement",
  "Outline the small claims track process",
  "Explain a tenant's rights in a possession claim",
  "Draft a letter of dismissal",
  "Explain the limitation period for a claim",
  "Summarise a court judgment",
];

export default function AiConsultationPage() {
  const user = useAuthStore((s) => s.user);
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode);
  const firstName = user?.name?.split(" ")[0] ?? user?.username;

  return (
    <PageShell className="h-screen overflow-hidden">
      <ConsultationChat
        basePath="/homepage"
        enableFileChips
        emptyStateHeading={firstName ? `What can I help you with, ${firstName}?` : undefined}
        emptyStateHeroImage="/consultation/hero-2.jpg"
        emptyStatePrompts={tenantCode === "UK" ? UK_PROMPTS : PH_PROMPTS}
      />
    </PageShell>
  );
}
