// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'

async function loadState(search: string) {
  vi.resetModules()
  window.history.replaceState({}, '', `/${search}`)
  return await import('../src/state')
}

beforeEach(() => localStorage.clear())

it('labels the share image footer with the date for daily and history puzzles', async () => {
  const { dayLabel } = await loadState('?date=2022-01-01')
  expect(dayLabel.value).toBe('2022-01-01')
})

it('labels the share image footer as a random puzzle with its challenge code', async () => {
  const { dayLabel } = await loadState('?seed=12345')
  expect(dayLabel.value).toBe('随机题目 · 挑战码 12345')
})
