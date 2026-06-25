import Link from "next/link";



const companyLinks = ["About Us", "Contact & Support", "RA 10173 Compliance"];
const legalLinks = ["Privacy Policy", "Terms of Service", "Security & Data Sovereignty"];

export function LandingFooter() {
  return (
    <footer className="bg-[#f1f4f6] border-t border-[#c6c6ce] py-12 px-8 md:px-16">
      <div className="max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-8">
          <div className="md:col-span-4 flex flex-col gap-5">
            <span className="text-[28px] text-black" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
              ilovelawyer
            </span>
            <p className="text-[#45464d] text-base leading-[1.6] pr-8" style={{ fontFamily: "Inter, sans-serif" }}>
              Premium AI Legal Operations for the Philippine market. We integrate centuries of legal tradition with modern technological innovation.
            </p>
          </div>


          <div className="md:col-span-2 flex flex-col gap-6">
            <h4 className="text-black text-xs tracking-[1.2px] uppercase" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>COMPANY</h4>
            <div className="flex flex-col gap-4">
              {companyLinks.map((label) => (
                <button key={label} className="text-[#45464d] text-base text-left cursor-pointer bg-transparent border-0 hover:text-black transition-colors leading-6" style={{ fontFamily: "Inter, sans-serif" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-4 flex flex-col gap-6">
            <h4 className="text-black text-xs tracking-[1.2px] uppercase" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>LEGAL</h4>
            <div className="flex flex-col gap-4">
              {legalLinks.map((label) => (
                <button key={label} className="text-[#45464d] text-base text-left cursor-pointer bg-transparent border-0 hover:text-black underline transition-colors leading-6" style={{ fontFamily: "Inter, sans-serif" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-[rgba(198,198,206,0.3)] pt-8 flex items-center justify-between flex-wrap gap-4">
          <p className="text-[#45464d] text-base" style={{ fontFamily: "Inter, sans-serif" }}>
            © 2024 ilovelawyer. All rights reserved. Premium AI Legal Operations.
          </p>
          <div className="flex items-center gap-6">
            <div className="w-4 h-4 rounded-sm bg-[#45464d]/40 cursor-pointer" />
            <div className="size-4 rounded-full border border-[#45464d]/40 cursor-pointer" />
          </div>
        </div>
      </div>
    </footer>
  );
}
