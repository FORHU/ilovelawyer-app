"use client";

import { PageShell } from "@/components/page-shell";
import ConsultationChat from "@/components/chat/consultation-chat";
import { ApplicationReminderBanner } from "@/components/account/application-reminder-banner";
import { useAuthStore } from "@/lib/store/auth.store";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";

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

// Korean practice, in Korean (the KR site's default language; chat runs on Chat Wonder's legal_kr
// persona): 내용증명 (demand letter by certified mail), 부당해고 구제 (unfair dismissal remedies before
// the Labour Relations Commission), 소액사건심판 (small claims), 임대차 보증금 (lease deposits),
// 소멸시효 (limitation).
const KR_PROMPTS = [
  "내용증명 작성하기",
  "인용 판례 확인하기",
  "부당해고 구제 신청 요건 검토하기",
  "첨부한 계약서 요약하기",
  "채무불이행에 따른 손해배상 청구 요건 설명하기",
  "비밀유지계약서 검토하기",
  "소액사건심판 절차 개요 정리하기",
  "임대차 보증금 반환 청구 방법 설명하기",
  "청구권의 소멸시효 설명하기",
  "대법원 판결 요약하기",
];

const PROMPTS: Record<TenantCode, string[]> = { PH: PH_PROMPTS, UK: UK_PROMPTS, KR: KR_PROMPTS };

export default function AiConsultationPage() {
  const user = useAuthStore((s) => s.user);
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode);
  const firstName = user?.name?.split(" ")[0] ?? user?.username;

  return (
    <PageShell className="h-screen overflow-hidden">
      <ApplicationReminderBanner />
      <ConsultationChat
        basePath="/homepage"
        enableFileChips
        emptyStateHeading={firstName ? `What can I help you with, ${firstName}?` : undefined}
        emptyStateHeroImage="/consultation/hero-2.jpg"
        emptyStatePrompts={PROMPTS[tenantCode ?? "PH"]}
      />
    </PageShell>
  );
}
