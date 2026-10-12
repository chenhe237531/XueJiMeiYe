<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import HomeRender from '@/components/home/HomeRender.vue'
import XIcon from '@/components/XIcon.vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'

defineOptions({ name: 'Home' })
definePage({ type: 'home', style: { navigationStyle: 'custom', navigationBarTitleText: '首页' } })

const xj = useXj()
const data = ref<any>(uni.getStorageSync('xj_home_cache') || null)
const offline = ref(false)
const night = computed(() => data.value?.tier === 'A')

async function load() {
  try {
    data.value = await http.get('/app/home', undefined, { silent: true })
    offline.value = false
    uni.setStorageSync('xj_home_cache', data.value)
  }
  catch (e: any) {
    if (e?.code === 40001) { xj.logout(); return load() }
    offline.value = true
  }
}

onShow(async () => {
  if (xj.loggedIn && !xj.me) await xj.loadMe()
  load()
})
watch(() => xj.elderMode, () => load())
onPullDownRefresh(async () => { await load(); uni.stopPullDownRefresh() })
</script>

<template>
  <view :class="[...xj.pageClass, 'has-tabbar', night ? 'night' : '']">
    <XNav />
    <view v-if="offline" class="card hint row gap8 t-sm" style="margin-bottom: 12px">
      <XIcon name="wifi-off" :size="18" />
      <text>网络不太好，展示的可能是缓存内容</text>
    </view>
    <view v-if="!data" class="col gap12">
      <view class="card skeleton" style="height: 64px" />
      <view class="card skeleton" style="height: 180px" />
      <view class="card skeleton" style="height: 220px" />
    </view>
    <HomeRender v-else :components="data.components" :night="night" />
    <view class="t-xs c3" style="text-align: center; margin-top: 24px">雪姬美业 · 六维健康 | 价格与权益按公开会员规则</view>
  </view>
</template>
