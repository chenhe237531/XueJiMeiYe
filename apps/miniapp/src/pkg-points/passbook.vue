<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { confirm, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '健康存折' } })

const xj = useXj()
const d = ref<any>(null)
async function load() { d.value = await http.get('/app/points') }
onShow(load)

async function redeem(it: any) {
  if (d.value.balance < it.points) return toast('积分不够哦，继续打卡和测评可以攒积分')
  if (!(await confirm('确认兑换', `用 ${it.points} 积分兑换「${it.name}」`, '确认兑换'))) return
  await http.post('/app/points/redeem', { code: it.code })
  toast('兑换成功，顾问会联系您安排')
  load()
}
</script>

<template>
  <view :class="xj.pageClass">
    <view v-if="d" class="stack" style="padding-top: 12px">
      <view class="book">
        <view class="row-between"><text class="t-md">雪姬美业 · 健康存折</text><text class="t-xs">户名：{{ xj.me?.salutation }}</text></view>
        <view class="row gap8" style="align-items: baseline; margin-top: 12px"><text class="num bold" style="font-size: 40px">{{ d.balance }}</text><text>积分</text></view>
        <text class="t-xs" style="opacity: 0.85">积分获得后 12 个月内有效；不能兑换现金；授权和分享不发积分</text>
      </view>
      <view class="section-title"><text>可以兑换</text></view>
      <view class="group">
        <view v-for="(it, k) in d.items" :key="it.code" class="cell">
          <view class="icon-box" :class="['', 'rose', 'sky', 'plum', 'terra'][Number(k) % 5]"><XIcon name="gift" /></view>
          <text class="flex1 t-md">{{ it.name }}</text>
          <text class="t-sm c2 num">{{ it.points }} 积分</text>
          <view class="mini" :class="{ on: d.balance >= it.points }" @click="redeem(it)">兑换</view>
        </view>
      </view>
      <view class="section-title"><text>收支明细</text></view>
      <view class="ledger card">
        <view class="lrow head"><text class="d">日期</text><text class="flex1">摘要</text><text class="n">收支</text><text class="n">余额</text></view>
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
.book { position: relative; overflow: hidden; background: linear-gradient(135deg, #e3cdb0 0%, #c9a063 48%, #a8824d 100%); color: var(--on-brand); border-radius: 20px; padding: 18px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 10px 24px -12px rgba(168, 130, 77, 0.5); }
/* 存折纸纹：右上柔光 + 底部细线，和"我的"页存折卡同一套金色 */
.book::after { content: ''; position: absolute; right: -28px; top: -36px; width: 130px; height: 130px; border-radius: 50%; background: rgba(255, 255, 255, 0.18); pointer-events: none; }
.book::before { content: ''; position: absolute; left: 18px; right: 18px; bottom: 44px; border-top: 1px dashed rgba(43, 38, 34, 0.18); }
.mini { height: 32px; padding: 0 14px; border-radius: 16px; background: #efeaec; color: #786e74; display: flex; align-items: center; font-size: 13px; margin-left: 8px; }
.mini.on { background: linear-gradient(135deg, var(--brand-hi), var(--brand-dark)); color: var(--on-brand); font-weight: 600; box-shadow: 0 4px 10px -4px rgba(168, 130, 77, 0.6); }
.lrow { display: flex; gap: 8px; padding: 8px 0; border-top: 1px dashed var(--line-2); font-size: var(--fs-sm); }
.lrow.head { border-top: 0; color: var(--ink-3); }
.d { width: 52px; }
.n { width: 56px; text-align: right; }
</style>
