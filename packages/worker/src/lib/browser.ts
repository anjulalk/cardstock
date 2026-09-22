import type { Browser, Page } from 'playwright'

/** Four banks answer a plain client with a challenge page: Imperva for Union,
 *  Sucuri for Pan Asia, and a client side render for Sampath and DFCC. Those
 *  fingerprint the client rather than the headers, so a real browser is the
 *  only way in.
 *
 *  Playwright is an optional dependency. When it is not installed the sync
 *  skips the browser sources and says so, which keeps a plain `npm run sync`
 *  working on a machine without Chromium. */

export interface BrowserOptions {
  waitFor?: string
  timeoutMs?: number
  idleMs?: number
  userAgent?: string
}

let browserPromise: Promise<Browser> | null = null

export async function browserAvailable(): Promise<boolean> {
  try {
    await import('playwright')
    return true
  } catch {
    return false
  }
}

async function getBrowser(userAgent?: string): Promise<Browser> {
  if (!browserPromise) {
    const { chromium } = await import('playwright')
    browserPromise = chromium.launch()
  }
  const browser = await browserPromise
  void userAgent
  return browser
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return
  const browser = await browserPromise.catch(() => null)
  browserPromise = null
  await browser?.close()
}

/** Renders a page and returns the HTML the browser ends up with, after the
 *  page has settled. */
export async function renderHtml(url: string, options: BrowserOptions = {}): Promise<string> {
  const browser = await getBrowser(options.userAgent)
  const page = await browser.newPage({ userAgent: options.userAgent })
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs ?? 45000 })
    if (options.waitFor) {
      await page.waitForSelector(options.waitFor, { timeout: options.timeoutMs ?? 45000 })
    } else {
      await page.waitForLoadState('networkidle', { timeout: options.timeoutMs ?? 45000 }).catch(() => undefined)
    }
    await page.waitForTimeout(options.idleMs ?? 1200)
    return await page.content()
  } finally {
    await page.close()
  }
}

/** Renders a page and keeps the JSON the site fetches for itself, which is the
 *  way in when the offers never reach the markup. */
export async function captureJson(
  url: string,
  pattern: string,
  options: BrowserOptions = {},
): Promise<unknown | null> {
  const browser = await getBrowser(options.userAgent)
  const page: Page = await browser.newPage({ userAgent: options.userAgent })
  try {
    let captured: unknown | null = null
    let resolveCaptured: (() => void) | null = null
    const arrived = new Promise<void>((resolve) => {
      resolveCaptured = resolve
    })

    page.on('response', (response) => {
      if (captured || !response.url().includes(pattern)) return
      void response
        .json()
        .then((body) => {
          captured = body
          resolveCaptured?.()
        })
        .catch(() => undefined)
    })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs ?? 60000 })
    await Promise.race([
      arrived,
      page.waitForLoadState('networkidle', { timeout: options.timeoutMs ?? 60000 }).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, options.idleMs ?? 8000)),
    ])

    return captured
  } finally {
    await page.close()
  }
}
