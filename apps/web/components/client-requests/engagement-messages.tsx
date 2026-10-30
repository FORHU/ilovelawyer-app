"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, MessageSquare } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"
import { useDateLocale } from "@/lib/i18n/date-locale"
import type { EngagementMessage } from "@/lib/client-handoff"
import {
  useEngagementMessagesQuery,
  useMarkEngagementMessagesReadMutation,
  usePostEngagementMessageMutation,
} from "@/lib/client-requests/messages"

const MESSAGE_MAX_LENGTH = 5000

function MessageBubble({ message, locale }: { message: EngagementMessage; locale: string | undefined }) {
  const { t } = useTranslation("client-request")
  const mine = message.author.side === "LAWYER"
  const when = new Date(message.createdAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
  // Before the client hires them, the API leaves out who the client is (no id, no name).
  const client = message.author.id ? `${message.author.name} · ${t("messages.client")}` : t("messages.client")
  return (
    <li className={cn("flex max-w-[85%] flex-col gap-1", mine ? "self-end items-end" : "self-start items-start")}>
      <span className="text-[11px] text-muted-foreground">
        {mine ? t("messages.you") : client} · {when}
      </span>
      {message.body && (
        <p
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
            mine ? "bg-foreground text-background" : "bg-muted text-foreground"
          )}
        >
          {message.body}
        </p>
      )}
      {message.document && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">{message.document.filename}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("messages.sharedBy", {
                name: message.document.submittedBy.name,
                date: new Date(message.document.submittedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }),
              })}
            </p>
          </div>
        </div>
      )}
    </li>
  )
}

/**
 * The lawyer's thread with the client (FORHU/ilovelawyer-app#887, ilovelawyer-api#517): a Messages
 * button with the unread count, opening a right-side drawer with the participants, the thread
 * (documents the client shared show who shared them and when) and a composer. Opening it, or a new
 * message arriving while it's open, marks the thread read. Since phase 5b it opens when the lawyer
 * joins (`beforeHire`: the client isn't named, and a hint asks them not to share contact details).
 * Read-only once the engagement is closed (`closed`) or their claim has ended (`ended`).
 */
export function EngagementMessages({
  requestId,
  clientName,
  closed = false,
  ended = false,
  beforeHire = false,
}: {
  requestId: string
  /** Who the client is; left out before hire, when they aren't named. */
  clientName?: string
  closed?: boolean
  ended?: boolean
  beforeHire?: boolean
}) {
  const { t } = useTranslation("client-request")
  const locale = useDateLocale()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const thread = useEngagementMessagesQuery(requestId)
  const post = usePostEngagementMessageMutation(requestId)
  const { mutate: markRead, isPending: marking } = useMarkEngagementMessagesReadMutation(requestId)
  const endRef = useRef<HTMLDivElement>(null)

  const unread = thread.data?.unread ?? 0
  const messages = thread.data?.data ?? []

  // Reading the drawer reads the thread: on opening, and whenever something new arrives while open.
  useEffect(() => {
    if (open && unread > 0 && !marking) markRead()
  }, [open, unread, marking, markRead])

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" })
  }, [open, messages.length])

  function send(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    post.mutate(body, {
      onSuccess: () => setDraft(""),
      onError: (err) => toast.error(err instanceof Error ? err.message : t("loadError")),
    })
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="relative">
        <MessageSquare className="size-4" aria-hidden="true" />
        {t("messages.open")}
        {unread > 0 && (
          <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white" aria-label={t("messages.unread", { count: unread })}>
            {unread}
          </span>
        )}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle>{t("messages.title")}</SheetTitle>
            <SheetDescription>
              {clientName ? t("messages.participants", { client: clientName }) : t("messages.participantsBeforeHire")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {thread.isLoading ? (
              <p className="text-[13px] text-muted-foreground">{t("messages.loading")}</p>
            ) : thread.isError ? (
              <p className="text-[13px] text-red-600">{t("loadError")}</p>
            ) : messages.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                {clientName ? t("messages.empty", { client: clientName }) : t("messages.emptyBeforeHire")}
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} locale={locale} />
                ))}
              </ul>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border px-5 py-4">
            {closed || ended ? (
              <p className="text-[12px] text-muted-foreground">{t(ended ? "messages.ended" : "messages.closed")}</p>
            ) : (
              <form onSubmit={send} className="flex flex-col gap-2">
                {beforeHire && <p className="text-[12px] text-muted-foreground">{t("messages.contactHint")}</p>}
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) send(e)
                  }}
                  maxLength={MESSAGE_MAX_LENGTH}
                  rows={3}
                  placeholder={t("messages.placeholder")}
                  aria-label={t("messages.placeholder")}
                  className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-foreground"
                />
                <Button type="submit" variant="accent" className="self-end" isPending={post.isPending} disabled={!draft.trim()}>
                  {t("messages.send")}
                </Button>
              </form>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
