<script setup lang="ts">
import { dayNo, daySince, isRandom, now, shareUrl } from '~/state'
import { t } from '~/i18n'
import { EPOCH } from '~/endless/puzzle'
const ms = computed(() => 86400000 - (+now.value - EPOCH) % 86400000)
const formatted = computed(() => {
  const h = Math.floor((ms.value % 86400000) / 3600000)
  const m = Math.floor((ms.value % 3600000) / 60000)
  const s = Math.floor((ms.value % 60000) / 1000)
  return t('time-format', h, m.toString().padStart(2, '0'), s.toString().padStart(2, '0'))
})
</script>

<template>
  <div pt12 pb16>
    <div flex="~ col" items-center>
      <div flex="~ center gap-3" items-stretch>
        <ShareButton />
        <ToggleMask :hint="true" />
      </div>
      <div my3 op50 text-sm>
        {{ t('dont-spoiler') }}
      </div>
      <QrCode :text="shareUrl" :size="80" />
    </div>

    <div h-1px w-10 border="t base" mt6 mb6 mxa />

    <div v-if="!isRandom && dayNo === daySince" flex="~ col center" relative>
      <div op50 ws-nowrap>
        {{ t('next-note') }}
      </div>
      <div text-lg ws-nowrap style="font-variant-numeric: tabular-nums;">
        {{ formatted }}
      </div>
    </div>
  </div>
</template>
