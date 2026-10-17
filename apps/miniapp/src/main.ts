import { createSSRApp } from 'vue'
import App from './App.vue'
import { routeInterceptor } from './router/interceptor'

import store from './store'
import '@/style/index.scss'
import '@/style/motion.scss'
// 彩色图形底座、徽章与合成动图的变量层（组件结构样式在各自 scoped 内）见 docs/09
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
