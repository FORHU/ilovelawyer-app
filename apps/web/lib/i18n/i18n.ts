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
}

export default i18next
