<script lang="ts" setup>
import { computed } from 'vue'
import { toast } from '@/xj/utils'

/**
 * 签到月历（XJ-401，docs/07 §3.1）。
 * 四态：已签 = 金底实心圆；今日 = 白底金描边；过去未签 = 灰底；未来 = 浅灰。
 * 点击走事件委托（容器单个 @tap + dataset），不为每个日期绑独立 handler（性能硬约束）。
 * 点过去未签日只提示「从今天继续」，不做中断惩罚（D8：健康产品不做焦虑驱动）。
 */
const props = defineProps<{
  /** 已签日期（YYYY-MM-DD，来自 /app/checkins 的 monthSignedDates） */
  signed: string[]
  /** 月历月份（YYYY-MM），默认当月 */
  month?: string
}>()

const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const ym = computed(() => props.month || today.slice(0, 7))
const WEEKS = ['一', '二', '三', '四', '五', '六', '日']

const cells = computed(() => {
  const [y, m] = ym.value.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7 // 周一开头，与六维周报口径一致
  const signedSet = new Set(props.signed)
  const list: { key: string, date?: string, label?: number, state?: string }[] = []
  for (let i = 0; i < lead; i++) list.push({ key: `blank${i}` })
  for (let d = 1; d <= days; d++) {
    const date = `${ym.value}-${pad(d)}`
    const state = signedSet.has(date) ? 'signed' : date === today ? 'today' : date < today ? 'miss' : 'future'
    list.push({ key: date, date, label: d, state })
  }
  return list
})

const monthCount = computed(() => props.signed.filter(s => s.startsWith(ym.value)).length)

function onTap(e: any) {
  const date = e?.target?.dataset?.date
  if (!date || date >= today)
    return
  toast('漏签不焦虑，从今天继续就好')
}
</script>

<template>
  <view class="cal">
    <view class="row-between">
      <text class="t-md semi">{{ ym.replace('-', ' 年 ') }} 月</text>
      <text class="t-sm c2">本月已签 {{ monthCount }} 天</text>
    </view>
    <view class="cal-grid" @tap="onTap">
      <view v-for="w in WEEKS" :key="w" class="cal-week t-xs c3">
        {{ w }}
      </view>
      <view v-for="c in cells" :key="c.key" class="cal-cell" :data-date="c.date">
        <view v-if="c.label" class="cal-dot" :class="`s-${c.state}`">
          {{ c.label }}
        </view>
      </view>
    </view>
    <view class="row gap12" style="margin-top: 10px">
      <view class="row gap4">
        <view class="lg-dot s-signed" /><text class="t-xs c3">已签</text>
      </view>
      <view class="row gap4">
        <view class="lg-dot s-today" /><text class="t-xs c3">今天</text>
      </view>
      <view class="row gap4">
        <view class="lg-dot s-miss" /><text class="t-xs c3">过去未签</text>
      </view>
      <view class="row gap4">
        <view class="lg-dot s-future" /><text class="t-xs c3">未来</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.cal-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 6px;
}
.cal-week {
  text-align: center;
  padding-bottom: 2px;
}
.cal-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
}
/* 四态：金底实心 / 白底金描边 / 灰底 / 浅灰字；全部走继承令牌，不写皮肤选择器 */
.cal-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  line-height: 1;
}
.cal-dot.s-signed {
  background: linear-gradient(135deg, var(--gold), var(--brand-dark));
  color: var(--on-brand);
  font-weight: 700;
}
.cal-dot.s-today {
  background: var(--surface);
  border: 2px solid var(--brand-dark);
  color: var(--brand-ink);
  font-weight: 600;
  box-sizing: border-box;
}
.cal-dot.s-miss {
  background: var(--line);
  color: var(--ink-3);
}
.cal-dot.s-future {
  color: var(--ink-3);
  opacity: 0.6;
}
.lg-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.lg-dot.s-signed {
  background: linear-gradient(135deg, var(--gold), var(--brand-dark));
}
.lg-dot.s-today {
  background: var(--surface);
  border: 2px solid var(--brand-dark);
  box-sizing: border-box;
}
.lg-dot.s-miss {
  background: var(--line);
}
.lg-dot.s-future {
  background: var(--line);
  opacity: 0.5;
}
</style>
