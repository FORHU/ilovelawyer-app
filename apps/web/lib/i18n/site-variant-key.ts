import i18next from "i18next"
import { tenantI18nContext } from "@/config/tenant-codes"
import type { TenantCode } from "@/lib/tenant-code/resolve-host"

/**
 * The key to read for copy that differs by site when the value is a nested object or array
 * (sample data read with `returnObjects`). i18next's `context` option doesn't apply to those, so
 * this picks `key_UK` / `key_KR` explicitly — but only when that variant exists, so a site whose
 * variant isn't written yet gets the shared copy instead of a raw key.
 */
export function siteVariantKey(ns: string, key: string, tenantCode: TenantCode | null | undefined): string {
  const context = tenantI18nContext(tenantCode)?.context
  if (!context) return key
  const variant = `${key}_${context}`
  return i18next.exists(variant, { ns }) ? variant : key
}
