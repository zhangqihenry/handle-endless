import { breakpointsTailwind } from '@vueuse/core'
import type { MatchType, ParsedChar } from './logic'
import { TRIES_LIMIT, WORD_LENGTH, parseWord as _parseWord, testAnswer as _testAnswer, checkPass, getHint, numberToHanzi } from './logic'
import { useNumberTone as _useNumberTone, inputMode, meta, spMode, tries } from './storage'
import { getAnswerOfDay } from './answers'
import { dateOfDay, dayAt, parseDate, puzzleKey, randomWord, validSeed } from './endless/puzzle'
import { libraryWarning, randomPool, randomPoolVersion } from './endless/library'

export const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isMobile = isIOS || /iPad|iPhone|iPod|Android|Phone|webOS/i.test(navigator.userAgent)
export const breakpoints = useBreakpoints(breakpointsTailwind)

export const now = useNow({ interval: 1000 })
export const isDark = useDark()
export const showHint = ref(false)
export const showSettings = ref(false)
export const showHelp = ref(false)
export const showShare = ref(false)
export const showFailed = ref(false)
export const showDashboard = ref(false)
export const showCheatSheet = ref(false)
export const showShareDialog = ref(false)
export const useMask = ref(false)

export const useNumberTone = computed(() => {
  if (inputMode.value === 'sp')
    return true
  if (inputMode.value === 'zy')
    return false
  return _useNumberTone.value
})

const params = new URLSearchParams(window.location.search)
export const isDev = false
export const daySince = computed(() => dayAt(+now.value))
export const isRandom = params.has('seed')
export const randomSeed = params.get('seed') || ''
const requestedDate = params.get('date')
const legacyDay = params.get('d')
const selectedDay = requestedDate != null ? parseDate(requestedDate) : legacyDay != null && /^\d+$/.test(legacyDay) ? Number(legacyDay) : daySince.value
export const dayNo = ref(selectedDay != null && Number.isSafeInteger(selectedDay) && selectedDay >= 1 && selectedDay <= daySince.value ? selectedDay : daySince.value)
export const puzzleError = computed(() => {
  if (isRandom) {
    if (libraryWarning)
      return libraryWarning
    if (!validSeed(randomSeed))
      return '挑战码必须是 1 至 64 位数字。请点击随机按钮重新输入。'
    if (params.has('pool') && params.get('pool') !== randomPoolVersion)
      return '此链接的词库版本与本站不同，无法保证题目一致。请使用相同词库版本的站点，或重新输入挑战码开始当前版本的题目。'
  }
  else if (selectedDay == null || !Number.isSafeInteger(selectedDay) || selectedDay < 1 || selectedDay > daySince.value || (legacyDay != null && !/^\d+$/.test(legacyDay)) || dayNo.value < 1 || dayNo.value > daySince.value) {
    return '请选择 2022-01-01 至今天之间的有效日期。'
  }
  return ''
})
export const puzzleDate = computed(() => dateOfDay(dayNo.value))
export const puzzleLabel = computed(() => isRandom ? `随机题 · 挑战码 ${randomSeed}` : `${puzzleDate.value} · ${dayNo.value === daySince.value ? '每日题目' : '历史题目'}`)
export const dayNoHanzi = computed(() => isRandom ? `挑战码 ${randomSeed}` : `${puzzleDate.value} · 第${numberToHanzi(dayNo.value)}日`)
export const dayLabel = computed(() => isRandom ? `随机题目 · 挑战码 ${randomSeed}` : puzzleDate.value)
export const gameKey = computed(() => puzzleKey(dayNo.value, isRandom ? randomSeed : undefined, randomPoolVersion))
export const shareUrl = computed(() => {
  const url = new URL(window.location.pathname, window.location.origin)
  if (isRandom) {
    url.searchParams.set('seed', randomSeed)
    url.searchParams.set('pool', randomPoolVersion)
  }
  else {
    url.searchParams.set('date', puzzleDate.value)
  }
  return url.href
})
export const answer = computed(() => {
  if (puzzleError.value)
    return { word: '', hint: '' }
  if (isRandom) {
    const word = randomWord(randomSeed, randomPool, randomPoolVersion)
    return { word, hint: getHint(word) }
  }
  return getAnswerOfDay(dayNo.value)
})

export const hint = computed(() => answer.value.hint)
export const parsedAnswer = computed(() => parseWord(answer.value.word))

export const isPassed = computed(() => meta.value.passed || (tries.value.length && checkPass(testAnswer(parseWord(tries.value[tries.value.length - 1])))))
export const isFailed = computed(() => !isPassed.value && tries.value.length >= TRIES_LIMIT)
export const isFinished = computed(() => isPassed.value || meta.value.answer)

export function parseWord(word: string, _ans = answer.value.word, mode = inputMode.value, spM = spMode.value) {
  return _parseWord(word, _ans, mode, spM)
}

export function testAnswer(word: ParsedChar[], ans = parsedAnswer.value) {
  return _testAnswer(word, ans)
}

export const parsedTries = computed(() => tries.value.map((i) => {
  const word = parseWord(i)
  const result = testAnswer(word)
  return {
    word,
    result,
  }
}))

export function getSymbolState(symbol?: string | number, key?: '_1' | '_2' | 'tone') {
  const results: MatchType[] = []
  for (const t of parsedTries.value) {
    for (let i = 0; i < WORD_LENGTH; i++) {
      const w = t.word[i]
      const r = t.result[i]
      if (key) {
        if (w[key] === symbol)
          results.push(r[key])
      }
      else {
        if (w._1 === symbol)
          results.push(r._1)
        if (w._2 === symbol)
          results.push(r._2)
        if (w._3 === symbol)
          results.push(r._3)
      }
    }
  }
  if (results.includes('exact'))
    return 'exact'
  if (results.includes('misplaced'))
    return 'misplaced'
  if (results.includes('none'))
    return 'none'
  return null
}
