"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageShell } from "@/components/page-shell";
import { NotificationItem } from "@/components/notifications/notification-item";
import {
  useInfiniteNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useUnreadCountQuery,
  type Notification,
} from "@/lib/notifications/queries";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading";
import { ErrorState } from "@/components/error-state";

// Mirrors NotificationItem's non-dense row shape (7x7 icon circle + title +
// message + timestamp lines, px-4 py-3.5) so the swap to real rows doesn't
// jump layout.
function NotificationListSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3.5">
          <Skeleton className="mt-0.5 h-7 w-7 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-4/5" />
            <Skeleton className="h-2 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const notificationsQuery = useInfiniteNotificationsQuery({ unreadOnly });
  const showSkeleton = useDelayedLoading(notificationsQuery.isLoading);
  const unreadCountQuery = useUnreadCountQuery();
  const markRead = useMarkNotificationReadMutation();
  const markAllRead = useMarkAllNotificationsReadMutation();

  const notifications = notificationsQuery.data?.pages.flatMap((page) => page.notifications) ?? [];
  const unreadCount = unreadCountQuery.data ?? 0;

  function handleOpenNotification(notification: Notification) {
    if (!notification.isRead) markRead.mutate(notification.id);
    if (notification.link) router.push(notification.link);
  }

  return (
    <PageShell activeTab="notifications">
      <main className="max-w-[800px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-8">
        <div className="w-full flex flex-col gap-2">
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground">
            {t("notifications.label")}
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            {unreadCount > 0 ? t("notifications.unreadCount", { count: unreadCount }) : t("notifications.empty")}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            <button
              type="button"
              onClick={() => setUnreadOnly(false)}
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                !unreadOnly ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setUnreadOnly(true)}
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                unreadOnly ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Unread
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-[11px] font-semibold uppercase tracking-wide text-primary transition-opacity hover:opacity-70 disabled:opacity-40"
            >
              {t("notifications.markAllRead")}
            </button>
          )}
        </div>

        {showSkeleton ? (
          <NotificationListSkeleton />
        ) : notificationsQuery.isError ? (
          <ErrorState
            message={t("notifications.loadError", { defaultValue: "Couldn't load notifications." })}
            retryLabel={t("notifications.retry", { defaultValue: "Retry" })}
            onRetry={() => notificationsQuery.refetch()}
          />
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">{t("notifications.empty")}</p>
            <p className="text-sm text-muted-foreground">{t("notifications.emptyDescription")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} onOpen={handleOpenNotification} dense={false} />
            ))}
          </div>
        )}

        {notificationsQuery.hasNextPage && (
          <button
            type="button"
            onClick={() => notificationsQuery.fetchNextPage()}
            disabled={notificationsQuery.isFetchingNextPage}
            className="mx-auto rounded-full border border-border px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-50"
          >
            {notificationsQuery.isFetchingNextPage ? "…" : "Load more"}
          </button>
        )}
      </main>
    </PageShell>
  );
}
