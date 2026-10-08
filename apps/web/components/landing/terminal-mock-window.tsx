"use client";

import type { ReactNode } from "react";
import { Maximize2, Pin, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";
import { PANEL_TITLES } from "@/lib/terminal/panel-titles";
import type { DetailedMockKey, LandingPanel } from "@/components/landing/terminal-panel-cards";

// Static miniature "screenshots" of Legal Terminal panes for the landing page's panel carousel.
// Purely presentational. Four panes have a hand-built layout (`terminal.mocks`); every other pane
// uses the generic list layout below, fed by `terminal.samples` — both with a `_UK` variant so a
// UK visitor sees a UK sample case instead of a Philippine one. The pane header uses the
// Terminal's own PANEL_TITLES and the same pin / maximise / close controls a real pane has (no
// keyboard-shortcut badge — the Terminal has no per-pane shortcuts). Type sizes are deliberately
// tiny: each window reads as a scaled-down product screenshot, not as page copy.



interface SampleRow {
  title: string;
  note: string;
  status: string;
}
interface PanelSample {
  intro: string;
  rows: SampleRow[];
}

interface RiskMock {
  level: string;
  percent: number;
  text: string;
}

interface Mocks {
  caseSummary: {
    partyOne: string;
    partyOneName: string;
    partyTwo: string;
    partyTwoName: string;
    claims: string;
    claimsValue: string;
    riskRegister: string;
    add: string;
    risks: RiskMock[];
  };
  evidenceTimeline: {
    documents: string;
    hint: string;
    docs: { name: string; status: string }[];
    timeline: string;
    events: { date: string; tone: string; text: string; source?: string; status?: string }[];
  };
  redTeam: {
    intro: string;
    arguments: { title: string; strength: string; note: string; response?: string }[];
  };
  chat: {
    anchored: string;
    thread: string;
    scope: string;
    question: string;
    source: string;
    answer: string;
    chips: string[];
    placeholder: string;
    send: string;
  };
}

const RED = "text-red-400 border-red-400/40";
const ORANGE = "text-orange-400 border-orange-400/40";
const GREEN = "text-green-400 border-green-400/40";
const GOLD = "text-brand-gold border-brand-gold/40";
// Status words the sample data uses, by the tone the real panes give them (red = hurts us /
// blocked, orange = unresolved, green = done / helps us, gold = neutral highlight).
const TEXT_TONE: Record<string, string> = {
  HIGH: RED, STRONG: RED, DIRECT: RED, ADVERSE: RED, BLOCKED: RED, MATERIAL: RED, FAILED: RED, DISPUTED: RED,
  MEDIUM: ORANGE, MODERATE: ORANGE, PENDING: ORANGE, OPEN: ORANGE, CONTESTED: ORANGE, DRAFTING: ORANGE,
  PARTIAL: ORANGE, OUTSTANDING: ORANGE, ANTICIPATED: ORANGE, UNVERIFIED: ORANGE, ALLEGATION: ORANGE, PROVISIONAL: ORANGE, INDIRECT: ORANGE, STALE: ORANGE, REJECTED: ORANGE,
  READY: GREEN, DONE: GREEN, VERIFIED: GREEN, "ON POINT": GREEN, ANSWERED: GREEN, KEY: GREEN, CONFIRMED: GREEN,
  MODELED: GREEN, FACT: GREEN, APPROVED: GREEN, FAVOURS: GREEN, FAVORS: GREEN, WEAK: GREEN, SUPPORTS: GREEN,
  STATUTE: GOLD, ASSIGNED: GOLD, CITED: GOLD, NODE: GOLD, INFERENCE: GOLD, SHARED: GOLD, BRANCH: GOLD,
};
const BAR_TONE: Record<string, string> = { HIGH: "bg-red-400", MEDIUM: "bg-orange-400" };

function Badge({ value }: { value: string }) {
  return (
    <span className={`shrink-0 rounded-[3px] border px-[3px] font-bold ${TEXT_TONE[value] ?? "text-white/60 border-white/20"}`}>
      {value}
    </span>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-[6.5px] uppercase tracking-[0.05em] text-white/50">{children}</div>;
}

function PaneHeader({ title, extra }: { title: string; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-[5px] border-b border-white/[0.12] pb-1.5">
      <span className="flex-1 truncate text-[8.5px] font-semibold uppercase tracking-[0.06em] text-white">{title}</span>
      {extra ?? (
        <span className="flex items-center gap-[5px] text-white/40" aria-hidden="true">
          <Pin size={8} />
          <Maximize2 size={8} />
          <X size={8} />
        </span>
      )}
    </div>
  );
}

export function TerminalMockWindow({ panel, tenantCode }: { panel: LandingPanel; tenantCode: TenantCode }) {
  const { t } = useTranslation("landing");
  const isUk = tenantCode === "UK";
  // Explicit `_UK` key rather than i18next's `context` option: context is not applied when the
  // value is a nested object, so it would silently keep returning the Philippine sample data.
  const mocks = t(isUk ? "terminal.mocks_UK" : "terminal.mocks", { returnObjects: true }) as unknown as Mocks;
  const title = PANEL_TITLES[panel.id];
  const mock = panel.detailedMock;

  let body: ReactNode;
  if (!mock) {
    const sample = t(`${isUk ? "terminal.samples_UK" : "terminal.samples"}.${panel.id}`, {
      returnObjects: true,
    }) as unknown as PanelSample;
    body = (
      <>
        <PaneHeader title={title} />
        <div className="leading-[1.4] text-white/60">{sample.intro}</div>
        <div className="flex flex-col">
          {sample.rows.map((row, i) => (
            <div
              key={row.title}
              className={`flex items-start justify-between gap-2 py-[5px] ${i < sample.rows.length - 1 ? "border-b border-white/[0.08]" : ""}`}
            >
              <div className="min-w-0">
                <div className="font-semibold text-white">{row.title}</div>
                <div className="mt-px text-[6.5px] uppercase text-white/50">{row.note}</div>
              </div>
              <Badge value={row.status} />
            </div>
          ))}
        </div>
      </>
    );
  } else if (mock === "caseSummary") {
    const m = mocks.caseSummary;
    body = (
      <>
        <PaneHeader title={title} />
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <Label>{m.partyOne}</Label>
            <div className="font-semibold text-white">{m.partyOneName}</div>
          </div>
          <div>
            <Label>{m.partyTwo}</Label>
            <div className="font-semibold text-white">{m.partyTwoName}</div>
          </div>
        </div>
        <div>
          <Label>{m.claims}</Label>
          <div className="text-white">{m.claimsValue}</div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[6.5px] uppercase text-white/50">
            <span>{m.riskRegister}</span>
            <span className="text-brand-gold">{m.add}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {m.risks.map((risk) => (
              <div key={risk.text}>
                <div className="flex justify-between">
                  <Badge value={risk.level} />
                  <span className="text-white/50">{risk.percent}%</span>
                </div>
                <div className="mt-0.5 text-white">{risk.text}</div>
                <div
                  className={`mt-[3px] h-0.5 rounded-sm ${BAR_TONE[risk.level] ?? "bg-white/40"}`}
                  style={{ width: `${risk.percent}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </>
    );
  } else if (mock === "evidenceTimeline") {
    const m = mocks.evidenceTimeline;
    body = (
      <>
        <PaneHeader title={title} />
        <div className="flex items-center justify-between text-[6.5px] uppercase tracking-[0.05em] text-white/50">
          <span>{m.documents}</span>
          <span>{m.hint}</span>
        </div>
        <div className="flex flex-col gap-1">
          {m.docs.map((doc, i) => (
            <div
              key={doc.name}
              className={`flex items-center justify-between gap-2 pb-1 ${
                i < m.docs.length - 1 ? "border-b border-white/[0.08]" : ""
              }`}
            >
              <span className="truncate text-white">{doc.name}</span>
              <Badge value={doc.status} />
            </div>
          ))}
        </div>
        <div className="mt-0.5 text-[6.5px] uppercase tracking-[0.05em] text-white/50">{m.timeline}</div>
        <div className="flex flex-col gap-[5px]">
          {m.events.map((event) => (
            <div key={event.date} className="flex items-start gap-1.5">
              <span className="shrink-0 text-white/50">{event.date}</span>
              <span
                className={`mt-[3px] size-[3px] shrink-0 rounded-full ${
                  event.tone === "red" ? "bg-red-400" : "bg-brand-gold"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-white">{event.text}</div>
                {event.source && (
                  <div className="mt-px flex items-center justify-between gap-2 text-[6.5px] uppercase text-white/50">
                    <span className="truncate">{event.source}</span>
                    {event.status && <Badge value={event.status} />}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  } else if (mock === "redTeam") {
    const m = mocks.redTeam;
    body = (
      <>
        <PaneHeader title={title} />
        <div className="leading-[1.4] text-white/60">{m.intro}</div>
        <div className="flex flex-col gap-1.5">
          {m.arguments.map((arg) => (
            <div key={arg.title}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white">{arg.title}</span>
                <Badge value={arg.strength} />
              </div>
              <div className="mt-px text-[6.5px] uppercase text-white/50">{arg.note}</div>
              {arg.response && <div className="mt-px text-[6.5px] text-brand-gold">{arg.response}</div>}
            </div>
          ))}
        </div>
      </>
    );
  } else {
    const m = mocks.chat;
    body = (
      <>
        <PaneHeader
          title={title}
          extra={<span className="text-[6.5px] uppercase text-brand-gold">{m.anchored}</span>}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-white">{m.thread}</span>
          <span className="text-[6.5px] text-brand-gold">{m.scope}</span>
        </div>
        <div className="max-w-[85%] self-end rounded-lg bg-[#232323] p-1.5 text-white">{m.question}</div>
        <div className="text-[6.5px] uppercase tracking-[0.05em] text-white/50">{m.source}</div>
        <div className="leading-[1.4] text-white">{m.answer}</div>
        <div className="flex gap-[5px]">
          {m.chips.map((chip) => (
            <span key={chip} className="rounded border border-white/[0.18] px-[5px] py-0.5 text-[6.5px] text-white/60">
              {chip}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between rounded-[10px] border border-white/[0.12] px-[7px] py-[5px] text-white/50">
          <span>{m.placeholder}</span>
          <span className="rounded-full bg-brand-gold px-[7px] py-0.5 text-[7px] font-bold text-[#0b0b0b]">{m.send}</span>
        </div>
      </>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="absolute bottom-10 left-[8%] -right-[6%] flex h-[300px] flex-col overflow-hidden rounded-[14px] bg-[#0b0b0b] shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
    >
      <div className="flex h-7 shrink-0 items-center gap-2.5 border-b border-white/10 px-2.5">
        <span className="font-['Libre_Caslon_Text'] text-[11px] tracking-[-0.02em] text-white">ilovelawyer</span>
        {/* Every card is a Terminal pane, so the window is always on the Legal Terminal tab. */}
        <span className="text-[7px] font-bold uppercase tracking-[0.08em] text-white">Legal Terminal</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[7px] overflow-hidden p-2.5 text-[8px]">{body}</div>
    </div>
  );
}
