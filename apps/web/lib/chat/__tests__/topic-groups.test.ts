import { describe, it, expect } from "vitest"
import { AUTO_MINDMAP_PROMPT } from "@/lib/chat/auto-prompts"
import { buildTopicGroups, promptNumberAt, visibleChatMessages } from "../use-topic-navigator"

type M = { role: "user" | "assistant" | "system"; content: string; groupId?: string | null; groupTitle?: string | null }

const user = (content: string): M => ({ role: "user", content })
const reply = (content: string, groupTitle?: string): M => ({
  role: "assistant",
  content,
  groupId: groupTitle ? "g" : null,
  groupTitle: groupTitle ?? null,
})

// One consultation's history: a split reply, an unsplit one, a hidden mind-map turn, another split.
const history: M[] = [
  { role: "system", content: "sys" },
  user("Discuss the abortion law in the UK"),
  reply("…", "Abortion law in the UK"),
  reply("…", "England and Wales"),
  user("Thanks"),
  reply("You're welcome"),
  user(AUTO_MINDMAP_PROMPT),
  reply("{map}", "Hidden topic"),
  user("Scotland only"),
  reply("…", "Scotland"),
]

describe("visibleChatMessages", () => {
  it("drops system messages and the hidden auto mind-map turn with its reply", () => {
    const visible = visibleChatMessages(history)
    expect(visible.map((m) => m.content)).not.toContain("sys")
    expect(visible.map((m) => m.content)).not.toContain(AUTO_MINDMAP_PROMPT)
    expect(visible.map((m) => m.groupTitle)).not.toContain("Hidden topic")
  })
})

describe("buildTopicGroups", () => {
  it("groups each split reply's topics under its prompt and leaves out unsplit prompts", () => {
    const groups = buildTopicGroups(visibleChatMessages(history))
    expect(groups.map((g) => g.promptTitle)).toEqual(["Discuss the abortion law in the UK", "Scotland only"])
    expect(groups[0]!.topics.map((t) => t.title)).toEqual(["Abortion law in the UK", "England and Wales"])
  })

  it("gives an empty consultation no topics", () => {
    expect(buildTopicGroups(visibleChatMessages([]))).toEqual([])
    expect(buildTopicGroups(visibleChatMessages(undefined))).toEqual([])
  })
})

describe("promptNumberAt", () => {
  it("maps a topic bubble to the prompt it answers — what `?p=` opens another consultation at", () => {
    const visible = visibleChatMessages(history)
    const [first, second] = buildTopicGroups(visible)
    expect(promptNumberAt(visible, first!.topics[1]!.index)).toBe(0)
    // "Thanks" is prompt 1 even without topics; the hidden mind-map turn isn't counted.
    expect(promptNumberAt(visible, second!.topics[0]!.index)).toBe(2)
  })

  it("is -1 before the first prompt", () => {
    expect(promptNumberAt([{ role: "assistant" }], 0)).toBe(-1)
  })
})
