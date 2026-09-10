"use client";

import GlobalHeader from "@/components/global-header";
import ConsultationChat from "@/components/chat/consultation-chat";
import { useAuthStore } from "@/lib/store/auth.store";

export default function AiConsultationPage() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(" ")[0] ?? user?.username;

  return (
    // "dark landing-theme" forces the redesign's noir/gold palette regardless of the
    // app's light/dark toggle — same tokens the marketing landing page already uses
    // (see packages/ui/src/styles/globals.css), reused here for the Consultation redesign.
    <div className="dark landing-theme h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      <GlobalHeader activeTab="consultation" />
      <ConsultationChat
        basePath="/homepage"
        enableFileChips
        emptyStateHeading={firstName ? `What can I help you with, ${firstName}?` : undefined}
        emptyStateHeroImage="/consultation/hero-2.jpg"
        // Fallback pool ConsultationChat draws a random handful from whenever the user has
        // no consultation history yet to suggest from instead (see suggestedPrompts in
        // consultation-chat.tsx) — kept as a list rather than a fixed four so the empty
        // state doesn't show the exact same pills to every first-time user every time.
        emptyStatePrompts={[
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
        ]}
      />
    </div>
  );
}
