import { DEVELOPER_NAME, DEVELOPER_PAGE_URL } from "@/lib/seo/brand"

// Server component on purpose: the real footer is client-portaled (footer-reveal-portal.tsx), so
// it isn't in the initial HTML. This keeps the developer backlink there for crawlers. Plain
// <a>, no rel attribute, so the link passes full link equity to forhu.ai.
export function DeveloperCredit() {
  return (
    <p className="bg-background border-t border-border py-6 px-6 md:px-16 text-center text-[13px] text-muted-foreground">
      Developed by <a href={DEVELOPER_PAGE_URL} className="underline underline-offset-4 hover:text-foreground">{DEVELOPER_NAME}</a>
    </p>
  )
}
