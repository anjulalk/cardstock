/** Some banks refuse every cloud egress IP, so a request from a CI runner can
 *  never succeed directly. The same two ways out as the sibling project:
 *
 *  1. `CARDSTOCK_PROXY`, a relay that takes `{url}` or a bare suffix, for when a
 *     self hosted relay is wanted.
 *  2. Google's translation proxy, which fetches the page from its own addresses.
 *     It rewrites every URL in the page to its own host, so responses that come
 *     back this way are put back with `restoreUrls` before anything reads them.
 */

/** The relay for a URL, or null when the URL is already going through one. */
export function proxiedUrl(url: string): string | null {
  if (isProxied(url)) return null

  const template = process.env.CARDSTOCK_PROXY
  if (template) {
    return template.includes('{url}')
      ? template.replace('{url}', encodeURIComponent(url))
      : template + encodeURIComponent(url)
  }

  const parsed = new URL(url)
  parsed.hostname = `${parsed.hostname.replace(/\./g, '-')}.translate.goog`
  parsed.searchParams.set('_x_tr_sl', 'auto')
  parsed.searchParams.set('_x_tr_tl', 'en')
  parsed.searchParams.set('_x_tr_hl', 'en')
  return parsed.toString()
}

export function isProxied(url: string): boolean {
  return url.includes('.translate.goog')
}

/** Undoes the translation proxy's rewriting, so hrefs, ids and image paths read
 *  as the bank published them. A host with a real dash in it would come back
 *  wrong; none of the banks here has one. */
export function restoreUrls(text: string): string {
  return text
    .replace(/https?:\/\/([a-z0-9-]+)\.translate\.goog/gi, (_match, host: string) => {
      const name = host.replace(/-/g, '.')
      return `https://${name}`
    })
    .replace(/[?&](?:amp;)?_x_tr_[a-z]+=[^&"'\s]*/g, '')
}
