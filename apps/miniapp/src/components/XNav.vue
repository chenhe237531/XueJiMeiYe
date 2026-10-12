<script setup lang="ts">
import { back } from '@/xj/utils'

const props = defineProps<{ title?: string, showBack?: boolean, night?: boolean, transparent?: boolean, big?: boolean }>()
const sys = uni.getSystemInfoSync()
const statusBar = sys.statusBarHeight || 0
let rightPad = 16
// #ifdef MP-WEIXIN
const capsule = uni.getMenuButtonBoundingClientRect()
rightPad = (sys.windowWidth - capsule.left) + 8
// #endif
void props
</script>

<template>
  <view class="xnav" :class="{ night, transparent }" :style="{ paddingTop: `${statusBar}px` }">
    <view class="bar" :style="{ paddingRight: `${rightPad}px` }">
      <view v-if="showBack" class="back" @click="back()">
        <view class="i-tabler-chevron-left" style="font-size: 26px" />
      </view>
      <view v-if="title" class="title" :class="{ big, withBack: showBack }">{{ title }}</view>
      <view class="flex1" />
      <slot name="right" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.xnav { margin: 0 calc(-1 * var(--pad, 12px)); background: var(--bg, #f5f5f5); position: sticky; top: 0; z-index: 40; }
.xnav.transparent { background: transparent; position: relative; }
.bar { height: 48px; display: flex; align-items: center; padding-left: var(--pad, 12px); }
.back { width: 44px; height: 44px; margin-left: -12px; display: flex; align-items: center; justify-content: center; color: var(--ink); }
.title { font-size: 18px; font-weight: 600; color: var(--ink); }
.title.big { font-size: var(--fs-title, 26px); font-weight: 700; }
.title.withBack { font-size: 18px; }
</style>
