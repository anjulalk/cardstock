---
name: merchant-registry
description: Add or correct a merchant in the cardstock registry, or fix a name that a bank spells differently. Load when a merchant is missing from the picker, when two names should be one merchant, or when the match rate needs to go up.
---

# Merchants

The same shop is named differently by every bank. `Keells`, `Keells Supermarket` and
`Keells Super - Union Place` are one merchant; `Citrus Hikkaduwa` and `Citrus Waskaduwa` are one chain.
Resolving them is what makes a merchant selectable while each offer still shows the bank's own wording.

## The registry

`registry/vendors.json` holds one entry per merchant:

```jsonc
{
  "id": "keells",
  "name": "Keells",
  "category": "supermarket",
  "aliases": ["Keells Super", "Keells Supermarket"],   // spellings a bank may publish
  "keywords": ["keells"]                              // match terms, including longer titles
}
```

`name` is what the picker shows. `category` is the merchant's own category, not an offer's: a dining
deal at a hotel belongs to a hotel. Aliases and keywords are both match terms.

## How matching works

`matchVendor` in `packages/worker/src/registry.ts`:

1. Normalises the text: lowercase, punctuation to spaces, and drops words that carry no identity
   (`pvt`, `ltd`, `supermarket`, `hotel`, `restaurant`, `bank`, and so on).
2. Tries the whole name and the name with a branch or a town stripped (`Club Palm Bay, Marawila`,
   `Keells Super - Union Place`).
3. Scores the best term: **4** the same name, **3** a name inside a longer one, **2** every word of a
   keyword present. Anything below 2 is refused.

Refusing matters more than matching. When it refuses, the bank's own name is kept as `vendorHint` and
shown to the visitor, which is a correct answer; a wrong match is not.

Two lessons already learned here:

- **A single long word is not enough.** "Hilton Colombo" matched a jewellery shop through the word
  *Colombo*, which is a city. Two words are the floor.
- **A discount is not a merchant.** Pan Asia's badge ("35%") was reaching the registry as a name; a
  badge never becomes a hint.

## Growing it

```bash
node packages/worker/report-vendors.mts
```

It prints how many offers match, and the merchant names that do not, most common first, with the banks
and categories involved. Work down that list: add the recurring merchants, ignore the one-off hotels
unless they matter, and ignore anything that is not a merchant at all (a network name like `Visa`, a
promotional label like `Special IPP Promotions`).

When a bank publishes a chain's longer title, put that in `keywords` rather than inventing an alias:
`"keywords": ["sheraton"]` catches `Sheraton Kosgoda Turtle Beach Resort` by stripping the tail, and
`"keywords": ["fox kandy", "fox jaffna"]` is the honest way to catch a two-word brand.

## After changing it

1. `npm test` runs the registry tests, which use the names the banks actually publish.
2. `npm run sync` to re-normalise, then `node packages/worker/report-vendors.mts` to see the new rate.
3. `npm run chunk` and `npm run build` so the picker and the merchant filter carry it.
