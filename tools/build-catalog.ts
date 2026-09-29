import { mkdirSync, writeFileSync } from 'node:fs'
import { answers } from '../src/answers/list'
import { IdiomsList, Polyphones, getPinyin } from '../src/logic/idioms'
import { buildPool, dateOfDay } from '../src/endless/puzzle'
import simplifiedMap from '../packages/tools/src/map/toSimplified.json'

function pronunciation(word: string) {
  return getPinyin(word).map(part => part.replace(/^([jqxy])v/, '$1u')).map(part => /[1-5]$/.test(part) ? part : `${part}5`).join(' ')
}

const daily = answers.flatMap(([word, hint], day) => word ? [{ day, date: dateOfDay(day), word, hint: hint || '', pinyin: pronunciation(word) }] : [])
const ordinary = buildPool([...IdiomsList, ...Object.keys(Polyphones)]).map(word => ({ word, pinyin: pronunciation(word) }))
mkdirSync('server', { recursive: true })
writeFileSync('server/catalog.json', JSON.stringify({ daily, ordinary, simplifiedMap }))
writeFileSync('src/endless/daily-words.json', `${JSON.stringify(buildPool(daily.map(entry => entry.word)), null, 2)}\n`)
// eslint-disable-next-line no-console
console.log(`已生成官方目录：每日 ${daily.length} 条，普通成语 ${ordinary.length} 条。`)
