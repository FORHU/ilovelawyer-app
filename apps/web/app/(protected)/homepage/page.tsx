"use client";

import GlobalHeader from "@/components/global-header";
import ConsultationChat from "@/components/chat/consultation-chat";

export default function AiConsultationPage() {
  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      <GlobalHeader activeTab="consultation" />
      <ConsultationChat basePath="/homepage" />
    </div>
  );
}
