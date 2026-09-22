<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { CardProduct, MonthOffer } from '@shared/types.ts'
import { addMonths, daysInMonth, monthKey, todayIso, weekdayOf } from '@shared/dates.ts'
import CardPicker from './components/CardPicker.vue'
import MonthGrid from './components/MonthGrid.vue'
import { loadCards, loadManifest, loadMonth } from './lib/api.ts'
import {
  discountLabel,
  loadOnlyMine,
  loadSelection,
  offerMatches,
  saveOnlyMine,
  saveSelection,
} from './lib/store.ts'

const today = todayIso()
const month = ref(monthKey(today))
const selectedDay = ref<string | null>(today)
const allCards = ref<CardProduct[]>([])
const selected = ref<string[]>(loadSelection())
const onlyMine = ref(loadOnlyMine())
const monthOffers = ref<MonthOffer[]>([])
const banks = ref<Array<{ id: string; name: string }>>([])
const categoryNames = ref<Record<string, string>>({})
const categoryCounts = ref<Array<{ id: string; name: string; count: number }>>([])
const category = ref<string | null>(null)
const vendor = ref<string | null>(null)
const vendorCounts = ref<Array<{ id: string; name: string; category: string; count: number }>>([])
const window_ = ref<{ from: string; to: string } | null>(null)
const generatedAt = ref<string | null>(null)
const loading = ref(true)
const monthLoading = ref(false)
const error = ref<string | null>(null)

const myCards = computed(() =>
  selected.value.length > 0 ? allCards.value.filter((card) => selected.value.includes(card.id)) : [],
)

/** Which banks the calendar needs. With cards picked, only those banks are
 *  downloaded; with nothing picked, the whole month is. */
const banksToLoad = computed(() =>
  onlyMine.value && myCards.value.length > 0
    ? [...new Set(myCards.value.map((card) => card.bank))]
    : undefined,
)

const visible = computed(() => {
  let list = monthOffers.value
  if (onlyMine.value && myCards.value.length > 0) {
    list = list.filter((offer) => offerMatches(offer, myCards.value))
  }
  if (category.value) list = list.filter((offer) => offer.category === category.value)
  if (vendor.value) list = list.filter((offer) => offer.vendor === vendor.value)
  return list
})

const counts = computed(() => {
  const map: Record<string, number> = {}
  for (const offer of visible.value) {
    for (const day of offer.days) {
      const iso = `${month.value}-${String(day).padStart(2, '0')}`
      map[iso] = (map[iso] ?? 0) + 1
    }
  }
  return map
})

const weeks = computed(() => {
  const days = daysInMonth(month.value)
  const lead = (weekdayOf(days[0]!) + 6) % 7
  const cells: Array<{ iso: string | null; day: number | null }> = []
  for (let i = 0; i < lead; i++) cells.push({ iso: null, day: null })
  for (const iso of days) cells.push({ iso, day: Number(iso.slice(8, 10)) })
  while (cells.length % 7 !== 0) cells.push({ iso: null, day: null })
  const out: Array<Array<{ iso: string | null; day: number | null }>> = []
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7))
  return out
})

const dayOffers = computed(() => {
  if (!selectedDay.value) return []
  const day = Number(selectedDay.value.slice(8, 10))
  return visible.value
    .filter((offer) => offer.days.includes(day))
    .sort((a, b) => (b.discount?.value ?? 0) - (a.discount?.value ?? 0))
})

const monthLabel = computed(() =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
    new Date(`${month.value}-01T00:00:00Z`),
  ),
)

const checkedLabel = computed(() => {
  if (!generatedAt.value) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Colombo',
  }).format(new Date(generatedAt.value))
})

const dayLabel = computed(() => {
  if (!selectedDay.value) return 'Pick a day'
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${selectedDay.value}T00:00:00Z`))
})

const canGoBack = computed(() => !!window_.value && month.value > window_.value.from)
const canGoForward = computed(() => !!window_.value && month.value < window_.value.to)

async function showMonth(key: string): Promise<void> {
  monthLoading.value = true
  try {
    monthOffers.value = await loadMonth(key, banksToLoad.value)
    if (selectedDay.value && monthKey(selectedDay.value) !== key) selectedDay.value = null
    const neighbours = [addMonths(key, -1), addMonths(key, 1)]
    for (const neighbour of neighbours) {
      if (window_.value && neighbour >= window_.value.from && neighbour <= window_.value.to) {
        void loadMonth(neighbour, banksToLoad.value).catch(() => undefined)
      }
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    monthLoading.value = false
  }
}

function step(delta: number): void {
  const next = addMonths(month.value, delta)
  if (!window_.value || (next >= window_.value.from && next <= window_.value.to)) month.value = next
}

function toggleCard(id: string): void {
  const next = selected.value.includes(id)
    ? selected.value.filter((value) => value !== id)
    : [...selected.value, id]
  selected.value = next
  saveSelection(next)
}

function clearCards(): void {
  selected.value = []
  saveSelection([])
}

watch(month, (key) => void showMonth(key))
watch(banksToLoad, () => void showMonth(month.value))
watch(onlyMine, (value) => saveOnlyMine(value))
watch(selectedDay, (value) => {
  if (value && monthKey(value) !== month.value) month.value = monthKey(value)
})

onMounted(async () => {
  try {
    const manifest = await loadManifest()
    generatedAt.value = manifest.generatedAt
    window_.value = manifest.window
    banks.value = manifest.facets.banks.map((bank) => ({ id: bank.id, name: bank.name }))
    categoryNames.value = Object.fromEntries(
      manifest.facets.categories.map((entry) => [entry.id, entry.name]),
    )
    categoryCounts.value = manifest.facets.categories
    vendorCounts.value = manifest.facets.vendors
    allCards.value = await loadCards()
    if (monthKey(today) < manifest.window.from) month.value = manifest.window.from
    await showMonth(month.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="mx-auto w-full max-w-[80rem] px-6 pt-6 pb-16 sm:px-14 sm:pt-10 md:px-24 lg:px-32">
    <header class="ui pb-6 sm:pb-10">
      <div class="flex flex-wrap items-baseline justify-between gap-4">
        <h1 class="text-xl font-semibold">card<span class="text-clay-strong">stock</span></h1>
          <p v-if="checkedLabel" class="ui shrink-0 text-sm text-soft">Last checked {{ checkedLabel }}</p>
      </div>
    </header>

    <p class="text-lg text-ink">Every Sri Lankan card offer, on the days it runs.</p>
    <p class="mt-5 max-w-2xl text-mute">
      Pick the cards in your wallet once. The calendar then shows only the supermarkets,
      restaurants and stores that accept them, on the days the offer is live.
    </p>

    <div
      v-if="error"
      class="card ui mt-7 border-down/35! p-5 text-sm text-mute"
    >
      Something went wrong loading the offers: {{ error }}
    </div>

    <div v-else-if="loading" class="card ui mt-7 animate-pulse p-10 text-center text-sm text-soft">
      Loading offers…
    </div>

    <div v-else class="mt-7 grid gap-6 lg:grid-cols-[20rem_1fr]">
      <div class="space-y-4">
        <CardPicker
          :cards="allCards"
          :banks="banks"
          :selected="selected"
          @toggle="toggleCard"
          @clear="clearCards"
        />

        <section class="card ui p-4 sm:p-5">
          <h2 class="text-sm font-semibold text-ink">Filters</h2>
          <label class="mt-3 flex items-center gap-2 text-sm text-mute">
            <input v-model="onlyMine" type="checkbox" class="accent-clay" />
            Only my cards
          </label>
          <p v-if="onlyMine && !myCards.length" class="mt-2 text-xs text-faint">
            Pick a card above to narrow the calendar.
          </p>

          <p class="label mt-4 text-faint">Merchant</p>
          <select
            v-model="vendor"
            class="mt-1.5 w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm text-ink"
          >
            <option :value="null">Any merchant</option>
            <option v-for="entry in vendorCounts" :key="entry.id" :value="entry.id">
              {{ entry.name }} ({{ entry.count }})
            </option>
          </select>
          <p v-if="vendor" class="mt-2 text-xs text-faint">
            Only offers the banks file under this merchant. Each one still shows the bank's own name
            for it.
          </p>

          <p class="label mt-4 text-faint">Category</p>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              class="rounded-md border px-2 py-1 text-xs transition"
              :class="
                category === null
                  ? 'border-clay/50 bg-clay/10 text-clay-strong'
                  : 'border-line bg-wash text-mute hover:border-faint/60'
              "
              @click="category = null"
            >
              All
            </button>
            <button
              v-for="entry in categoryCounts"
              :key="entry.id"
              type="button"
              class="rounded-md border px-2 py-1 text-xs transition"
              :class="
                category === entry.id
                  ? 'border-clay/50 bg-clay/10 text-clay-strong'
                  : 'border-line bg-wash text-mute hover:border-faint/60'
              "
              @click="category = entry.id"
            >
              {{ categoryNames[entry.id] ?? entry.id }}
            </button>
          </div>
        </section>
      </div>

      <div class="min-w-0 space-y-5">
        <section class="card p-4 sm:p-5">
          <header class="ui flex items-center justify-between gap-3 pb-4">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-md border border-line px-2 py-1 text-sm transition hover:border-faint/60 disabled:opacity-40"
                :disabled="!canGoBack"
                aria-label="Previous month"
                @click="step(-1)"
              >
                ‹
              </button>
              <h2 class="text-base font-semibold text-ink">{{ monthLabel }}</h2>
              <button
                type="button"
                class="rounded-md border border-line px-2 py-1 text-sm transition hover:border-faint/60 disabled:opacity-40"
                :disabled="!canGoForward"
                aria-label="Next month"
                @click="step(1)"
              >
                ›
              </button>
            </div>
            <p class="label text-faint">
              {{ visible.length }} offer{{ visible.length === 1 ? '' : 's' }}
            </p>
          </header>

          <div :class="monthLoading ? 'opacity-50 transition' : 'transition'">
            <MonthGrid
              :weeks="weeks"
              :counts="counts"
              :selected="selectedDay"
              :today="today"
              @select="selectedDay = $event"
            />
          </div>
        </section>

        <section class="card rise p-4 sm:p-5">
          <header class="ui flex flex-wrap items-baseline justify-between gap-3">
            <h2 class="text-base font-semibold text-ink">{{ dayLabel }}</h2>
            <p v-if="dayOffers.length" class="label text-faint">
              {{ dayOffers.length }} offer{{ dayOffers.length === 1 ? '' : 's' }}
            </p>
          </header>

          <p v-if="!selectedDay" class="ui mt-3 text-sm text-soft">
            Choose a day in the calendar to see what is running.
          </p>
          <p v-else-if="!dayOffers.length" class="ui mt-3 text-sm text-soft">
            Nothing that matches runs on this day.
          </p>

          <ul v-else class="mt-3 divide-y divide-hair">
            <li v-for="offer in dayOffers" :key="offer.id" class="flex flex-wrap gap-x-4 gap-y-1 py-3">
              <div class="min-w-0 flex-1">
                <p class="text-ink">{{ offer.title }}</p>
                <p class="ui mt-0.5 text-xs text-soft">
                  {{ offer.vendorHint ?? 'Merchant' }}
                  <span v-if="offer.category">· {{ categoryNames[offer.category] ?? offer.category }}</span>
                  <span v-if="offer.validTo" class="num">· till {{ offer.validTo }}</span>
                </p>
              </div>
              <div class="flex items-center gap-3">
                <span v-if="discountLabel(offer)" class="num text-sm text-clay-strong">
                  {{ discountLabel(offer) }}
                </span>
                <a
                  v-if="offer.sourceUrl"
                  :href="offer.sourceUrl"
                  target="_blank"
                  rel="noreferrer"
                  class="ui text-xs text-soft underline-offset-2 transition hover:text-ink hover:underline"
                >
                  Bank terms
                </a>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <footer class="ui mt-12 text-sm text-soft">
      <p>
        Built by
        <a
          class="underline-offset-2 transition hover:text-ink hover:underline"
          href="https://anjula.dev"
          target="_blank"
          rel="noreferrer"
          >Anjula Karunarathne</a
        >.
      </p>
      <p class="mt-1 text-xs">
        Offers are read from the banks' own pages and may change without notice. Confirm the terms
        with the bank before you transact. Not affiliated with, endorsed by, or operated by any bank
        listed, and bank names and marks belong to their respective owners.
      </p>
    </footer>
  </div>
</template>
