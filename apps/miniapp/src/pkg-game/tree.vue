<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '种健康树' } })

const xj = useXj()
const d = ref<any>(null)
const watering = ref(false)

const STAGES = ['🌰', '🌱', '🌿', '🌲', '🌳']

async function load() {
  d.value = await http.get('/app/games/tree', undefined, { silent: true })
}
onLoad(load)

async function water() {
  if (watering.value) return
  watering.value = true
  try {
    d.value = { ...d.value, ...(await http.post('/app/games/tree/water', { drops: 1 }, { silent: true })) }
  }
  catch (e: any) {
    toast(e?.message || '浇水失败')
  }
  finally {
    setTimeout(() => { watering.value = false; load() }, 400)
  }
}

async function claim(source: 'checkin' | 'quiz') {
  try {
    const r = await http.post('/app/games/tree/claim', { source }, { silent: true })
    toast(source === 'checkin' ? '领到 2 滴水啦' : '领到 1 滴水啦')
    d.value.drops = r.drops
    load()
  }
  catch (e: any) {
    toast(e?.message || '先完成任务再来领水滴')
    if (source === 'checkin') go('/pkg-points/checkin')
    else go('/pkg-game/quiz')
  }
}

function redeem() {
  uni.showModal({
    title: '兑换奖励',
    content: `健康树长成啦，兑换 ${d.value.redeemPoints} 积分（计入健康存折），再种一棵新的？`,
    confirmColor: '#6B4E2E',
    success: async (r) => {
      if (!r.confirm) return
      const res = await http.post('/app/games/tree/redeem', {}, { loading: '兑换中' })
      toast(`+${res.points} 积分已入账`)
      load()
    },
  })
}
</script>

<template>
  <view v-if="d" :class="xj.pageClass">
    <view class="card stack">
      <view class="col gap8" style="align-items: center; padding: 8px 0">
        <text class="tree-emoji" :class="[`s${d.stage}`, { bounce: watering }]">{{ STAGES[d.stage] }}</text>
        <text class="t-md semi">{{ d.stageNames[d.stage] }}（{{ d.stage + 1 }} / 5）</text>
        <view class="bar"><view class="bar-in" :style="{ width: `${Math.round((d.watered % d.stageDrops) / d.stageDrops * 100)}%` }" /></view>
        <text class="t-sm c2">{{ d.stage < 4 ? `再浇 ${d.stageDrops - d.watered % d.stageDrops} 滴水到「${d.stageNames[d.stage + 1]}」` : '树已长成，可以兑换奖励啦' }}</text>
      </view>
      <view class="row gap12">
        <view class="btn flex1" @click="water">
          <text class="drop-anim" :class="{ on: watering }">💧</text>
          <text>浇 1 滴（余 {{ d.drops }}）</text>
        </view>
        <view v-if="d.stage >= 4" class="btn gold flex1" @click="redeem">兑换 {{ d.redeemPoints }} 积分</view>
      </view>
    </view>

    <view class="card stack">
      <text class="t-lg">今日可得水滴</text>
      <view class="claim row-between" @click="claim('checkin')">
        <view class="row gap8"><XIcon name="calendar-check" :size="22" /><text class="t-md">完成每日打卡</text></view>
        <text class="claim-btn" :class="{ off: !d.canClaim.checkin }">{{ d.canClaim.checkin ? '领 2 滴' : '已领取' }}</text>
      </view>
      <view class="claim row-between" @click="claim('quiz')">
        <view class="row gap8"><XIcon name="bulb" :size="22" /><text class="t-md">答健康问答（每题 1 滴）</text></view>
        <text class="claim-btn" :class="{ off: !d.canClaim.quizCount }">{{ d.canClaim.quizCount ? `领 ${d.canClaim.quizCount} 滴` : '已领完' }}</text>
      </view>
      <text class="t-xs c3">水滴通过打卡、答题获得，每天各限一次；树长成兑换后重新种一棵。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.tree-emoji { font-size: 72px; line-height: 1.15; transition: transform 0.3s; }
.tree-emoji.s4 { font-size: 84px; }
.tree-emoji.bounce { animation: tree-bounce 0.4s ease; }
@keyframes tree-bounce { 0% { transform: scale(1); } 40% { transform: scale(1.12) rotate(-2deg); } 100% { transform: scale(1); } }
.bar { width: 100%; height: 10px; border-radius: 5px; background: var(--placeholder); overflow: hidden; }
.bar-in { height: 100%; border-radius: 5px; background: linear-gradient(90deg, var(--care-soft), var(--care)); transition: width 0.3s; }
.claim { padding: 14px 0; border-top: 1px solid var(--line); }
.claim-btn { padding: 6px 16px; border-radius: 18px; background: var(--brand); color: var(--on-brand); font-size: var(--fs-sm); font-weight: 600; min-width: 72px; text-align: center; }
.claim-btn.off { background: var(--placeholder); color: var(--ink-3); }
.drop-anim { display: inline-block; }
.drop-anim.on { animation: drop-fall 0.4s ease-in; }
@keyframes drop-fall { 0% { transform: translateY(-6px); opacity: 1; } 100% { transform: translateY(4px); opacity: 0; } }
</style>
