<script setup lang="ts">
/**
 * HomeTasks · 首页「今日 3 件事」任务卡（XJ-201 / docs/06 §3.1 / D1）
 *
 * 数据由后端动态生成（XJ-305）：/app/home 的 taskList 组件下发
 *   tasks: [{ code, icon(D15 语义枚举), title, sub, target, current, link, points }]
 *   doneToday: 今日已完成动作的 code 列表（计入进度，不再展示）
 * 组件只消费 props，不自行发请求（保持可复用与可测）。
 *
 * D15 语义枚举 → tabler 图标映射（XJ-602 会固定为全站映射层，这里先内联一份最小映射）：
 *   skin/body/mind/assess/checkup/plan/checkin → 均在 uno safelist 内
 *
 * 动效：整卡 mo-rise；行内错峰 mo-d1~d3；进度环为 conic-gradient 静态渲染
 *（数据驱动、无过渡动画，符合「只动 transform / opacity」）；按压 hover-class。
 * 完成项降级：灰字 + ✓，图标去色。
 * 无倒计时、无催促文案；完成即时的正反馈由目标页自己给（本卡只做状态呈现）。
 */
import { computed } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { go } from '@/xj/utils'

interface TaskItem {
  code: string
  icon?: string
  title: string
  sub?: string
  target?: number
  current?: number
  link?: string
  points?: number | null
}

const props = withDefaults(defineProps<{
  title?: string
  tasks?: TaskItem[]
  doneToday?: string[]
}>(), {
  title: '今日 3 件事',
  tasks: () => [],
  doneToday: () => [],
})

/** D15 语义枚举 → tabler 图标名（XJ-602 收敛前的最小映射，全部在 safelist） */
const ICON_MAP: Record<string, string> = {
  skin: 'droplet',
  body: 'run',
  mind: 'mood-smile',
  assess: 'hexagon',
  checkup: 'ticket',
  plan: 'clipboard-heart',
  checkin: 'calendar-check',
}
const FALLBACK_ICON = 'circle-check'

interface Row extends TaskItem {
  iconResolved: string
  done: boolean
  pct: number
  progressLabel: string
}

const rows = computed<Row[]>(() => (props.tasks || []).map((t) => {
  const done = (props.doneToday || []).includes(t.code) || (t.target != null && t.current != null && t.current >= t.target)
  const target = t.target ?? 1
  const current = Math.min(t.current ?? 0, target)
  const pct = target > 0 ? Math.round((current / target) * 100) : 0
  const progressLabel = target > 1 ? `${current}/${target}` : ''
  return { ...t, iconResolved: ICON_MAP[t.icon || ''] || FALLBACK_ICON, done, pct, progressLabel }
}))

/** 已完成数（含后端剔除进 doneToday 的动作），供标题右侧进度提示 */
const doneCount = computed(() => rows.value.filter(r => r.done).length + (props.doneToday || []).length)

function open(t: Row) {
  if (t.link)
    go(t.link)
}
</script>

<template>
  <view class="tasks card mo-rise">
    <view class="row-between">
      <text class="t-lg">{{ title }}</text>
      <text class="t-sm c3">{{ doneCount }}/{{ rows.length }} 完成</text>
    </view>
    <view
      v-for="(t, i) in rows"
      :key="t.code"
      class="task row gap12"
      :class="[`mo-d${Math.min(i + 1, 3)}`, { done: t.done }]"
      hover-class="mo-press-active"
      :hover-stay-time="80"
      @click="open(t)"
    >
      <view class="ring" :class="{ done: t.done }" :style="{ '--p': `${t.pct}` }">
        <text v-if="t.done" class="ring-check">✓</text>
        <template v-else>
          <text v-if="t.progressLabel" class="ring-n num">{{ t.progressLabel }}</text>
          <XIcon v-else :name="t.iconResolved" :size="16" />
        </template>
      </view>
      <view class="col flex1 gap2">
        <view class="row gap6">
          <text class="t-md semi task-title">{{ t.title }}</text>
          <text v-if="t.points" class="pts">+{{ t.points }}</text>
        </view>
        <text v-if="t.sub" class="t-xs c2 clamp1">{{ t.sub }}</text>
      </view>
      <XIcon v-if="!t.done" name="chevron-right" :size="18" color="#B0A6AC" />
    </view>
    <view v-if="!rows.length" class="t-sm c2" style="text-align: center; padding: 8px 0">
      今天的安排都完成了，明天见
    </view>
  </view>
</template>

<style scoped lang="scss">
.tasks {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.task {
  border-top: 1px solid var(--line);
  padding: 12px 0;
  min-height: 56px;
}
/* 进度环：conic-gradient 静态渲染（数据驱动无过渡），完成满环变绿 */
.ring {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: conic-gradient(var(--brand) calc(var(--p) * 1%), var(--line-2) 0);
  box-sizing: border-box;
}
.ring::before {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: var(--surface);
}
.ring-n,
.ring-check {
  position: relative;
  z-index: 1;
}
.ring-n {
  font-size: 11px;
  font-weight: 700;
  color: var(--brand-ink);
}
.ring-check {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}
.ring.done {
  background: var(--care);
}
/* 完成项降级：灰字 + 已满环 */
.task.done .task-title {
  color: var(--ink-3);
  font-weight: 500;
}
.task.done .pts {
  display: none;
}
.pts {
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--brand-soft);
  color: var(--brand-ink);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.5;
}
.clamp1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
