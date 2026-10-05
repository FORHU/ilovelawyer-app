/** The rows PanelRowList shows while some are fading out: every live row in its live order, plus
 * each removed row still in `prev`, kept at its old index so it fades out in place. Generic over
 * anything with a key so the merge is testable without React. */
export function mergeRenderedRows<T extends { key: unknown }>(prev: T[], live: T[], removedKeys: Set<string>): T[] {
  const merged = [...live]
  prev.forEach((row, i) => {
    if (removedKeys.has(String(row.key))) merged.splice(Math.min(i, merged.length), 0, row)
  })
  return merged
}
