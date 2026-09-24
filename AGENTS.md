# AGENTS.md

Cardstock is a static calendar of Sri Lankan credit card offers. A visitor ticks the cards they hold
and sees which venues run an offer on which days. There is no server and no database: a scheduled job
reads each bank's own pages or API, normalizes what it finds into `data/offers.jsonl`, and the build
slices that into the small files the browser asks for.

This file is the working brief. The skills in `.opencode/skills/` carry the detail:

| Skill | Load it when |
| --- | --- |
| `source-adapter` | Adding a bank, repairing one that broke, or working on dates and periods |
| `data-contract` | Changing what the browser downloads, the manifest, or the client loader |
| `merchant-registry` | Adding a merchant, or a name that a bank spells differently |
| `seo` | Changing the name, the description, the palette or the domain, or adding a page |

## Commands

```bash
npm install
npm run sync      # fetch every source, validate, write data/offers.jsonl
npm run chunk     # build the browser chunks under packages/web/public/data
npm test          # unit tests, fixtures included
npm run probe     # assert each source still answers what its contract expects
npm run dev       # http://localhost:5173
npm run build     # the static site, into packages/web/dist
npm run assets    # icons, social card, manifest, robots.txt, CNAME
```

Some banks answer a plain client with a challenge page or render their offers only in a browser. Those
sources are fetched with Playwright, installed separately:

```bash
npx playwright install chromium
```

Without it, `npm run sync` skips those sources and logs why. That is deliberate: a checkout should
work before it has a browser.

## How the pieces fit

```
sources/<id>.json     the crawl contract for one bank
registry/*.json       banks, card products with tiers, merchants with keywords
scripts/              the brand asset generator
packages/shared       types, the date parser, the eligibility parser, the wire decoder
packages/worker       adapters, validation, sync, chunk builder, probe
packages/web          the Vue app, reading the manifest and chunks at runtime
data/offers.jsonl     canonical offers, one JSON object per line, generated
```

`sync` writes the canonical file and stops if a guard fails. `chunk` reads that file and writes
`packages/web/public/data`, which the browser downloads. Only the run counters (`data/latest.json`,
`data/runs.json`) are committed; the offers and the chunks are generated and gitignored.

## Adding a bank

The full method is in the `source-adapter` skill. In short:

1. Reconnoitre: is the listing server rendered, an API, or client side? A browser user agent, a count
   of offer phrases in the HTML, and a look at the bundle for `baseURL` and `/api/` paths answer it.
2. Write `sources/<id>.json` with the boundaries and the guards.
3. Write `packages/worker/src/adapters/<id>.ts` with a **pure mapper** (`mapXList(html, contract)`) and
   a thin fetch wrapper. The mapper is what the tests and the browser runner both call.
4. Save a trimmed real payload under `sources/<id>/fixtures/` and test the mapper against it.
5. Register the fetcher in `sync.ts` and `probe.ts`.
6. `npm run sync`, then `npm run chunk` and `npm run build`.

Every source earns its keep twice: the fixture test fails when our mapping changes, and the daily
probe fails when the bank's page changes.

## When a bank refuses the runner

Some banks answer every cloud egress IP with a 403, so the same request that works from a laptop can
never work from CI. A 403 is therefore retried through a relay: `CARDSTOCK_PROXY` when it is set (a
relay that takes `{url}`, or takes the encoded target appended), and Google's translation proxy when it
is not. The proxy rewrites every URL in the response to its own host, so responses that arrive that way
have the bank's own URLs put back before anything reads them, and hrefs, ids and image paths stay
correct.

A rendered page takes the same route: a load that fails, or that returns a few hundred bytes of
challenge, is retried through the relay.

```bash
node scripts/check-relay.mts   # proves the relay answers where a direct request is refused
```

## What must not bend

- **Never publish an offer without an end date.** An offer that cannot be placed on a calendar is
  skipped, with a count in the log, and the offer-count guard notices if that becomes common.
- **Availability is not quality.** A source the runner cannot reach, or one that answers with nothing,
  is recorded in `data/runs.json` and left out of that run rather than failing it, because a datacenter
  IP can be refused where a home one is not. The daily probe is what fails loudly about a source that
  has gone.
- **A guard decides what is published, not whether the run survives.** A source that breaks its floor,
  loses too much of its list or drops a required field sits the run out: its previous offers stay in
  the store and on the site, and the reason lands in `data/runs.json`. Half a list is worse than the
  last good one. The run fails only when no source answered at all.
- **The id must reproduce the link.** The manifest rebuilds each offer's page from a template and the
  id, so the id is the bank's slug exactly, underscores and case included.
- **One row per offer.** Some feeds publish the same id twice; the sync keeps one and reports how many
  it dropped.
- **Do not hand-edit a fixture.** Refresh it from the live source, then read the diff.
- **Do not commit generated output**: `data/offers.jsonl` and `packages/web/public/data/` are ignored
  on purpose.

## Data and payload rules

The browser never downloads everything. `index.json` names every chunk and its size, months are
published **one file per bank**, and the client asks only for the banks its cards belong to. September
2026 is 702 KB of JSON across eleven banks and 81 KB compressed; a visitor holding two banks fetches a
fraction of that. `DATA-CONTRACT.md` is the agreement; the `data-contract` skill explains the changes
and the versioning.

## Merchants

The same shop is named differently by each bank. The registry matches by keyword and alias, strips a
branch or a town, and scores the result. Below the floor it refuses, and the bank's own name is shown
instead. The client lets a visitor pick one merchant and filters to the offers the banks file under
it, while each offer keeps its own bank's wording. See the `merchant-registry` skill.

## Design

The site follows the shared design system of this author's projects: warm ivory paper, ink text, one
clay accent, Inter for chrome, Source Serif 4 for prose, JetBrains Mono for numbers that are compared.
The page carries the shared ambient wash (`--wash-ambient`, two soft clay and moss glows), the
wordmark is two tones (`card` in ink, `stock` in clay), and the tokens are published at
<https://anjula.dev/design/tokens.css> and mirrored in `packages/web/src/style.css`. Container 80rem,
gutters 1.5 to 8rem, reading measure 65ch, hairlines rather than shadows, and every pairing legible
in both light and dark.

**Typography roles are the part that gets forgotten.** The page is serif, because most of what is on it
is prose, and chrome switches back to Inter with the `ui` utility:

| Role | How | Where |
| --- | --- | --- |
| Reading | `--font-serif`, the body default | the tagline, the intro, offer titles in the day panel |
| Chrome | the `ui` utility | header, filters, controls, calendar navigation, footer, error and empty states |
| Metadata | the `label` utility (Inter, uppercase, 0.07em) | eyebrows, counts, the last checked stamp |
| Compared numbers | the `num` utility (mono, tabular) | day numbers, day counts, discount values |

Do not leave a control in serif or a paragraph in Inter. When adding markup, ask which of the four it
is, and say so in the class list.

### Marks

Bank marks are 64x64 PNGs in `packages/web/public/banks`, one per bank, shown beside the bank in the
picker and beside each offer in the day panel, because an offer belongs to a bank. `npm run logos`
refetches them from the banks' own sites, through the browser, since two of those sites refuse a plain
client. A bank that publishes no square mark gets a monogram tile in its own brand colour rather than a
broken image, which is what Amãna has.

Card network marks are drawn in `NetworkMark.vue` in `currentColor`, so they stay inside the palette:
Mastercard is its two circles, Visa and Amex are wordmarks. Never put a network's brand colour on the
page; the paper palette is the point.

## SEO

One page, so the work is small but easy to leave inconsistent: the origin, the name and the palette
each appear in several files. The `seo` skill lists them and the checks. `npm run assets` regenerates
the icons and the social card, and the card must be looked at after any change to the name or palette.

## Writing

All prose follows the same house style as the blog: plain and direct sentences, no em-dashes, sentence
case headings, no bold lead-ins inside bullets, first person where it is the author's experience.
Titles read like something a person would search for. The same rules apply to log lines, comments and
commit messages, not just to published copy.

## Known gaps

- **DFCC** is the last bank out. Its mapping is written and tested from the one route that renders on
  the server; its category pages need a browser pass that renders them, since a plain render shows
  none of the cards. Its contract records what was tried.
- **Sampath's** list API fills `promotion_period`, `eligible_card_categories` and `location` only on
  its detail route, one request per offer. The calendar does not need them; the terms do, if a detail
  page is ever wanted.
- **1264 of 1803 offers** still name a merchant the registry does not know, almost all one-off hotels
  and small shops appearing once or twice. `packages/worker/report-vendors.mts` prints them, most
  common first, which is the fastest way to grow the registry.
- **Seylan's** tier pages (Visa Gold, Platinum, Signature, World Master) are not read yet, which is the
  cheapest source of more tier labels than the seven in play.
- The site is deployed by the workflows to GitHub Pages, and the repository's Pages source is the
  GitHub Actions workflow. The one step left is the DNS record for `cardstock.anjula.dev`, which
  `packages/web/public/CNAME` pins the site to; until it exists the `github.io` address answers 404.
- In CI the canonical store rides in an `actions/cache` entry (`data/offers.jsonl`, key prefix
  `offers-`), because a fresh checkout has no store and a skipped source must not take its bank off
  the site. A cache miss falls back to the committed counts in `data/latest.json`.
