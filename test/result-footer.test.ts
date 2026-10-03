// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import ResultFooter from '../src/components/ResultFooter.vue'
import { dayLabel } from '../src/state'

vi.mock('../src/state', async () => {
  const { ref } = await import('vue')
  return { dayLabel: ref('2022-01-01') }
})
vi.mock('../src/storage', async () => {
  const { ref } = await import('vue')
  return { formatDuration: () => '1分23秒', meta: ref({ strict: true, duration: 83000 }) }
})

it('shows only the date, without the day number, in the share image footer', () => {
  const wrapper = mount(ResultFooter, { props: { day: true } })
  const text = wrapper.text()
  expect(text).toContain('2022-01-01')
  expect(text).not.toMatch(/第.*日/)
  expect(text).toContain('1分23秒')
  wrapper.unmount()
})

it('shows the random puzzle label instead of a date for random puzzles', () => {
  dayLabel.value = '随机题目 · 挑战码 12345'
  const wrapper = mount(ResultFooter, { props: { day: true } })
  expect(wrapper.text()).toContain('随机题目 · 挑战码 12345')
  wrapper.unmount()
  dayLabel.value = '2022-01-01'
})

it('omits the date outside the share image', () => {
  const wrapper = mount(ResultFooter)
  expect(wrapper.text()).not.toContain('2022-01-01')
  expect(wrapper.text()).toContain('1分23秒')
  wrapper.unmount()
})
