// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { toPng } from 'html-to-image'
import ShareImage from '../src/components/ShareImage.vue'

const SHARE_URL = 'http://nas:8088/?date=2022-01-01'

vi.mock('html-to-image', () => ({ toPng: vi.fn() }))
vi.mock('file-saver', () => ({ saveAs: vi.fn() }))
vi.mock('../src/state', async () => {
  const { ref } = await import('vue')
  return {
    dayNoHanzi: ref('2022-01-01 · 第一日'),
    isIOS: false,
    isMobile: false,
    puzzleLabel: ref('2022-01-01 · 历史题目'),
    shareUrl: ref('http://nas:8088/?date=2022-01-01'),
    useMask: ref(false),
  }
})
vi.mock('../src/storage', async () => {
  const { ref } = await import('vue')
  return { tries: ref(['班门弄斧']) }
})

const stubs = {
  AppName: true,
  ToggleMask: true,
  WordBlocks: { template: '<div class="word-blocks" />' },
  ResultFooter: { template: '<div class="result-footer" />' },
}

it('renders the share image with a centered QR code at the bottom, without link or puzzle label', async () => {
  const snapshots: string[] = []
  vi.mocked(toPng).mockImplementation(async (node) => {
    snapshots.push(node.outerHTML)
    return 'data:image/png;base64,AAAA'
  })
  Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true })

  const wrapper = mount(ShareImage, { global: { stubs }, attachTo: document.body })
  await flushPromises()

  expect(snapshots).toHaveLength(2)
  for (const html of snapshots) {
    expect(html).not.toContain(SHARE_URL)
    expect(html).not.toContain('nas:8088')
    expect(html).not.toContain('历史题目')
    expect(html).not.toContain('每日题目')

    const root = document.createElement('div')
    root.innerHTML = html
    const image = root.firstElementChild!
    const qr = image.lastElementChild!
    expect(qr.tagName.toLowerCase()).toBe('svg')
    expect(qr.getAttribute('role')).toBe('img')
    expect(image.querySelectorAll('svg[role="img"]')).toHaveLength(1)
    expect(qr.previousElementSibling!.classList.contains('result-footer')).toBe(true)
    // Column flex with centered items is what centers the QR code horizontally
    expect(image.getAttribute('flex')).toContain('col')
    expect(image.hasAttribute('items-center')).toBe(true)
  }
  wrapper.unmount()
})
