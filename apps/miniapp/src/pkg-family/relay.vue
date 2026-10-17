<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import XMascot from '@/components/XMascot.vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go, toast } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '健康接力棒' } })

/** /app/family/relay 契约（XJ-304 交付）：未绑定 → { bound:false }（D3：走引导空状态） */
interface WeekCell { date: string, label: string, state: 'passed' | 'today' | 'rest' | 'future' }
interface RelayData {
  bound: boolean
  peer?: { id: number, name: string, relation: string, myRole: 'elder' | 'family' }
  streak?: number
  totalDays?: number
  todayPassed?: boolean
  myPassedToday?: boolean
  week?: WeekCell[]
  rule?: string
}

/** 副标称呼按家人关系生成（docs/07 §3.2「我 +5 · 女儿 +5」）；与 pkg-family/list 的 REL 同源，口语化取值 */
const REL: Record<string, string> = { daughter: '女儿', son: '儿子', spouse: '爱人', other: '家人' }

const xj = useXj()
const d = ref<RelayData | null>(null)
const passing = ref(false)
const justPopped = ref(false)

const peerName = computed(() => d.value?.peer?.name || '家人')
const peerRel = computed(() => REL[d.value?.peer?.relation || 'other'] || '家人')
const week = computed(() => d.value?.week ?? [])
/** 连续 0 天 = 尚未开始；文案给「第一棒」引导而非「断了」（AC#3：无惩罚性文案） */
const streakHint = computed(() => (d.value?.streak ?? 0) > 0 ? `已连续互相接棒 ${d.value!.streak} 天` : '接出第一棒，开始你们的健康接力')

async function load() {
  d.value = await http.get<RelayData>('/app/family/relay')
}
onShow(load)

/** 接棒：成功后立即重拉（双方积分与今日格子即时刷新）；当天任一方已接时后端事务内拒绝并 toast（AC#1/#2 双保险） */
async function pass() {
  if (passing.value)
    return
  if (d.value?.todayPassed) {
    toast('今天已经接过棒啦，明天再来')
    return
  }
  passing.value = true
  try {
    await http.post('/app/family/relay/pass')
    toast('接棒成功，你们各得 5 积分')
    await load()
    justPopped.value = xj.moTier !== 'off'
  }
  finally {
    passing.value = false
  }
}
</script>

<template>
  <view :class="xj.pageClass">
    <XNav show-back title="健康接力棒" />
    <view v-if="d" class="stack" style="padding-top: 12px">
      <!-- 未绑定家人：引导去绑定的空状态（D3：不展示任何接力内容） -->
      <view v-if="!d.bound" class="card raised col empty mo-rise mo-d1">
        <XMascot :size="88" tone="care" />
        <text class="t-lg">还没有一起接力的家人</text>
        <text class="t-sm c2 ta-c">绑定家人后，每天互相接棒打卡，你们各得 5 积分</text>
        <view class="btn" hover-class="mo-press-active" @click="go('/pkg-family/list')">
          去绑定家人
        </view>
      </view>

      <template v-else>
        <!-- ① 接力状态卡：墨绿渐变白字（乐龄自动转养生绿），连续天数 + 累计 + 今日待接状态 -->
        <view class="hero mo-rise mo-d1">
          <text class="t-title">你和{{ peerName }}的接力</text>
          <text class="t-sm hero-sub">{{ streakHint }}</text>
          <view class="row gap16 hero-nums">
            <view class="col">
              <text class="hero-num num">{{ d.streak }}</text>
              <text class="hero-cap">连续天数</text>
            </view>
            <view class="hero-sep" />
            <view class="col">
              <text class="hero-num num">{{ d.totalDays }}</text>
              <text class="hero-cap">累计接力</text>
            </view>
            <view class="flex1" />
            <text class="hero-tag" :class="{ done: d.todayPassed }">{{ d.todayPassed ? '今日已接棒' : '今日待接棒' }}</text>
          </view>
        </view>

        <!-- ② 接力环：左「我」+ 虚线 + 握手徽标 + 虚线 + 右家人（头像用 XMascot 合成，禁图片资源） -->
        <view class="card raised mo-rise mo-d2 ring">
          <view class="col gap4 ring-side">
            <XMascot :size="64" tone="gold" />
            <text class="t-sm semi">我</text>
          </view>
          <view class="dash" />
          <view class="col center gap4 ring-mid">
            <view class="handshake" :class="{ 'mo-pop': justPopped }">
              <XIcon name="heart-handshake" :size="24" color="var(--on-brand)" />
            </view>
            <text class="t-xs c3">{{ d.todayPassed ? '今日已接棒' : '等待接棒' }}</text>
          </view>
          <view class="dash" />
          <view class="col ring-side gap4">
            <XMascot :size="64" tone="care" />
            <text class="t-sm semi">{{ peerName }}</text>
          </view>
        </view>

        <!-- ③ 规则说明：接口 rule + 休息日口径（AC#3：不出现「漏/断/惩罚」字样） -->
        <view class="card hint rule mo-rise mo-d3">
          <view class="row gap8">
            <XIcon name="info-circle" :size="18" color="var(--warn-ink)" />
            <text class="t-sm semi">接力规则</text>
          </view>
          <text class="t-sm">{{ d.rule }}</text>
          <text class="t-sm">没接棒的日子算休息日，不打紧，随时可以重新出发</text>
        </view>

        <!-- ④ 本周接力：7 格（周一起）；已接 = 墨绿✓；休息 = 灰「休」；今日 = 虚线描边「今」；未来 = 空格 -->
        <view class="card raised mo-rise mo-d3 week">
          <text class="t-md semi">本周接力</text>
          <view class="row week-grid">
            <view v-for="w in week" :key="w.date" class="col center gap6 week-cell">
              <view class="week-dot" :class="w.state">
                <XIcon v-if="w.state === 'passed'" name="check" :size="16" color="#fff" />
                <text v-else-if="w.state === 'rest'" class="week-txt rest">休</text>
                <text v-else-if="w.state === 'today'" class="week-txt today">今</text>
              </view>
              <text class="t-xs c3 num">{{ w.label }}</text>
            </view>
          </view>
          <view class="row gap12 wrap week-legend">
            <text class="t-xs c3">✓ 已接棒</text>
            <text class="t-xs c3">休 休息日</text>
            <text class="t-xs c3">今 待接棒</text>
          </view>
        </view>

        <!-- ⑤ 主按钮：金色渐变「接棒打卡」+ 副标「我 +5 · 女儿 +5」；今日已接 → 完成态（点击仍给友好提示） -->
        <view v-if="!d.todayPassed" class="col center gap6 mo-rise mo-d4">
          <view class="btn act" hover-class="mo-press-active" @click="pass">
            接棒打卡
          </view>
          <text class="t-sm c2">我 +5 · {{ peerRel }} +5</text>
        </view>
        <view v-else class="col center gap6 mo-rise mo-d4">
          <view class="btn disabled act" @click="pass">
            今日已接棒，明天再来
          </view>
          <text class="t-sm c2">你们今天各得 5 积分，已入账</text>
        </view>
      </template>
    </view>

    <!-- UnoCSS safelist 字面量登记：heart-handshake 不在 uno.config.ts safelist 内（该文件不在本卡
         files_own），按 uno.config 注释允许的方式在页面内写字面量类名，让 UnoCSS 扫描进包 -->
    <view class="uno-keep i-tabler-heart-handshake" />
  </view>
</template>

<style scoped>
/* ── ① 状态卡：墨绿渐变（--care 乐龄自动转养生绿；夜色金皮肤白字 4.81:1 达标） ── */
.hero {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 16px;
  border-radius: var(--r-card);
  background: linear-gradient(150deg, var(--care) 0%, var(--care-dark) 100%);
  color: #fff;
}
.hero-sub {
  opacity: 0.85;
}
.hero-nums {
  margin-top: 4px;
}
.hero-num {
  font-size: var(--fs-hero);
  font-weight: 700;
  font-family: var(--font-title);
  line-height: 1.2;
}
.hero-cap {
  font-size: var(--fs-xs);
  opacity: 0.8;
}
.hero-sep {
  width: 1px;
  height: 34px;
  background: rgba(255, 255, 255, 0.35);
}
.hero-tag {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1.5px dashed rgba(255, 255, 255, 0.9);
  font-size: var(--fs-xs);
  font-weight: 600;
}
.hero-tag.done {
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.16);
}
/* ── ② 接力环 ── */
.ring {
  display: flex;
  align-items: center;
  padding: 18px 12px;
}
.ring-side {
  align-items: center;
}
.ring-mid {
  gap: 6px;
}
.dash {
  flex: 1;
  height: 0;
  border-top: 2px dashed var(--care-line);
  margin: 0 4px;
}
.handshake {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--brand-hi) 0%, var(--brand) 55%, var(--brand-dark) 100%);
  box-shadow: 0 6px 14px -6px rgba(168, 130, 77, 0.55);
}
/* ── ③ 规则说明 ── */
.rule {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
/* ── ④ 本周 7 格 ── */
.week {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.week-grid {
  gap: 4px;
}
.week-cell {
  flex: 1;
  min-width: 0;
}
.week-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.week-dot.passed {
  background: var(--care);
}
.week-dot.rest {
  background: var(--placeholder);
}
.week-dot.today {
  border: 2px dashed var(--brand);
  background: var(--brand-soft);
}
.week-dot.future {
  border: 1px solid var(--line-2);
}
.week-txt {
  font-size: var(--fs-sm);
  font-weight: 600;
  line-height: 1;
}
.week-txt.rest {
  color: var(--ink-3);
}
.week-txt.today {
  color: var(--brand-ink);
}
.week-legend {
  color: var(--ink-3);
}
/* ── ⑤ 主按钮 ── */
.act {
  width: 100%;
}
/* ── 空状态 ── */
.empty {
  align-items: center;
  gap: 12px;
  padding: 36px 20px 28px;
}
.ta-c {
  text-align: center;
}
.uno-keep {
  display: none;
}
</style>
