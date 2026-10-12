<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { getCurrentInstance } from 'vue'
import { navigateToInterceptor } from '@/router/interceptor'
import { permission } from '@/router/permission'
import { useXj } from '@/xj/store'

const { proxy } = (getCurrentInstance() || {}) as any
const router = proxy?.$router
router && permission.install(router)

onLaunch((options: any) => {
  // 小程序码参数 scene=q=K7P2X9（设计文档 P-05）
  const scene = options?.query?.scene ? decodeURIComponent(options.query.scene) : ''
  const q = options?.query?.q || (scene.startsWith('q=') ? scene.slice(2) : '')
  if (q) uni.setStorageSync('xj_q', q)
  useXj().loadMe()
})
onShow((options: any) => {
  if (options?.path) navigateToInterceptor.invoke({ url: `/${options.path}`, query: options.query })
  else navigateToInterceptor.invoke({ url: '/' })
})
</script>

<style lang="scss">
</style>
