import { describe, it, expect } from "vitest"
import { getLibraryConfig, ukCourtLabel } from "../library-config"

describe("getLibraryConfig", () => {
  it("PH: both categories browse, jurisprudence gets caseType+topics, republic-acts topics only", () => {
    const cfg = getLibraryConfig("PH")
    expect(cfg.categories.map((c) => c.value)).to.deep.equal(["jurisprudence", "republic-acts"])
    expect(cfg.browsable("jurisprudence")).to.equal(true)
    expect(cfg.browsable("republic-acts")).to.equal(true)
    expect(cfg.facetKind("jurisprudence")).to.equal("ph-jurisprudence")
    expect(cfg.facetKind("republic-acts")).to.equal("ph-topics")
    expect(cfg.isLegislation("republic-acts")).to.equal(true)
    expect(cfg.isLegislation("jurisprudence")).to.equal(false)
    expect(cfg.leadActorLabelKey).to.equal("lawSearch.ponenteLabel")
  })

  it("UK: case law browses by court, legislation is search-only", () => {
    const cfg = getLibraryConfig("UK")
    expect(cfg.categories.map((c) => c.value)).to.deep.equal(["uk-case-law", "uk-legislation"])
    expect(cfg.browsable("uk-case-law")).to.equal(true)
    expect(cfg.browsable("uk-legislation")).to.equal(false)
    expect(cfg.facetKind("uk-case-law")).to.equal("uk-court")
    expect(cfg.facetKind("uk-legislation")).to.equal("none")
    expect(cfg.isLegislation("uk-legislation")).to.equal(true)
    expect(cfg.leadActorLabelKey).to.equal("lawSearch.judgeLabel")
    expect(cfg.courts).to.include("uksc")
  })

  it("falls back to the PH config for an unknown / missing tenant", () => {
    expect(getLibraryConfig(null).categories[0]?.value).to.equal("jurisprudence")
    expect(getLibraryConfig(undefined).categories[0]?.value).to.equal("jurisprudence")
    expect(getLibraryConfig("XX").categories[0]?.value).to.equal("jurisprudence")
  })

  it("ukCourtLabel humanizes slugs", () => {
    expect(ukCourtLabel("uksc")).to.equal("UKSC")
    expect(ukCourtLabel("ewca/civ")).to.equal("EWCA (Civ)")
    expect(ukCourtLabel("ukut/iac")).to.equal("UKUT (Iac)")
  })
})
