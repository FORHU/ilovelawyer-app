// Brand-level entity data, so Google can tie "ilovelawyer" / "I Love Lawyer" to one entity
// that owns the apex, ph. and uk. sites. Only verifiable facts go here.

export const BRAND_ORIGIN = "https://ilovelawyer.com"
export const BRAND_NAME = "ilovelawyer"
export const BRAND_ALTERNATE_NAMES = ["I Love Lawyer"]

// ilovelawyer's OWN official profiles (LinkedIn, X, etc.). Left empty on purpose: the only
// profile we know of belongs to the developer (Forhu AI, below), and listing it here would
// claim it is ilovelawyer's. Add real ilovelawyer profiles as they exist — consistent sameAs
// links are the strongest brand-matching signal.
export const BRAND_SAME_AS: string[] = []

export const DEVELOPER_NAME = "Forhu AI"
export const DEVELOPER_PAGE_URL = "https://forhu.ai/ilovelawyer"

// Same @id as the Organization on forhu.ai (which lists ilovelawyer's ph. and uk. sites as
// brands), so the relationship is stated from both sides.
const DEVELOPER = {
  "@type": "Organization",
  "@id": "https://forhu.ai/#organization",
  name: DEVELOPER_NAME,
  url: "https://forhu.ai",
  sameAs: ["https://www.instagram.com/forhu_ai/"],
}

export const BRAND_DESCRIPTION =
  "ilovelawyer is an AI legal intelligence platform for lawyers: case management, AI consultation with cited case law, and a Legal Terminal. It is software, not a law firm."

const ORGANIZATION_ID = `${BRAND_ORIGIN}/#organization`

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: BRAND_NAME,
    alternateName: BRAND_ALTERNATE_NAMES,
    url: `${BRAND_ORIGIN}/`,
    logo: `${BRAND_ORIGIN}/opengraph-image.png`,
    description: BRAND_DESCRIPTION,
    parentOrganization: DEVELOPER,
    ...(BRAND_SAME_AS.length > 0 && { sameAs: BRAND_SAME_AS }),
  }
}

/** WebSite for the host actually serving the page (apex, ph. or uk.): Google reads site name
 * from each site's own homepage, so `url` must be that host's origin, not the apex. */
export function buildWebSiteJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: BRAND_NAME,
    alternateName: BRAND_ALTERNATE_NAMES,
    url: `${origin}/`,
    publisher: { "@id": ORGANIZATION_ID },
  }
}

export function brandJsonLd(origin: string) {
  return [buildOrganizationJsonLd(), buildWebSiteJsonLd(origin)]
}
