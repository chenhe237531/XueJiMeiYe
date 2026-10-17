<script setup lang="ts">
/**
 * HomeSignin · 首页连续签到激活条（XJ-201 / docs/06 §3.1 / docs/07 §4.2）
 *
 * 金色渐变底：左「已连续签到 N 天」大数字，右「本月已签 M 天」；
 * 未签今日时右侧显示「去签到」按钮，已签显示「今日已签 ✓」。
 * 漏签（streak 归零）只显示「从今天继续」——无倒计时、无催促文案（健康产品不做焦虑驱动）。
 *
 * 数据源：GET /app/checkins（XJ-302 扩展字段 streakDays / monthSignedDates），
 * 组件内自取（首页 /app/home 不含签到数据）；onShow 自动刷新（签到回来状态回写）。
 *
 * 动效：入场 mo-rise（档位自动降级）；按压走 hover-class="mo-press-active"。
 * 组件内不写皮肤选择器，颜色全部读令牌（金渐变底用 --brand 族，乐龄自动变墨绿）。
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { http } from '@/xj/request'
import { go } from '@/xj/utils'

const props = defineProps<{ night?: boolean }>()

const streak = ref(0)
const monthCount = ref(0)
const signedToday = ref(false)
const loaded = ref(false)

async function load() {
  try {
    const res = await http.get('/app/checkins', undefined, { silent: true })
    streak.value = res?.streakDays ?? res?.streak ?? 0
    const dates: string[] = res?.monthSignedDates || []
    monthCount.value = dates.length
    signedToday.value = (res?.today || []).length > 0 || dates.includes(todayStr())
    loaded.value = true
  }
  catch {
    // 静默失败：激活条保持初始态，不打扰首页主内容
    loaded.value = true
  }
}

function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

onShow(() => {
  load()
})

/** 漏签后回归：连续天数归零时不说「断了」，说「从今天继续」 */
const streakText = computed(() => (streak.value > 0 ? `已连续签到` : `从今天继续`))
const monthText = computed(() => `本月已签 ${monthCount.value} 天`)
</script>

<template>
  <view
    class="signin-bar mo-rise"
    hover-class="mo-press-active"
    :hover-stay-time="80"
    @click="go('/pkg-points/checkin')"
  >
    <view class="row gap8" style="align-items: baseline">
      <text class="num bold days">{{ streak }}</text>
      <view class="col gap2">
        <text class="lbl">{{ streakText }}</text>
        <text class="lbl-sub">{{ monthText }}</text>
      </view>
    </view>
    <view class="cta" :class="{ done: signedToday }">
      <text>{{ signedToday ? '今日已签 ✓' : '去签到' }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* 金色渐变底：默认柔金（--brand 族令牌），乐龄自动变墨绿、夜色变金（令牌继承，组件内不写皮肤选择器） */
.signin-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 16px;
  padding: 14px 16px;
  background: linear-gradient(135deg, var(--brand-hi) 0%, var(--brand) 55%, var(--brand-dark) 100%);
  color: var(--on-brand);
  box-shadow: 0 8px 18px -10px rgba(168, 130, 77, 0.5);
}
.days {
  font-size: 40px;
  line-height: 1;
  letter-spacing: -0.02em;
}
.lbl {
  font-size: var(--fs-body);
  font-weight: 600;
  line-height: 1.3;
}
.lbl-sub {
  font-size: var(--fs-xs);
  opacity: 0.85;
  line-height: 1.3;
}
.cta {
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--brand-ink);
  font-size: var(--fs-sm);
  font-weight: 700;
  white-space: nowrap;
}
.cta.done {
  background: rgba(255, 255, 255, 0.28);
  color: var(--on-brand);
}
</style>
