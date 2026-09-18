import { useCallback, useEffect, useMemo, useState } from "react";
import { useMessagesQuery } from "@/lib/chat/mutations";
import { AUTO_MINDMAP_PROMPT, AUTO_AUDIO_OVERVIEW_PROMPT } from "@/lib/chat/auto-prompts";
import { useSendingConsultationsStore } from "@/lib/store/sending-consultations.store";
import type { DecisionRecordPayload } from "@/lib/terminal/types";

export interface TopicNavigatorItem {
  /** Index into ConsultationChat's own visibleMessages — matches the `chat-msg-${index}` id
   * it renders on each bubble, since topics only ever exist once persisted (never mid-stream),
   * and at that point ConsultationChat's visibleMessages is this same filtered history. */
  index: number;
  title: string;
}

export interface TopicNavigatorGroup {
  /** visibleMessages index of the user turn that produced this group's topics — stable across
   * re-renders (unlike array position), so it doubles as the group's React key and the
   * "currently expanded" identifier in TopicNavigatorList. */
  promptIndex: number;
  promptTitle: string;
  topics: TopicNavigatorItem[];
}

/** DOM id of one decision's highlighted anchor span inside a reply bubble (see
 * assistant-message.tsx's highlightAnchorsAndQuotes, which sets this same id) — `decisionIndex`
 * is that message's own `decisions` array index, matching `m.decisions`/`decisionRecords.records`
 * order exactly (both come from the same array, never re-sorted). Shared so AssistantMessage
 * (writer) and SourcesPanel (reader, via scrollToElementId below) agree on the exact id without
 * either one hardcoding a format the other actually owns. */
export function decisionAnchorElementId(messageIndex: number, decisionIndex: number): string {
  return `chat-msg-${messageIndex}-decision-${decisionIndex}`;
}

/** DOM id of one piece of evidence's highlighted (yellow) quote span, wherever in the reply it
 * actually appears — unlike decisionAnchorElementId, this is NOT scoped to one message, because
 * a split reply only attaches its decisions to the *last* topic bubble (see chat.service.ts's
 * persistAssistantTurn) while the quoted sentence itself can live in any earlier sibling. Every
 * bubble in a split reply gets offered the same full quote list (ConsultationChat's doSend) and
 * each independently highlights whichever quotes actually match its own text — so the id only
 * needs to name the evidence item, not a message. `recordIndex`/`indexInDirection` mirror
 * SourcesPanel's own flatMap order over `latestDecisions.records[recordIndex].evidenceFor` /
 * `.evidenceAgainst`, so both sides agree without either hardcoding the other's iteration. */
export function evidenceQuoteElementId(
  recordIndex: number,
  direction: "for" | "against",
  indexInDirection: number,
): string {
  return `evidence-quote-${recordIndex}-${direction}-${indexInDirection}`;
}

/** Derives "topics across every split AI reply" for a consultation straight from persisted
 * history — usable from anywhere on the page, not just inside ConsultationChat's own render
 * tree, since a split reply is always already-persisted data (see MessageGroup). Each turn's
 * topics are appended in chronological order rather than replacing the previous turn's, so
 * the panel builds up into a running table of contents for the whole thread instead of only
 * ever showing the most recent reply. Replicates ConsultationChat's own visibleMessages filter
 * (dropping the hidden system-driven mind-map/audio-overview turns) so index numbering lines
 * up with the bubble ids it renders. Also the single place SourcesPanel gets `chat-msg-${index}`
 * jump targets for its Evidence/Authorities sections (`latestDecisions`, `latestAssistantIndex`)
 * — deliberately not re-derived there, so there's only one copy of this filter to keep in sync
 * with ConsultationChat's own. */
export function useTopicNavigator(consultationId: string | null | undefined) {
  const { data: history } = useMessagesQuery(consultationId ?? undefined);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Set by ConsultationChat's doSend the moment a turn starts for this consultation (see
  // sending-consultations.store.ts) — true well before a split reply could possibly be
  // persisted, so callers can show a "generating" state instead of a bare empty one.
  const isGenerating = useSendingConsultationsStore((s) =>
    consultationId ? s.sendingConsultationIds.has(consultationId) : false,
  );

  const visibleMessages = useMemo(() => {
    const list = (history ?? []).filter((m) => m.role !== "system");
    const hidden = new Set<number>();
    list.forEach((m, i) => {
      if (m.role === "user" && (m.content === AUTO_MINDMAP_PROMPT || m.content === AUTO_AUDIO_OVERVIEW_PROMPT)) {
        hidden.add(i);
        // Same run-of-consecutive-assistant-messages hiding as ConsultationChat's own copy of
        // this filter — a split reply's sibling topics all belong to this hidden turn.
        let j = i + 1;
        while (list[j]?.role === "assistant") {
          hidden.add(j);
          j++;
        }
      }
    });
    return hidden.size > 0 ? list.filter((_, i) => !hidden.has(i)) : list;
  }, [history]);

  // Groups every split reply's topics under the user prompt that asked for it, so a thread with
  // several turns behind it reads as "prompt -> its topics" (TopicNavigatorList's per-prompt
  // dropdown) instead of one flat list where later turns' topics run together with earlier ones.
  const groups = useMemo<TopicNavigatorGroup[]>(() => {
    const result: TopicNavigatorGroup[] = [];
    let current: TopicNavigatorGroup | null = null;
    visibleMessages.forEach((m, index) => {
      if (m.role === "user") {
        current = { promptIndex: index, promptTitle: m.content.trim(), topics: [] };
        result.push(current);
        return;
      }
      if (!m.groupId || !current) return;
      current.topics.push({ index, title: m.groupTitle || `Topic ${current.topics.length + 1}` });
    });
    return result.filter((g) => g.topics.length > 0);
  }, [visibleMessages]);

  const topics = useMemo<TopicNavigatorItem[]>(() => groups.flatMap((g) => g.topics), [groups]);

  // Same "walk visibleMessages backward" shape as Case Workspace's Decisions Studio tile
  // (studio-panel.tsx's latestDecisionsMessage), but computed against this hook's *filtered*
  // visibleMessages instead of raw history — SourcesPanel needs the index to double as a
  // `chat-msg-${index}` scroll target, and only visibleMessages' numbering lines up with that id.
  const latestDecisionsIndex = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if ((visibleMessages[i]?.decisionRecords?.records.length ?? 0) > 0) return i;
    }
    return -1;
  }, [visibleMessages]);
  const latestDecisionsRecords = latestDecisionsIndex >= 0 ? visibleMessages[latestDecisionsIndex]!.decisionRecords!.records : undefined;
  const latestDecisions: { index: number; records: DecisionRecordPayload[] } | null =
    latestDecisionsRecords ? { index: latestDecisionsIndex, records: latestDecisionsRecords } : null;

  // The reply Related Cases (useRelatedCasesQuery) belongs to — that query is always "this
  // consultation's latest turn," with no per-item anchor of its own, so SourcesPanel jumps any
  // related-case row here rather than to a specific sentence.
  const latestAssistantIndex = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (visibleMessages[i]?.role === "assistant") return i;
    }
    return null;
  }, [visibleMessages]);

  const scrollToTopic = useCallback((index: number) => {
    document.getElementById(`chat-msg-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // A message can carry several decision records, each highlighted at its own anchor sentence,
  // and each piece of evidence at its own quoted sentence (see assistant-message.tsx's
  // highlightAnchorsAndQuotes) — SourcesPanel's Evidence/Authorities rows should jump to the
  // specific sentence they actually came from, not just the message as a whole (every row
  // landing on the same spot regardless of which decision/quote it backs was the bug this
  // fixes). Falls back to the plain message scroll when that id never matched in the rendered
  // text (findAnchorMatches can miss one — e.g. split across markdown formatting, or a quote the
  // model paraphrased instead of copying verbatim).
  const scrollToElementId = useCallback((id: string, fallbackMessageIndex: number) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    document.getElementById(`chat-msg-${fallbackMessageIndex}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Lightweight scroll-spy: highlights whichever topic bubble is nearest the top of the
  // scrollable transcript. Re-observes whenever the topic set changes (a different split
  // reply, or none) — the bubbles themselves live in ConsultationChat's DOM, wherever that's
  // mounted on the page, not this hook's caller.
  useEffect(() => {
    if (topics.length === 0) {
      setActiveIndex(null);
      return;
    }
    const elements = topics
      .map((t) => document.getElementById(`chat-msg-${t.index}`))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topmost = visible.reduce((a, b) => (a.boundingClientRect.top <= b.boundingClientRect.top ? a : b));
        const index = Number(topmost.target.id.replace("chat-msg-", ""));
        if (!Number.isNaN(index)) setActiveIndex(index);
      },
      { root: null, rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [topics]);

  return {
    topics,
    groups,
    activeIndex,
    scrollToTopic,
    scrollToElementId,
    isGenerating,
    latestDecisions,
    latestAssistantIndex,
  };
}
