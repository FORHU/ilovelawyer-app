import { britishCatalogs } from "@/lib/i18n/british"

import enAuth from "@/locales/en/auth.json"
import enCalendar from "@/locales/en/calendar.json"
import enCasePortfolio from "@/locales/en/case-portfolio.json"
import enCommon from "@/locales/en/common.json"
import enCreateCase from "@/locales/en/create-case.json"
import enHomepage from "@/locales/en/homepage.json"
import enLanding from "@/locales/en/landing.json"
import enLibrary from "@/locales/en/library.json"
import enOrganization from "@/locales/en/organization.json"
import enProfile from "@/locales/en/profile.json"
import enTerm from "@/locales/en/term.json"
import enTerminal from "@/locales/en/terminal.json"
import enTranscription from "@/locales/en/transcription.json"

// en-GB holds only what a transform cannot derive: the terms UK practice uses. British spelling is
// applied to the American catalogs at load time instead — see lib/i18n/british.ts for why the
// output isn't checked in.
import enGBCasePortfolio from "@/locales/en-GB/case-portfolio.json"
import enGBCreateCase from "@/locales/en-GB/create-case.json"
import enGBTerminal from "@/locales/en-GB/terminal.json"

import koAuth from "@/locales/ko/auth.json"
import koCalendar from "@/locales/ko/calendar.json"
import koCasePortfolio from "@/locales/ko/case-portfolio.json"
import koCommon from "@/locales/ko/common.json"
import koCreateCase from "@/locales/ko/create-case.json"
import koHomepage from "@/locales/ko/homepage.json"
import koLanding from "@/locales/ko/landing.json"
import koLibrary from "@/locales/ko/library.json"
import koOrganization from "@/locales/ko/organization.json"
import koProfile from "@/locales/ko/profile.json"
import koTerm from "@/locales/ko/term.json"
import koTerminal from "@/locales/ko/terminal.json"
import koTranscription from "@/locales/ko/transcription.json"

import tlAuth from "@/locales/tl/auth.json"
import tlCalendar from "@/locales/tl/calendar.json"
import tlCasePortfolio from "@/locales/tl/case-portfolio.json"
import tlCommon from "@/locales/tl/common.json"
import tlCreateCase from "@/locales/tl/create-case.json"
import tlHomepage from "@/locales/tl/homepage.json"
import tlLanding from "@/locales/tl/landing.json"
import tlLibrary from "@/locales/tl/library.json"
import tlOrganization from "@/locales/tl/organization.json"
import tlProfile from "@/locales/tl/profile.json"
import tlTerm from "@/locales/tl/term.json"
import tlTerminal from "@/locales/tl/terminal.json"
import tlTranscription from "@/locales/tl/transcription.json"

const EN = {
  common: enCommon,
  auth: enAuth,
  landing: enLanding,
  homepage: enHomepage,
  calendar: enCalendar,
  "case-portfolio": enCasePortfolio,
  "create-case": enCreateCase,
  library: enLibrary,
  transcription: enTranscription,
  profile: enProfile,
  organization: enOrganization,
  term: enTerm,
  terminal: enTerminal,
} as const

// Only the differences British spelling can't derive — the terms UK practice uses. Keyed by
// namespace; namespaces with nothing to override are simply absent.
const EN_GB_TERMS = {
  "case-portfolio": enGBCasePortfolio,
  "create-case": enGBCreateCase,
  terminal: enGBTerminal,
}

// Statically bundled: catalogs are small, curated, and this avoids a runtime
// fetch/backend just to swap Display Language.
export const I18N_RESOURCES = {
  en: EN,
  // Derived, not checked in: every namespace en has, respelled, with the UK terms over the top.
  // See lib/i18n/british.ts.
  "en-GB": britishCatalogs(EN, EN_GB_TERMS),
  ko: {
    common: koCommon,
    auth: koAuth,
    landing: koLanding,
    homepage: koHomepage,
    calendar: koCalendar,
    "case-portfolio": koCasePortfolio,
    "create-case": koCreateCase,
    library: koLibrary,
    transcription: koTranscription,
    profile: koProfile,
    organization: koOrganization,
    term: koTerm,
    terminal: koTerminal,
  },
  tl: {
    common: tlCommon,
    auth: tlAuth,
    landing: tlLanding,
    homepage: tlHomepage,
    calendar: tlCalendar,
    "case-portfolio": tlCasePortfolio,
    "create-case": tlCreateCase,
    library: tlLibrary,
    transcription: tlTranscription,
    profile: tlProfile,
    organization: tlOrganization,
    term: tlTerm,
    terminal: tlTerminal,
  },
} as const
