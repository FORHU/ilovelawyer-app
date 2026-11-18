import type { TenantCode } from "@/lib/tenant-code/resolve-host"

/** The i18next `context` for a tenant's landing copy: `key_UK` / `key_KR` beats `key`, and PH uses
 * the bare key. Context is only applied to string values — for a nested object or array, read the
 * suffixed key explicitly with {@link copyKey}. */
export function copyContext(tenantCode: TenantCode): { context: "UK" | "KR" } | undefined {
  return tenantCode === "PH" ? undefined : { context: tenantCode }
}

/** `base` for PH, `base_UK` / `base_KR` otherwise — for keys whose value is an object or array. */
export function copyKey(base: string, tenantCode: TenantCode): string {
  return tenantCode === "PH" ? base : `${base}_${tenantCode}`
}
