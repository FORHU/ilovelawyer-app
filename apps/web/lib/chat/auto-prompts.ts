// Sent verbatim (both by the auto-trigger and the manual retry button) so the Chat tab can
// recognize and hide this system-driven turn instead of showing it as a bubble the user
// never actually typed — see consultation-chat.tsx's `visibleMessages` filter and
// use-topic-navigator.ts's own copy of that same filter.
export const AUTO_MINDMAP_PROMPT = "Please generate a visual strategy map for this case.";
// Must contain the exact phrase "audio overview" — the_server.py's _wants_audio_overview and
// ilovelawyer-api's chat.service.ts wantsAudioOverview both gate on that substring, case-
// insensitively, to decide whether to run the (expensive) script-generation call at all.
export const AUTO_AUDIO_OVERVIEW_PROMPT = "Please generate an audio overview discussing this case.";
