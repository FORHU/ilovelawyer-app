import { useCallback, useEffect, useMemo, useState } from "react";
import { useMessagesQuery } from "@/lib/chat/mutations";
import { AUTO_MINDMAP_PROMPT, AUTO_AUDIO_OVERVIEW_PROMPT } from "@/lib/chat/auto-prompts";
import { useSendingConsultationsStore } from "@/lib/store/sending-consultations.store";

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

/** Derives "topics across every split AI reply" for a consultation straight from persisted
 * history — usable from anywhere on the page, not just inside ConsultationChat's own render
 * tree, since a split reply is always already-persisted data (see MessageGroup). Each turn's
 * topics are appended in chronological order rather than replacing the previous turn's, so
 * the panel builds up into a running table of contents for the whole thread instead of only
 * ever showing the most recent reply. Replicates ConsultationChat's own visibleMessages filter
 * (dropping the hidden system-driven mind-map/audio-overview turns) so index numbering lines
 * up with the bubble ids it renders. */
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

  const scrollToTopic = useCallback((index: number) => {
    document.getElementById(`chat-msg-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  return { topics, groups, activeIndex, scrollToTopic, isGenerating };
}
