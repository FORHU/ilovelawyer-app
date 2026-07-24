"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Mail, MapPin } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import GlobalFooter from "@/components/global-footer";

const SUBJECTS = ["General question", "Account & billing", "Technical issue", "Ethics concern", "Media inquiry"] as const;

export default function ContactUsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in your name, email, and message.");
      return;
    }
    setError(null);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="contact-us" />

      <main className="max-w-[1000px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-10">
        <div className="w-full flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-[1.5px] text-amber-700 dark:text-amber-400 uppercase">Connect</span>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground leading-tight">
            Contact <span className="italic">Us.</span>
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            Questions, feedback, or an issue with your workspace — send it our way and a real person will follow up.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          <section className="bg-card rounded-xl border border-border shadow-sm p-6 md:p-8">
            {submitted ? (
              <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">Message sent</h2>
                <p className="text-[14px] text-muted-foreground max-w-sm">
                  Thanks, {name.split(" ")[0]}. We&apos;ve received your message and will reply to {email} shortly.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setName("");
                    setEmail("");
                    setMessage("");
                    setSubject(SUBJECTS[0]);
                  }}
                  className="mt-2 cursor-pointer rounded-lg border border-border px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[1.2px] text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="contact-name" className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                      Full Name
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Juan Dela Cruz"
                      className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                      Email Address
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="juan@example.com"
                      className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-subject" className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                    Subject
                  </label>
                  <select
                    id="contact-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as (typeof SUBJECTS)[number])}
                    className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="contact-message" className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what's going on…"
                    className="mt-1.5 w-full resize-none rounded-lg border border-border bg-card px-3 py-2.5 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                </div>

                {error && <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>}

                <button
                  type="submit"
                  className="self-start cursor-pointer rounded-lg bg-brand-navy-900 px-6 py-3 text-[12px] font-semibold tracking-[1.2px] uppercase text-white transition-colors hover:bg-brand-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2"
                >
                  Send Message
                </button>
              </form>
            )}
          </section>

          <aside className="flex flex-col gap-5">
            <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-foreground text-[15px]">Email</p>
                <p className="text-muted-foreground text-[13px] mt-0.5">support@ilovelawyer.ph</p>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                <MapPin className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-foreground text-[15px]">Based in</p>
                <p className="text-muted-foreground text-[13px] mt-0.5">Manila, Philippines</p>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                <Clock className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-foreground text-[15px]">Response time</p>
                <p className="text-muted-foreground text-[13px] mt-0.5">Within 1 business day</p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
