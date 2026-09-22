---
name: source-adapter
description: Add or repair a bank source in the cardstock repo. Load when a bank must be added, when a probe fails because a bank changed its page, or when a date, period or eligibility string is not being read. Covers the reconnaissance checklist, the contract fields, the adapter conventions, fixtures and guards, and the full catalogue of date shapes the banks publish.
---

# Source adapters

One bank, one contract in `sources/<id>.json`, one adapter in `packages/worker/src/adapters/<id>.ts`.
The contract declares the boundaries and the guards; the adapter does the reading.

## 1. Reconnoitre before writing anything

Never guess the shape. The answers below decide everything else:

1. Fetch the listing with a **browser user agent** and count offer phrases in the HTML
   (`% off`, `up to N%`, `Valid till|until|from`). Zero means the offers are not in the served HTML.
2. Look for a framework marker: `__NEXT_DATA__`, `__NUXT__`, `data-reactroot`, `wp-json`,
   `data-server-rendered`. That tells you what the client will do.
3. Download the page's JS chunks and grep for `baseURL`, `/api/`, `graphql` and any path containing
   `offer` or `promotion`. This is how two APIs were found here, and it is far cheaper than scraping.
4. If an API turns up, call it **with the headers the site itself sends**. Sampath's list returns a
   correct `total` with an empty `data` array unless the request carries `locale: en` and
   `platform: web`. A parameter and a header with the same name are not the same thing.
5. If the page still resists, render it in a browser and watch the network, or read the rendered
   markup. Union (Imperva) and Pan Asia (Sucuri) fingerprint the client, not the headers.
6. Check `robots.txt`, and keep a courtesy delay. Every contract sets `policy.delayMs`.

## 2. The contract

```jsonc
{
  "id": "boc",
  "name": "Bank of Ceylon",
  "kind": "html",                     // api | html | browser
  "blocked": "why it cannot be fetched yet",   // browser sources only
  "policy": { "robots": "...", "delayMs": 1500, "userAgent": "cardstock/0.1 (+https://...)" },
  "requests": [{ "name": "list", "url": "https://...", "params": {}, "headers": {} }],
  "itemMarker": "class=\"reward box-shadow active\"",   // where one card starts
  "itemPattern": "<a href=\"https://.../product\"",     // when an anchor is the boundary
  "categoryMap": { "supermarkets": "supermarket" },     // the site's taxonomy to ours
  "sourceUrlTemplate": "https://.../offer/{id}",        // rebuilds the link from the id
  "pagination": { "maxPages": 8 },
  "guards": { "minItems": 50, "maxDropRatio": 0.25, "requireFields": ["id", "title", "validTo", "bank", "sourceUrl"] }
}
```

Two details that cause real bugs:

- **The id must reproduce the link.** If the template cannot be built from the id, the client shows a
  broken link. Seylan's slug ends in an underscore and the id keeps it; BOC's and ComBank's ids are the
  URL path after the section, because the category is part of the address.
- **`itemMarker` is a literal, `itemPattern` is a regex source.** Use the pattern when the useful
  boundary is an anchor's `href` that comes before the class attribute, as BOC and NDB do.

## 3. The adapter

- Export a **pure mapper**: `mapXList(html, contract): Draft[]`. No fetching inside it, so a fixture
  and the browser runner can both call it.
- Export a thin `fetchX(contract)` that fetches and calls the mapper. Browser sources get a second
  wrapper that renders the page first.
- A `Draft` is raw: `source`, `externalId`, `bank`, `title`, `sourceUrl`, plus any of `vendorHint`,
  `image`, `validFrom`, `validTo`, `validityLabel`, `periodText`, `eligibilityText`, `cardTypeText`,
  `discountText`, `termsText`, `categoryHint`. `buildOffer` in `normalize.ts` turns it into an `Offer`.
- **Skip what cannot be placed.** If the period has no end date, skip the card and count it in the log
  (`skipped N card(s) with no placeable period`). Do not publish an undated offer, and do not let one
  fail the run.
- Prefer the source's own words over your inference: `categoryHint` beats the keyword guess, the
  published prose beats a padded calendar link, and a bank's merchant name is kept verbatim as
  `vendorHint` even when the registry matches it.
- When a title carries template debris (Seylan's `?name=".$result->slug}}"`), read the tag's text, not
  its attributes.

## 4. Fixtures and tests

- Save a **trimmed real payload** under `sources/<id>/fixtures/`. Five or six rows, chosen to cover the
  date shapes and the card types the source uses.
- Test the mapper against it: ids, the rebuilt link, the dates, the card types, the category, the
  discount. Assert fields, not implementation.
- The fixture test catches **our** mistakes; the daily probe catches **the bank's** changes. Both are
  needed: a fixture cannot notice a redesign, and a probe cannot notice a mapping regression.
- When a fixture test fails, read the actual value before touching the test. Two of the failures in
  this repo were real bugs (an anchor split that paired every offer with the next one's link, and a
  time of day read as a day).

## 5. Guards

- `minItems` is an absolute floor. A run below it fails and nothing is written.
- `maxDropRatio` compares against the last run, or against the committed counts in CI where there is
  no previous file. **Month end legitimately drops offers**: NTB loses a quarter of its list when a
  month turns, so its limit is 0.35 rather than the default 0.25.
- `requireFields` is checked against the canonical names (`validTo`, not the API's `to`).
- `probe` runs the fetchers and asserts the floor, so a bank redesign fails a daily job instead of
  quietly shrinking the calendar.

## 6. The date shapes these banks publish

This is the catalogue the parser in `packages/shared/src/dates.ts` exists to handle. Read it before
adding a pattern, and add a test for every new shape.

| Shape | Example | Where |
| --- | --- | --- |
| ISO | `2026-09-30` | HNB feeds |
| Day, month, year | `Till 30th September 2026`, `31 Aug 2026` | most banks |
| Month first, American | `Till October 31, 2026` | People's |
| Day first with a separator | `11-09-2026`, `10/09/2026` | Pan Asia |
| Named days sharing a month | `Valid on 2nd, 16th and 30th September 2026`, `8th & 22nd August 2026` | NTB, Union |
| A weekday rule | `Every Wednesday till 26th August 2026` | HNB, Sampath, ComBank |
| A weekday span | `every Monday to Thursday till 30 September 2026` | NTB |
| A range inside one month | `1st to 15th August 2026`, `01st -30th September 2026` | NTB, NDB |
| A range across two months | `10th September - 24th September 2026` | NDB |
| A monthly day range | `from 20th to 30th of every month till December 2026` | ComBank |
| The same, running backwards | `from 24th to 11th of every month` wraps into the next month | ComBank |
| A calendar link | `dates=20260917/20260922`, end exclusive | Seylan, Union, Sampath |
| An `data-ics` JSON | `{"start":"2026-12-16","end":"2026-12-17"}`, end exclusive | Amana |
| Epoch milliseconds | `1790360940000`, the last minute of the day in Colombo | Sampath |
| An end date only | `Expiration date: 30 Sep 2026` | HNB, BOC, ComBank |

Rules and traps that came out of these:

- **Strip times of day first.** DFCC writes `at 18:30 until 31 October 2026`, and the `30` of `18:30`
  reads as a day unless it is removed. The parser strips `at HH:MM` and `HH:MM`.
- **A month and a year is not a day.** `October 2026` must not become the 20th; the month-first
  pattern carries a lookahead for exactly this. Inside a monthly range, `till December 2026` means the
  end of that month.
- **Two words are not a date range if one of them is a time.** The same-month pattern refuses a day
  that follows a colon.
- **Day first is the local convention.** `11-09-2026` from a Sri Lankan bank is the 11th of September.
- **A padded calendar link is not the offer.** Union's page reads `18th to 20th September` while its
  calendar link runs 17th to 22nd. The prose wins; the link is a fallback.
- **The parser is where the model is decided**: `days` is a weekday rule (0 is Sunday), `dates` is a
  list of ISO days, and `qualifyingDays` turns either into the day numbers of a month. The chunker
  never sees a rule, only the days.
- The chunker claims **the current month** for an offer that publishes only an end date. That is the
  honest floor: the offer was published, so it is running, and the month is where a visitor looks.
