<script lang="ts" setup>
import { ref } from 'vue'
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
      <text class="section-title">可以兑换</text>
      <view class="group">
        <view v-for="it in d.items" :key="it.code" class="cell">
          <text class="flex1 t-md">{{ it.name }}</text>
          <text class="t-sm c2 num">{{ it.points }} 积分</text>
          <view class="mini" :class="{ on: d.balance >= it.points }" @click="redeem(it)">兑换</view>
        </view>
      </view>
      <text class="section-title">收支明细</text>
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
.book { background: linear-gradient(160deg, #ffe14d, #ffc300); color: var(--on-brand); border-radius: 20px; padding: 18px; display: flex; flex-direction: column; gap: 4px; }
.mini { height: 32px; padding: 0 14px; border-radius: 16px; background: #efeaec; color: #786e74; display: flex; align-items: center; font-size: 13px; margin-left: 8px; }
.mini.on { background: var(--brand); color: var(--on-brand); }
.lrow { display: flex; gap: 8px; padding: 8px 0; border-top: 1px dashed var(--line-2); font-size: var(--fs-sm); }
.lrow.head { border-top: 0; color: var(--ink-3); }
.d { width: 52px; }
.n { width: 56px; text-align: right; }
</style>
