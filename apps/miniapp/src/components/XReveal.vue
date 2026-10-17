<script setup lang="ts">
/**
 * 滚动触发入场容器（见 docs/08 第 3 章）
 *
 * 用法：<XReveal :delay="i * 60"><view class="card">…</view></XReveal>
 * 说明：会额外引入一层 view 节点。长列表请改用 useReveal() 直接挂在现有元素上，
 *       避免节点数增长（微信官方建议控制 WXML 节点数量与层级）。
 */
import { computed } from 'vue'
import { useReveal } from '@/xj/motion'

const props = withDefaults(defineProps<{ delay?: number }>(), { delay: 0 })

const uid = `xr${Math.random().toString(36).slice(2, 8)}`
const shown = useReveal(uid)

const cls = computed(() => (shown.value ? 'mo-reveal is-in' : 'mo-reveal'))
const sty = computed(() => ({ '--mo-delay': `${props.delay}ms` }))
</script>

<template>
  <view :id="uid" :class="cls" :style="sty">
    <slot />
  </view>
</template>
