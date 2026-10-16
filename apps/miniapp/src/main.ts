import { createSSRApp } from 'vue'
import App from './App.vue'
import { routeInterceptor } from './router/interceptor'

import store from './store'
import '@/style/index.scss'
// 图形底座（图标底座尺寸 / 色底 / 合成动图）与徽章的变量层，见 docs/09；组件结构样式在各自 scoped 内
import '@/style/graphics.scss'
// 小镜形象 XMascot 的皮肤变量层（组件结构样式在 XMascot.vue 的 scoped 内）见 docs/07 §2
import '@/style/mascot.scss'
import 'virtual:uno.css'

export function createApp() {
  const app = createSSRApp(App)
  app.use(store)
  app.use(routeInterceptor)

  return {
    app,
  }
}
