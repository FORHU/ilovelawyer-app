"use client";

import { LANGUAGE_LABELS } from "@/lib/i18n/languages";
import { useTenantLanguages } from "@/lib/i18n/use-tenant-languages";
import { useLanguageStore } from "@/lib/store/language.store";

// A flat, always-visible switch between the site's display languages for the landing navbar. The
// dropdown LanguageSwitcher is built for the app's light headers; this one takes its colour from
// the surrounding text (`currentColor`), so it reads the same over the hero and on the frosted bar.
export function LandingLanguageToggle({ className = "" }: { className?: string }) {
  const languages = useTenantLanguages();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  if (languages.length <= 1) return null;

  return (
    <div role="group" aria-label="Display language" className={`flex items-center gap-1 text-xs ${className}`}>
      {languages.map((lang, i) => (
        <span key={lang} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="opacity-40">/</span>}
          <button
            type="button"
            lang={lang}
            aria-pressed={language === lang}
            onClick={() => setLanguage(lang)}
            className={`rounded-xs px-1 py-0.5 transition-opacity duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/60 ${
              language === lang ? "font-semibold opacity-100 underline underline-offset-4" : "opacity-60 hover:opacity-100"
            }`}
          >
            {LANGUAGE_LABELS[lang]}
          </button>
        </span>
      ))}
    </div>
  );
}
