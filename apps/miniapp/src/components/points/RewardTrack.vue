<script lang="ts" setup>
import { computed } from 'vue'
import { getTier } from '@/xj/motion'

/**
 * 连签奖励轨道（XJ-401，docs/07 §3.1）：7 格递进 +2 / +2 / +3 / +3 / +5 / +5 / 金蛋。
 * 本轮点亮格数 = 连签进度（第 8 天开新一轮）；下一格描边提示。
 * 金蛋格两态：未解锁 = 虚线描边 + 线稿蛋；已解锁 = 金蛋 + 脉冲（mo-off 静止，D8）。
 * 里程碑：连签 7 / 14 / 30 天解锁金蛋（15 积分 + 门店体验券）。
 */
const props = defineProps<{ streak: number }>()

const STEPS = [2, 2, 3, 3, 5, 5]
const lit = computed(() => (props.streak <= 0 ? 0 : ((props.streak - 1) % 7) + 1))
const eggOpen = computed(() => lit.value >= 7)
const animOn = getTier() !== 'off'
const EGGS = [
  { days: 7, name: '首枚金蛋' },
  { days: 14, name: '再接再厉蛋' },
  { days: 30, name: '满月金蛋' },
]

function cellState(i: number) {
  if (i + 1 <= lit.value)
    return 'lit'
  if (i + 1 === lit.value + 1)
    return 'next'
  return 'locked'
}
</script>

<template>
  <view class="track">
    <view class="row-between">
      <text class="t-md semi">连签奖励</text>
      <text class="t-sm c2">已连签 {{ streak }} 天</text>
    </view>
    <view class="track-row">
      <view v-for="(n, i) in STEPS" :key="i" class="track-cell">
        <view class="track-dot" :class="cellState(i)">
          <text class="track-n">+{{ n }}</text>
        </view>
      </view>
      <view class="track-cell">
        <view class="track-dot egg" :class="[eggOpen ? 'lit' : cellState(6)]">
          <view class="egg-shape" :class="{ open: eggOpen, pulse: eggOpen && animOn }" />
        </view>
      </view>
    </view>
    <view class="track-hint t-xs c3">
      <text>每连满 7 天点亮一枚金蛋</text>
      <text v-if="streak > 0 && !eggOpen">，再连 {{ 7 - lit }} 天开蛋</text>
    </view>
    <view class="eggs row gap8">
      <view v-for="e in EGGS" :key="e.days" class="egg-chip row gap4" :class="{ on: streak >= e.days }">
        <view class="egg-mini" :class="{ open: streak >= e.days }" />
        <text class="t-xs">{{ e.name }}</text>
        <text class="t-xs c3">{{ e.days }} 天</text>
      </view>
    </view>
    <text class="t-xs c3">金蛋含 15 积分与门店体验券，连签中断不清空成就，从今天继续即可</text>
  </view>
</template>

<style scoped>
.track-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
}
.track-cell {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
/* 格间连接线：走伪元素之外的兄弟节点方案（小程序 scoped 稳妥），用 cell 背景细线 */
.track-cell:not(:first-child)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 100%;
  height: 1px;
  background: var(--line-2);
  z-index: 0;
}
.track-dot {
  position: relative;
  z-index: 1;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.track-n {
  font-size: 12px;
  line-height: 1;
  font-weight: 700;
}
.track-dot.lit {
  background: linear-gradient(135deg, var(--gold), var(--brand-dark));
}
.track-dot.lit .track-n {
  color: var(--on-brand);
}
.track-dot.next {
  background: var(--surface);
  border: 2px solid var(--brand-dark);
  box-sizing: border-box;
}
.track-dot.next .track-n {
  color: var(--brand-ink);
}
.track-dot.locked {
  background: var(--line);
}
.track-dot.locked .track-n {
  color: var(--ink-3);
  font-weight: 500;
}
/* 金蛋格：未解锁 = 虚线盘 + 线稿蛋；已解锁 = 金蛋 + 脉冲（mo-off 静止） */
.track-dot.egg.locked {
  background: var(--surface);
  border: 2px dashed var(--brand-line);
}
.track-dot.egg.lit {
  background: var(--brand-soft);
}
.egg-shape {
  width: 18px;
  height: 24px;
  border-radius: 50% 50% 50% 50% / 58% 58% 42% 42%;
}
.egg-shape:not(.open) {
  border: 1.5px solid var(--brand-line);
  background: transparent;
}
.egg-shape.open {
  background: linear-gradient(160deg, #ecd9ae 0%, var(--gold) 45%, var(--brand-dark) 100%);
  box-shadow: 0 2px 6px -2px rgba(168, 130, 77, 0.6);
}
.egg-shape.pulse {
  animation: egg-pulse 2.4s ease-in-out infinite;
}
@keyframes egg-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.12);
  }
}
.track-hint {
  margin-top: 8px;
}
.eggs {
  margin-top: 10px;
  flex-wrap: wrap;
}
.egg-chip {
  padding: 4px 10px;
  border-radius: 14px;
  background: var(--line);
  opacity: 0.75;
}
.egg-chip.on {
  background: var(--brand-soft);
  opacity: 1;
}
.egg-mini {
  width: 9px;
  height: 12px;
  border-radius: 50% 50% 50% 50% / 58% 58% 42% 42%;
  border: 1.5px solid var(--ink-3);
}
.egg-chip.on .egg-mini {
  border: 0;
  background: linear-gradient(160deg, #ecd9ae 0%, var(--gold) 45%, var(--brand-dark) 100%);
}
</style>
