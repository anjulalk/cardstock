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

/** Used for offer ids when a page has no stable slug of its own. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
