import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, type LucideIcon } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { usePhStatutoryContentGuard } from "@/components/ph-statutory-content-guard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

type ActiveTab = Parameters<typeof usePhStatutoryContentGuard>[0];

interface LegalCodePageProps {
  activeTab: ActiveTab;
  eyebrow: string;
  title: ReactNode;
  subtitle: ReactNode;
  aiCta: {
    icon: LucideIcon;
    body: string;
    href: string;
    tooltip: string;
    heading?: string;
  };
  /** The page-specific middle section(s) — key-provisions list, stat cards, etc. */
  children: ReactNode;
}

/**
 * Shared shell for the ~10 PH statute/jurisprudence reference pages (constitution, civil-code,
 * labor-code, etc.) — every one of them is "back link -> eyebrow/title/subtitle -> bespoke
 * middle section -> AI search CTA banner", so only the middle section is a page-specific prop.
 * See DESIGN.md.
 */
export function LegalCodePage({ activeTab, eyebrow, title, subtitle, aiCta, children }: LegalCodePageProps) {
  const guard = usePhStatutoryContentGuard(activeTab);
  if (guard) return guard;

  const AiIcon = aiCta.icon;

  return (
    <PageShell activeTab={activeTab}>
      <main className="max-w-[1000px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/homepage/library"
              className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to Library
            </Link>
          </TooltipTrigger>
          <TooltipContent>Return to the Library home</TooltipContent>
        </Tooltip>

        <div className="w-full flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-[1.5px] text-amber-700 dark:text-amber-400 uppercase">{eyebrow}</span>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground leading-tight">{title}</h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">{subtitle}</p>
        </div>

        {children}

        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy-800 to-brand-navy-950 p-8 md:p-10 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-brand-gold/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
              <AiIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] md:text-[24px]">{aiCta.heading ?? "Search the full text with AI"}</h2>
              <p className="text-white/70 text-[14px] mt-1 max-w-md">{aiCta.body}</p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={aiCta.href}
                className="relative inline-flex shrink-0 cursor-pointer items-center gap-2 self-start sm:self-center rounded-lg bg-white px-6 py-3 text-[12px] font-semibold uppercase tracking-[1.2px] text-brand-navy-950 transition-colors hover:bg-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-950"
              >
                Open in Library
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>{aiCta.tooltip}</TooltipContent>
          </Tooltip>
        </section>
      </main>
    </PageShell>
  );
}
