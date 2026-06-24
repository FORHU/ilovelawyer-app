import svgPaths from "@/imports/ActionSection/svg-4n6twsb3v9";

const steps = [
  {
    num: "01",
    title: "Input Context",
    titleClassName: "text-[#191c1e] dark:text-[#e2e8f0]",
    desc: "Upload documents, audio recordings, or brief summaries of your legal challenge.",
    iconPath: svgPaths.p143bba80,
    iconViewBox: "0 0 21.3333 26.6667",
    circleClassName: "bg-[#f2f4f6] dark:bg-[#1e3350]",
    iconFill: "#0059BB",
  },
  {
    num: "02",
    title: "AI Processing",
    titleClassName: "text-[#0059bb] dark:text-[#4d9cf8]",
    desc: "Our neural network cross-references millions of legal nodes to identify strategy and risk.",
    iconPath: svgPaths.p2c877e00,
    iconViewBox: "0 0 25.349 26.6667",
    circleClassName: "bg-[#0070ea]",
    iconFill: "white",
  },
  {
    num: "03",
    title: "Actionable Output",
    titleClassName: "text-[#191c1e] dark:text-[#e2e8f0]",
    desc: "Receive a precise legal roadmap, draft documents, or specific case-law citations.",
    iconPath: svgPaths.p2039fd80,
    iconViewBox: "0 0 24 24",
    circleClassName: "bg-[#f2f4f6] dark:bg-[#1e3350]",
    iconFill: "#0059BB",
  },
];

export function ProcessSection() {
  return (
    <section className="bg-white dark:bg-[#0d1b2a] py-24 px-6 md:px-16 border-b border-[#d8dadc] dark:border-[#1e3350]">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-20 items-start">
        <div className="flex flex-col gap-4 items-center w-full">
          <h2
            className="text-[#0a192f] dark:text-[#e2e8f0] text-[clamp(32px,4vw,52px)] text-center leading-[1.5]"
            style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 400 }}
          >
            Streamlined Insights
          </h2>
          <div className="bg-[#0059bb] h-1 w-24 rounded-full" />
        </div>

        <div className="relative w-full grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="hidden md:block absolute top-10 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-transparent via-[#d8dadc] dark:via-[#1e3350] to-transparent" />
          {steps.map((step) => (
            <div key={step.num} className="flex flex-col items-center text-center relative pt-10">
              <div
                className={`absolute top-0 left-1/2 -translate-x-1/2 rounded-full size-20 flex items-center justify-center border-4 border-white dark:border-[#0d1b2a] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1)] ${step.circleClassName}`}
              >
                <svg className="size-7" fill="none" viewBox={step.iconViewBox}>
                  <path d={step.iconPath} fill={step.iconFill} />
                </svg>
                <div className="absolute -top-1 -right-1 bg-[#0a192f] rounded-full size-8 flex items-center justify-center">
                  <span className="text-white text-sm" style={{ fontFamily: "'Source Serif 4', serif" }}>
                    {step.num}
                  </span>
                </div>
              </div>
              <h3
                className={`text-[28px] leading-[42px] mt-8 ${step.titleClassName}`}
                style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 400 }}
              >
                {step.title}
              </h3>
              <p className="text-[#44474d] dark:text-[#94a3b8] text-lg mt-6" style={{ fontFamily: "'Source Serif 4', serif" }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
