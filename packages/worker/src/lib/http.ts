/** Small fetch wrapper: identifies the crawler, keeps a courtesy delay between
 *  requests to one host, and retries the transient failures these sites throw. */

export interface FetchOptions {
  source: string
  userAgent: string
  delayMs?: number
  retries?: number
  timeoutMs?: number
  headers?: Record<string, string>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchJson<T>(url: string, opts: FetchOptions): Promise<T> {
  const text = await fetchText(url, opts)
  return JSON.parse(text) as T
}

export async function fetchText(url: string, opts: FetchOptions): Promise<string> {
  const retries = opts.retries ?? 2
  const timeoutMs = opts.timeoutMs ?? 30000
  let lastError: unknown = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0 || (opts.delayMs ?? 0) > 0) {
      await sleep((opts.delayMs ?? 0) * (attempt === 0 ? 1 : attempt + 1))
    }
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': opts.userAgent,
          Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
          'Accept-Language': 'en-LK,en;q=0.9',
          ...(opts.headers ?? {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`${res.status} ${res.statusText} for ${url}${body ? ` :: ${body.slice(0, 120)}` : ''}`)
      }
      return await res.text()
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const retryable = /5\d\d|timeout|aborted|fetch failed|ECONN|socket/i.test(message)
      console.warn(`[${opts.source}] attempt ${attempt + 1} failed: ${message}`)
      if (!retryable) break
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
