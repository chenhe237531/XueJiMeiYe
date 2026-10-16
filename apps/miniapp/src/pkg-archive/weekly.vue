<script lang="ts" setup>
import XNav from '@/components/XNav.vue'
import { useXj } from '@/xj/store'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '六维周报' } })

const xj = useXj()
</script>

<template>
  <view :class="xj.pageClass">
    <XNav show-back title="六维周报" />
    <view class="empty mo-rise mo-d1">
      <text class="t-md semi">页面建设中</text>
      <text class="t-sm">每周健康指数与六维变化，可分享给家人</text>
      <text class="t-xs c2">占位页 · 完整玩法由 XJ-405 实现（docs/07 §3.5）</text>
    </view>
  </view>
</template>
