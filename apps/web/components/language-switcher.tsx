"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Globe } from "lucide-react"
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from "@/lib/i18n/languages"
import { useLanguageStore } from "@/lib/store/language.store"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"

/**
 * Display Language switcher. Styling is intentionally minimal (inherits
 * currentColor/text sizing from wherever it's placed) so it can be dropped
 * into either header without fighting that header's own theme.
 */
export function LanguageSwitcher() {
  const language = useLanguageStore((state) => state.language)
  const setLanguage = useLanguageStore((state) => state.setLanguage)
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  return (
    <div className="relative" ref={menuRef}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center gap-1 text-[10px] tracking-[1px] uppercase opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-label="Change display language"
          >
            <Globe className="w-4 h-4" aria-hidden="true" />
            {LANGUAGE_LABELS[language]}
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent>Change display language</TooltipContent>
      </Tooltip>

      {isOpen && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-3 w-32 bg-white border border-black/10 rounded-sm shadow-xl py-1 z-50"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              role="menuitem"
              onClick={() => {
                setLanguage(lang)
                setIsOpen(false)
              }}
              className={`block w-full text-left px-4 py-2.5 text-[10px] tracking-[1px] uppercase transition-colors ${
                language === lang ? "text-black font-bold bg-black/5" : "text-black/60 hover:text-black hover:bg-black/5"
              }`}
            >
              {LANGUAGE_LABELS[lang]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
