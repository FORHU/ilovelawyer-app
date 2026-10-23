/**
 * The subscription plans onboarding's last step offers. MOCK: there's no billing behind them yet
 * (no API, nothing is charged, the choice isn't saved). Prices are per month, in US dollars.
 */
export type PlanId = "BASIC" | "PRO" | "MAX";

export interface Plan {
  id: PlanId;
  /** Per month, in whole dollars. */
  priceUsd: number;
  /** How many cases the account can create. */
  cases: number;
  /** The AI usage included, in dollars of token consumption. */
  aiUsageUsd: number;
}

export const PLANS: readonly Plan[] = [
  { id: "BASIC", priceUsd: 20, cases: 5, aiUsageUsd: 10 },
  { id: "PRO", priceUsd: 50, cases: 20, aiUsageUsd: 30 },
  { id: "MAX", priceUsd: 100, cases: 50, aiUsageUsd: 50 },
];
