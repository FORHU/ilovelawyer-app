import svgPaths from "@/imports/IlovelawyerLandingPageWithInActionSection/svg-4n6twsb3v9";

export function FeaturesSection() {
  return (
    <section className="bg-[#f2f4f6] py-24 px-6 md:px-16">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-16 items-center">
        <div className="flex flex-col gap-4 items-center max-w-3xl text-center">
          <h2
            className="text-[#0a192f] text-[clamp(28px,4vw,42px)] leading-[1.5]"
            style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 400 }}
          >
            Precision Engineering for Legal Teams
          </h2>
          <p className="text-[#44474d] text-lg" style={{ fontFamily: "'Source Serif 4', serif" }}>
            Our system isn&apos;t just a chatbot. It&apos;s a vertically integrated legal operating system designed for the highest level of rigor.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
          <div className="bg-white rounded-xl border border-[#d8dadc] p-8 lg:col-span-2">
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div className="flex-1 flex flex-col gap-4">
                <svg className="size-8" fill="none" viewBox="0 0 33.3333 33.3333">
                  <path d={svgPaths.p2ccb6580} fill="#0059BB" />
                </svg>
                <h3
                  className="text-[#191c1e] text-2xl pt-1"
                  style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 400 }}
                >
                  Institutional Legal Context
                </h3>
                <p className="text-[#44474d] text-base leading-[1.625]" style={{ fontFamily: "'Source Serif 4', serif" }}>
                  Access a massive repository of cross-jurisdictional precedents and statutes instantly. Our AI understands the nuance between different territories and specialized fields of law.
                </p>
                <div className="flex flex-col gap-2 pt-4">
                  {["Multi-jurisdictional Analysis", "Statute Synchronization"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <svg className="size-[15px] shrink-0" fill="none" viewBox="0 0 15 15">
                        <path d={svgPaths.p1041200} fill="#0059BB" />
                      </svg>
                      <span className="text-[#191c1e] text-sm" style={{ fontFamily: "'Source Serif 4', serif" }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-[192px] rounded-lg overflow-hidden bg-[#e8edf5] flex items-center justify-center">
                <span className="text-[#76849f] text-sm" style={{ fontFamily: "'Source Serif 4', serif" }}>Columns image</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#d8dadc] p-8">
            <svg className="w-[33px] h-[27px]" fill="none" viewBox="0 0 33.3361 26.6667">
              <path d={svgPaths.p2cbc7d80} fill="#0059BB" />
            </svg>
            <h3
              className="text-[#191c1e] text-xl pt-5 pb-3"
              style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 400 }}
            >
              Rapid Synthesis
            </h3>
            <p className="text-[#44474d] text-base leading-[1.625]" style={{ fontFamily: "'Source Serif 4', serif" }}>
              Turn 100-page discovery documents into actionable executive summaries in less than 30 seconds.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
