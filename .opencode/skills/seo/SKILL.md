---
name: seo
description: Keep cardstock's search and social presence correct. Load after changing the site name, the tagline, the palette, the domain, or anything in the head, and when adding a page that should rank. Covers the head tags, structured data, the sitemap, robots, the icons and the social card.
---

# SEO

The site is one page, so this is short. It still has to be rechecked after any change to the name,
the description, the palette or the domain, because the same facts appear in several files and they
must agree.

## The one origin

`https://cardstock.anjula.dev` is written in four places. Change them together:

| Where | What |
| --- | --- |
| `packages/web/index.html` | `<link rel="canonical">`, `og:url`, `og:image`, `twitter:image`, the JSON-LD `@id`s |
| `packages/web/vite.config.ts` | `SITE_URL`, which stamps `sitemap.xml` |
| `packages/web/public/robots.txt` | the `Sitemap:` line |
| `packages/web/public/CNAME` | the domain GitHub Pages serves |

`SITE_URL` can be overridden at build time for a staging origin, but the canonical link and the social
image are baked into `index.html`, so a staging build should not be indexed. Keep
`<meta name="robots">` in step if that ever matters.

## What the head carries

- A title that reads like a search: what the site is, where, and what for. Sentence case.
- A description of about 150 to 160 characters, plain text, key terms early.
- Canonical, `robots` with `max-image-preview:large`, author, and a `theme-color` that follows the
  appearance.
- Open Graph and Twitter card tags, pointing at `/og.png` at 1200x630, with `og:image:alt` saying what
  the image shows.
- JSON-LD: a `WebSite`, a `WebApplication` with `applicationCategory` and a free `Offer`, and the
  `Person` who built it, all cross referenced by `@id`.
- A `<noscript>` block with the heading and a paragraph, because the app itself needs JavaScript.

## The assets

`npm run assets` regenerates the favicon, the two PNG icons, the social card, the manifest, robots.txt
and the CNAME from the paper palette. Run it after any change to the palette, the mark or the name, and
**look at the social card afterwards**: it is the only one of these that can be quietly wrong, and a
broken card is worse than none.

The card is rendered in the same browser the blocked bank sources use, so there is no second renderer
to install. It uses the shared fonts, so it must be checked after a change to the typography too.

## Sitemap and robots

`sitemap.xml` is stamped at build time with one URL, `changefreq: daily`, because the offers change
daily. `robots.txt` allows everything and names the sitemap. Nothing here needs a service: the build
writes both.

## After a content change

1. `npm run build` and read the built `dist/index.html` head, rather than the source.
2. Confirm `dist/sitemap.xml`, `dist/robots.txt`, `dist/og.png` and the icons are present.
3. If the name or description changed, check that the title, the description, the OG tags and the
   JSON-LD all say the same thing.
4. Nothing on this site is a page of its own yet. If a page is ever added (a merchant or a card
   landing page, for example), it needs its own title, description and canonical, and the sitemap
   needs to list it.
