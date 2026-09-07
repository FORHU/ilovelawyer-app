import { AnimatePresence, motion } from "framer-motion";
import type { TraceStep } from "@/lib/chat/mind-map-parser";

const MAX_VISIBLE_STEPS = 5;

/** Live "glass-box" research trace shown in place of ThinkingIndicator once the
 * backend's [TRACE] frames start arriving — see consultation-chat.tsx's doSend. */
export function ResearchTraceList({ steps }: { steps: TraceStep[] }) {
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
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full shrink-0 ${
                step.status === "active"
                  ? "bg-[#d4af37] animate-pulse motion-reduce:animate-none"
                  : "bg-muted-foreground/50"
              }`}
            />
            <span className="truncate">
              {step.label}
              {typeof step.count === "number" && (
                <span className="text-muted-foreground/70">
                  {" "}
                  — {step.count} {step.count === 1 ? "result" : "results"}
                </span>
              )}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
