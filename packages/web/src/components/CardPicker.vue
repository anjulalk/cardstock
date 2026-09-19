<script setup lang="ts">
import type { CardProduct } from '@shared/types.ts'

const props = defineProps<{
  cards: CardProduct[]
  banks: Array<{ id: string; name: string }>
  selected: string[]
}>()

const emit = defineEmits<{
  (event: 'toggle', id: string): void
  (event: 'clear'): void
}>()

const groups = () => {
  const byBank = new Map<string, CardProduct[]>()
  for (const card of props.cards) {
    const list = byBank.get(card.bank) ?? []
    list.push(card)
    byBank.set(card.bank, list)
  }
  return props.banks
    .map((bank) => ({ bank, cards: byBank.get(bank.id) ?? [] }))
    .filter((group) => group.cards.length > 0)
}

const tierLabel = (tier: string) => tier.charAt(0).toUpperCase() + tier.slice(1)
</script>

<template>
  <section class="card p-4 sm:p-5">
    <header class="flex items-baseline justify-between gap-3">
      <h2 class="text-sm font-semibold text-ink">Your cards</h2>
      <button
        v-if="selected.length"
        type="button"
        class="label text-faint transition hover:text-clay-strong"
        @click="emit('clear')"
      >
        Clear
      </button>
    </header>

    <div class="mt-3 space-y-3">
      <div v-for="group in groups()" :key="group.bank.id">
        <p class="label text-faint">{{ group.bank.name }}</p>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <button
            v-for="card in group.cards"
            :key="card.id"
            type="button"
            class="rounded-md border px-2 py-1 text-xs transition"
            :class="
              selected.includes(card.id)
                ? 'border-clay/50 bg-clay/10 text-clay-strong'
                : 'border-line bg-wash text-mute hover:border-faint/60'
            "
            @click="emit('toggle', card.id)"
          >
            {{ tierLabel(card.tier) }}
            <span class="text-faint">{{ card.network }}</span>
          </button>
        </div>
      </div>
    </div>

    <p v-if="!cards.length" class="mt-3 text-sm text-faint">The card list has not loaded yet.</p>
  </section>
</template>
