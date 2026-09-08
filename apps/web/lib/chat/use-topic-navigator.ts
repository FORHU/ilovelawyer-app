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

/** Derives "topics in the latest split AI reply" for a consultation straight from persisted
 * history — usable from anywhere on the page, not just inside ConsultationChat's own render
 * tree, since a split reply is always already-persisted data (see MessageGroup). Replicates
 * ConsultationChat's own visibleMessages filter (dropping the hidden system-driven mind-map/
 * audio-overview turns) so index numbering lines up with the bubble ids it renders. */
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
        if (list[i + 1]?.role === "assistant") hidden.add(i + 1);
      }
    });
    return hidden.size > 0 ? list.filter((_, i) => !hidden.has(i)) : list;
  }, [history]);

  const topics = useMemo<TopicNavigatorItem[]>(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      const groupId = visibleMessages[i]?.groupId;
      if (!groupId) continue;
      return visibleMessages
        .map((m, index) => ({ index, groupId: m.groupId, title: m.groupTitle }))
        .filter((m) => m.groupId === groupId)
        .map((m, j) => ({ index: m.index, title: m.title || `Topic ${j + 1}` }));
    }
    return [];
  }, [visibleMessages]);

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

  return { topics, activeIndex, scrollToTopic, isGenerating };
}
