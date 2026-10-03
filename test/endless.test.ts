import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import seedrandom from 'seedrandom'
import { answers } from '../src/answers/list'
import { getAnswerOfDay } from '../src/answers'
import { buildPool, dateOfDay, dayAt, parseDate, poolVersion, puzzleKey, randomWord, validSeed } from '../src/endless/puzzle'
import { configureExtraLibrary, configureLibraries, randomPool, randomPoolVersion } from '../src/endless/library'
import { getIdiom, getPinyin } from '../src/logic/idioms'

afterEach(() => configureLibraries({ ordinaryOverrides: {}, extra: [] }))

describe('official daily compatibility', () => {
  it('preserves the upstream answer table, shuffle and dictionaries byte for byte', () => {
    const checksums = {
      'src/answers/list.ts': '805cee5a2a13d038db9ac03a5cdb8241b9e625ad260faba5a7e271c87c077089',
      'src/answers/utils.ts': '7d067ad0a3042dbe87f1110aa8b884fa5ddeba4c340ef802fbc0359c685697fd',
      'src/data/idioms.txt': 'ed8ca4bbc5c667116df9d9088b1851ae0c696e5fddb7d1ad987df35fc50af792',
      'src/data/polyphones.json': '03fdbdb60d209b2e670d8975017d61c2265ba113cec07397ff01c378cff6c086',
    }
    for (const [path, hash] of Object.entries(checksums))
      expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(hash)
  })
  it('matches every defined official day through 2035', () => {
    for (let day = 1; day <= parseDate('2035-12-31')!; day++) {
      if (day === answers.length)
        continue // upstream out-of-bounds bug, separately tested below
      const expected = day > answers.length
        ? answers[Math.floor(seedrandom(`day-${day}`)() * answers.length)]
        : answers[day]
      expect(getAnswerOfDay(day).word).toBe(expected[0] || '')
    }
  })
  it('handles the upstream boundary and invalid indexes without crashing', () => {
    expect(dateOfDay(answers.length)).toBe('2023-03-01')
    expect(() => getAnswerOfDay(answers.length)).not.toThrow()
    expect(getAnswerOfDay(-1).word).toBe('')
    expect(getAnswerOfDay(Number.NaN).word).toBe('')
  })
})

describe('dates and isolated storage identities', () => {
  it('changes day at Hong Kong midnight regardless of system timezone', () => {
    expect(dateOfDay(dayAt(Date.parse('2026-09-28T15:59:59Z')))).toBe('2026-09-28')
    expect(dateOfDay(dayAt(Date.parse('2026-09-28T16:00:00Z')))).toBe('2026-09-29')
    expect(parseDate('2022-01-01')).toBe(1)
    expect(dateOfDay(parseDate('2024-02-29')!)).toBe('2024-02-29')
  })
  it.each(['2023-02-29', '2026-13-01', 'x', '2021-12-31', '2026-9-1'])('rejects invalid date %s', (date) => {
    expect(parseDate(date)).toBeUndefined()
  })
  it('separates different dates, seeds and versions', () => {
    const keys = [puzzleKey(100), puzzleKey(101), puzzleKey(100, '100', 'v1'), puzzleKey(100, '101', 'v1'), puzzleKey(100, '100', 'v2')]
    expect(new Set(keys).size).toBe(keys.length)
    expect(puzzleKey(100, '100', 'v1')).toBe(puzzleKey(101, '100', 'v1'))
  })
})

describe('seeded extra dictionary', () => {
  it('draws only from the daily answer table plus extras', () => {
    expect(randomPool).toEqual(buildPool(answers.map(entry => entry[0])))
    expect(randomPool).not.toContain('自怨自艾')
    const before = randomPoolVersion
    configureExtraLibrary([{ word: '路不拾遗', pinyin: 'lu4 bu4 shi2 yi2' }])
    expect(randomPoolVersion).toBe(before)
  })
  it('sorts and deduplicates consistently, irrespective of input ordering', () => {
    const a = buildPool(['春和景明', '一心一意', '春和景明', '', '三个字'])
    const b = buildPool(['一心一意', '春和景明'])
    expect(a).toEqual(b)
    expect(poolVersion(a, { a: 'a', b: 'b' })).toBe(poolVersion(b, { b: 'b', a: 'a' }))
    const version = poolVersion(a, {})
    for (const seed of ['0', '001', '20260929', '9'.repeat(64)])
      expect(randomWord(seed, a, version)).toBe(randomWord(seed, b, version))
  })
  it.each(['', '-1', '1.5', '1e3', '挑战码', '1'.repeat(65)])('rejects seed %s', seed => expect(validSeed(seed)).toBe(false))
  it('adds extra words with explicit pronunciation without changing daily answers', () => {
    const before = getAnswerOfDay(1733)
    const oldVersion = randomPoolVersion
    // Artificial entry exclusively for checking the custom dictionary path.
    configureExtraLibrary([{ word: '甲乙丙丁', pinyin: 'jia3 yi3 bing3 ding1' }])
    expect(randomPool).toContain('甲乙丙丁')
    expect(getIdiom('甲乙丙丁')).toBeDefined()
    expect(getPinyin('甲乙丙丁')).toEqual(['jia3', 'yi3', 'bing3', 'ding1'])
    expect(randomPoolVersion).not.toBe(oldVersion)
    expect(getAnswerOfDay(1733)).toEqual(before)
  })
  it('uses saved extension readings consistently with the pool version', () => {
    const version = randomPoolVersion
    configureExtraLibrary([{ word: '自怨自艾', pinyin: 'zi4 yuan4 zi4 ai4' }])
    expect(getPinyin('自怨自艾')).toEqual(['zi4', 'yvan4', 'zi4', 'ai4'])
    expect(randomPool).toContain('自怨自艾')
    expect(randomPoolVersion).not.toBe(version)
  })
  it('rejects malformed libraries atomically', () => {
    const version = randomPoolVersion
    expect(() => configureExtraLibrary([{ word: '甲乙丙丁', pinyin: 'invalid' }])).toThrow()
    expect(() => configureExtraLibrary({})).toThrow()
    expect(randomPoolVersion).toBe(version)
  })
})

describe('editable ordinary library', () => {
  it('applies added, changed and deleted ordinary words without growing the random pool', () => {
    const before = randomPoolVersion
    configureLibraries({
      ordinaryOverrides: {
        甲乙丙戊: { word: '甲乙丙戊', pinyin: 'jia3 yi3 bing3 wu4' },
        自怨自艾: { word: '自怨自艾', pinyin: 'zi4 yuan4 zi4 ai4' },
        春和景明: null,
      },
      extra: [],
    })
    expect(getIdiom('甲乙丙戊')).toBeDefined()
    expect(getPinyin('自怨自艾')).toEqual(['zi4', 'yvan4', 'zi4', 'ai4'])
    expect(getIdiom('春和景明')).toBeUndefined()
    expect(randomPool).not.toContain('甲乙丙戊')
    expect(randomPoolVersion).toBe(before)
  })
  it('keeps daily words and readings playable after overlapping ordinary edits or removal', () => {
    const before = getPinyin('路不拾遗')
    for (const entry of [null, { word: '路不拾遗', pinyin: 'lu4 bu4 shi2 yi4' }]) {
      configureLibraries({ ordinaryOverrides: { 路不拾遗: entry }, extra: [] })
      expect(getIdiom('路不拾遗')).toBeDefined()
      expect(getPinyin('路不拾遗')).toEqual(before)
    }
  })
  it('keeps extension entries valid after ordinary deletion and versions changed readings', () => {
    configureLibraries({ ordinaryOverrides: { 春和景明: null }, extra: [{ word: '春和景明', pinyin: 'chun1 he2 jing3 ming2' }] })
    const version = randomPoolVersion
    expect(getIdiom('春和景明')).toBeDefined()
    expect(randomPool).toContain('春和景明')
    configureLibraries({ ordinaryOverrides: {}, extra: [{ word: '春和景明', pinyin: 'chun1 he2 jing3 ming3' }] })
    expect(randomPoolVersion).not.toBe(version)
    expect(getPinyin('春和景明')[3]).toBe('ming3')
  })
})
