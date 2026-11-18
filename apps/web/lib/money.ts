/** Formats a Money (its amountMinor in its currency's smallest unit) for the client-request screens:
 * "£80.00" for pence, "₩150,000" for won (no minor unit). GBP when no currency is given, as every
 * request was before KR had them. */
export function formatMoney(amountMinor: number, currency: string = "GBP"): string {
  return formatAmount(toMajor({ amountMinor, currency }), currency, { locale: currency === "KRW" ? "ko-KR" : "en-GB", cents: true })
}

/** A typed major-unit amount ("80.50", "150000") in minor units of `currency`, or NaN. */
export function toMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** currencyDecimals(currency))
}

/** "£", "₩": the symbol an amount field shows before what's typed. */
export function currencySymbol(currency: string): string {
  return new Intl.NumberFormat(currency === "KRW" ? "ko-KR" : "en-GB", { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency
}

/** "0.00" for pence, "0" for won: what an empty amount field suggests. */
export function amountPlaceholder(currency: string): string {
  return currencyDecimals(currency) === 0 ? "0" : "0.00"
}

/** An amount in a currency's smallest unit: cents for USD, whole won for KRW (which has no smaller
 * unit). The shape ilovelawyer-api sends plan prices in. */
export interface Price {
  amountMinor: number
  currency: string
}

/** How many decimals a currency has (2 for USD, 0 for KRW), from Intl's own currency data. */
export function currencyDecimals(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2
}

/** A minor-unit amount in major units: 2000 USD is 20, 29000 KRW is 29000. */
export function toMajor({ amountMinor, currency }: Price): number {
  return amountMinor / 10 ** currencyDecimals(currency)
}

/**
 * A major-unit amount for display, in its own currency: "$20", "$20.50", "₩29,000". Whole amounts
 * drop the cents unless `cents` asks for them ("$15.00", for a charge); a currency without decimals
 * never has any. `locale` is the site's (ko-KR on KR); it only changes grouping and symbol placement.
 */
export function formatAmount(amount: number, currency: string, { locale = "en-US", cents = false }: { locale?: string; cents?: boolean } = {}): string {
  const decimals = currencyDecimals(currency)
  const showCents = cents || !Number.isInteger(amount)
  return amount.toLocaleString(locale, { style: "currency", currency, minimumFractionDigits: showCents ? decimals : 0, maximumFractionDigits: decimals })
}

/** A plan's price for display: "$20" on PH and UK, "₩29,000" on KR. */
export function formatPrice(price: Price, options?: { locale?: string; cents?: boolean }): string {
  return formatAmount(toMajor(price), price.currency, options)
}
