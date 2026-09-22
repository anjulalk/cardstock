<script setup lang="ts">
import { computed, ref } from 'vue'

/** A bank's mark. The logo is served from public/banks where one exists; the
 *  rest fall back to a monogram tile, which keeps the paper look rather than
 *  showing a broken image. */
const props = withDefaults(
  defineProps<{
    bank: string
    name?: string
    /** Tailwind size classes, so a caller can make it small or large. */
    size?: string
  }>(),
  { name: undefined, size: 'h-5 w-5' },
)

const failed = ref(false)

const initials = computed(() =>
  (props.name ?? props.bank)
    .replace(/[^A-Za-z ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join(''),
)

const src = computed(() => `${import.meta.env.BASE_URL}banks/${props.bank}.png`)
</script>

<template>
  <img
    v-if="!failed"
    :src="src"
    alt=""
    :class="[size, 'shrink-0 rounded-[5px] object-contain']"
    loading="lazy"
    @error="failed = true"
  />
  <span
    v-else
    :class="[
      size,
      'ui flex shrink-0 items-center justify-center rounded-[5px] border border-line bg-wash text-[9px] font-semibold tracking-wide text-soft',
    ]"
    aria-hidden="true"
    >{{ initials }}</span
  >
</template>
