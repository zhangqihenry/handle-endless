<script setup lang="ts">
import { dayNo, daySince, isRandom, puzzleDate, puzzleLabel, randomSeed } from '~/state'
import { history, pauseTimer } from '~/storage'
import { FIRST_DATE, dateOfDay, parseDate, validSeed } from '~/endless/puzzle'
import { libraryWarning, randomPool, randomPoolVersion } from '~/endless/library'

const calendar = ref<HTMLDialogElement>()
const randomDialog = ref<HTMLDialogElement>()
const selected = ref(puzzleDate.value)
const month = ref(puzzleDate.value.slice(0, 7))
const seed = ref(randomSeed)
const error = ref('')
const today = computed(() => dateOfDay(daySince.value))
const monthTitle = computed(() => `${Number(month.value.slice(0, 4))} 年 ${Number(month.value.slice(5))} 月`)
const cells = computed(() => {
  const start = new Date(`${month.value}-01T00:00:00Z`)
  const offset = (start.getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
  return [...Array(offset).fill(''), ...Array.from({ length: count }, (_, i) => `${month.value}-${String(i + 1).padStart(2, '0')}`)] as string[]
})
function moveMonth(offset: number) {
  const date = new Date(`${month.value}-01T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  month.value = date.toISOString().slice(0, 7)
}
function updateMonth() {
  const day = parseDate(selected.value)
  if (day != null && day <= daySince.value)
    month.value = selected.value.slice(0, 7)
}
function completed(date: string) {
  const item = history.value[`daily:${parseDate(date)}`]
  return item?.passed || item?.answer
}
function go(url: string) {
  pauseTimer()
  window.location.assign(url)
}
function openDate(date: string) {
  const day = parseDate(date)
  if (day == null || day > daySince.value) {
    error.value = '请选择有效的历史日期，最早可选 2022-01-01。'
    return
  }
  go(`/?date=${date}`)
}
function startRandom() {
  const value = seed.value.trim()
  if (!validSeed(value)) {
    error.value = '请输入 1 至 64 位数字，挑战码中的前导零会保留。'
    return
  }
  go(`/?seed=${value}&pool=${randomPoolVersion}`)
}
function generateSeed() {
  const values = crypto.getRandomValues(new Uint32Array(2))
  seed.value = `${values[0]}${String(values[1]).padStart(10, '0')}`
}
function openCalendar() {
  error.value = ''
  calendar.value?.showModal()
}
function openRandom() {
  error.value = ''
  randomDialog.value?.showModal()
}
</script>

<template>
  <section class="puzzle-toolbar">
    <div class="edition">
      HANDLE_ENDLESS <span>汉兜无限</span>
    </div>
    <div class="mode-actions">
      <button :class="{ selected: !isRandom && dayNo === daySince }" @click="go('/')">
        <span i-carbon-calendar-heat-map />今日
      </button>
      <button :class="{ selected: !isRandom && dayNo < daySince }" @click="openCalendar">
        <span i-carbon-calendar />日历
      </button>
      <button :class="{ selected: isRandom }" @click="openRandom">
        <span i-carbon-shuffle />随机
      </button>
    </div>
    <h1 class="puzzle-title">
      {{ puzzleLabel }}
    </h1>
    <div class="puzzle-note">
      {{ isRandom ? '同一挑战码、同一词库版本，挑战同一道题' : '官方同日题目 · 北京时间 UTC+8' }}
    </div>
    <div v-if="!isRandom && dayNo < daySince" class="date-navigation">
      <button :disabled="dayNo <= 1" @click="openDate(dateOfDay(dayNo - 1))">
        ← 前一天
      </button>
      <button @click="openDate(dateOfDay(dayNo + 1))">
        后一天 →
      </button>
    </div>
    <div v-if="libraryWarning" class="library-warning" role="status">
      {{ libraryWarning }}
    </div>
  </section>

  <dialog ref="calendar" class="endless-dialog" aria-labelledby="calendar-title" @click="($event.target === calendar) && calendar?.close()">
    <div class="dialog-heading">
      <h2 id="calendar-title">
        选择历史题目
      </h2><button aria-label="关闭日历" @click="calendar?.close()">
        ×
      </button>
    </div>
    <p class="dialog-description">
      从日历中选择一天，继续当时的挑战。已完成的题目会显示圆点。
    </p>
    <div class="calendar-heading">
      <button aria-label="上个月" :disabled="month <= FIRST_DATE.slice(0, 7)" @click="moveMonth(-1)">
        ←
      </button>
      <strong>{{ monthTitle }}</strong>
      <button aria-label="下个月" :disabled="month >= today.slice(0, 7)" @click="moveMonth(1)">
        →
      </button>
    </div>
    <div class="calendar-grid">
      <span v-for="label in ['一', '二', '三', '四', '五', '六', '日']" :key="label" class="weekday">{{ label }}</span>
      <template v-for="date, index in cells" :key="index">
        <span v-if="!date" />
        <button v-else :aria-label="`${date}${completed(date) ? ' 已完成' : ''}`" :class="{ active: date === puzzleDate && !isRandom, completed: completed(date), today: date === today }" :disabled="date < FIRST_DATE || date > today" @click="openDate(date)">
          {{ Number(date.slice(-2)) }}
        </button>
      </template>
    </div>
    <form class="date-jump" @submit.prevent="openDate(selected)">
      <label for="history-date">跳转到指定日期</label>
      <div>
        <input id="history-date" v-model="selected" type="date" :min="FIRST_DATE" :max="today" required @change="updateMonth"><button type="submit" class="primary-action">
          开始
        </button>
      </div>
    </form>
    <p v-if="error" role="alert" class="form-error">
      {{ error }}
    </p>
    <p class="dialog-description">
      最早可选 2022-01-01。未来日期暂不开放。
    </p>
  </dialog>

  <dialog ref="randomDialog" class="endless-dialog" aria-labelledby="random-title" @click="($event.target === randomDialog) && randomDialog?.close()">
    <div class="dialog-heading">
      <h2 id="random-title">
        随机挑战
      </h2><button aria-label="关闭随机窗口" @click="randomDialog?.close()">
        ×
      </button>
    </div>
    <p class="dialog-description">
      输入相同的挑战码，就能和朋友挑战同一道题。分享链接会自动带上挑战码和词库版本。
    </p>
    <form @submit.prevent="startRandom">
      <label for="random-seed" class="seed-label">挑战码</label>
      <input id="random-seed" v-model="seed" class="seed-input" type="text" inputmode="numeric" maxlength="64" placeholder="例如 20260929" autocomplete="off" required>
      <p v-if="error" role="alert" class="form-error">
        {{ error }}
      </p>
      <div class="random-actions">
        <button type="button" @click="generateSeed">
          生成挑战码
        </button><button type="submit" class="primary-action" :disabled="!!libraryWarning">
          开始挑战
        </button>
      </div>
    </form>
    <p class="dialog-description">
      当前词库 {{ randomPool.length.toLocaleString() }} 个成语。不同挑战码可能抽到相同成语。
    </p>
    <details class="pool-details">
      <summary>词库版本</summary><code>{{ randomPoolVersion }}</code><p>扩充词库后，挑战码对应的题目可能变化。请与朋友使用同一版本。</p>
    </details>
  </dialog>
</template>
