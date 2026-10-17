<script setup lang="ts">
/**
 * 六维达标卡片（XJ-207 / docs/06 §3.2、docs/07 §2 档案页）
 *
 * - 达标进度条：颜色由 --meter-ok / --meter-near / --meter-low 令牌驱动（XJ-102 已落三皮肤），
 *   生长用 scaleX（mo-grow-x），不过渡 width（硬约束：进度条不用 width 动画）。
 * - 人话结论：分数 → 档位文字映射，阈值与六维算法同源（优 ≥80 / 良 ≥60 / 需关注 <60，
 *   即 engine.dimGrade / D20 的展示层等价映射，不做健康推断）。
 * - 滚动入场：useReveal（IntersectionObserver）命中视口后加 .is-in，只播一次；
 *   mo-off / 乐龄下由 motion.scss 的统一降级直接呈现终态。
 * - 无数据（score=null）：不出进度条，显示「完成测评后生成」。
 */
import type { GraphicName } from '@/xj/graphics'
import { computed } from 'vue'
import XGraphic from '@/components/XGraphic.vue'
import { DIM_GRAPHIC } from '@/xj/graphics'
import { DIMS } from '@/xj/utils'
import { useReveal } from '@/xj/motion'

const props = defineProps<{
  /** 维度 code（skin / shape / contour / fitness / posture / mind） */
  code: string
  /** 本次得分 0~100；null = 该维度尚未测评 */
  score?: number | null
}>()

const dim = computed(() => DIMS.find(d => d.code === props.code))
const graphic = computed(() => DIM_GRAPHIC[props.code] as GraphicName)

/** 与 engine.dimGrade 同阈值：优 ≥80 / 良 ≥60 / 需关注 <60（D20 展示层同源映射） */
const grade = computed(() => {
  const s = props.score
  if (s == null)
    return { tone: 'none', text: '完成测评后生成', meter: 'transparent', pct: 0 }
  if (s >= 80)
    return { tone: 'ok', text: `优 · 达标 ${s}%`, meter: 'var(--meter-ok)', pct: s / 100 }
  if (s >= 60)
    return { tone: 'near', text: `良 · 达标 ${s}%`, meter: 'var(--meter-near)', pct: s / 100 }
  return { tone: 'low', text: `需关注 · 达标 ${s}%`, meter: 'var(--meter-low)', pct: s / 100 }
})

/** 每卡一个观察器，命中后一次性播放（mo-reveal 入场 + 进度条 scaleX 生长） */
const uid = `dc${Math.random().toString(36).slice(2, 8)}`
const shown = useReveal(uid)
</script>

<template>
  <view :id="uid" class="dimcard card" :class="shown ? 'mo-reveal is-in' : 'mo-reveal'">
    <view class="row gap8">
      <XGraphic :name="graphic" :size="30" />
      <text class="t-md flex1">{{ dim?.name || code }}</text>
      <view class="col" style="align-items: flex-end">
        <view class="row gap4" style="align-items: baseline">
          <text class="num bold dim-score">{{ score ?? '—' }}</text>
          <text v-if="score != null" class="t-xs c3">分</text>
        </view>
      </view>
    </view>
    <view class="meter">
      <view class="bar" :class="[shown ? 'mo-grow-x is-in' : 'mo-grow-x']" :style="{ background: grade.meter }" />
    </view>
    <text class="t-xs verdict" :class="`v-${grade.tone}`">{{ grade.text }}</text>
  </view>
</template>

<style scoped lang="scss">
.dimcard {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dim-score {
  font-size: 24px;
  line-height: 1.1;
}
/* 轨道固定高度，进度条 scaleX 生长（不动 width），transform-origin 左侧 */
.meter {
  height: 6px;
  border-radius: 3px;
  background: var(--line-2, #e5ddd2);
  overflow: hidden;
}
.bar {
  height: 100%;
  width: 100%;
  transform-origin: left center;
  border-radius: 3px;
}
/* 结论色与进度条同源（ok/near/low），none 态用弱化灰 */
.verdict.v-ok {
  color: var(--meter-ok);
}
.verdict.v-near {
  color: var(--meter-near);
}
.verdict.v-low {
  color: var(--meter-low);
}
.verdict.v-none {
  color: var(--ink-3, #8d8479);
}
/* 乐龄下卡片内字号放大（继承变量驱动，不写皮肤选择器） */
.elder .dim-score {
  font-size: 28px;
}
</style>
