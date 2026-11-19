import { describe, it, expect } from "vitest"
import { getLibraryConfig, hasLibrary, krCourtLabel, ukCourtFromCode, ukCourtLabel } from "../library-config"

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
    expect(cfg.facetKind("uk-case-law")).to.equal("court")
    expect(cfg.facetKind("uk-legislation")).to.equal("none")
    expect(cfg.isLegislation("uk-legislation")).to.equal(true)
    expect(cfg.leadActorLabelKey).to.equal("lawSearch.judgeLabel")
    expect(cfg.courts).to.include("uksc")
  })

  it("KR: 판례 browses by court, 법령 is search-only, with Korean section headings", () => {
    const cfg = getLibraryConfig("KR")
    expect(cfg.categories.map((c) => c.value)).to.deep.equal(["kr-case-law", "kr-legislation"])
    expect(cfg.browsable("kr-case-law")).to.equal(true)
    expect(cfg.browsable("kr-legislation")).to.equal(false)
    expect(cfg.facetKind("kr-case-law")).to.equal("court")
    expect(cfg.facetKind("kr-legislation")).to.equal("none")
    expect(cfg.isLegislation("kr-legislation")).to.equal(true)
    expect(cfg.courts[0]).to.equal("대법원")
    expect(cfg.docLabelKeys?.courtReasoning).to.equal("lawDoc.kr.holdings")
  })

  it("names a KR court in the page's language", () => {
    expect(krCourtLabel("대법원", "ko")).to.equal("대법원")
    expect(krCourtLabel("대법원", "en")).to.equal("Supreme Court")
    expect(krCourtLabel("서울중앙지방법원", "en-GB")).to.equal("Seoul Central District Court")
    expect(getLibraryConfig("UK").courtLabel("ewca/civ", "ko")).to.equal("EWCA (Civ)")
  })

  it("has a library on PH, UK and KR only", () => {
    expect(["PH", "UK", "KR"].every((code) => hasLibrary(code as never))).to.equal(true)
    expect(hasLibrary(null)).to.equal(false)
    expect(hasLibrary("XX" as never)).to.equal(false)
  })

  it("falls back to the PH config for an unknown / missing tenant", () => {
    expect(getLibraryConfig(null).categories[0]?.value).to.equal("jurisprudence")
    expect(getLibraryConfig(undefined).categories[0]?.value).to.equal("jurisprudence")
    expect(getLibraryConfig("XX").categories[0]?.value).to.equal("jurisprudence")
  })

  it("ukCourtLabel humanizes slugs", () => {
    expect(ukCourtLabel("uksc")).to.equal("UKSC")
    expect(ukCourtLabel("ewca/civ")).to.equal("EWCA (Civ)")
    expect(ukCourtLabel("ewhc/admlty")).to.equal("EWHC (Admlty)")
  })

  it("ukCourtLabel keeps division initialisms in capitals", () => {
    expect(ukCourtLabel("ewhc/kb")).to.equal("EWHC (KB)")
    expect(ukCourtLabel("ewhc/tcc")).to.equal("EWHC (TCC)")
    expect(ukCourtLabel("ewhc/ipec")).to.equal("EWHC (IPEC)")
    expect(ukCourtLabel("ewhc/scco")).to.equal("EWHC (SCCO)")
    expect(ukCourtLabel("ukut/iac")).to.equal("UKUT (IAC)")
    expect(ukCourtLabel("ukut/aac")).to.equal("UKUT (AAC)")
    expect(ukCourtLabel("ukut/tcc")).to.equal("UKUT (TCC)")
    expect(ukCourtLabel("ukut/lc")).to.equal("UKUT (LC)")
    expect(ukCourtLabel("ukftt/tc")).to.equal("UKFTT (TC)")
    expect(ukCourtLabel("ukftt/grc")).to.equal("UKFTT (GRC)")
  })

  it("ukCourtFromCode normalises a stored court code and names the court", () => {
    expect(ukCourtFromCode("UKSC")).to.deep.equal({ label: "UKSC", name: "UK Supreme Court" })
    expect(ukCourtFromCode("EWHC (Kb)")).to.deep.equal({
      label: "EWHC (KB)",
      name: "High Court (King's Bench Division)",
    })
    expect(ukCourtFromCode("UKUT (IAC)").name).to.equal("Upper Tribunal (Immigration and Asylum Chamber)")
    expect(ukCourtFromCode("EWCA (Civ)").label).to.equal("EWCA (Civ)")
    expect(ukCourtFromCode("XYZ")).to.deep.equal({ label: "XYZ", name: null })
  })
})
