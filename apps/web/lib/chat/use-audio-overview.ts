import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AUTO_AUDIO_OVERVIEW_PROMPT } from "@/components/chat/consultation-chat";
import {
  useMessagesQuery,
  useChatSessionQuery,
  sendChatMessage,
  useGenerateAudioOverviewAudioMutation,
  pollAudioOverviewAudio,
  type ChatMessage,
} from "@/lib/chat/mutations";
import { chatKeys } from "@/lib/query-keys";

/** Script generation → Polly render polling → playable URL, shared by every surface that offers
 * Audio Overview (Case Workspace's Studio panel, the Legal Terminal's Audio Overview panel).
 * Deliberately excludes playback UI (play/pause/seek/rate) — that's per-surface (a docked player
 * bar in Studio, a plain native <audio controls> in the Terminal) and doesn't belong here. */
export function useAudioOverview(consultationId: string | null, caseId: string | null) {
  const { data: session } = useChatSessionQuery();
  const { data: history } = useMessagesQuery(consultationId ?? undefined);
  const queryClient = useQueryClient();

  const activeAudioOverviewMessage = useMemo<ChatMessage | undefined>(() => {
    const list = history ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]?.audioOverview?.turns?.length) return list[i];
    }
    return undefined;
  }, [history]);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generateScriptError, setGenerateScriptError] = useState(false);

  const generateAudio = useGenerateAudioOverviewAudioMutation(consultationId ?? "");
  const [audioRendering, setAudioRendering] = useState(false);
  const [audioRenderError, setAudioRenderError] = useState(false);
  const [renderedAudioUrl, setRenderedAudioUrl] = useState<string | null>(null);

  const audioOverviewMessageId = activeAudioOverviewMessage?.id;
  const audioOverviewStatus = activeAudioOverviewMessage?.audioOverview?.audioStatus ?? null;

  const triggerAudioRender = useCallback(
    (messageId: string) => {
      setAudioRenderError(false);
      setRenderedAudioUrl(null);
      generateAudio.mutate(messageId, {
        onSuccess: () => setAudioRendering(true),
        onError: () => setAudioRenderError(true),
      });
    },
    [generateAudio],
  );

  // Already-rendered audio from a previous visit: status is COMPLETED but this session hasn't
  // fetched a (short-lived, presigned) playback URL for it yet — one poll call gets it without
  // starting a new render.
  useEffect(() => {
    if (!consultationId || !audioOverviewMessageId || audioOverviewStatus !== "COMPLETED" || renderedAudioUrl) {
      return;
    }
    pollAudioOverviewAudio(consultationId, audioOverviewMessageId)
      .then((result) => {
        if (result.status === "COMPLETED" && result.audioFile?.fileUrl) setRenderedAudioUrl(result.audioFile.fileUrl);
      })
      .catch(() => {});
  }, [consultationId, audioOverviewMessageId, audioOverviewStatus, renderedAudioUrl]);

  useEffect(() => {
    if (!audioRendering || !consultationId || !audioOverviewMessageId) return;
    const interval = setInterval(() => {
      pollAudioOverviewAudio(consultationId, audioOverviewMessageId)
        .then((result) => {
          if (result.status === "IN_PROGRESS") return;
          setAudioRendering(false);
          if (result.status === "COMPLETED" && result.audioFile?.fileUrl) {
            setRenderedAudioUrl(result.audioFile.fileUrl);
          } else if (result.status === "FAILED") {
            setAudioRenderError(true);
          }
        })
        .catch(() => setAudioRendering(false));
    }, 3000);
    return () => clearInterval(interval);
  }, [audioRendering, consultationId, audioOverviewMessageId]);

  // Auto-chains straight into rendering once the script lands — script generation and audio
  // rendering are one click from the caller's point of view.
  const generateScript = useCallback(async () => {
    if (!consultationId || !session || isGeneratingScript) return;
    setIsGeneratingScript(true);
    setGenerateScriptError(false);
    try {
      await sendChatMessage({
        consultationId,
        sessionId: session.session_id,
        message: AUTO_AUDIO_OVERVIEW_PROMPT,
        caseId: caseId ?? undefined,
        onChunk: () => {},
      });
      await queryClient.invalidateQueries({ queryKey: chatKeys.messages(consultationId) });
      // Read the just-invalidated cache directly instead of activeAudioOverviewMessage — that
      // memo won't reflect this new message until the next render, but triggerAudioRender needs
      // its id now, in this same synchronous continuation.
      const freshHistory = queryClient.getQueryData<ChatMessage[]>(chatKeys.messages(consultationId));
      const newMessage = (freshHistory ?? []).slice().reverse().find((m) => m.audioOverview?.turns?.length);
      if (newMessage) triggerAudioRender(newMessage.id);
    } catch {
      setGenerateScriptError(true);
    } finally {
      setIsGeneratingScript(false);
    }
  }, [consultationId, session, isGeneratingScript, caseId, queryClient, triggerAudioRender]);

  const regenerateAudio = useCallback(() => {
    if (!audioOverviewMessageId) return;
    triggerAudioRender(audioOverviewMessageId);
  }, [audioOverviewMessageId, triggerAudioRender]);

  return {
    session,
    activeAudioOverviewMessage,
    isGeneratingScript,
    generateScriptError,
    generateScript,
    audioRendering,
    audioRenderError,
    renderedAudioUrl,
    regenerateAudio,
    isGeneratingAudio: generateAudio.isPending,
  };
}
