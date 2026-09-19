import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

/** Served from the root of the custom subdomain in production; the default
 *  keeps the GitHub project-pages path working until the domain is attached. */
const base = process.env.BASE_PATH ?? '/cardstock/'

export default defineConfig({
  base,
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared/src', import.meta.url)),
    },
  },
  server: {
    fs: { allow: ['../..'] },
  },
})
