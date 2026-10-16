<script lang="ts" setup>
import XNav from '@/components/XNav.vue'
import { useXj } from '@/xj/store'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '成就徽章墙' } })

const xj = useXj()
</script>

<template>
  <view :class="xj.pageClass">
    <XNav show-back title="成就徽章墙" />
    <view class="empty mo-rise mo-d1">
      <text class="t-md semi">页面建设中</text>
      <text class="t-sm">坚持 / 探索 / 分享三组徽章，点亮成就分享给家人</text>
      <text class="t-xs c2">占位页 · 完整玩法由 XJ-403 实现（docs/07 §3.3）</text>
    </view>
  </view>
</template>
