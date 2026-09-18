"use client"

import { AlertTriangle, CheckCircle2, Info, Loader2, OctagonAlert } from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// Wraps each lucide icon in a soft tinted chip rather than tinting the whole toast body —
// keeps the toast itself on the app's one neutral surface (--popover/--border, same as
// tooltips/dropdowns) and reserves color for the one thing that needs to signal severity.
function ToastIcon({ icon: Icon, tone }: { icon: typeof OctagonAlert; tone: "danger" | "warn" | "ok" | "muted" }) {
  const toneClasses = {
    danger: "bg-danger/12 text-danger",
    warn: "bg-warn/15 text-warn",
    ok: "bg-ok/12 text-ok",
    muted: "bg-muted text-muted-foreground",
  }[tone]

  return (
    <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${toneClasses}`}>
      <Icon className="size-3.5" aria-hidden="true" />
    </span>
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      position="bottom-right"
      closeButton
      gap={10}
      className="toaster group"
      icons={{
        error: <ToastIcon icon={OctagonAlert} tone="danger" />,
        warning: <ToastIcon icon={AlertTriangle} tone="warn" />,
        success: <ToastIcon icon={CheckCircle2} tone="ok" />,
        info: <ToastIcon icon={Info} tone="muted" />,
        loading: <Loader2 className="size-4.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />,
      }}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "rounded-2xl! border! border-border! bg-popover! shadow-[0_8px_30px_-6px_rgba(0,0,0,0.18)]! px-4! py-3.5! pr-8! gap-3! font-['Inter']! items-start!",
          title: "text-[13px]! font-medium! leading-snug! text-popover-foreground!",
          description: "text-[12px]! text-muted-foreground! mt-0.5!",
          icon: "mt-0.5!",
          closeButton:
            "size-5! bg-popover! border! border-border! text-muted-foreground! hover:text-foreground! hover:bg-card! shadow-sm!",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          // Default sonner close button hangs half off the top-left corner of the toast —
          // pulled inside to sit inline in the top-right, in line with the rest of the app's
          // dialog/tooltip close buttons.
          "--toast-close-button-start": "unset",
          "--toast-close-button-end": "8px",
          "--toast-close-button-transform": "translate(0, 8px)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
