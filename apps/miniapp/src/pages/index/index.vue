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
// 首页缓存标记属于哪个登录态，换账号 / 退出后不会先闪出上一位用户的首页
const cached = uni.getStorageSync('xj_home_cache')
const data = ref<any>(cached && cached.owner === xj.token ? cached.data : null)
const offline = ref(false)
const night = computed(() => data.value?.tier === 'A')

/**
 * XJ-201：C 级登录用户（非乐龄）插入「连续签到」激活条。
 * 后端 home.service 已自动补 taskList（XJ-305），但 layout 未配置 checkinBar 组件类型，
 * 前端按 docs/07 §4.2 组件矩阵兜底插入（访客 / B / A / 乐龄不显示）。
 * 位置：taskList 之前；无 taskList 时插健康卡 / 问候栏之后。
 */
const components = computed(() => {
  const list = [...(data.value?.components || [])]
  const showSignin = xj.loggedIn && data.value?.tier === 'C' && !xj.elderMode && !list.some(c => c.type === 'checkinBar')
  if (!showSignin)
    return list
  const at = Math.max(
    list.findIndex(c => c.type === 'taskList'),
    list.findIndex(c => c.type === 'healthCard' || c.type === 'elderToday' || c.type === 'greeting'),
  )
  list.splice(at + 1, 0, { type: 'checkinBar', props: {} })
  return list
})

async function load() {
  const owner = xj.token
  try {
    const res = await http.get('/app/home', undefined, { silent: true })
    if (owner !== xj.token) return // 请求期间换了账号，丢弃旧结果
    data.value = res
    offline.value = false
    uni.setStorageSync('xj_home_cache', { owner, data: res })
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
  <view :class="[...xj.pageClass, 'has-tabbar', 'washed', night ? 'night' : '']">
    <XNav transparent />
    <view v-if="offline" class="card hint row gap8 t-sm" style="margin-bottom: 12px">
      <XIcon name="wifi-off" :size="18" />
      <text>网络不太好，展示的可能是缓存内容</text>
    </view>
    <view v-if="!data" class="col gap12">
      <view class="card skeleton" style="height: 64px" />
      <view class="card skeleton" style="height: 180px" />
      <view class="card skeleton" style="height: 220px" />
    </view>
    <HomeRender v-else :components="components" :night="night" />
    <view class="t-xs c3" style="text-align: center; margin-top: 24px">雪姬美业 | 价格与权益按公开会员规则</view>
  </view>
</template>
