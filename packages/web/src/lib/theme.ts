import { ref } from 'vue'

/** Appearance choice; `auto` follows the OS and is the default. */
export type Theme = 'light' | 'dark' | 'auto'

/** Same key the pre-paint script in index.html reads. */
const KEY = 'cardstock.appearance'
const LIGHT = '#faf8f3'
const DARK = '#282622'

const media =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function stored(): Theme {
  try {
    const value = window.localStorage.getItem(KEY)
    if (value === 'light' || value === 'dark') return value
  } catch {
    // private mode: fall through to auto
  }
  return 'auto'
}

function resolve(theme: Theme): boolean {
  return theme === 'dark' || (theme === 'auto' && !!media?.matches)
}

export const theme = ref<Theme>(stored())
export const dark = ref(resolve(theme.value))

function apply(): void {
  document.documentElement.classList.toggle('dark', dark.value)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark.value ? DARK : LIGHT)
}

export function setTheme(next: Theme): void {
  theme.value = next
  dark.value = resolve(next)
  try {
    if (next === 'auto') window.localStorage.removeItem(KEY)
    else window.localStorage.setItem(KEY, next)
  } catch {
    // private mode: keep the choice for this session only
  }
  apply()
}

/** Flips light and dark; the OS is not consulted again until `resetTheme`. */
export function toggleTheme(): void {
  setTheme(dark.value ? 'light' : 'dark')
}

/** Returns to following the OS. */
export function resetTheme(): void {
  setTheme('auto')
}

if (typeof window !== 'undefined') {
  media?.addEventListener('change', () => {
    if (theme.value !== 'auto') return
    dark.value = resolve('auto')
    apply()
  })
  apply()
}
