import Link from "next/link";

const companyLinks = [
  { label: "About Us", href: "#" },
  { label: "Contact & Support", href: "mailto:support@ilovelawyer.ph" },
  { label: "RA 10173 Compliance", href: "#" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Security & Data Sovereignty", href: "#" },
];

export function LandingFooter() {
  return (
    <footer className="bg-[#f1f4f6] border-t border-[#c6c6ce] py-12 px-8 md:px-16">
      <div className="max-w-360 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-8">
          <div className="md:col-span-4 flex flex-col gap-5">
            <Link href="/" className="cursor-pointer w-fit">
              <span className="text-[28px] text-black hover:opacity-70 transition-opacity duration-200" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
                ilovelawyer
              </span>
            </Link>
            <p className="text-[#45464d] text-base leading-[1.6] pr-8" style={{ fontFamily: "Inter, sans-serif" }}>
              Premium AI Legal Operations for the Philippine market. We integrate centuries of legal tradition with modern technological innovation.
            </p>
          </div>

          <div className="md:col-span-2 flex flex-col gap-6">
            <h4 className="text-black text-xs tracking-[1.2px] uppercase" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>COMPANY</h4>
            <div className="flex flex-col gap-4">
              {companyLinks.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="text-[#45464d] text-base text-left hover:text-black transition-colors duration-200 leading-6"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="md:col-span-4 flex flex-col gap-6">
            <h4 className="text-black text-xs tracking-[1.2px] uppercase" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>LEGAL</h4>
            <div className="flex flex-col gap-4">
              {legalLinks.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="text-[#45464d] text-base text-left hover:text-black underline decoration-[#c6c6ce] hover:decoration-black transition-colors duration-200 leading-6"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
