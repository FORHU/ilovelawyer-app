import { buildFaqJsonLd, type FaqItem } from "@/lib/seo/faq"

// Server component on purpose: every answer must be in the initial HTML for crawlers and AI
// fetchers (most don't run JS). <details> keeps collapsed answers in the DOM and gives native
// keyboard + screen-reader behaviour with no client code. The first item renders open so the
// page's headline answer is visible without a click.
export function FaqSection({
  items,
  heading = "Frequently asked questions",
  lede = "Short, direct answers about what ilovelawyer is, how it checks its citations, and where it applies.",
}: {
  items: FaqItem[]
  heading?: string
  lede?: string
}) {
  return (
    <section id="faq" className="bg-background border-t border-border py-24 md:py-32 px-6 md:px-16 scroll-mt-20">
      {/* Safe: built only from the hardcoded FAQ data in lib/seo/faq.ts. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(items)) }} />

      <div className="max-w-[1160px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-12 lg:gap-20">
        <header className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="font-display text-foreground text-[clamp(36px,4.6vw,60px)] font-light leading-[1] tracking-[-0.02em] text-balance">
            {heading}
          </h2>
          <p className="mt-6 text-muted-foreground text-[15px] leading-[1.65] max-w-[44ch]">{lede}</p>
        </header>

        <div className="border-t border-foreground/20">
          {items.map((item, i) => (
            <details key={item.question} open={i === 0} className="group border-b border-foreground/15">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                <h3 className="font-display text-foreground text-[clamp(20px,2vw,24px)] font-light leading-[1.25] tracking-[-0.01em] text-balance transition-colors duration-200 group-hover:text-brand-gold">
                  {item.question}
                </h3>
                {/* Drawn plus/minus: the vertical bar collapses when open. */}
                <span
                  aria-hidden
                  className="relative mt-[0.55em] size-3.5 shrink-0 text-brand-gold before:absolute before:left-0 before:top-1/2 before:h-px before:w-full before:bg-current after:absolute after:left-1/2 after:top-0 after:h-full after:w-px after:bg-current after:origin-center after:transition-transform after:duration-300 after:ease-[cubic-bezier(0.22,1,0.36,1)] group-open:after:scale-y-0"
                />
              </summary>
              <div className="pb-7 md:pr-10 max-w-[68ch]">
                <p className="text-foreground text-[16px] leading-[1.6]">{item.answer}</p>
                {item.detail && <p className="mt-3 text-muted-foreground text-[15px] leading-[1.65]">{item.detail}</p>}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
