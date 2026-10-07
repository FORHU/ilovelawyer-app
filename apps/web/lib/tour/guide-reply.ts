import type { GuideReply } from "@/lib/store/tour.store"
import { guidePath, PREREQUISITES, type GuideAnswer, type Prerequisite } from "@/lib/tour/steps"

type T = (key: string, options?: Record<string, unknown>) => string

/** What the guide says for `answer`, and the control it lights up:
 * - "answer": the how-to, pointing at the feature's own control.
 * - "blocked": the user can't reach that control yet — say what's missing and point at the
 *   control that meets `missing` instead (e.g. "Create your first case").
 * - "next": the prerequisite has just been met — the how-to again, as the next step. */
export function guideReply(t: T, answer: GuideAnswer, stage: "answer" | "next"): GuideReply
export function guideReply(t: T, answer: GuideAnswer, stage: "blocked", missing: Prerequisite): GuideReply
export function guideReply(t: T, answer: GuideAnswer, stage: "answer" | "blocked" | "next", missing?: Prerequisite): GuideReply {
  const topic = t(`helpTopics.${answer.topic}`)

  if (stage === "blocked" && missing) {
    const prerequisite = PREREQUISITES[missing]
    const label = t(`targets.${prerequisite.target}`)
    return {
      text: t(`answers.${answer.id}_blocked`),
      topic,
      highlight: { target: prerequisite.target, route: prerequisite.route, label, title: label, body: t(`prerequisites.${missing}.body`) },
      path: guidePath(answer, false),
      sample: answer.sample,
    }
  }

  const text = t(stage === "next" ? `answers.${answer.id}_next` : `answers.${answer.id}`)
  const label = t(`targets.${answer.target}`)
  return {
    text,
    topic,
    highlight: { target: answer.target, route: answer.route, label, title: label, body: text.replace(/\*\*/g, "") },
    ...(stage === "next" && { path: guidePath(answer, true), sample: answer.sample }),
  }
}
