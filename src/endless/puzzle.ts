import seedrandom from 'seedrandom'

export const EPOCH = Date.parse('2021-12-31T00:00:00+08:00')
export const DAY_MS = 86400000
export const FIRST_DATE = '2022-01-01'

export function dayAt(time: number) {
  return Math.floor((time - EPOCH) / DAY_MS)
}

export function dateOfDay(day: number) {
  return new Date(EPOCH + day * DAY_MS + 8 * 3600000).toISOString().slice(0, 10)
}

export function parseDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return undefined
  const day = dayAt(Date.parse(`${date}T00:00:00+08:00`))
  return Number.isFinite(day) && dateOfDay(day) === date && day >= 1 ? day : undefined
}

export function validSeed(seed: string) {
  return /^[0-9]{1,64}$/.test(seed)
}

export function buildPool(words: string[]) {
  return [...new Set(words.filter(w => /^[\p{Script=Han}]{4}$/u.test(w)))].sort()
}

export function poolVersion(words: string[], pronunciations: Record<string, string>) {
  const pronunciationEntries = Object.entries(pronunciations).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  const rng = seedrandom(JSON.stringify([words, pronunciationEntries]))
  return `v1-${[rng.int32(), rng.int32(), rng.int32(), rng.int32()].map(n => (n >>> 0).toString(16).padStart(8, '0')).join('')}`
}

export function randomWord(seed: string, pool: string[], version: string) {
  if (!validSeed(seed) || !pool.length)
    throw new Error('请输入 1 至 64 位数字挑战码。')
  return pool[Math.floor(seedrandom(`Handle_Endless/${version}/${seed}`)() * pool.length)]
}

export function puzzleKey(day: number, seed?: string, version?: string) {
  return seed == null ? `daily:${day}` : `random:${version}:${seed}`
}
