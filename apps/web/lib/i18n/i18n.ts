import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import { I18N_RESOURCES } from "@/lib/i18n/resources"
import { DEFAULT_LANGUAGE } from "@/lib/i18n/languages"
import { NAMESPACES } from "@/lib/i18n/namespaces"

if (!i18next.isInitialized) {
  i18next.use(initReactI18next).init({
    resources: I18N_RESOURCES,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    ns: NAMESPACES,
    defaultNS: "common",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
} else {
  // Dev Fast Refresh re-evaluates this module but i18next itself is a singleton that stays
  // initialized, so edits to a locale JSON would never reach it (keys render as raw ids until a
  // hard reload). Re-register the bundled catalogs so those edits show up live.
  for (const [lng, namespaces] of Object.entries(I18N_RESOURCES)) {
    for (const [ns, resources] of Object.entries(namespaces)) {
      i18next.addResourceBundle(lng, ns, resources, true, true)
    }
  }
}

export default i18next
