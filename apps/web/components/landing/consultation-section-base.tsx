"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Grid2x2, Mic, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useScrollDrift } from "@/lib/landing/use-scroll-drift";
import { hasSessionHint, refreshAccessToken } from "@/lib/fetch";
import AssistantMessage from "@/components/chat/assistant-message";
import { HubRelatedCases } from "@/components/chat/case-hub-widget";
import type { RelatedCase } from "@/lib/chat/mutations";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";

// PH and UK render identical markup (see hero-section-base.tsx for why this is one
// component instead of two hand-copied files) — differing only in i18next context.
//
// Per user decision, the citation card below stays theme-adaptive (it's built from the
// real chat-rendering components AssistantMessage/HubRelatedCases, so it authentically
// shows the product in the visitor's chosen theme) even though the handoff depicts it as
// permanently dark like the rest of the page's chrome — only the section's own heading/
// body/background follow the fixed-dark treatment used elsewhere on the redesigned page.

const CONSULTATION_ROUTE = "/homepage";
const loginHref = `/login?next=${encodeURIComponent(CONSULTATION_ROUTE)}`;

interface MockCitation {
  title: string;
  citation: string;
  vetted: boolean;
}

export function ConsultationSectionBase({ tenantCode }: { tenantCode: TenantCode }) {
  const { t } = useTranslation("landing");
  const tCtx = tenantCode === "UK" ? { context: "UK" as const } : undefined;
  const relatedCases = t("consultation.relatedCasesItems", { ...tCtx, returnObjects: true }) as MockCitation[];
  const entries: RelatedCase[] = relatedCases.map((c) => ({
    type: "case",
    title: c.title,
    url: null,
    case_number: c.citation,
    ra_number: null,
    year: null,
    snippet: null,
    relevance: null,
    vetted: c.vetted,
  }));
  const [ref, y] = useScrollDrift([-16, 16]);
  const router = useRouter();

  const handleCtaClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (hasSessionHint()) {
      try {
        await refreshAccessToken();
        router.push(CONSULTATION_ROUTE);
        return;
      } catch {
        // fall through — hint was stale, visitor isn't actually logged in
      }
    }
    router.push(loginHref);
  };

  return (
    <section className="bg-brand-navy-950 py-24 px-6 md:px-16">
      <div ref={ref} className="max-w-360 mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <div className="flex flex-col gap-6 max-w-[600px]">
          <h2 className="font-display text-white text-[clamp(38px,5vw,64px)] font-light leading-[0.98] tracking-[-0.02em]">
            {t("consultation.heading")}
          </h2>
          <p className="text-white/75 text-base leading-[1.6]">{t("consultation.body")}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={loginHref}
                onClick={(e) => void handleCtaClick(e)}
                className="self-start text-xs tracking-[1.2px] uppercase font-semibold px-6 py-3 rounded-full bg-brand-gold text-brand-navy-950 hover:bg-brand-gold/85 transition-colors duration-200"
              >
                {t("consultation.cta")}
              </Link>
            </TooltipTrigger>
            <TooltipContent>{t("capabilities.tileTooltip")}</TooltipContent>
          </Tooltip>
        </div>

        <motion.div
          style={{ y }}
          className="justify-self-center w-full max-w-[600px] rounded-xl bg-card border border-border shadow-xl overflow-hidden flex flex-col"
        >
          <div className="p-4 border-b border-border flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-brand-gold shrink-0" />
            <span className="font-['Libre_Caslon_Text'] text-card-foreground text-sm uppercase tracking-[-0.01em]">
              {t("consultation.caseName", tCtx)}
            </span>
          </div>

          <div className="p-4 flex flex-col gap-3">
            <p className="self-end max-w-[85%] rounded-[18px_18px_4px_18px] border border-border bg-muted text-card-foreground text-[15px] leading-6 px-3 py-2">
              {t("consultation.question", tCtx)}
            </p>

            <AssistantMessage content={t("consultation.answer", tCtx)} />

            <div className="rounded-[14px] border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <Grid2x2 size={13} />
                <span className="font-semibold text-card-foreground">{t("consultation.relatedCases")}</span>
                <span>&middot; {relatedCases.length}</span>
              </div>
              <HubRelatedCases entries={entries} isLoading={false} emptyLabel="" />
            </div>

            <div className="bg-card p-2 rounded-[26px] border border-border shadow-[0_20px_40px_rgba(0,0,0,0.15)] flex items-center gap-1.5">
              <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-border text-muted-foreground">
                <Plus className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="flex-1 px-1 py-1.5 text-[15px] text-muted-foreground truncate">
                {t("consultation.composerPlaceholder")}
              </span>
              <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-border text-muted-foreground">
                <Mic className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="h-9 shrink-0 flex items-center gap-2 rounded-full bg-brand-gold text-background px-[18px] text-[10px] font-semibold uppercase tracking-[1.2px]">
                <span>Send</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
