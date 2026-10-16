<script lang="ts" setup>
import XNav from '@/components/XNav.vue'
import { useXj } from '@/xj/store'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '门店集章册' } })

const xj = useXj()
</script>

<template>
  <view :class="xj.pageClass">
    <XNav show-back title="门店集章册" />
    <view class="empty mo-rise mo-d1">
      <text class="t-md semi">页面建设中</text>
      <text class="t-sm">到店完成项目或体检即可盖章，集满解锁奖励</text>
      <text class="t-xs c2">占位页 · 完整玩法由 XJ-406 实现（docs/07 §3.6）</text>
    </view>
  </view>
</template>
