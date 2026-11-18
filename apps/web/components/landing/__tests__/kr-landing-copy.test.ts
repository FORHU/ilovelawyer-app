import { describe, expect, it } from "vitest";
import enLanding from "@/locales/en/landing.json";
import koLanding from "@/locales/ko/landing.json";
import { cardKeyOf, panelsForTenant } from "@/components/landing/terminal-panel-cards";
import { getTenantCodeConfig } from "@/config/tenant-codes";
import { copyContext, copyKey } from "@/lib/landing/copy-context";

type Landing = typeof enLanding & typeof koLanding;
const LOCALES: [string, Landing][] = [
  ["en", enLanding as Landing],
  ["ko", koLanding as Landing],
];

describe("copy helpers", () => {
  it("uses bare keys for PH and suffixed keys / i18next context for the others", () => {
    expect(copyKey("terminal.mocks", "PH")).toBe("terminal.mocks");
    expect(copyKey("terminal.mocks", "UK")).toBe("terminal.mocks_UK");
    expect(copyKey("terminal.mocks", "KR")).toBe("terminal.mocks_KR");
    expect(copyContext("PH")).toBeUndefined();
    expect(copyContext("KR")).toEqual({ context: "KR" });
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
