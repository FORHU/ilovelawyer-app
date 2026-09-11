import { Logo } from "@/components/logo";
import { hostForTenantCode } from "@/lib/tenant-code/resolve-host";

// Local dev hosts (`ph.localhost:3002`, `ph.ilovelawyer.local:3002`, bare `ph.ilovelawyer:3002`)
// are the only ones ever served over plain HTTP — matches the dev-host conventions documented
// in lib/tenant-code/resolve-host.ts.
function protocolFor(host: string): "http" | "https" {
  return /(localhost|\.local)(:|$)/i.test(host) ? "http" : "https";
}

/**
 * Shown on any host that didn't resolve to a Tenant — the bare apex (ilovelawyer.com) and
 * app.ilovelawyer.com alike (see app/page.tsx). Deliberately carries no PH- or UK-specific
 * copy/branding of its own; it only exists to route the visitor to the design that does.
 */
export function NeutralLandingSplash({ currentHost }: { currentHost: string }) {
  const protocol = protocolFor(currentHost);
  const ukHref = `${protocol}://${hostForTenantCode("UK", currentHost)}`;
  const phHref = `${protocol}://${hostForTenantCode("PH", currentHost)}`;

  return (
    <section className="flex-1 flex flex-col items-center justify-center gap-12 px-8 py-24 text-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Logo forBackground="auto" size={40} />
        <p
          className="text-muted-foreground text-base max-w-md"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Choose your jurisdiction to continue.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <a
          href={ukHref}
          className="flex items-center justify-center gap-3 border border-foreground text-foreground px-10 py-6 text-xs tracking-[1.2px] uppercase hover:bg-foreground/5 transition-colors duration-200"
          style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
        >
          🇬🇧 United Kingdom
        </a>
        <a
          href={phHref}
          className="flex items-center justify-center gap-3 border border-foreground text-foreground px-10 py-6 text-xs tracking-[1.2px] uppercase hover:bg-foreground/5 transition-colors duration-200"
          style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
        >
          🇵🇭 Philippines
        </a>
      </div>
    </section>
  );
}
