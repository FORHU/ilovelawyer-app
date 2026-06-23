import Link from "next/link";

export function CTASection() {
  return (
    <section className="bg-[#f7f9fb] py-24 px-6 md:px-16">
      <div className="max-w-[800px] mx-auto flex flex-col items-center gap-6 text-center">
        <h2
          className="text-[#0a192f] text-[clamp(32px,5vw,52px)] leading-[1.5]"
          style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 400 }}
        >
          Ready to Elevate Your Practice?
        </h2>
        <p className="text-[#44474d] text-xl leading-[1.625]" style={{ fontFamily: "'Source Serif 4', serif" }}>
          Join over 5,000 legal professionals already using ilovelawyer to redefine the standards of legal intelligence.
        </p>
        <div className="flex flex-wrap gap-4 justify-center mt-2">
          <Link
            href="/signup"
            className="bg-[#0a192f] text-white text-lg px-10 py-5 rounded-lg hover:bg-[#142744] transition-colors shadow-[0px_10px_15px_-3px_rgba(10,25,47,0.2)]"
            style={{ fontFamily: "'Source Serif 4', serif" }}
          >
            Start Your Free Trial
          </Link>
          <button
            className="bg-white text-[#0a192f] text-lg px-10 py-5 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors border border-[#d8dadc]"
            style={{ fontFamily: "'Source Serif 4', serif" }}
          >
            Schedule a Demo
          </button>
        </div>
        <p className="text-[rgba(68,71,77,0.6)] text-xs" style={{ fontFamily: "'Source Serif 4', serif" }}>
          No credit card required. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
