import { writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

/** Served from the root of the custom subdomain in production; the default
 *  keeps the GitHub project-pages path working until the domain is attached. */
const base = process.env.BASE_PATH ?? '/cardstock/'

/** Canonical origin. Used for the sitemap; keep it in step with the canonical
 *  link, the social tags and the CNAME in index.html and public/. */
const SITE = process.env.SITE_URL ?? 'https://cardstock.anjula.dev'

/** The app is one page, so the sitemap is one URL stamped at build time. */
function sitemap(site: string): Plugin {
  return {
    name: 'cardstock-sitemap',
    apply: 'build',
    writeBundle() {
      const url = `${site.replace(/\/$/, '')}/`
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`
      writeFileSync(new URL('./dist/sitemap.xml', import.meta.url), xml)
    },
  }
}

export default defineConfig({
  base,
  plugins: [vue(), tailwindcss(), sitemap(SITE)],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared/src', import.meta.url)),
    },
  },
  server: {
    fs: { allow: ['../..'] },
  },
})
