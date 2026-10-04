<script setup lang="ts">
import { isDark, isRandom, showDashboard, showHelp, showSettings, useMask } from '~/state'
import { gamesCount } from '~/storage'

const toggleDark = useToggle(isDark)
const toggleSettings = useToggle(showSettings)
const toggleDashboard = useToggle(showDashboard)

function openHelp() {
  showHelp.value = true
  useMask.value = false
}
</script>

<template>
  <nav border="b base" relative>
    <div absolute font-serif text-2xl left-0 right-0 top-0 bottom-0 z--1 tracking-2 flex>
      <AppName ma :endless="isRandom" />
    </div>
    <div flex items-center justify-between md:max-w-md ma py4 px2>
      <div flex items-center>
        <button icon-btn mx2 aria-label="玩法说明" @click="openHelp()">
          <div i-carbon-help />
        </button>
        <button v-if="gamesCount" icon-btn mx2 aria-label="答题统计" @click="toggleDashboard()">
          <div i-carbon-catalog />
        </button>
      </div>
      <div flex items-center>
        <a href="/admin" icon-btn mx2 aria-label="词库管理" title="词库管理"><div i-carbon-data-base /></a>
        <button icon-btn mx2 aria-label="设置" @click="toggleSettings()">
          <div i-carbon-settings />
        </button>
        <button icon-btn mx2 aria-label="切换深浅主题" @click="toggleDark()">
          <div i-carbon-sun dark:i-carbon-moon />
        </button>
      </div>
    </div>
  </nav>
</template>
