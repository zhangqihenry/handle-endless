/// <reference types="vitest" />

import path from 'path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Unocss from 'unocss/vite'

export default defineConfig({
  server: { proxy: { '/api': 'http://127.0.0.1:13863', '/libraries.json': 'http://127.0.0.1:13863', '/extra-idioms.json': 'http://127.0.0.1:13863' } },
  resolve: {
    alias: {
      '~/': `${path.resolve(__dirname, 'src')}/`,
      '@hankit/tools': path.resolve(__dirname, 'packages/tools/src/index.ts'),
    },
  },
  define: {
    'import.meta.vitest': 'false',
  },
  plugins: process.env.TEST && !process.env.VITEST
    ? []
    : [
        Vue(),
        AutoImport({
          imports: [
            'vue',
            '@vueuse/core',
          ],
          dts: true,
        }),
        Components({
          dts: true,
        }),
        Unocss(),
      ],
  test: {
    include: ['test/**/*.test.ts', 'packages/**/test/**/*.test.ts'],
    includeSource: ['packages/*/src/**/*.ts'],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('locale'))
            return 'locale'
          if (id.includes('idioms.txt'))
            return 'idioms'
          if (id.includes('polyphones.json'))
            return 'polyphones'
          if (id.includes('node_modules') && !id.endsWith('.css'))
            return 'vendor'
        },
      },
    },
  },
})
