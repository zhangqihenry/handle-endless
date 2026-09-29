// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import ShareText from '../src/components/ShareText.vue'

vi.mock('../src/state', async () => {
  const { ref } = await import('vue')
  return {
    answer: ref({ word: '路不拾遗' }),
    puzzleLabel: ref('2022-01-01 · 历史题目'),
    shareUrl: ref('http://nas:8088/?date=2022-01-01'),
    parseWord: vi.fn(),
    testAnswer: vi.fn(),
  }
})
vi.mock('../src/storage', async () => {
  const { ref } = await import('vue')
  return { meta: ref({}), tries: ref([]) }
})
vi.mock('@vueuse/core', async () => {
  const original = await vi.importActual<Record<string, unknown>>('@vueuse/core')
  const { ref } = await import('vue')
  return {
    ...original,
    useShare: () => ({ isSupported: ref(false), share: vi.fn() }),
    useClipboard: () => ({ isSupported: ref(false), copy: vi.fn() }),
  }
})

it('renders dated share text on HTTP without clipboard or system sharing', () => {
  const wrapper = mount(ShareText)
  const text = wrapper.get('textarea').element.value
  expect(text).toContain('2022-01-01 · 历史题目')
  expect(text).toContain('http://nas:8088/?date=2022-01-01')
  expect(wrapper.find('button').exists()).toBe(false)
  wrapper.unmount()
})
