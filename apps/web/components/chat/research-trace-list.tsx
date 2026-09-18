import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { TraceStep } from "@/lib/chat/mind-map-parser";

const MAX_VISIBLE_STEPS = 5;

function StepLabel({ step }: { step: TraceStep }) {
  return (
    <span className="truncate">
      {step.label}
      {typeof step.count === "number" && (
        <span className="text-muted-foreground/70">
          {" "}
          — {step.count} {step.count === 1 ? "result" : "results"}
        </span>
      )}
    </span>
  );
}

/** Live "glass-box" research trace shown in place of ThinkingIndicator once the backend's
 * [TRACE] frames start arriving (see consultation-chat.tsx's doSend), or its persisted replay
 * once a turn's steps are saved (ilovelawyer-api#119) — e.g. Case Workspace's Decisions Studio
 * tile, after a refresh. `variant="replay"` shows every step (no MAX_VISIBLE_STEPS truncation —
 * the live feed's "last few, sliding" shape only makes sense while something is still in
 * flight) as static, already-done rows: no spinner, no enter/exit motion, since nothing here is
 * actually live. Defaults to `variant="live"`, i.e. today's unchanged behavior. */
export function ResearchTraceList({ steps, variant = "live" }: { steps: TraceStep[]; variant?: "live" | "replay" }) {
  if (variant === "replay") {
    return (
      <ul className="flex flex-col gap-1.5 text-[13px] font-['Inter']">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="size-3 shrink-0 text-green-600 dark:text-green-500" aria-hidden="true" />
            <StepLabel step={step} />
          </li>
        ))}
      </ul>
    );
  }

  const visible = steps.slice(-MAX_VISIBLE_STEPS);

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-1.5 text-[13px] font-['Inter']">
      <AnimatePresence initial={false}>
        {visible.map((step) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: step.status === "done" ? 0.6 : 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex items-center gap-2 text-muted-foreground"
          >
            {step.status === "active" ? (
              <Loader2 className="size-3 shrink-0 animate-spin text-[#d4af37]" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-3 shrink-0 text-green-600 dark:text-green-500" aria-hidden="true" />
            )}
            <StepLabel step={step} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
