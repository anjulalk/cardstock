---
name: data-contract
description: Change or extend what the cardstock browser downloads. Load when touching the manifest, the chunk layout, the wire format, the client loader, or the published window, or when deciding what the client should fetch and when.
---

# The data contract

The build writes the data; the browser reads it. `DATA-CONTRACT.md` is the agreement itself. This
skill is how to change it without breaking the client.

## The three ideas

1. **The manifest is the only index.** `index.json` names every chunk and its size. The client never
   composes a URL, so the build can move files without shipping a new client first.
2. **Months are published one file per bank.** A visitor holding two banks downloads two files, not
   every offer in the country. This is what keeps the payload from growing with the bank count.
3. **Chunks are positional.** A field header plus arrays, not objects, because field names are the
   bulk of a JSON object and there are hundreds of offers. The client decodes once, in
   `packages/shared/src/chunks.ts`.

## Layout

```
data/index.json                 the manifest, fetched no-cache
data/cards.<version>.json       the card products the picker offers
data/m/<month>/<bank>.<version>.json
```

A chunk carries `{ month, bank, fields, entries }`. Positions are fixed by `MONTH_FIELDS`:
`id, title, vendor, vendorHint, category, banks, tiers, networks, cardTypes, discount, validFrom,
validTo, days, terms`.

- `discount` is `null` or `[kind, value, cap, minSpend]`.
- `days` holds the concrete day numbers of the month that qualify. An offer running every Wednesday
  arrives as `[2, 9, 16, 23, 30]`; one naming its own days arrives as `[2, 16, 30]`. **The browser
  never evaluates a recurrence rule and never does timezone arithmetic.**
- `sourceUrl` is not in the wire format. The manifest carries `sourceTemplates` per source and the
  client rebuilds the link from the offer's id, which is why the id must be the bank's slug exactly.

## What the client asks for

| The visitor does | The client requests |
| --- | --- |
| Opens the site | `index.json` |
| Opens the picker or filters | `cards.<v>.json`, once, cached per version |
| Opens a month, no cards picked | every bank's file for that month |
| Opens a month with cards picked | only the banks those cards belong to |
| Steps a month | the same set, plus the two neighbours on idle |
| Taps a day | nothing, the month chunk already holds it |

Requests are coalesced per URL, and decoded files are kept in memory for the session.

## Changing it

- **Adding a field** is free: append it to `MONTH_FIELDS`, emit it in `chunk.ts`, read it in
  `decodeMonthOffer`, and update the fixture-based expectations if any assert positions.
- **Changing a field's meaning or type** bumps `CONTRACT` in `packages/shared/src/types.ts` and gets a
  row in the version table in `DATA-CONTRACT.md`. `minClient` travels with it so a stale client can
  say so rather than guess.
- **Adding months** inside the existing window changes nothing. The window is three months back and
  six forward, and `validateChunks` fails the build if a listed month was not built, a built month is
  not listed, or a month repeats an offer id across banks.

## Rules that keep it small

- Never put an image URL or a bank link in a chunk: the manifest has templates, and merchant logos are
  not used at all.
- Never put a field in the wire that the calendar does not use. If it is only needed on a detail view,
  fetch it when that view opens.
- Measure before and after. `npm run chunk` prints bytes per bank-month; a healthy month is tens of
  kilobytes raw and a few kilobytes compressed.
