"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme, type ThemeProviderProps } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"

// ThemeProviderProps extends React.PropsWithChildren in next-themes's own .d.ts, but under
// this project's installed @types/react, JSX children-checking against that type still
// reports no `children` member — a known next-themes/React 19 types interaction. Recasting
// the component's type locally (no runtime effect) sidesteps it without patching the library.
const ThemeProviderRoot = NextThemesProvider as React.ComponentType<ThemeProviderProps & { children?: React.ReactNode }>

function ThemeProvider({ children, ...props }: ThemeProviderProps & { children?: React.ReactNode }) {
  return (
    <ThemeProviderRoot
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </ThemeProviderRoot>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Forces a client-only re-render after mount so resolvedTheme matches the client,
  // avoiding a hydration mismatch between server and first client render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="w-8 h-8" />

  const label = resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="cursor-pointer rounded-full p-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          aria-label={label}
        >
          {resolvedTheme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export { ThemeProvider, ThemeToggle }
