<script setup lang="ts">
import { useMask } from '~/state'
import { t } from '~/i18n'

defineProps<{
  // Dim the button while the mask is off, used beside the share button
  hint?: boolean
}>()
</script>

<template>
  <button
    square-btn flex-gap-1
    :class="useMask ? 'text-primary' : hint ? 'op50' : ''"
    @click="useMask = !useMask"
  >
    <div :i="useMask ? 'carbon-view-off' : 'carbon-view'" />
    {{ useMask ? t('mask-on') : t('mask-off') }}
  </button>
</template>
