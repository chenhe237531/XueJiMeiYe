<script setup lang="ts">
import { computed } from 'vue'
import { useXj } from '@/xj/store'
import { customTabbarEnable, needHideNativeTabbar, tabbarCacheEnable } from './config'
import { tabbarList, tabbarStore } from './store'

// #ifdef MP-WEIXIN
defineOptions({ virtualHost: true })
// #endif

const xj = useXj()
const elder = computed(() => xj.elderMode)

function handleClick(index: number) {
  if (index === tabbarStore.curIdx && tabbarStore.isCurrentRouteTabbarItem(index)) return
  const list = tabbarList.value
  if (!list[index]) return
  const url = list[index].pagePath
  const prevIdx = tabbarStore.curIdx
  tabbarStore.setCurIdx(index)
  const ok = () => tabbarStore.syncCurIdxByCurrentPageAsync()
  const fail = () => tabbarStore.setCurIdx(prevIdx)
  if (tabbarCacheEnable) uni.switchTab({ url, success: ok, fail })
  else uni.navigateTo({ url, success: ok, fail })
}
// #ifndef MP-WEIXIN || MP-ALIPAY
onLoad(() => {
  needHideNativeTabbar && uni.hideTabBar({ fail() {} })
})
// #endif
</script>

<template>
  <view v-if="customTabbarEnable" class="tabbar-holder" :class="{ elder }">
    <view class="tabbar" :class="{ elder }" @touchmove.stop.prevent>
      <view class="items">
        <view v-for="(item, index) in tabbarList" :key="index" class="item" :class="{ on: tabbarStore.curIdx === index }" @click="handleClick(index)">
          <view :class="[item.icon]" class="ic" />
          <text class="label">{{ item.text }}</text>
        </view>
      </view>
      <view class="safe" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.tabbar-holder { height: 60px; }
.tabbar-holder.elder { height: 70px; }
.tabbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 1000; background: #fff; border-top: 1px solid #ebe6e9; }
.items { height: 60px; display: flex; }
.tabbar.elder .items { height: 70px; }
.item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: #5c5358; }
.item .ic { font-size: 24px; }
.item .label { font-size: 11px; }
.tabbar.elder .item .ic { font-size: 30px; }
.tabbar.elder .item .label { font-size: 14px; }
.item.on { color: #8c2b56; }
.item.on .label { font-weight: 700; }
.safe { padding-bottom: env(safe-area-inset-bottom); }
</style>
