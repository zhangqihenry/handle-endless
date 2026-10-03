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

it('sizes the module area to the requested edge length, with a white quiet zone around it', () => {
  const wrapper = mount(QrCode, { props: { text: URL_TEXT, size: 80 } })
  const { size } = encode(URL_TEXT, { ecc: 'L', border: 0 })
  const svg = wrapper.get('svg')
  const outer = Number(svg.attributes('width'))
  expect(svg.attributes('height')).toBe(String(outer))
  expect(outer * size / (size + 4)).toBeCloseTo(80)
  expect(svg.attributes('viewBox')).toBe(`-2 -2 ${size + 4} ${size + 4}`)
  expect(wrapper.get('rect').attributes('fill')).toBe('#fff')
  expect(wrapper.get('path').attributes('fill')).toBe('#000')
  wrapper.unmount()
})

it('keeps the module area at 80px by default and follows the text', async () => {
  const wrapper = mount(QrCode, { props: { text: 'http://nas:8088/?date=2022-01-01' } })
  const before = wrapper.get('path').attributes('d')
  const { size } = encode('http://nas:8088/?date=2022-01-01', { ecc: 'L', border: 0 })
  expect(Number(wrapper.get('svg').attributes('width')) * size / (size + 4)).toBeCloseTo(80)

  await wrapper.setProps({ text: 'http://nas:8088/?date=2022-01-02' })
  expect(wrapper.get('path').attributes('d')).not.toBe(before)
  wrapper.unmount()
})
