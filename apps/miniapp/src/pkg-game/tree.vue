<script lang="ts" setup>
import { ref, watch } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { syncMotion } from '@/xj/motion'
import type { MoTier } from '@/xj/motion'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go, themeHex, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '种健康树' } })

const xj = useXj()
/** 动效档位（XJ-707）：档位 class 落本页根节点；浇水回弹与水滴动效在 mo-off 下不播，状态变化仍可见 */
const mo = ref<MoTier>(syncMotion(xj.elderMode))
watch(() => xj.elderMode, v => (mo.value = syncMotion(v)))

const d = ref<any>(null)
const watering = ref(false)
/** 兑换积分 +N 上浮（XJ-707）：600ms 上浮淡出；mo-off 不播，toast 已告知积分入账 */
const float = ref<{ id: number, text: string } | null>(null)
function popPoints(n?: number) {
  if (!n || n <= 0)
    return
  if (mo.value === 'off')
    return
  float.value = { id: Date.now(), text: `+${n}` }
  setTimeout(() => (float.value = null), 650)
}

const STAGES = ['🌰', '🌱', '🌿', '🌲', '🌳']

async function load() {
  d.value = await http.get('/app/games/tree', undefined, { silent: true })
}
onShow(load) // 从打卡 / 问答页回来时刷新可领水滴

async function water() {
  if (watering.value)
    return
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
  const can = source === 'checkin' ? d.value.canClaim.checkin : d.value.canClaim.quizCount > 0
  const claimed = source === 'checkin' ? d.value.claimed?.checkin : d.value.claimed?.quizAll
  if (!can) {
    if (claimed)
      return toast('今天的水滴已经领过啦，明天再来')
    return go(source === 'checkin' ? '/pkg-points/checkin' : '/pkg-game/quiz')
  }
  try {
    const r = await http.post('/app/games/tree/claim', { source }, { silent: true })
    toast(source === 'checkin' ? '领到 2 滴水啦' : '领到 1 滴水啦')
    d.value.drops = r.drops
    load()
  }
  catch (e: any) {
    toast(e?.message || '领取失败，稍后再试')
  }
}

function redeem() {
  uni.showModal({
    title: '兑换奖励',
    content: `健康树长成啦，兑换 ${d.value.redeemPoints} 积分（计入健康存折），再种一棵新的？`,
    confirmColor: themeHex().ink,
    success: async (r) => {
      if (!r.confirm)
        return
      const res = await http.post('/app/games/tree/redeem', {}, { loading: '兑换中' })
      toast(`+${res.points} 积分已入账`)
      popPoints(res.points)
      load()
    },
  })
}
</script>

<template>
  <view :class="[xj.pageClass, `mo-${mo}`]">
    <view v-if="!d" class="page-loading col gap12">
      <view class="gd-spin spin-ring" />
      <text class="t-sm c2">加载中…</text>
    </view>
    <template v-else>
      <view class="page-head">
        <view class="ph-deco i-tabler-plant" />
        <text class="ph-title">种健康树</text>
        <text class="ph-sub">打卡答题攒水滴，树长成兑换积分</text>
        <view class="ph-meta">
          <view><XIcon name="droplet" :size="14" />水滴 {{ d.drops }}</view>
          <view><XIcon name="plant" :size="14" />{{ d.stageNames[d.stage] }}</view>
        </view>
      </view>
      <view class="card raised stack mo-rise mo-d1 tree-card">
        <!-- 小场景：天空到草地渐变 + 土坡，树在中间生长 -->
        <view class="scene">
          <view class="sun" />
          <text class="tree-emoji" :class="[`s${d.stage}`, { bounce: watering && mo !== 'off' }]">{{ STAGES[d.stage] }}</text>
          <view class="soil" />
        </view>
        <view class="col gap8" style="align-items: center">
          <view class="timeline stages">
            <view v-for="(n, k) in d.stageNames" :key="k" class="tl-step" :class="{ on: k <= d.stage }">
              <view class="tl-dot" /><text>{{ n }}</text>
            </view>
          </view>
          <view class="bar">
            <view class="bar-in" :style="{ transform: `scaleX(${(d.watered % d.stageDrops) / d.stageDrops})` }" />
          </view>
          <text class="t-sm c2">{{ d.stage < 4 ? `再浇 ${d.stageDrops - d.watered % d.stageDrops} 滴水到「${d.stageNames[d.stage + 1]}」` : '树已长成，可以兑换奖励啦' }}</text>
        </view>
        <view class="row gap12">
          <view v-if="d.stage < 4" class="btn flex1 mo-press" :class="{ disabled: !d.drops }" hover-class="mo-press-active" :hover-stay-time="80" @click="water">
            <text class="drop-anim" :class="{ on: watering && mo !== 'off' }">💧</text>
            <text>浇 1 滴（余 {{ d.drops }}）</text>
          </view>
          <view v-if="d.stage >= 4" class="btn gold flex1 mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="redeem">
            兑换 {{ d.redeemPoints }} 积分
          </view>
          <view v-if="float" :key="float.id" class="float-plus" :class="{ anim: mo !== 'off' }">
            {{ float.text }}
          </view>
        </view>
      </view>

      <view class="card stack mo-rise mo-d2">
        <view class="section-title" style="margin-top: 0">
          <text>今日可得水滴</text>
        </view>
        <view class="claim row-between mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="claim('checkin')">
          <view class="row gap12">
            <view class="icon-box">
              <XIcon name="calendar-check" />
            </view><text class="t-md">完成每日打卡</text>
          </view>
          <text class="claim-btn" :class="{ off: !d.canClaim.checkin && d.claimed?.checkin, todo: !d.canClaim.checkin && !d.claimed?.checkin }">{{ d.canClaim.checkin ? '领 2 滴' : d.claimed?.checkin ? '已领取' : '去打卡' }}</text>
        </view>
        <view class="claim row-between mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="claim('quiz')">
          <view class="row gap12">
            <view class="icon-box sky">
              <XIcon name="bulb" />
            </view><text class="t-md">答健康问答（每题 1 滴）</text>
          </view>
          <text class="claim-btn" :class="{ off: !d.canClaim.quizCount && d.claimed?.quizAll, todo: !d.canClaim.quizCount && !d.claimed?.quizAll }">{{ d.canClaim.quizCount ? `领 ${d.canClaim.quizCount} 滴` : d.claimed?.quizAll ? '已领完' : '去答题' }}</text>
        </view>
        <text class="t-xs c3">水滴通过打卡、答题获得，每天各限一次；树长成兑换后重新种一棵。</text>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.tree-emoji {
  font-size: 72px;
  line-height: 1.15;
  transition: transform 0.3s;
}
.tree-emoji.s4 {
  font-size: 84px;
}
.tree-emoji.bounce {
  animation: tree-bounce 0.4s ease;
}
@keyframes tree-bounce {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.12) rotate(-2deg);
  }
  100% {
    transform: scale(1);
  }
}
.bar {
  width: 100%;
  height: 10px;
  border-radius: 5px;
  background: var(--placeholder);
  overflow: hidden;
}
/* 进度条用 scaleX 而非 width 过渡（docs/08：只动 transform/opacity），时长随 --mo-* 档位变量降级 */
.bar-in {
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, var(--care-soft), var(--care));
  transform-origin: 0 50%;
  transition: transform var(--mo-base) var(--mo-ease);
}
.claim {
  padding: 14px 0;
  border-top: 1px solid var(--line);
}
.scene {
  position: relative;
  height: 170px;
  margin: -2px -2px 4px;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: linear-gradient(180deg, #e8f0f4 0%, #f4f1e6 62%, #dfe8cf 100%);
}
.sun {
  position: absolute;
  right: 22px;
  top: 18px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff3c9 0%, #f6d98a 70%);
  box-shadow: 0 0 24px 6px rgba(246, 217, 138, 0.5);
}
.soil {
  position: absolute;
  left: 50%;
  bottom: -26px;
  width: 220px;
  height: 56px;
  margin-left: -110px;
  border-radius: 50%;
  background: linear-gradient(180deg, #b9a184, #9d8468);
}
.scene .tree-emoji {
  position: relative;
  z-index: 1;
  margin-bottom: 14px;
}
.stages {
  width: 100%;
  margin-bottom: 4px;
}
.claim-btn {
  padding: 6px 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--brand-hi), var(--brand-dark));
  color: var(--on-brand);
  box-shadow: 0 4px 10px -4px rgba(168, 130, 77, 0.6);
  font-size: var(--fs-sm);
  font-weight: 600;
  min-width: 72px;
  text-align: center;
}
.claim-btn.off {
  background: var(--placeholder);
  color: var(--ink-3);
  box-shadow: none;
}
.claim-btn.todo {
  background: var(--surface);
  color: var(--brand-ink);
  border: 1px solid var(--brand-line);
  box-shadow: none;
}
.drop-anim {
  display: inline-block;
}
.drop-anim.on {
  animation: drop-fall 0.4s ease-in;
}
@keyframes drop-fall {
  0% {
    transform: translateY(-6px);
    opacity: 1;
  }
  100% {
    transform: translateY(4px);
    opacity: 0;
  }
}
/* 上浮积分气泡锚点（兑换 +N，与签到页 float-plus 同款 600ms 上浮淡出） */
.tree-card {
  position: relative;
}
.float-plus {
  position: absolute;
  top: 14px;
  right: 16px;
  font-size: 20px;
  font-weight: 700;
  color: var(--brand-ink);
  z-index: 3;
}
.float-plus.anim {
  animation: float-up 600ms ease-out both;
}
@keyframes float-up {
  0% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(-30px);
    opacity: 0;
  }
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
</style>
