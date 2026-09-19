# Data contract

The build writes the data; the browser reads it. This file is the agreement between the two sides.
`contract` in `index.json` versions it. Adding a field is free, changing the meaning or the type of a
field bumps `contract`, and publishing a new month inside the existing window changes nothing at
all.

Nothing in the browser composes a data URL. Every path comes from `index.json`, which is why the
build can move files around without shipping a new client first.

## index.json

Fetched with `cache: no-cache` on boot. Small, and the only file the client must understand.

```jsonc
{
  "contract": 1,
  "minClient": 1,                  // oldest client build that can read this index
  "dataVersion": "bd1f5de697",     // content hash, the cache key for every chunk
  "generatedAt": "2026-09-20T06:12:00+05:30",
  "window": { "from": "2026-06", "to": "2027-03" },
  "counts": { "offers": 843, "vendors": 21, "cards": 31 },
  "facets": {
    "banks": [{ "id": "hnb", "name": "HNB", "count": 843 }],
    "categories": [{ "id": "supermarket", "name": "Supermarkets", "count": 41 }],
    "tiers": [{ "id": "platinum", "name": "platinum", "count": 12 }],
    "vendors": [{ "id": "keells", "name": "Keells", "category": "supermarket", "count": 6 }]
  },
  "sourceTemplates": { "hnb": "https://www.hnb.lk/card-promotion/search/{id}" },
  "chunks": {
    "cards": { "url": "cards.bd1f5de697.json", "bytes": 5204 },
    "months": {
      "2026-09": { "url": "m/2026-09.bd1f5de697.json", "bytes": 243710, "offers": 836 }
    }
  }
}
```

`bytes` is there so a client can decide before it spends the request. `sourceTemplates` is why a
chunk does not repeat a bank URL for every offer: the client rebuilds it from the offer's id.

## Chunks

Every chunk is a field header plus positional entries. Field names are the bulk of a JSON object and
there are hundreds of offers, so the wire format drops them and the client decodes once.

```jsonc
// m/2026-09.<version>.json
{
  "month": "2026-09",
  "fields": ["id","title","vendor","vendorHint","category","banks","tiers","networks","cardTypes",
             "discount","validFrom","validTo","days","terms"],
  "entries": [
    ["hnb:1727","Up to 06 months 0% installments for Hamper value above LKR 10,000 at Keells",
     "keells","Keells Supermarket","supermarket",["hnb"],[],["visa","mastercard"],["credit"],
     ["installments",6,null,null],"2026-09-01","2026-10-31",[20,21,22],"..."],
  ]
}
```

Positions are fixed by `MONTH_FIELDS` in `packages/shared/src/chunks.ts`, and `decodeMonthOffer`
converts an entry back into the readable shape. Notes on the values:

- `discount` is `null` or `[kind, value, cap, minSpend]`, where kind is one of `percent`, `amount`,
  `installments`, `cashback`, `other`.
- `days` holds the concrete day numbers of the month that qualify, so an offer running every
  Wednesday arrives as `[2, 9, 16, 23, 30]`, and an offer naming its own days ("Valid on 2nd, 16th
  and 30th September") arrives as `[2, 16, 30]`. The browser never evaluates a recurrence rule, and
  never does timezone arithmetic.
- `terms` is the bank's own wording, kept verbatim where the source publishes it.
- `cards.bd1f5de697.json` is a plain array of card products (`id`, `bank`, `name`, `tier`,
  `network`, `type`), small enough to ship whole because the picker cannot work without it.

## What the client asks for

| The visitor does | The client requests |
| --- | --- |
| Opens the site | `index.json` |
| Opens the picker or filters | `cards.<v>.json`, once, cached per version |
| Opens a month | `m/<month>.<v>.json` |
| Steps a month | the new month, plus the two neighbours on idle |
| Taps a day | nothing, the month chunk already holds it |
| Returns later in the same version | nothing, the decoded month is in memory |

Request coalescing is per URL, so a component asking twice for September makes one request.

## Cache rules

- `index.json` is fetched `no-cache`, which is how a new `dataVersion` is noticed.
- Chunk filenames carry the version, so a chunk can be cached for as long as the version lives.
- On a new version the client refetches what it is showing and drops the rest. Nothing else is
  invalidated, because nothing else changed.

## Retention

`window` is three months back and six forward. Older offers stop being served; their months are not
listed, so no client can ask for them.
