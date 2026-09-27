/**
 * Derives the British English catalogs from the American ones.
 *
 * Spelling is a *mechanical* difference, so this encodes the transform instead of a second copy of
 * the prose. Shipping the output as JSON meant a 200-character marketing sentence was duplicated to
 * change one letter in "organisation", and nothing kept the two in step — edit the English and the
 * British copy silently keeps the old wording. Only differences a transform cannot derive (the
 * terms UK practice uses: claimant, legal advice privilege) stay as hand-written overrides in
 * `locales/en-GB/`.
 *
 * Consequence worth knowing: new English copy becomes British automatically, including in `term`
 * (Terms & Conditions). That is spelling only and cannot change meaning, but it does mean the two
 * variants of that document are never separately reviewed.
 */

/**
 * American stem → British stem, matched case-insensitively anywhere in a word, with the case of the
 * matched run preserved ("Organiz" → "Organis", "ORGANIZ" → "ORGANIS").
 *
 * Stems, not whole words, so one entry covers a family: `authoriz` handles authorize, authorized
 * and unauthorized alike.
 *
 * **Deliberately absent, and why — read before adding:**
 * - `labor` — "Labor Code", "Department of Labor and Employment" are Philippine statutes and
 *   agencies. Proper nouns, not Americanisms; respelling them would be wrong, not localised.
 * - `practice`, `license` — British English splits these by part of speech (a practice, to
 *   practise; a licence, to license). No regex knows which one a string means.
 * - `program` — "programme" is the British form for a broadcast or a plan, never for software.
 * - `judgment` — already the spelling UK courts use for a decision. Nothing to change.
 * - `meter`, `liter` — would corrupt "parameter" and "obliterate".
 * - `catalog`, `dialog` — the -ue forms need suffix-aware handling ("cataloged" is not
 *   "catalogueed"), and neither appears in the catalogs today.
 */
const SPELLING: readonly (readonly [string, string])[] = [
  // -ize → -ise
  ["organiz", "organis"],
  ["analyz", "analys"],
  ["summariz", "summaris"],
  ["authoriz", "authoris"],
  ["recogniz", "recognis"],
  ["customiz", "customis"],
  ["prioritiz", "prioritis"],
  ["categoriz", "categoris"],
  ["finaliz", "finalis"],
  ["minimiz", "minimis"],
  ["maximiz", "maximis"],
  ["optimiz", "optimis"],
  ["synchroniz", "synchronis"],
  ["initializ", "initialis"],
  ["utiliz", "utilis"],
  ["apologiz", "apologis"],
  ["emphasiz", "emphasis"],
  // -er → -re
  ["center", "centre"],
  // -se → -ce
  ["defense", "defence"],
  ["offense", "offence"],
  // -or → -our
  ["favorite", "favourite"],
  ["behavior", "behaviour"],
  ["color", "colour"],
  // doubled consonant
  ["canceled", "cancelled"],
  ["canceling", "cancelling"],
  ["traveling", "travelling"],
  ["modeling", "modelling"],
  // single l
  ["fulfillment", "fulfilment"],
  ["enrollment", "enrolment"],
  // misc
  ["gray", "grey"],
]

const RULES = SPELLING.map(([american, british]) => [new RegExp(american, "gi"), british] as const)

function matchCase(matched: string, replacement: string): string {
  if (matched === matched.toUpperCase()) return replacement.toUpperCase()
  if (matched[0] === matched[0]?.toUpperCase()) return replacement[0]!.toUpperCase() + replacement.slice(1)
  return replacement
}

/** One string, respelled. Exported for the tests; callers want `toBritish`. */
export function britishSpelling(value: string): string {
  let out = value
  for (const [pattern, british] of RULES) {
    out = out.replace(pattern, (matched) => matchCase(matched, british))
  }
  return out
}

/** Every string in a catalog, respelled, with the structure left exactly as it was. */
export function toBritish<T>(node: T): T {
  if (typeof node === "string") return britishSpelling(node) as T
  if (Array.isArray(node)) return node.map(toBritish) as T
  if (node && typeof node === "object") {
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, toBritish(value)])) as T
  }
  return node
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * Lays hand-written overrides over a derived catalog. Objects merge key by key; anything else —
 * including an array — is replaced outright, matching how i18next itself treats an overridden
 * array rather than pretending elements can be merged by index.
 */
export function withOverrides<T>(base: T, overrides: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(overrides)) return (overrides === undefined ? base : overrides) as T
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    out[key] = key in base ? withOverrides(base[key], value) : value
  }
  return out as T
}

/**
 * The British catalogs: every American namespace respelled, then the hand-written term overrides
 * applied on top. `overrides` is keyed by namespace and need only cover the namespaces that have
 * any.
 */
export function britishCatalogs<T extends Record<string, unknown>>(
  american: T,
  overrides: Partial<Record<keyof T, unknown>>,
): T {
  return Object.fromEntries(
    Object.entries(american).map(([ns, catalog]) => [ns, withOverrides(toBritish(catalog), overrides[ns as keyof T])]),
  ) as T
}
