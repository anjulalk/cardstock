<script setup lang="ts">
interface Cell {
  iso: string | null
  day: number | null
}

const props = defineProps<{
  weeks: Cell[][]
  counts: Record<string, number>
  selected: string | null
  today: string
}>()

const emit = defineEmits<{ (event: 'select', iso: string): void }>()

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
</script>

<template>
  <div>
    <div class="grid grid-cols-7 gap-1 sm:gap-1.5">
      <div v-for="day in WEEKDAYS" :key="day" class="label pb-1 text-center text-faint">
        {{ day }}
      </div>
    </div>

    <div class="grid grid-cols-7 gap-1 sm:gap-1.5">
      <template v-for="(week, index) in props.weeks" :key="index">
        <button
          v-for="(cell, cellIndex) in week"
          :key="cellIndex"
          type="button"
          :disabled="!cell.iso"
          class="relative flex aspect-square flex-col items-center justify-center rounded-md border text-sm transition"
          :class="[
            !cell.iso
              ? 'border-transparent'
              : props.counts[cell.iso]
                ? 'border-clay/40 bg-clay/8 text-ink hover:border-clay/70'
                : 'border-line bg-card text-faint hover:border-faint/50',
            cell.iso && cell.iso === props.selected ? 'ring-2 ring-clay/60 ring-offset-0' : '',
            cell.iso && cell.iso === props.today ? 'font-semibold text-clay-strong' : '',
          ]"
          @click="cell.iso && emit('select', cell.iso)"
        >
          <span>{{ cell.day }}</span>
          <span
            v-if="cell.iso && props.counts[cell.iso]"
            class="label mt-0.5 text-[10px] text-clay-strong"
          >
            {{ props.counts[cell.iso] }}
          </span>
        </button>
      </template>
    </div>
  </div>
</template>
