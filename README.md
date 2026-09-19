# cardstock

Credit card offers in Sri Lanka, on a calendar, filtered to the cards you actually hold. Pick your
cards once, then see which venues run an offer on which days.

The site is static. A scheduled job reads the banks' own offer pages or APIs, normalizes what it
finds into `data/offers.jsonl`, and the build slices that into the small chunks the browser asks
for. There is no server and no database.

```bash
npm install
npm run sync      # fetch the sources, normalize, write data/
npm run chunk     # build the browser chunks under packages/web/public/data
npm run dev       # http://localhost:5173
npm run probe     # assert each source still returns what the contract expects
```

## Layout

| Path | What lives there |
| --- | --- |
| `sources/<id>.json` | The crawl contract for one bank, with fixtures beside it |
| `registry/` | Hand written banks, card products with tiers, and vendors |
| `packages/shared` | Types, the date and eligibility parsers, and their tests |
| `packages/worker` | The adapters, validation, sync and the chunk builder |
| `packages/web` | The Vue app, reading the manifest and chunks at runtime |
| `data/offers.jsonl` | Canonical offers, one per line, generated |

## The contract

`packages/web/public/data/index.json` is the agreement between the build and the browser. It names
every chunk and its size, so the client resolves URLs rather than composing them, and it carries
`contract`, `minClient` and `dataVersion` so the two sides can ship independently. See
`DATA-CONTRACT.md`.

## Design

The interface follows the shared design system documented at
<https://anjula.dev/design/tokens.css>. The tokens live in `packages/web/src/style.css`.
