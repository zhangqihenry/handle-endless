<script setup lang="ts">
import { encode } from 'uqr'

const props = withDefaults(
  defineProps<{
    text: string
    // Edge length in px of the module area, quiet zone excluded
    size?: number
  }>(), {
    size: 80,
  },
)

// Quiet zone in modules, drawn white around the pattern so it scans on dark backgrounds
const QUIET_ZONE = 2

const qr = computed(() => encode(props.text, { ecc: 'L', border: 0 }))

const viewBox = computed(() => {
  const total = qr.value.size + QUIET_ZONE * 2
  return `${-QUIET_ZONE} ${-QUIET_ZONE} ${total} ${total}`
})

const outerSize = computed(() => props.size * (qr.value.size + QUIET_ZONE * 2) / qr.value.size)

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
    :viewBox="viewBox" :width="outerSize" :height="outerSize"
    shape-rendering="crispEdges"
  >
    <rect :x="-QUIET_ZONE" :y="-QUIET_ZONE" :width="qr.size + QUIET_ZONE * 2" :height="qr.size + QUIET_ZONE * 2" fill="#fff" />
    <path :d="path" fill="#000" />
  </svg>
</template>
