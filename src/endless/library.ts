/* eslint-disable import/no-mutable-exports */
// Initialized once before the Vue app is imported; bindings also support isolated dictionary tests.
import { toSimplified } from '@hankit/tools'
import Polyphones from '../data/polyphones.json'
import dailyWords from './daily-words.json'
import { buildPool, poolVersion } from './puzzle'

export const extraPronunciations: Record<string, string> = Object.create(null)
const officialWords = dailyWords
export const officialSet = new Set(officialWords.map(toSimplified))
export const ordinaryOverrides: Record<string, { word: string; pinyin: string } | null> = Object.create(null)
export let randomPool = buildPool(officialWords)
const versionFor = (words: string[], extra: Record<string, string>) => poolVersion(words, Object.fromEntries(words.map(word => [word, extra[word] || (Polyphones as Record<string, string>)[word] || ''])))
export let randomPoolVersion = versionFor(randomPool, {})
export let libraryWarning = ''

export function configureExtraLibrary(data: unknown) {
  if (!Array.isArray(data))
    throw new Error('额外词库必须是 JSON 数组。')
  const parsed: Record<string, string> = Object.create(null)
  for (let entry of data) {
    if (!entry || typeof entry.word !== 'string' || entry.word.length !== 4 || !/^[\p{Script=Han}]{4}$/u.test(entry.word)
      || typeof entry.pinyin !== 'string' || !/^[a-zv]+[1-5]( [a-zv]+[1-5]){3}$/.test(entry.pinyin))
      throw new Error('额外词库中存在无效条目，请检查四字成语和四个带声调数字的拼音。')
    entry = { ...entry, word: toSimplified(entry.word) }
    if (officialSet.has(entry.word))
      continue
    if (parsed[entry.word] && parsed[entry.word] !== entry.pinyin)
      throw new Error(`额外词库存在重复且读音冲突的成语：${entry.word}`)
    parsed[entry.word] = entry.pinyin
  }
  Object.keys(extraPronunciations).forEach(key => delete extraPronunciations[key])
  Object.assign(extraPronunciations, parsed)
  randomPool = buildPool([...officialWords, ...Object.keys(parsed)])
  randomPoolVersion = versionFor(randomPool, parsed)
}

export function configureLibraries(data: unknown) {
  const value = data as { ordinaryOverrides: typeof ordinaryOverrides; extra: unknown }
  if (!value || !value.ordinaryOverrides || typeof value.ordinaryOverrides !== 'object' || Array.isArray(value.ordinaryOverrides))
    throw new Error('普通词库修改记录格式错误。')
  const overrides: typeof ordinaryOverrides = Object.create(null)
  for (const [word, entry] of Object.entries(value.ordinaryOverrides)) {
    if (!/^[\p{Script=Han}]{4}$/u.test(word) || (entry !== null && (entry.word !== word || !/^[a-zv]+[1-5]( [a-zv]+[1-5]){3}$/.test(entry.pinyin))))
      throw new Error('普通词库修改记录存在无效条目。')
    overrides[toSimplified(word)] = entry
  }
  configureExtraLibrary(value.extra)
  Object.keys(ordinaryOverrides).forEach(key => delete ordinaryOverrides[key])
  Object.assign(ordinaryOverrides, overrides)
}

export async function loadExtraLibrary() {
  try {
    const response = await fetch('/libraries.json', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!response.ok)
      throw new Error(`HTTP ${response.status}`)
    configureLibraries(await response.json())
  }
  catch (error) {
    libraryWarning = `自定义词库加载失败，随机模式暂不可用。每日与历史题目仍可使用官方基础词库。${error instanceof Error ? error.message : ''}`
  }
}
