"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowLeft } from "lucide-react";
import { useForgotPasswordMutation } from "@/lib/auth/mutations";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const forgotPassword = useForgotPasswordMutation();

  const subNavItems = ["CHAT", "CASES", "LIBRARY", "RESEARCH", "RESOURCES"];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f1f4f6]">
      {/* LEFT — library image */}
      <div className="relative hidden lg:block overflow-hidden" style={{ width: "40%", minHeight: "1024px" }}>
        <div className="absolute inset-0 bg-[#131a33]" />
        <div className="absolute inset-0 opacity-70" style={{ background: "radial-gradient(ellipse at 40% 50%, #1e2d4a 0%, #131a33 65%)" }} />
        <div className="absolute inset-0 bg-[rgba(19,26,51,0.3)]" />

        {/* Logo */}
        <div className="absolute top-16 left-12 z-10">
          <span className="text-[28px] text-white tracking-[-0.7px]" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
            ilovelawyer
          </span>
        </div>
        

        {/* Quote */}
        <div className="absolute bottom-12 left-12 max-w-[384px] z-10">
          <p
            className="text-[rgba(255,255,255,0.95)] text-[20px] leading-[32.5px] italic"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontStyle: "italic" }}
          >
            &ldquo;Jurisprudence is the knowledge of things divine and human; the science of the just and the unjust.&rdquo;
          </p>
        </div>
      </div>

      {/* RIGHT — form + top nav */}
      <div className="bg-white flex-1 flex flex-col items-center justify-center px-8 md:px-16 relative shadow-[-20px_0px_20px_rgba(0,0,0,0.03)]">
        {/* Sub nav top-right */}
        <div className="absolute top-0 right-0 left-0 lg:left-0 bg-gradient-to-b from-white/80 to-transparent flex gap-8 items-start justify-end px-8 py-6 overflow-auto">
          {subNavItems.map((l) => (
            <button
              key={l}
              className="text-[#45464d] text-xs tracking-[1.2px] font-semibold cursor-pointer bg-transparent border-0 hover:text-black shrink-0"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Back to login */}
          {!sent && (
            <div className="border-t border-[rgba(224,227,229,0.6)] pt-10">
              <button
                onClick={() => router.push("/login")}
                className="flex items-center gap-3 cursor-pointer bg-transparent border-0 hover:opacity-70 transition-opacity"
              >
                <ArrowLeft size={13} color="#45464D" />
                <span className="text-[#45464d] text-xs tracking-[1.2px] font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                  Return to Secure Sign In
                </span>
              </button>
            </div>
          )}

        <div className="w-full max-w-lg flex flex-col gap-12 py-16">
          {/* Heading */}
          <div className="flex flex-col gap-6">
            <h2 className="text-[#181c1e] text-[40px] leading-[48px] tracking-[-1px]" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
              Account Recovery
            </h2>
            <p className="text-[#45464d] text-base leading-6 max-w-[448px]" style={{ fontFamily: "'Libre Caslon Text', serif" }}>
              Enter your professional email to receive secure recovery instructions. Ensuring the continuity of your legal practice.
            </p>
          </div>

          {/* Form / Success */}
          {!sent ? (
            <div className="flex flex-col gap-12">
              <div className="flex flex-col gap-4">
                <label className="text-[#3c475a] text-xs tracking-[1.2px] uppercase font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                  PROFESSIONAL RECOVERY EMAIL
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="attorney@firm.com.ph"
                  className="w-full bg-[rgba(241,244,246,0.3)] border border-[#6b7280] px-4 py-5 text-[18px] text-black placeholder-[#c6c6ce] outline-none focus:border-black transition-colors"
                  style={{ fontFamily: "'Libre Caslon Text', serif" }}
                />
              </div>
              <button
                onClick={() => email && forgotPassword.mutate({ email }, { onSuccess: () => setSent(true) })}
                disabled={forgotPassword.isPending}
                className="w-full bg-[#131a33] text-white text-xs tracking-[2.4px] uppercase font-semibold py-5 cursor-pointer hover:bg-black transition-colors border-0 shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1)] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {forgotPassword.isPending ? "SENDING..." : "SEND RESET LINK"}
              </button>
            </div>
          ) : (
            <div className="border border-[#c6c6ce] p-16 flex flex-col gap-8 items-center shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">
              <div className="border border-[#cca830] rounded-full size-20 flex items-center justify-center">
                <Mail size={36} color="#CCA830" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-4 items-center text-center">
                <h3 className="text-[#181c1e] text-[28px] leading-[36px]" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
                  Instructions Sent
                </h3>
                <p className="text-[#45464d] text-base leading-[26px]" style={{ fontFamily: "'Libre Caslon Text', serif" }}>
                  A secure recovery link has been dispatched to your inbox. Please check your professional email to continue the restoration process.
                </p>
              </div>
              <button
                onClick={() => router.push("/login")}
                className="border-b-2 border-black text-black text-xs tracking-[1.2px] uppercase font-semibold pb-1.5 cursor-pointer bg-transparent border-t-0 border-l-0 border-r-0 hover:opacity-70"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                BACK TO LOGIN
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
