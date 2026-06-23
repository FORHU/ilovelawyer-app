import { Logo } from "@/components/logo";

const links = ["PRIVACY POLICY", "TERMS OF SERVICE", "LEGAL DISCLAIMER", "COOKIE POLICY", "SUPPORT"];

export function SharedFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className="bg-[#0a192f] w-full">
      <div className={`flex flex-col items-center ${compact ? "px-8 py-12" : "px-16 py-16"}`}>
        <Logo textColor="white" size={compact ? 20 : 28} />
        <div className={`flex flex-wrap gap-6 justify-center ${compact ? "mt-6" : "mt-8"}`}>
          {links.map((link) => (
            <button
              key={link}
              className="text-[#76849f] text-xs tracking-widest uppercase opacity-80 hover:opacity-100 transition-opacity cursor-pointer bg-transparent border-0"
              style={{ fontFamily: "'Source Serif 4', serif" }}
            >
              {link}
            </button>
          ))}
        </div>
        <div className={`${compact ? "mt-6" : "mt-8"} pt-6 w-full border-t border-white/10 text-center`}>
          <p className="text-white/40 text-sm" style={{ fontFamily: "'Source Serif 4', serif" }}>
            © 2026 ilovelawyer AI Legal Systems. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
