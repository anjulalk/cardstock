import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fetchJson } from '../lib/http.ts'
import type { Draft } from '../normalize.ts'
import { sourcesDir } from '../paths.ts'
import { decodeEntities, stripHtml } from '../normalize.ts'

export interface SourceContract {
  id: string
  name: string
  kind: 'api' | 'html' | 'browser'
  policy: { robots?: string; delayMs?: number; userAgent: string }
  requests: Array<{ name: string; url: string; params?: Record<string, string | number> }>
  sourceUrlTemplate: string
  imageBase?: string
  cadence?: string
  guards?: { minItems?: number; maxDropRatio?: number; requireFields?: string[] }
}

interface HnbWebPromo {
  id: number
  title: string
  thumb?: string
  merchant?: string
  cardType?: string
  to?: string
  valid?: string
}

interface HnbWebResponse {
  page: number
  limit: number
  total: number
  totalPages: number
  data: HnbWebPromo[]
}

interface HnbPremiumPromo {
  id: number
  title: string
  thumbUrl?: string
  from?: string
  to?: string
  card_type?: string
  content?: string
}

interface HnbPremiumResponse {
  status: number
  data: HnbPremiumPromo[]
}

export function loadContract(id: string): SourceContract {
  return JSON.parse(readFileSync(resolve(sourcesDir, `${id}.json`), 'utf8')) as SourceContract
}

/** The premium feed already labels its own sections, so pull them out by label
 *  instead of by position. */
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
  const tail = html.slice(index).replace(/<ul>/i, ' ')
  const value = stripHtml(tail)
  return value.length > 0 ? value : null
}

function absoluteImage(base: string | undefined, path: string | undefined): string | null {
  if (!path) return null
  const clean = decodeURIComponent(path).replace(/^\/+/, '')
  if (/^https?:\/\//i.test(clean)) return clean
  if (!base) return null
  return base.replace(/\/+$/, '') + '/' + encodeURI(clean)
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

    if (request.name === 'web') {
      const payload = await fetchJson<HnbWebResponse>(url.toString(), {
        source: 'hnb',
        userAgent,
        delayMs,
      })
      console.log(`[hnb] web feed reports ${payload.total} promotions`)
      for (const promo of payload.data) {
        drafts.push({
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
        })
      }
    }

    if (request.name === 'premium') {
      const payload = await fetchJson<HnbPremiumResponse>(url.toString(), {
        source: 'hnb',
        userAgent,
        delayMs,
      })
      console.log(`[hnb] premium feed reports ${payload.data.length} promotions`)
      for (const promo of payload.data) {
        const html = promo.content ?? ''
        drafts.push({
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
        })
      }
    }
  }

  return drafts
}
