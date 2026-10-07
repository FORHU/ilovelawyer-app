import { FaqSection } from "@/components/landing/faq-section"
import { BRAND_DESCRIPTION, BRAND_ORIGIN, brandJsonLd } from "@/lib/seo/brand"
import { getFaqItems } from "@/lib/seo/faq"
import { hostForTenantCode, protocolForHost } from "@/lib/tenant-code/resolve-host"

/**
 * Indexable brand copy for the apex (ilovelawyer.com), rendered under the jurisdiction picker.
 * Gives "ilovelawyer" searches a crawlable page that states what the brand is and links to both
 * jurisdiction sites, plus the Organization/WebSite entity markup (lib/seo/brand.ts).
 */
export function ApexBrandContent({ currentHost }: { currentHost: string }) {
  const protocol = protocolForHost(currentHost)
  const ukHref = `${protocol}://${hostForTenantCode("UK", currentHost)}/`
  const phHref = `${protocol}://${hostForTenantCode("PH", currentHost)}/`

  return (
    <>
      {/* Safe: built only from hardcoded brand constants. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(brandJsonLd(BRAND_ORIGIN)) }} />
      <section className="bg-background px-6 md:px-16 pb-16 text-center">
        <h1 className="font-display text-foreground text-[clamp(30px,4vw,48px)] font-light tracking-[-0.02em] max-w-[900px] mx-auto">
          ilovelawyer — AI legal intelligence for lawyers
        </h1>
        <p className="mt-5 text-muted-foreground text-base leading-[1.65] max-w-[680px] mx-auto">{BRAND_DESCRIPTION}</p>
        <p className="mt-5 text-base max-w-[680px] mx-auto">
          <a href={phHref} className="underline underline-offset-4">ilovelawyer Philippines</a>
          {" · "}
          <a href={ukHref} className="underline underline-offset-4">ilovelawyer UK</a>
        </p>
      </section>
      <FaqSection items={getFaqItems("APEX")} />
    </>
  )
}
