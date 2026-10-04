// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import { encode } from 'uqr'
import QrCode from '../src/components/QrCode.vue'

const URL_TEXT = 'http://nas:8088/?seed=12345&pool=v1-cfdc15e0fd9796e3dcf50654753de704'

function readModules(path: string, size: number) {
  const modules = Array.from({ length: size }, () => Array.from({ length: size }, () => false))
  for (const [, x, y, len] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(len); i++)
      modules[Number(y)][Number(x) + i] = true
  }
  return modules
}

it('draws exactly the modules of the encoded text', () => {
  const wrapper = mount(QrCode, { props: { text: URL_TEXT } })
  const expected = encode(URL_TEXT, { ecc: 'L', border: 0 })
  const drawn = readModules(wrapper.get('path').attributes('d')!, expected.size)
  expect(drawn).toEqual(expected.data)
  wrapper.unmount()
})

it('sizes the code to the requested edge length on a transparent background', () => {
  const wrapper = mount(QrCode, { props: { text: URL_TEXT, size: 80 } })
  const { size } = encode(URL_TEXT, { ecc: 'L', border: 0 })
  const svg = wrapper.get('svg')
  expect(svg.attributes('width')).toBe('80')
  expect(svg.attributes('height')).toBe('80')
  expect(svg.attributes('viewBox')).toBe(`0 0 ${size} ${size}`)
  expect(wrapper.find('rect').exists()).toBe(false)
  // Modules take the correct-tile color through currentColor
  expect(wrapper.get('svg').attributes('text-ok')).toBeDefined()
  expect(wrapper.get('path').attributes('fill')).toBe('currentColor')
  wrapper.unmount()
})

it('keeps the code at 80px by default and follows the text', async () => {
  const wrapper = mount(QrCode, { props: { text: 'http://nas:8088/?date=2022-01-01' } })
  const before = wrapper.get('path').attributes('d')
  expect(wrapper.get('svg').attributes('width')).toBe('80')

  await wrapper.setProps({ text: 'http://nas:8088/?date=2022-01-02' })
  expect(wrapper.get('path').attributes('d')).not.toBe(before)
  wrapper.unmount()
})
