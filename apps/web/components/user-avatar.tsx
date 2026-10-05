"use client"

import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"

/**
 * A user's avatar circle: their photo when `avatarUrl` is set (Google signups start with their
 * Google photo; anyone can upload one), otherwise — or if the image fails to load — the initials
 * each caller already computes. Sizing, border and text styling come from `className`, so this
 * drops into the existing initials circles unchanged.
 */
export function UserAvatar({
  avatarUrl,
  initials,
  className,
}: {
  avatarUrl?: string | null
  initials: string
  className?: string
}) {
  // Keyed on the URL itself, so a new upload gets a fresh attempt after an earlier failure.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = !!avatarUrl && failedUrl !== avatarUrl

  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full", className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- same-origin /files/<token> proxy URL; next/image would re-proxy it
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setFailedUrl(avatarUrl)} />
      ) : (
        initials
      )}
    </span>
  )
}
