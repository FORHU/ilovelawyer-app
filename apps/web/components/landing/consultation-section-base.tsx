"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Grid2x2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useScrollDrift } from "@/lib/landing/use-scroll-drift";
import { hasSessionHint, refreshAccessToken } from "@/lib/fetch";
import { HubRelatedCases } from "@/components/chat/case-hub-widget";
import type { RelatedCase } from "@/lib/chat/mutations";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";

// PH and UK render identical markup (see hero-section-base.tsx for why this is one component
// instead of two hand-copied files), but each tenant gets its own sample case and citations via
// the `_UK` locale keys.
//
// The citation card carries the `dark` class so it always uses the dark theme tokens, matching the
// handoff (a permanently dark card, like the rest of the page's chrome) in both light and dark mode.
// It is still built from the real chat-rendering component HubRelatedCases, so it shows the product
// as it actually looks in dark mode.

const CONSULTATION_ROUTE = "/homepage";
// A visitor with no account tries the consultation as a trial guest (UK; /trial sends other
// hosts on to the normal sign-in).
const TRIAL_ROUTE = "/trial";

interface MockCitation {
  title: string;
  citation: string;
  snippet?: string;
  vetted: boolean;
}

export function ConsultationSectionBase({ tenantCode }: { tenantCode: TenantCode }) {
  const { t } = useTranslation("landing");
  const isUk = tenantCode === "UK";
  const tCtx = isUk ? { context: "UK" as const } : undefined;
  // Explicit `_UK` key rather than i18next's `context` option: context is not applied when the
  // value is a nested object, so it would silently keep returning the Philippine sample data.
  const relatedCases = t(isUk ? "consultation.relatedCasesItems_UK" : "consultation.relatedCasesItems", {
    returnObjects: true,
  }) as MockCitation[];
  const entries: RelatedCase[] = relatedCases.map((c) => ({
    type: "case",
    title: c.title,
    url: null,
    case_number: c.citation,
    ra_number: null,
    year: null,
    snippet: c.snippet ?? null,
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
    router.push(TRIAL_ROUTE);
  };

  return (
    <section className="bg-brand-navy-950 py-24 px-6 md:px-16">
      <div ref={ref} className="max-w-360 mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <div className="flex flex-col gap-6 max-w-[600px]">
          <h2 className="font-display text-white text-[clamp(38px,5vw,64px)] font-light leading-[0.98] tracking-[-0.02em]">
            {t("consultation.heading")}
          </h2>
          <p className="text-white/75 text-base leading-[1.6]">{t("consultation.body", tCtx)}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={TRIAL_ROUTE}
                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => void handleCtaClick(e)}
                className="self-start text-xs tracking-[1.2px] uppercase font-semibold px-6 py-3 rounded-full bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold/85 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]"
              >
                {t("consultation.cta")}
              </Link>
            </TooltipTrigger>
            <TooltipContent>{t("capabilities.tileTooltip")}</TooltipContent>
          </Tooltip>
        </div>

        <motion.div
          style={{ y }}
          className="dark justify-self-center w-full max-w-[600px] rounded-xl bg-card border border-border shadow-xl overflow-hidden flex flex-col"
        >
          <div className="p-4 border-b border-border flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-brand-gold shrink-0" />
            <span className="font-['Libre_Caslon_Text'] text-card-foreground text-sm uppercase tracking-[-0.01em]">
              {t("consultation.caseName", tCtx)}
            </span>
          </div>

          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Grid2x2 size={13} />
              <span className="font-semibold text-card-foreground">{t("consultation.relatedCases")}</span>
              <span>&middot; {relatedCases.length}</span>
            </div>
            <HubRelatedCases entries={entries} isLoading={false} emptyLabel="" />
          </div>

          {/* A document attached to the consultation, still being indexed for chat. */}
          <div className="px-4 py-3 border-t border-border flex flex-col items-start gap-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-card-foreground">
              <Loader2 className="size-3 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
              {t("consultation.attachment", tCtx)}
            </span>
            <span className="text-[10.5px] text-muted-foreground">{t("consultation.indexing")}</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
