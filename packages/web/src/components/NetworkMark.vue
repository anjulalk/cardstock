<script setup lang="ts">
/** A card network's mark, drawn in `currentColor` so it stays inside the paper
 *  palette. Mastercard is its two circles; the other two are wordmarks, which is
 *  how a printed page would set them. */
defineProps<{ network: string }>()
</script>

<template>
  <svg
    v-if="network === 'mastercard'"
    class="h-3 w-5 shrink-0"
    viewBox="0 0 24 14"
    aria-hidden="true"
  >
    <circle cx="9" cy="7" r="5.6" fill="currentColor" opacity="0.5" />
    <circle cx="15" cy="7" r="5.6" fill="none" stroke="currentColor" stroke-width="1.4" />
  </svg>
  <svg v-else-if="network === 'visa'" class="h-3 w-7 shrink-0" viewBox="0 0 30 12" aria-hidden="true">
    <text
      x="0"
      y="10"
      font-family="Inter, sans-serif"
      font-size="11"
      font-style="italic"
      font-weight="700"
      letter-spacing="-0.5"
      fill="currentColor"
    >
      VISA
    </text>
  </svg>
  <svg v-else-if="network === 'amex'" class="h-3 w-7 shrink-0" viewBox="0 0 30 12" aria-hidden="true">
    <rect x="0.7" y="0.7" width="28.6" height="10.6" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.1" />
    <text
      x="15"
      y="9"
      text-anchor="middle"
      font-family="Inter, sans-serif"
      font-size="7"
      font-weight="700"
      letter-spacing="0.5"
      fill="currentColor"
    >
      AMEX
    </text>
  </svg>
</template>
