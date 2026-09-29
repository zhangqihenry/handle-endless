<script setup lang="ts">
import '~/init'
import { answer, puzzleError } from '~/state'
import { colorblind } from '~/storage'

const { height } = useWindowSize()

watchEffect(() => {
  document.documentElement.style.setProperty('--vh', `${height.value / 100}px`)
})
</script>

<template>
  <main font-sans text="center gray-700 dark:gray-300" select-none :class="{ colorblind }">
    <Navbar />
    <PuzzleToolbar />
    <div p="4">
      <div v-if="puzzleError" role="alert" class="puzzle-error">
        {{ puzzleError }} <a href="/">返回今日</a>
      </div>
      <NoQuizToday v-else-if="!answer.word" />
      <Play v-else />
    </div>
    <ModalsLayer />
    <Confetti />
  </main>
</template>
