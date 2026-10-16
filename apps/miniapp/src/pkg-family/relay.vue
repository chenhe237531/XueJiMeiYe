<script lang="ts" setup>
import XNav from '@/components/XNav.vue'
import { useXj } from '@/xj/store'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '健康接力棒' } })

const xj = useXj()
</script>

<template>
  <view :class="xj.pageClass">
    <XNav show-back title="健康接力棒" />
    <view class="empty mo-rise mo-d1">
      <text class="t-md semi">页面建设中</text>
      <text class="t-sm">与家人互相接棒打卡，接棒后双方各得 5 积分</text>
      <text class="t-xs c2">占位页 · 完整玩法由 XJ-402 实现（docs/07 §3.2）</text>
    </view>
  </view>
</template>
