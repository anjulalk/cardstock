/** Small extraction helpers for the server-rendered pages. Deliberately boring:
 *  the fixture test pins the result, and the daily probe notices when the
 *  markup moves underneath. */

export function firstMatch(html: string, pattern: RegExp): string | null {
  const match = pattern.exec(html)
  const value = match?.[1]
  return value === undefined ? null : value
}

export function allMatches(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((match) => match[1] ?? '')
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Cuts a listing into one string per card. The boundary is a literal class
 *  name where that comes first in the markup, or a pattern where the useful
 *  boundary is an anchor's href.
 *
 *  Built on matchAll rather than split: split drops a zero width match at
 *  position 0, which would silently lose the first card of a page that starts
 *  with one. */
export function splitItems(
  html: string,
  contract: { itemMarker?: string; itemPattern?: string },
): string[] {
  const source =
    contract.itemPattern ?? (contract.itemMarker ? escapeRegExp(contract.itemMarker) : null)
  if (!source) throw new Error('the contract declares neither itemMarker nor itemPattern')

  const starts = [...html.matchAll(new RegExp(source, 'g'))].map((match) => match.index!)
  return starts.map((start, index) => html.slice(start, starts[index + 1] ?? html.length))
}

/** Used for offer ids when a page has no stable slug of its own. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
