# cardstock

[![ci](https://img.shields.io/github/actions/workflow/status/anjulalk/cardstock/ci.yml?branch=main&label=ci&labelColor=44403a&style=flat-square)](https://github.com/anjulalk/cardstock/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/anjulalk/cardstock?label=release&labelColor=44403a&color=5f5a51&style=flat-square)](https://github.com/anjulalk/cardstock/releases/latest)
[![deploy](https://img.shields.io/github/actions/workflow/status/anjulalk/cardstock/deploy.yml?branch=main&label=deploy&labelColor=44403a&style=flat-square)](https://github.com/anjulalk/cardstock/actions/workflows/deploy.yml)
[![offers](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fanjulalk%2Fcardstock%2Fmain%2Fdata%2Flatest.json&query=%24.offers&label=offers&labelColor=44403a&color=c1603c&style=flat-square)](https://cardstock.anjula.dev)
[![node](https://img.shields.io/badge/node-24-5f5a51?labelColor=44403a&style=flat-square)](https://nodejs.org/)
[![license](https://img.shields.io/badge/license-MIT-c1603c?labelColor=44403a&style=flat-square)](LICENSE)

Credit card offers in Sri Lanka, on a calendar, filtered to the cards you actually hold. Pick the
cards in your wallet once, then see which supermarkets, restaurants and stores run an offer on which
days.

The site is static. A scheduled job reads each bank's own pages or API, normalizes what it finds into
`data/offers.jsonl`, and the build slices that into the small files the browser asks for. There is no
server and no database.

## Quick start

```bash
npm install
npm run sync      # fetch every source, validate, write data/offers.jsonl
npm run chunk     # build the browser chunks under packages/web/public/data
npm run dev       # http://localhost:5173
npm run probe     # assert each source still answers what its contract expects
npm run assets    # regenerate the icons, the social card, robots.txt and the CNAME
```

Two banks stand behind a bot filter that fingerprints the client rather than the headers, so their
pages are fetched with a browser:

```bash
npx playwright install chromium
```

Without it, `npm run sync` skips those sources and says why, and everything else still works.

Some banks refuse every cloud address with a 403, so a scheduled run cannot reach them directly. Those
requests are retried through a relay: set `CARDSTOCK_PROXY` to a relay of your own (it takes `{url}`, or
the encoded target appended), or leave it unset to fall back to Google's translation proxy.

## How it fits together

```
sources/<id>.json     one crawl contract per bank, with a trimmed real payload beside it
registry/*.json       banks, card products with tiers, and merchants with their keywords
packages/shared       types, the date parser, the eligibility parser, the wire decoder
packages/worker       adapters, validation, sync, the chunk builder, the probe
packages/web          the Vue app, reading the manifest and chunks at runtime
data/offers.jsonl     canonical offers, one per line, generated
```

`sync` validates before it writes, and a source that breaks its guards sits the run out rather than
publishing half its offers. `chunk` then publishes one file per bank per month, which is what keeps a
visitor's download proportional to the cards they hold rather than to every offer in the country.

## The banks

Eleven of the twelve banks are read, around 1800 offers in total. The live counts per source are in
`data/latest.json` after a sync.

| Bank | How it is read |
| --- | --- |
| HNB | its own JSON API |
| Seylan | server rendered listing, dates in a calendar link |
| People's | server rendered listing inside a script |
| Nations Trust | server rendered listing |
| Sampath | its own JSON API, behind two required headers |
| NDB | server rendered listing |
| BOC | server rendered listing |
| Commercial Bank | server rendered listing |
| Amana | server rendered listing, dates in a `data-ics` JSON |
| Pan Asia | rendered in a browser, Sucuri in front |
| Union | rendered in a browser, Imperva in front |
| DFCC | mapping written, waiting on a browser pass |

## Knowledge and conventions

- **`AGENTS.md`** is the working brief: commands, layout, the rules that must not bend, and the known
  gaps.
- **`DATA-CONTRACT.md`** is the agreement between the build and the browser: the manifest, the chunk
  layout, the wire format and its versions.
- **`.opencode/skills/`** carries the method: `source-adapter` for adding or repairing a bank and the
  full catalogue of date shapes the banks publish, `data-contract` for changing what the browser
  downloads, `merchant-registry` for resolving one merchant out of many bank spellings, and `seo` for
  the head tags, structured data, sitemap, icons and social card.

## Design and writing

The site follows the shared design system of this author's projects: warm ivory paper, ink text, one
clay accent, Inter for chrome, Source Serif 4 for prose, JetBrains Mono for numbers that are compared.
The page carries the shared ambient wash (two soft clay and moss glows, `--wash-ambient`), and the
wordmark is two tones, `card` in ink and `stock` in clay.

Typography follows the system's roles: the page reads in serif, chrome switches back to Inter with the
`ui` utility, `label` is for metadata and `num` for numbers that are compared. The tokens are published
at <https://anjula.dev/design/tokens.css> and mirrored in `packages/web/src/style.css`. Prose follows
the house style: plain sentences, no em-dashes, sentence case headings.

## Releases

The live site deploys from `main`. Merge a pull request labeled `release:patch`, `release:minor` or `release:major` to update `VERSION`, create a Git tag and publish a GitHub release. You can also dispatch the `release.yml` workflow with a version bump.

## Credits

Built by [Anjula Karunarathne](https://anjula.dev).

Offers are read from the banks' own pages and may change without notice. Confirm the terms with the
bank before you transact. Not affiliated with, endorsed by, or operated by any bank listed, and bank
names and marks belong to their respective owners.
