<script lang="ts" setup>
import XNav from '@/components/XNav.vue'
import { useXj } from '@/xj/store'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '健康盲盒' } })

const xj = useXj()
</script>

<template>
  <view :class="xj.pageClass">
    <XNav show-back title="健康盲盒" />
    <view class="empty mo-rise mo-d1">
      <text class="t-md semi">页面建设中</text>
      <text class="t-sm">拆盲盒收健康知识卡，每日免费 1 次</text>
      <text class="t-xs c2">占位页 · 完整玩法由 XJ-404 实现（docs/07 §3.4）</text>
    </view>
  </view>
</template>
