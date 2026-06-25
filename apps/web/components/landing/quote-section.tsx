"use client";

import { useState } from "react";

const quotes = [
  "\"The agility ilovelawyer brings to our research process is unprecedented. It isn't just about speed; it's about the depth of insight we can now provide our clients in a fraction of the time.\"",
  "\"ilovelawyer transformed how we approach statutory research. The precision of the AI's understanding of Philippine law is unmatched.\"",
  "\"Our litigation team cut case preparation time by 60%. The platform's grasp of jurisprudence is extraordinary.\"",
];

export function QuoteSection() {
  const [active, setActive] = useState(0);

  return (
    <section className="py-24 px-8 md:px-16 bg-[#f7fafc]">
      <div className="max-w-[720px] mx-auto flex flex-col gap-12 items-center">
        <p
          className="text-black text-[24px] text-center leading-[1.625] italic"
          style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}
        >
          {quotes[active]}
        </p>
        <div className="flex gap-2 items-center justify-center">
          {quotes.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`rounded-full size-2 cursor-pointer border-0 transition-colors ${i === active ? "bg-black" : "bg-[#c6c6ce]"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
