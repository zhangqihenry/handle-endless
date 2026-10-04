<script setup lang="ts">
import { encode } from 'uqr'

const props = withDefaults(
  defineProps<{
    text: string
    // Edge length in px, transparent and without a quiet zone
    size?: number
  }>(), {
    size: 80,
  },
)

const qr = computed(() => encode(props.text, { ecc: 'L', border: 0 }))

// One path, dark modules merged into horizontal runs
const path = computed(() => {
  const parts: string[] = []
  qr.value.data.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!row[x]) {
        x++
        continue
      }
      const start = x
      while (x < row.length && row[x])
        x++
      parts.push(`M${start} ${y}h${x - start}v1h${start - x}z`)
    }
  })
  return parts.join('')
})
</script>

<template>
  <svg
    role="img" aria-label="本题链接二维码"
    :viewBox="`0 0 ${qr.size} ${qr.size}`" :width="size" :height="size"
    shape-rendering="crispEdges" text-ok
  >
    <path :d="path" fill="currentColor" />
  </svg>
</template>
