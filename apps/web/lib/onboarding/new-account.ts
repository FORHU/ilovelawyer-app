/** The rule behind useIsNewAccount: every count known, and every one zero. A count that's still
 * loading (or failed) is unknown, and an unknown account is never treated as new. */
export function isNewAccount(activeCases?: number, archivedCases?: number, consultations?: number): boolean {
  return activeCases === 0 && archivedCases === 0 && consultations === 0
}
