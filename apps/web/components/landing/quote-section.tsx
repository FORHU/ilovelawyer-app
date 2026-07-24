"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface Quote {
  text: string;
  author: string;
  firm: string;
}

export function QuoteSection() {
  const { t } = useTranslation("landing");
  const quotes = t("quotes.items", { returnObjects: true }) as Quote[];
  const [displayed, setDisplayed] = useState(0);
  const [fading, setFading] = useState(false);

  const changeQuote = (index: number) => {
    if (index === displayed) return;
    setFading(true);
    setTimeout(() => {
      setDisplayed(index);
      setFading(false);
    }, 200);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setDisplayed((prev) => (prev + 1) % quotes.length);
        setFading(false);
      }, 200);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const quote = quotes[displayed] ?? quotes[0]!;

  return (
    <section id="testimonials" className="py-24 px-8 md:px-16 bg-[#f7fafc] dark:bg-background">
      <div className="max-w-180 mx-auto flex flex-col gap-10 items-center">
        <div className="bg-[#cca830] dark:bg-brand-gold h-0.5 w-12" />

        <div
          className="flex flex-col items-center gap-6 transition-opacity duration-200"
          style={{ opacity: fading ? 0 : 1 }}
        >
          <p
            className="text-black dark:text-foreground text-[22px] text-center leading-[1.7] italic"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}
          >
            &ldquo;{quote.text}&rdquo;
          </p>

          <div className="flex flex-col items-center gap-1">
            <p className="text-black dark:text-foreground text-sm font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
              {quote.author}
            </p>
            <p className="text-[#45464d] dark:text-muted-foreground text-xs tracking-[1px]" style={{ fontFamily: "Inter, sans-serif" }}>
              {quote.firm}
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-center justify-center">
          {quotes.map((_, i) => (
            <button
              key={i}
              onClick={() => changeQuote(i)}
              aria-label={t("quotes.quoteLabel", { number: i + 1 })}
              className="size-5 flex items-center justify-center cursor-pointer bg-transparent border-0"
            >
              <div
                className={`rounded-full transition-all duration-300 ${
                  i === displayed ? "size-2.5 bg-black dark:bg-foreground" : "size-2 bg-[#c6c6ce] hover:bg-[#888] dark:bg-muted-foreground/40 dark:hover:bg-muted-foreground/70"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
