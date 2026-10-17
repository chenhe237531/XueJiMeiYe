<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { syncMotion } from '@/xj/motion'
import type { MoTier } from '@/xj/motion'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { confirm, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '积分转盘' } })

const xj = useXj()
/** 动效档位（XJ-707）：档位 class 落本页根节点；mo-off 跳过 4.2s 旋转等待，结果直接呈现 */
const mo = ref<MoTier>(syncMotion(xj.elderMode))
watch(() => xj.elderMode, v => (mo.value = syncMotion(v)))

const d = ref<any>(null)
const angle = ref(0)
const spinning = ref(false)
const result = ref<any>(null)
const showOdds = ref(false)
/** 中奖积分 +N 上浮（XJ-707）：600ms 上浮淡出；mo-off 不播，中奖结果由结果卡直接告知 */
const float = ref<{ id: number, text: string } | null>(null)
function popPoints(n?: number) {
  if (!n || n <= 0)
    return
  if (mo.value === 'off')
    return
  float.value = { id: Date.now(), text: `+${n}` }
  setTimeout(() => (float.value = null), 650)
}

const step = computed(() => 360 / (d.value?.prizes?.length || 6))
const PRIZE_ICON: Record<string, string> = { points: 'coins', lead: 'gift', none: 'mood-smile' }
const items = computed(() => (d.value?.prizes || []).map((p: any, i: number) => ({ ...p, angle: i * step.value + step.value / 2, icon: PRIZE_ICON[p.type] || 'gift' })))
/** 扇区底色：品牌浅色与白交替，扇区之间留 1° 细缝 */
const conic = computed(() => {
  const colors = ['var(--brand-soft)', 'var(--surface)']
  const n = d.value?.prizes?.length || 6
  const s = step.value
  return `conic-gradient(${Array.from({ length: n }, (_, i) => `var(--brand-line) ${i * s}deg ${i * s + 0.8}deg, ${colors[i % 2]} ${i * s + 0.8}deg ${(i + 1) * s}deg`).join(', ')})`
})

async function load() {
  d.value = await http.get('/app/games/wheel', undefined, { silent: true })
}
onLoad(load)

async function spin(usePoints: boolean) {
  if (spinning.value)
    return
  if (usePoints && !(await confirm('积分抽奖', `这次抽奖会用掉 ${d.value.paidCost} 积分（当前 ${d.value.balance} 积分），确定抽吗？`, '抽一次')))
    return
  spinning.value = true
  result.value = null
  try {
    const r = await http.post('/app/games/wheel/spin', { usePoints }, { silent: true })
    // mo-off（乐龄）：不转盘不等待，结果卡直接呈现，toast 同步告知（AC#3：任何档位结果明确感知）
    if (mo.value === 'off') {
      result.value = r
      spinning.value = false
      toast(r.prize.type === 'none' ? '谢谢参与，明天再来' : `恭喜抽中：${r.prize.label}`)
      load()
      return
    }
    // 指针固定在顶部：转 5 圈后停在目标扇区中心
    angle.value += 1800 + (360 - angle.value % 360) % 360 + (360 - (r.index * step.value + step.value / 2))
    setTimeout(() => {
      result.value = r
      spinning.value = false
      if (r.prize.type === 'points')
        popPoints(r.prize.value)
      load()
    }, 4200)
  }
  catch (e: any) {
    spinning.value = false
    toast(e?.message || '稍后再试')
  }
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
        <view class="ph-deco i-tabler-gift" />
        <text class="ph-title">积分转盘</text>
        <text class="ph-sub">每天免费转一次，转出积分和好礼</text>
        <view class="ph-meta">
          <view><XIcon name="coins" :size="14" />存折 {{ d.balance }} 积分</view>
          <view><XIcon name="refresh" :size="14" />免费余 {{ d.freeLeft }} 次</view>
        </view>
      </view>
      <view class="card raised stack mo-rise mo-d1" style="align-items: center; padding-bottom: 20px">
        <view class="wheel-wrap">
          <view class="pointer" />
          <view class="wheel" :style="{ background: conic, transform: `rotate(${angle}deg)` }">
            <view v-for="p in items" :key="p.label" class="wheel-item" :style="{ transform: `rotate(${p.angle}deg)` }">
              <XIcon :name="p.icon" :size="20" :color="p.type === 'none' ? 'var(--ink-3)' : 'var(--brand-ink)'" />
              <text class="wheel-label" :class="{ muted: p.type === 'none' }">{{ p.label }}</text>
            </view>
          </view>
          <view class="hub mo-press" :class="{ busy: spinning }" hover-class="mo-press-active" :hover-stay-time="80" @click="d.freeLeft > 0 ? spin(false) : d.paidLeft > 0 ? spin(true) : null">
            <text>{{ spinning ? '…' : '抽' }}</text>
          </view>
          <view v-if="float" :key="float.id" class="float-plus" :class="{ anim: mo !== 'off' }">
            {{ float.text }}
          </view>
        </view>

        <view class="row gap12" style="width: 100%; margin-top: 16px">
          <view v-if="d.freeLeft > 0" class="btn flex1 mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="spin(false)">
            免费抽（余 {{ d.freeLeft }} 次）
          </view>
          <view v-else-if="d.paidLeft > 0" class="btn gold flex1 mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="spin(true)">
            {{ d.paidCost }} 积分抽一次（余 {{ d.paidLeft }} 次）
          </view>
          <view v-else class="btn flex1 off">
            今日次数已用完，明天再来
          </view>
        </view>
        <text class="t-xs c3">当前健康存折 {{ d.balance }} 积分 · 积分抽奖每日 3 次</text>

        <view v-if="result" class="result col gap6 mo-pop">
          <view class="icon-box result-ic" :class="result.prize.type === 'none' ? 'gray' : ''">
            <XIcon :name="result.prize.type === 'none' ? 'mood-smile' : 'gift'" :size="26" />
          </view>
          <text class="t-lg semi">{{ result.prize.type === 'none' ? '谢谢参与' : `恭喜抽中：${result.prize.label}` }}</text>
          <text class="t-sm c2">{{ result.prize.type === 'lead' ? '专属顾问会尽快联系您安排发放' : (result.prize.type === 'points' ? '积分已计入健康存折' : '明天再来转一转') }}</text>
        </view>
      </view>

      <view class="card stack mo-rise mo-d2">
        <view class="row-between mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="showOdds = !showOdds">
          <view class="section-title" style="margin-top: 0">
            <text>奖品与概率公示</text>
          </view>
          <XIcon :name="showOdds ? 'chevron-right' : 'chevron-right'" :size="20" :style="{ transform: showOdds ? 'rotate(90deg)' : 'none', transition: mo !== 'off' ? 'transform .2s' : 'none' }" />
        </view>
        <view v-if="showOdds" class="stack gap4">
          <view v-for="p in d.prizes" :key="p.label" class="row-between t-sm">
            <text>{{ p.label }}</text>
            <text class="c2">{{ p.pct }}%</text>
          </view>
          <text class="t-xs c3">奖品数量与概率按后台配置公示，中奖结果由服务端随机产生。</text>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.wheel-wrap {
  position: relative;
  width: 280px;
  height: 280px;
  margin-top: 18px;
  padding: 10px;
  border-radius: 50%;
  box-sizing: border-box;
  background: radial-gradient(circle at 30% 25%, var(--brand-line), var(--brand-dark));
  box-shadow:
    0 18px 36px -18px rgba(107, 78, 46, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
.wheel {
  width: 260px;
  height: 260px;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6);
  transition: transform 4s cubic-bezier(0.18, 0.75, 0.22, 1);
}
/* 每个奖品从圆心沿半径排开：图标在外圈、文字朝圆心，读起来顺着扇区方向 */
.wheel-item {
  position: absolute;
  left: 50%;
  top: 0;
  width: 64px;
  height: 50%;
  margin-left: -32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 18px;
  gap: 4px;
  box-sizing: border-box;
  transform-origin: 50% 100%;
}
.wheel-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--brand-ink);
  text-align: center;
  line-height: 1.25;
  max-width: 56px;
}
.wheel-label.muted {
  color: var(--ink-3);
  font-weight: 600;
}
.pointer {
  position: absolute;
  top: -6px;
  left: 50%;
  z-index: 3;
  width: 0;
  height: 0;
  margin-left: -12px;
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
  border-top: 22px solid var(--price);
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.18));
}
/* 按压反馈交给 mo-press + hover-class（小程序不支持 :active），过渡时长随 --mo-* 档位变量降级 */
.hub {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 2;
  width: 68px;
  height: 68px;
  margin: -34px 0 0 -34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 35% 30%, var(--brand-hi), var(--brand-dark));
  color: var(--on-brand);
  font-size: 22px;
  font-weight: 800;
  border: 4px solid var(--surface);
  box-shadow: 0 6px 14px -6px rgba(0, 0, 0, 0.35);
}
.hub.busy {
  opacity: 0.85;
}
.result {
  margin-top: 14px;
  padding: 16px 14px;
  border-radius: var(--r-card);
  background: linear-gradient(160deg, var(--surface), var(--brand-soft));
  border: 1px solid var(--brand-line);
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  align-items: center;
}
.icon-box.result-ic {
  width: 48px;
  height: 48px;
  border-radius: 16px;
}
.btn.off {
  opacity: 0.55;
}
/* 加载态（docs/09 §3.6）：功能性加载环，mo-off 下 --gd-spin-dur 归 1ms，静止为静态环仍可识别 */
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
/* 中奖积分上浮（与签到页 float-plus 同款，600ms 上浮淡出） */
.float-plus {
  position: absolute;
  top: 4px;
  right: 2px;
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
</style>
