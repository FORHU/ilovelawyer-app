import { describe, expect, it } from "vitest";
import enLanding from "@/locales/en/landing.json";
import koLanding from "@/locales/ko/landing.json";
import tlLanding from "@/locales/tl/landing.json";
import { cardKeyOf, panelsForTenant } from "@/components/landing/terminal-panel-cards";
import { getTenantCodeConfig, tenantI18nContext } from "@/config/tenant-codes";

type Landing = typeof enLanding & typeof koLanding;
const LOCALES: [string, Landing][] = [
  ["en", enLanding as Landing],
  ["ko", koLanding as Landing],
];

describe("site copy context", () => {
  it("uses bare keys for PH and the i18next context (`_UK` / `_KR`) for the others", () => {
    expect(tenantI18nContext("PH")).toBeUndefined();
    expect(tenantI18nContext("UK")).toEqual({ context: "UK" });
    expect(tenantI18nContext("KR")).toEqual({ context: "KR" });
  });
});

describe.each(LOCALES)("KR landing copy (%s)", (_lang, landing) => {
  const panels = panelsForTenant("KR");

  it("has KR copy for every hero slide", () => {
    for (const slide of ["slideOne", "slideTwo", "slideThree"] as const) {
      const s = landing.hero[slide] as Record<string, string>;
      expect(s.line1_KR, slide).toBeTruthy();
      expect(s.line2_KR, slide).toBeTruthy();
      expect(s.subtext_KR, slide).toBeTruthy();
    }
  });

  it("has a KR sample for every generic terminal card and every hand-built mock", () => {
    const samples = landing.terminal.samples_KR as Record<string, { intro: string; rows: unknown[] }>;
    const mocks = landing.terminal.mocks_KR as Record<string, unknown>;
    for (const panel of panels) {
      if (panel.detailedMock) expect(mocks[panel.detailedMock], panel.detailedMock).toBeTruthy();
      else {
        expect(samples[panel.id], panel.id).toBeTruthy();
        expect(samples[panel.id]!.rows.length, panel.id).toBeGreaterThan(0);
      }
    }
  });

  it("shows the KR consultation, firm and footer copy", () => {
    expect(landing.consultation.relatedCasesItems_KR.length).toBeGreaterThan(0);
    expect(landing.consultation.caseName_KR).toBeTruthy();
    expect(landing.consultation.sampleNotice_KR).toBeTruthy();
    expect(landing.firms.roster_KR).toHaveLength(4);
    expect(landing.firms.jurisdictionsHeading_KR).toBeTruthy();
    expect(landing.footer.columns.jurisdictions.links.southKorea).toBeTruthy();
  });

  it("keeps the roster emails unique (they are the React keys)", () => {
    const emails = landing.firms.roster_KR.map((m) => m.email);
    expect(new Set(emails).size).toBe(emails.length);
  });
});

describe("KR terminal in Korean", () => {
  it("translates every category, card and pane title", () => {
    const terminal = koLanding.terminal as Record<string, Record<string, string>>;
    for (const category of ["all", "facts", "law", "strategy", "risk", "team"]) {
      expect(terminal.categories![category], category).toBeTruthy();
    }
    for (const panel of panelsForTenant("KR")) {
      expect(terminal.cards![cardKeyOf(panel)], `card ${cardKeyOf(panel)}`).toBeTruthy();
      expect(terminal.titles_KR![cardKeyOf(panel)], `title ${cardKeyOf(panel)}`).toBeTruthy();
    }
  });
});

describe("KR tenant config", () => {
  it("opens in Korean with a still-image hero served from /landing/kr", () => {
    const kr = getTenantCodeConfig("KR");
    expect(kr.defaultLanguage).toBe("ko");
    expect(kr.landingAssets.heroVideos).toBeUndefined();
    expect(kr.landingAssets.heroPosters).toHaveLength(3);
  });
});

describe.each(LOCALES)("terminal sample wording (%s)", (_lang, landing) => {
  const blocks = Object.entries(landing.terminal as Record<string, unknown>).filter(([key]) => /^(mocks|samples)(_|$)/.test(key));

  const walk = (node: unknown, visit: (key: string, value: unknown) => void) => {
    if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
    else if (node && typeof node === "object")
      for (const [key, value] of Object.entries(node)) {
        visit(key, value);
        walk(value, visit);
      }
  };

  it("finds the sample blocks it is meant to check", () => {
    expect(blocks.length).toBeGreaterThan(0);
  });

  it("shows risk as a labelled level, never a percentage that looks like a probability", () => {
    for (const [name, block] of blocks) {
      walk(block, (key) => expect(key, `${name} has a "percent"`).not.toBe("percent"));
    }
    for (const [name, block] of blocks) {
      const summary = (block as { caseSummary?: { riskBasis?: string } }).caseSummary;
      if (summary) expect(summary.riskBasis, `${name}.caseSummary.riskBasis`).toBeTruthy();
    }
  });

  it("doesn't badge a row VERIFIED when all we know is that a source was found", () => {
    for (const [name, block] of blocks) {
      walk(block, (key, value) => {
        if (key === "status") expect(["VERIFIED", "확인"], `${name} has status ${String(value)}`).not.toContain(value);
      });
    }
  });
});

describe.each([...LOCALES, ["tl", tlLanding as unknown as Landing] as [string, Landing]])("footer operator line (%s)", (_lang, landing) => {
  it("names FORHU Inc. and where to reach it, the same on every site", () => {
    const operator = (landing.footer as unknown as { operator?: string }).operator ?? "";
    for (const fact of ["FORHU Inc.", "10371682", "Jungkwan Shin", "30 Wall Street, 8th Floor, New York, NY 10005, USA", "ilovelawyer@forhu.ai"]) {
      expect(operator, fact).toContain(fact);
    }
  });
});
