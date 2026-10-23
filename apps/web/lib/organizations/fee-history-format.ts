import type { ChargeStatus } from "@/lib/client-handoff"
import type { ChargeRecord } from "@/lib/organizations/billing"

/** Badge tone per charge status — see packages/ui/src/components/badge.tsx's `tone` variants. */
export function chargeStatusTone(status: ChargeStatus): "success" | "caution" | "danger" | "warning" | "neutral" {
  switch (status) {
    case "SUCCEEDED":
      return "success"
    case "PENDING":
      return "caution"
    case "FAILED":
      return "danger"
    case "PARTIALLY_REFUNDED":
      return "warning"
    case "REFUNDED":
      return "neutral"
  }
}

export interface ChargeMonthGroup {
  /** "2026-10" — sorts and compares the way a string naturally would. */
  key: string
  monthStart: Date
  charges: ChargeRecord[]
}

/** Buckets charges by the calendar month of `createdAt`. The API already returns them newest
 * first, and a Map preserves first-seen insertion order, so the groups come out newest month
 * first too — with each group's own charges still in the order the API gave them. */
export function groupChargesByMonth(charges: ChargeRecord[]): ChargeMonthGroup[] {
  const groups = new Map<string, ChargeMonthGroup>()
  for (const charge of charges) {
    const createdAt = new Date(charge.createdAt)
    const monthStart = new Date(createdAt.getFullYear(), createdAt.getMonth(), 1)
    const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`
    const group = groups.get(key)
    if (group) group.charges.push(charge)
    else groups.set(key, { key, monthStart, charges: [charge] })
  }
  return [...groups.values()]
}
