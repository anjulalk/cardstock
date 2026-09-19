import { type SourceContract } from '../contract.ts'
import { fetchJson } from '../lib/http.ts'
import type { Draft } from '../normalize.ts'
import { decodeEntities, stripHtml } from '../normalize.ts'

export interface HnbWebPromo {
  id: number
  title: string
  thumb?: string
  merchant?: string
  cardType?: string
  to?: string
  valid?: string
}

export interface HnbWebResponse {
  page: number
  limit: number
  total: number
  totalPages: number
  data: HnbWebPromo[]
}

export interface HnbPremiumPromo {
  id: number
  title: string
  thumbUrl?: string
  from?: string
  to?: string
  card_type?: string
  content?: string
}

export interface HnbPremiumResponse {
  status: number
  data: HnbPremiumPromo[]
}

/** The premium feed labels its own sections, so pull them out by label rather
 *  than by position. */
function section(html: string, label: string): string | null {
  const pattern = new RegExp(
    `<strong>\\s*${label}\\s*:?\\s*</strong>\\s*:?\\s*([\\s\\S]*?)(?=<strong>|</p>|$)`,
    'i',
  )
  const match = pattern.exec(html)
  if (!match?.[1]) return null
  const value = stripHtml(match[1]).replace(/^[:\s-]+/, '')
  return value.length > 0 ? value : null
}

function termsBlock(html: string): string | null {
  const index = html.search(/special terms and conditions/i)
  if (index < 0) return null
  const value = stripHtml(html.slice(index).replace(/<ul>/i, ' '))
  return value.length > 0 ? value : null
}

function absoluteImage(base: string | undefined, path: string | undefined): string | null {
  if (!path) return null
  const clean = decodeEntities(path).replace(/^\/+/, '')
  if (/^https?:\/\//i.test(clean)) return clean
  if (!base) return null
  return base.replace(/\/+$/, '') + '/' + encodeURI(clean)
}

/** Pure mapping, so a saved payload is enough to test it. */
export function mapHnbWeb(payload: HnbWebResponse, contract: SourceContract): Draft[] {
  return payload.data.map((promo) => ({
    source: 'hnb',
    externalId: String(promo.id),
    bank: 'hnb',
    title: promo.title,
    vendorHint: promo.merchant ?? null,
    image: absoluteImage(contract.imageBase, promo.thumb),
    validTo: promo.to ?? null,
    validityLabel: promo.valid ?? null,
    cardTypeText: promo.cardType ?? null,
    discountText: promo.title,
    sourceUrl: contract.sourceUrlTemplate.replace('{id}', String(promo.id)),
  }))
}

export function mapHnbPremium(payload: HnbPremiumResponse, contract: SourceContract): Draft[] {
  return payload.data.map((promo) => {
    const html = promo.content ?? ''
    return {
      source: 'hnb',
      externalId: String(promo.id),
      bank: 'hnb',
      title: promo.title,
      vendorHint: section(html, 'Merchant'),
      image: absoluteImage(contract.imageBase, promo.thumbUrl),
      validFrom: promo.from ?? null,
      validTo: promo.to ?? null,
      periodText: section(html, 'Period'),
      eligibilityText: section(html, 'Eligibility'),
      discountText: section(html, 'Offer') ?? promo.title,
      termsText: [section(html, 'Location'), termsBlock(html)].filter(Boolean).join(' ') || null,
      cardTypeText: promo.card_type ?? null,
      sourceUrl: contract.sourceUrlTemplate.replace('{id}', String(promo.id)),
    }
  })
}

export async function fetchHnb(contract: SourceContract): Promise<Draft[]> {
  const userAgent = contract.policy.userAgent
  const delayMs = contract.policy.delayMs ?? 800
  const drafts: Draft[] = []

  for (const request of contract.requests) {
    const url = new URL(request.url)
    for (const [key, value] of Object.entries(request.params ?? {})) {
      url.searchParams.set(key, String(value))
    }
    console.log(`[hnb] GET ${url.toString()}`)
    const fetchOptions = { source: 'hnb', userAgent, delayMs }

    if (request.name === 'web') {
      const payload = await fetchJson<HnbWebResponse>(url.toString(), fetchOptions)
      console.log(`[hnb] web feed reports ${payload.total} promotions`)
      drafts.push(...mapHnbWeb(payload, contract))
    }

    if (request.name === 'premium') {
      const payload = await fetchJson<HnbPremiumResponse>(url.toString(), fetchOptions)
      console.log(`[hnb] premium feed reports ${payload.data.length} promotions`)
      drafts.push(...mapHnbPremium(payload, contract))
    }
  }

  return drafts
}
