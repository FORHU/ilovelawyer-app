import { describe, it, expect, beforeEach } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import { chatKeys } from "@/lib/query-keys"
import type { ChatMessage } from "@/lib/chat/mutations"
import {
  appendOptimisticUserMessage,
  resolveOptimisticMessageId,
  isOptimisticMessageId,
} from "../optimistic-messages"

const CONSULTATION = "c-1"

const persisted = (id: string, role: "user" | "assistant", content: string): ChatMessage => ({
  id,
  consultationId: CONSULTATION,
  role,
  content,
  createdAt: "2026-01-01T00:00:00.000Z",
})

/** What a freshly mounted ConsultationChat reads to decide it must show the prompt plus a
 * "thinking" bubble (mirrors baseMessages/serverSaysPending in consultation-chat.tsx). */
function readOnRemount(queryClient: QueryClient) {
  const history = queryClient.getQueryData<ChatMessage[]>(chatKeys.messages(CONSULTATION)) ?? []
  const last = history.filter((m) => m.role !== "system").at(-1)
  return {
    lastUserPrompt: last?.role === "user" ? last.content : undefined,
    serverSaysPending: last?.role === "user" && last.replyStatus === "PENDING",
  }
}

describe("navigating away and back while a reply is generating", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } } })
    // History as it was cached before the user sent anything (fresh for 5 minutes, so a
    // remount will NOT refetch it).
    queryClient.setQueryData(chatKeys.messages(CONSULTATION), [
      persisted("m1", "user", "earlier question"),
      persisted("m2", "assistant", "earlier answer"),
    ])
  })

  it("without the optimistic write, a remount sees no trace of the prompt (the bug)", () => {
    const remounted = readOnRemount(queryClient)
    expect(remounted.lastUserPrompt).toBeUndefined()
    expect(remounted.serverSaysPending).toBe(false)
  })

  it("keeps the submitted prompt visible and pending after a remount", () => {
    appendOptimisticUserMessage(queryClient, CONSULTATION, "can you tell me about UK abortion law")

    // Component unmounts (user clicks another tab) and remounts (returns) — only the query
    // cache survives.
    const remounted = readOnRemount(queryClient)
    expect(remounted.lastUserPrompt).toBe("can you tell me about UK abortion law")
    expect(remounted.serverSaysPending).toBe(true)
  })

  it("appends after existing history without disturbing it", () => {
    appendOptimisticUserMessage(queryClient, CONSULTATION, "new prompt")
    const history = queryClient.getQueryData<ChatMessage[]>(chatKeys.messages(CONSULTATION))!
    expect(history.map((m) => m.id).slice(0, 2)).toEqual(["m1", "m2"])
    expect(history).toHaveLength(3)
  })

  it("swaps the temp id for the server id once the POST returns", () => {
    const tempId = appendOptimisticUserMessage(queryClient, CONSULTATION, "prompt")
    expect(isOptimisticMessageId(tempId)).toBe(true)

    resolveOptimisticMessageId(queryClient, CONSULTATION, tempId, "server-id")

    const history = queryClient.getQueryData<ChatMessage[]>(chatKeys.messages(CONSULTATION))!
    expect(history.at(-1)?.id).toBe("server-id")
    expect(isOptimisticMessageId(history.at(-1)?.id)).toBe(false)
    expect(history).toHaveLength(3)
  })

  it("prompt and reply stay consistent once the persisted reply lands", () => {
    const tempId = appendOptimisticUserMessage(queryClient, CONSULTATION, "prompt")
    resolveOptimisticMessageId(queryClient, CONSULTATION, tempId, "m3")

    // The post-generation refetch replaces the cache with the server's truth.
    queryClient.setQueryData(chatKeys.messages(CONSULTATION), [
      persisted("m1", "user", "earlier question"),
      persisted("m2", "assistant", "earlier answer"),
      { ...persisted("m3", "user", "prompt"), replyStatus: "DONE" },
      persisted("m4", "assistant", "the answer"),
    ])

    const remounted = readOnRemount(queryClient)
    expect(remounted.serverSaysPending).toBe(false)
    const history = queryClient.getQueryData<ChatMessage[]>(chatKeys.messages(CONSULTATION))!
    expect(history.filter((m) => m.content === "prompt")).toHaveLength(1)
  })

  it("starts a history from scratch for a brand-new consultation", () => {
    const fresh = new QueryClient()
    appendOptimisticUserMessage(fresh, "c-new", "first ever prompt")
    const history = fresh.getQueryData<ChatMessage[]>(chatKeys.messages("c-new"))!
    expect(history).toHaveLength(1)
    expect(history[0]?.replyStatus).toBe("PENDING")
  })
})
