// register vue composition api globally
import { createApp } from 'vue'
import { loadExtraLibrary } from './endless/library'

import '@unocss/reset/tailwind.css'
import './styles/main.css'
import 'uno.css'

async function bootstrap() {
  if (window.location.pathname.replace(/\/$/, '') === '/admin') {
    const { default: AdminApp } = await import('./AdminApp.vue')
    createApp(AdminApp).mount('#app')
    return
  }
  await loadExtraLibrary()
  const { default: App } = await import('./App.vue')
  createApp(App).mount('#app')
}
bootstrap()
