<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import XTrendChart from '@/components/chart/XTrendChart.vue'
import XIcon from '@/components/XIcon.vue'
import { syncMotion } from '@/xj/motion'
import type { MoTier } from '@/xj/motion'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { confirm, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '健康存折' } })

const xj = useXj()
/**
 * 动效档位（XJ-707）：乐龄强制 off（docs/08 §7 无障碍护栏），档位 class 落本页根节点，
 * mo-rise 入场与进度类动效随 --mo-* 变量降级；数据呈现不依赖动画完成。
 */
const mo = ref<MoTier>(syncMotion(xj.elderMode))
watch(() => xj.elderMode, v => (mo.value = syncMotion(v)))

const d = ref<any>(null)
async function load() { d.value = await http.get('/app/points') }
onShow(load)

/** 画布宽：与档案页趋势图同款算法（页边距 + 卡片留白） */
const chartW = (uni.getSystemInfoSync().windowWidth || 375) - 48

/** 余额趋势（XJ-707）：最近 14 条流水按时间正序，与收支明细同源，天然一致 */
const trend = computed(() => (d.value?.ledger || []).slice(0, 14).reverse().map((l: any) => ({ label: String(l.at).slice(5), value: l.balanceAfter })))

/** 来源名 → 展示（图标全部在 uno safelist 内） */
const SOURCES: Record<string, { icon: string, name: string }> = {
  checkin: { icon: 'calendar-check', name: '每日打卡' },
  quiz: { icon: 'bulb', name: '健康问答' },
  visit: { icon: 'map-pin', name: '到店护理' },
  assessment_level: { icon: 'hexagon', name: '六维测评' },
  assessment_complete: { icon: 'hexagon', name: '六维测评' },
  wheel_win: { icon: 'refresh', name: '积分转盘' },
  match3: { icon: 'grid-dots', name: '消消乐' },
  game_tree: { icon: 'plant', name: '健康树' },
  box_win: { icon: 'gift', name: '健康盲盒' },
  relay: { icon: 'users', name: '健康接力' },
}
/** 积分获取来源分组（XJ-707）：正收入按来源汇总次数与总分，从流水直接归并 */
const sources = computed(() => {
  const m: Record<string, { name: string, icon: string, count: number, sum: number }> = {}
  for (const l of (d.value?.ledger || [])) {
    if (!(l.change > 0))
      continue
    const s = SOURCES[l.reasonCode] || { icon: 'coins', name: '其他' }
    m[s.name] = m[s.name] || { ...s, count: 0, sum: 0 }
    m[s.name].count++
    m[s.name].sum += l.change
  }
  return Object.values(m).sort((a, b) => b.sum - a.sum)
})

async function redeem(it: any) {
  if (d.value.balance < it.points)
    return toast('积分不够哦，继续打卡和测评可以攒积分')
  if (!(await confirm('确认兑换', `用 ${it.points} 积分兑换「${it.name}」`, '确认兑换')))
    return
  await http.post('/app/points/redeem', { code: it.code })
  toast('兑换成功，顾问会联系您安排')
  load()
}
</script>

<template>
  <view :class="[xj.pageClass, `mo-${mo}`]">
    <view v-if="!d" class="page-loading col gap12">
      <view class="gd-spin spin-ring" />
      <text class="t-sm c2">加载中…</text>
    </view>
    <view v-else class="stack" style="padding-top: 12px">
      <view class="book mo-rise mo-d1">
        <view class="row-between">
          <text class="t-md">雪姬美业 · 健康存折</text><text class="t-xs">户名：{{ xj.me?.salutation }}</text>
        </view>
        <view class="row gap8" style="align-items: baseline; margin-top: 12px">
          <text class="num bold" style="font-size: 40px">{{ d.balance }}</text><text>积分</text>
        </view>
        <text class="t-xs" style="opacity: 0.85">积分获得后 12 个月内有效；不能兑换现金；授权和分享不发积分</text>
      </view>
      <view class="section-title">
        <text>积分趋势</text>
      </view>
      <view class="card raised stack mo-rise mo-d2">
        <text class="t-xs c3">最近 {{ trend.length }} 条流水的余额走向，与收支明细同一份数据</text>
        <XTrendChart v-if="trend.length > 1" :series="trend" :width="chartW" :height="112" unit="分" />
        <text v-else class="t-sm c2" style="text-align: center; padding: 10px 0">记录还少，攒几条流水就能看到余额走向</text>
      </view>
      <view class="section-title">
        <text>可以兑换</text>
      </view>
      <view class="group">
        <view v-for="(it, k) in d.items" :key="it.code" class="cell">
          <view class="icon-box" :class="['', 'rose', 'sky', 'plum', 'terra'][Number(k) % 5]">
            <XIcon name="gift" />
          </view>
          <text class="flex1 t-md">{{ it.name }}</text>
          <text class="t-sm c2 num">{{ it.points }} 积分</text>
          <view class="mini mo-press" :class="{ on: d.balance >= it.points }" hover-class="mo-press-active" :hover-stay-time="80" @click="redeem(it)">
            兑换
          </view>
        </view>
      </view>
      <view class="section-title">
        <text>积分都从哪来</text>
      </view>
      <view v-if="sources.length" class="card raised stack mo-rise mo-d3">
        <view v-for="s in sources" :key="s.name" class="src row gap8">
          <view class="icon-box sm">
            <XIcon :name="s.icon" :size="16" />
          </view>
          <text class="t-sm flex1">{{ s.name }}</text>
          <text class="t-xs c3 num">{{ s.count }} 次</text>
          <text class="t-sm c-care semi num">+{{ s.sum }}</text>
        </view>
      </view>
      <text v-else class="t-sm c2" style="text-align: center; padding: 8px 0">还没有积分收入，做完今日三件事就有了</text>
      <view class="section-title">
        <text>收支明细</text>
      </view>
      <view class="ledger card mo-rise mo-d4">
        <view class="lrow head">
          <text class="d">日期</text><text class="flex1">摘要</text><text class="n">收支</text><text class="n">余额</text>
        </view>
        <view v-for="l in d.ledger" :key="l.id" class="lrow">
          <text class="d num">{{ l.at.slice(5) }}</text>
          <text class="flex1">{{ l.note || l.reasonCode }}</text>
          <text class="n num" :class="l.change > 0 ? 'c-care' : 'c-brand'">{{ l.change > 0 ? '+' : '' }}{{ l.change }}</text>
          <text class="n num">{{ l.balanceAfter }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.book {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #e3cdb0 0%, #c9a063 48%, #a8824d 100%);
  color: var(--on-brand);
  border-radius: 20px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 10px 24px -12px rgba(168, 130, 77, 0.5);
}
/* 存折纸纹：右上柔光 + 底部细线，和"我的"页存折卡同一套金色 */
.book::after {
  content: '';
  position: absolute;
  right: -28px;
  top: -36px;
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  pointer-events: none;
}
.book::before {
  content: '';
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 44px;
  border-top: 1px dashed rgba(43, 38, 34, 0.18);
}
.mini {
  height: 32px;
  padding: 0 14px;
  border-radius: 16px;
  background: #efeaec;
  color: #786e74;
  display: flex;
  align-items: center;
  font-size: 13px;
  margin-left: 8px;
}
.mini.on {
  background: linear-gradient(135deg, var(--brand-hi), var(--brand-dark));
  color: var(--on-brand);
  font-weight: 600;
  box-shadow: 0 4px 10px -4px rgba(168, 130, 77, 0.6);
}
.lrow {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px dashed var(--line-2);
  font-size: var(--fs-sm);
}
.lrow.head {
  border-top: 0;
  color: var(--ink-3);
}
.d {
  width: 52px;
}
.n {
  width: 56px;
  text-align: right;
}
/* 加载态（docs/09 §3.6）：功能性加载环，mo-off 下静止为静态环仍可识别 */
.page-loading {
  padding: 64px 0;
  align-items: center;
  justify-content: center;
}
.spin-ring {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid var(--line-2);
  border-top-color: var(--brand);
  box-sizing: border-box;
}
.src {
  min-height: 42px;
}
</style>
