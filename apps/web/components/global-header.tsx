import Link from "next/link";

type WorkspaceTab = "consultation" | "case" | "library";

const platformLinks = [
  { label: "PLATFORM", href: "#platform" },
  { label: "SOLUTIONS", href: "#solutions" },
  { label: "PRICING", href: "#pricing" },
];

const workspaceTabs: { label: string; href: string; tab: WorkspaceTab }[] = [
  { label: "AI CHAT", href: "/homepage", tab: "consultation" },
  { label: "CASE MANAGEMENT", href: "/homepage/case-portfolio", tab: "case" },
  { label: "LEGAL LIBRARY", href: "/homepage/library", tab: "library" },
];

const comingSoonLinks = [
  { label: "TRANSCRIPTION", href: "#transcription" },
  { label: "DOCUMENT ANALYSIS", href: "#analysis" },
  { label: "STATUTORY TERMS", href: "#terms" },
];

export function GlobalHeader({ activeTab }: { activeTab: WorkspaceTab }) {
  return (
    <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-360 mx-auto px-6 md:px-16 h-16 flex items-center justify-center lg:justify-between gap-6 relative z-10">
        <div className="flex items-center gap-12">
          <span className="font-['Libre_Caslon_Text'] text-2xl font-normal text-black tracking-tight">
            ilovelawyer
          </span>
          <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold tracking-wider text-gray-500">
            {platformLinks.map((link) => (
              <a key={link.label} href={link.href} className="hover:text-black">
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex gap-6 text-gray-400">
          <button className="hover:text-black">🔍</button>
          <button className="hover:text-black">👤</button>
        </div>
      </div>

      <div className="bg-[#0b132b] text-white backdrop-blur-[6px] border-b border-white/10">
        <div className="max-w-360 mx-auto px-6 md:px-16 flex items-center justify-center lg:justify-center gap-8 overflow-x-auto whitespace-nowrap text-[10px] tracking-widest font-medium py-4">
          {workspaceTabs.map(({ label, href, tab }) => (
            <Link
              key={tab}
              href={href}
              className={
                tab === activeTab
                  ? "text-white border-b border-white pb-0.5 uppercase"
                  : "opacity-70 hover:opacity-100 uppercase"
              }
            >
              {label}
            </Link>
          ))}
          {comingSoonLinks.map(({ label, href }) => (
            <a key={label} href={href} className="opacity-70 hover:opacity-100 uppercase">
              {label}
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}
