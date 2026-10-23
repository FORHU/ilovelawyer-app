const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })

/** Formats a Money.amountMinor (pence) as a GBP string, e.g. "£80.00". */
export function formatMoney(amountMinor: number): string {
  return gbp.format(amountMinor / 100)
}
