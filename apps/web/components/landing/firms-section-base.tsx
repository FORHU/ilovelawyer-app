"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useScrollDrift } from "@/lib/landing/use-scroll-drift";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";

// PH and UK render identical markup (see hero-section-base.tsx for why this is one
// component instead of two hand-copied files) — differing only in i18next context.

interface Member {
  initials: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  you: boolean;
  /** Invited but hasn't accepted yet — shown with a PENDING badge instead of YOU. */
  pending?: boolean;
}

export function FirmsSectionBase({ tenantCode }: { tenantCode: TenantCode }) {
  const { t } = useTranslation("landing");
  const tCtx = tenantCode === "UK" ? { context: "UK" as const } : undefined;
  const members = t("firms.roster", { ...tCtx, returnObjects: true }) as Member[];
  const [ref, y] = useScrollDrift([-20, 20]);

  return (
    <section id="business" className="bg-brand-navy-950 py-24 px-6 md:px-16">
      <h2 className="font-display text-white text-center text-[clamp(38px,5.2vw,68px)] font-light leading-[0.98] tracking-[-0.02em] max-w-[900px] mx-auto mb-16">
        {t("firms.heading")}
      </h2>

      <div ref={ref} className="max-w-[1160px] mx-auto grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-16 items-center">
        <motion.div
          style={{ y }}
          className="justify-self-center w-[296px] min-h-[418px] rounded-xl bg-brand-navy-950 border border-white/10 shadow-2xl overflow-hidden text-white flex flex-col"
        >
          <div className="p-4 border-b border-white/10">
            <p className="font-['Libre_Caslon_Text'] text-[18px]">{t("firms.membersCard.title")}</p>
            <p className="text-[11px] text-white/50 mt-0.5">{t("firms.membersCard.subtitle")}</p>
          </div>
          <div className="grid grid-cols-2 border-b border-white/10">
            <div className="p-3 border-r border-white/10">
              <p className="text-[9px] font-semibold tracking-[0.05em] uppercase text-white/50">{t("firms.membersCard.organization")}</p>
              <p className="text-[13px] mt-1">{t("firms.membersCard.orgName", tCtx)}</p>
            </div>
            <div className="p-3">
              <p className="text-[9px] font-semibold tracking-[0.05em] uppercase text-white/50">{t("firms.membersCard.plan")}</p>
              <p className="text-[13px] mt-1">{t("firms.membersCard.planName", tCtx)}</p>
            </div>
          </div>
          <div className="flex flex-col">
            {members.map((m) => (
              <div key={m.email} className="flex items-center gap-2.5 p-2.5 border-b border-white/10">
                <span className="size-7 rounded-full bg-brand-navy-800 flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {m.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    {m.name}
                    {(m.you || m.pending) && (
                      <span className="text-[9px] border border-white/25 rounded-full px-1.5 py-px text-white/60 font-normal">
                        {m.you ? t("firms.membersCard.you") : t("firms.membersCard.pending")}
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-white/50 truncate">{m.email}</p>
                </div>
                <span className="text-[10px] border border-white/25 rounded-md px-2 py-1 shrink-0">
                  {t(`firms.membersCard.roles.${m.role}`)}
                  {/* The owner's role is fixed; everyone else's is a dropdown in the product. */}
                  {m.role !== "owner" && <span aria-hidden> ▾</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="p-3.5 flex flex-col gap-2">
            <p className="text-[9.5px] font-semibold tracking-[0.05em] uppercase text-white/50">
              {t("firms.membersCard.invite")}
            </p>
            <span className="border border-white/20 rounded-md px-2.5 py-2 text-xs text-white/50">
              {t("firms.membersCard.invitePlaceholder", tCtx)}
            </span>
            <span className="bg-brand-gold text-brand-navy-950 rounded-md px-2.5 py-2 text-center text-[10.5px] font-semibold tracking-[0.05em] uppercase">
              {t("firms.membersCard.sendInvite")}
            </span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
          <div className="flex flex-col gap-3.5">
            <h3 className="text-white text-[22px] tracking-[-0.02em]">{t("firms.teamsHeading")}</h3>
            <p className="text-white/75 text-base leading-[1.6]">{t("firms.teamsBody")}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/signup"
                  className="self-start text-xs tracking-[1.2px] uppercase font-semibold px-6 py-3 rounded-full bg-white text-[#0b0b0b] hover:opacity-85 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]"
                >
                  {t("firms.teamsCta")}
                </Link>
              </TooltipTrigger>
              <TooltipContent>Sign up to invite your colleagues</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-col gap-3.5">
            <h3 className="text-white text-[22px] tracking-[-0.02em]">{t("firms.jurisdictionsHeading", tCtx)}</h3>
            <p className="text-white/75 text-base leading-[1.6]">{t("firms.jurisdictionsBody", tCtx)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
