<script setup lang="ts">
import { toPng } from 'html-to-image'
import { saveAs } from 'file-saver'
import { dayNoHanzi, isIOS, isMobile, puzzleLabel, shareUrl, useMask } from '~/state'
import { tries } from '~/storage'
import { t } from '~/i18n'

const el = ref<HTMLDivElement>()
const show = ref(false)
const renderError = ref('')
const dataUrlUnmasked = ref('')
const dataUrlMasked = ref('')

const dataUrl = computed(() => useMask.value ? dataUrlMasked.value : dataUrlUnmasked.value)

async function render() {
  const previousMask = useMask.value
  renderError.value = ''
  show.value = true
  try {
    await nextTick()
    await document.fonts.ready
    useMask.value = false
    await nextTick()
    dataUrlUnmasked.value = await toPng(el.value!)
    useMask.value = true
    await nextTick()
    dataUrlMasked.value = await toPng(el.value!)
  }
  catch {
    renderError.value = '图片生成失败，请重试或使用文本分享。'
  }
  finally {
    useMask.value = previousMask
    show.value = false
  }
}

onMounted(() => render())

async function download() {
  saveAs(dataUrl.value, `${t('name')} ${dayNoHanzi.value}${useMask.value ? ' 遮罩' : ''}.png`)
}
</script>

<template>
  <div v-if="isMobile" op50 mb4>
    {{ t('press-and-download-image') }}
  </div>
  <div v-if="renderError" role="alert">
    {{ renderError }} <button @click="render">
      重试
    </button>
  </div>
  <img v-else-if="dataUrl" alt="本题分享图片" :src="dataUrl" w-80 min-h-10 border="~ base rounded">
  <div v-else w-80 border="~ base rounded" p4 animate-pulse>
    {{ t('rendering') }}
  </div>

  <div flex="~" py4>
    <button v-if="!isIOS" mx2 square-btn flex-gap-1 :disabled="!dataUrl" @click="download()">
      <div i-carbon-download />
      {{ t('download') }}
    </button>

    <ToggleMask mx2 />
  </div>

  <div v-if="show" fixed op0 top-0 left-0 pointer-events-none>
    <div ref="el" flex="~ col" items-center p="x6 y4" bg-base relative text-center>
      <AppName w-full />
      <div w-full text-xs mt1 mb3 op50 ws-nowrap>
        Handle_Endless
      </div>
      <div style="max-width: 320px; overflow-wrap: anywhere;" class="share-puzzle-label">
        {{ puzzleLabel }}
      </div>
      <div style="max-width: 320px; overflow-wrap: anywhere; font-size: 10px; margin-bottom: 12px;">
        {{ shareUrl }}
      </div>

      <WordBlocks v-for="w, i of tries" :key="i" :word="w" :revealed="true" :animate="false" />
      <ResultFooter :day="true" mt3 w-full />
    </div>
  </div>
</template>
