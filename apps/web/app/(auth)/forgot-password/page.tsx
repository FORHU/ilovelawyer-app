"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { useForgotPasswordMutation } from "@/lib/auth/mutations";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const forgotPassword = useForgotPasswordMutation();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f1f4f6]">
      {/* LEFT — dark panel */}
      <div className="relative hidden lg:block overflow-hidden" style={{ width: "58%", minHeight: "1024px" }}>
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


      {/* RIGHT — form */}
      <div className="bg-white flex-1 flex flex-col items-center justify-center px-8 md:px-26.5 py-12 overflow-y-auto">
        <div className="w-full max-w-md flex flex-col gap-10">

          {/* Back button */}
          {!sent && (
            <button
              onClick={() => router.push("/login")}
              className="flex items-center gap-2 cursor-pointer bg-transparent border-0 hover:opacity-70 transition-opacity w-fit"
            >
              <ArrowLeft size={13} color="#45464D" />
              <span className="text-[#45464d] text-xs tracking-[1.2px] font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                RETURN TO SIGN IN
              </span>
            </button>
          )}

          {/* Header */}
          <div className="flex flex-col gap-2">
            <h1 className="text-[40px] text-black leading-12" style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}>
              {sent ? "Instructions Sent" : "Account Recovery"}
            </h1>
            <p className="text-[#45464d] text-base leading-6" style={{ fontFamily: "Inter, sans-serif" }}>
              {sent
                ? "Check your professional email for the recovery link."
                : "Enter your professional email to receive secure recovery instructions."}
            </p>
          </div>

          {/* Form / Success */}
          {!sent ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email) {
                  forgotPassword.mutate({ email }, { onSuccess: () => setSent(true) });
                }
              }}
              className="flex flex-col gap-6"
            >
              <div className="flex flex-col gap-2">
                <label className="text-[#45464d] text-xs tracking-[1.2px] font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                  PROFESSIONAL EMAIL
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="attorney@firm.com.ph"
                  required
                  className="w-full rounded-xl border border-[#c6c6ce] border-b-2 bg-transparent px-3 py-4 text-base text-black placeholder-[#6b7280] outline-none focus:border-[#cca830] focus:placeholder-transparent transition-colors"
                  style={{ fontFamily: "Inter, sans-serif" }}
                />
              </div>

              <button
                type="submit"
                disabled={forgotPassword.isPending}
                className="w-full bg-black text-white rounded-xl text-base tracking-[3.2px] py-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {forgotPassword.isPending ? "SENDING..." : "SEND RESET LINK"}
              </button>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-8 py-4">
              <div className="border border-[#cca830] rounded-full size-20 flex items-center justify-center">
                <Mail size={36} color="#CCA830" strokeWidth={1.5} />
              </div>
              <p className="text-[#45464d] text-base leading-6.5 text-center max-w-90" style={{ fontFamily: "Inter, sans-serif" }}>
                A secure recovery link has been dispatched to{" "}
                <span className="font-semibold text-black">{email}</span>.{" "}
                Please check your professional email.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="w-full bg-black text-white text-base tracking-[3.2px] py-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors border-0"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                BACK TO SIGN IN
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[rgba(198,198,206,0.3)] pt-8">
            <span className="text-[rgba(69,70,77,0.5)] text-xs tracking-[1.2px] font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
              © 2026 ILOVELAWYER
            </span>
            <div className="flex gap-4">
              <button className="text-[#45464d] text-xs tracking-[1.2px] font-semibold underline decoration-[#c6c6ce] cursor-pointer bg-transparent border-0 hover:text-black transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>
                SUPPORT
              </button>
              <button className="text-[#45464d] text-xs tracking-[1.2px] font-semibold underline decoration-[#c6c6ce] cursor-pointer bg-transparent border-0 hover:text-black transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>
                PRIVACY
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
