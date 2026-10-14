<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { confirm, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '积分转盘' } })

const xj = useXj()
const d = ref<any>(null)
const angle = ref(0)
const spinning = ref(false)
const result = ref<any>(null)
const showOdds = ref(false)

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
  if (spinning.value) return
  if (usePoints && !(await confirm('积分抽奖', `这次抽奖会用掉 ${d.value.paidCost} 积分（当前 ${d.value.balance} 积分），确定抽吗？`, '抽一次'))) return
  spinning.value = true
  result.value = null
  try {
    const r = await http.post('/app/games/wheel/spin', { usePoints }, { silent: true })
    // 指针固定在顶部：转 5 圈后停在目标扇区中心
    angle.value += 1800 + (360 - angle.value % 360) % 360 + (360 - (r.index * step.value + step.value / 2))
    setTimeout(() => {
      result.value = r
      spinning.value = false
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
  <view v-if="d" :class="xj.pageClass">
    <view class="card stack" style="align-items: center; padding-bottom: 20px">
      <view class="wheel-wrap">
        <view class="pointer" />
        <view class="wheel" :style="{ background: conic, transform: `rotate(${angle}deg)` }">
          <view v-for="p in items" :key="p.label" class="wheel-item" :style="{ transform: `rotate(${p.angle}deg)` }">
            <XIcon :name="p.icon" :size="20" :color="p.type === 'none' ? 'var(--ink-3)' : 'var(--brand-ink)'" />
            <text class="wheel-label" :class="{ muted: p.type === 'none' }">{{ p.label }}</text>
          </view>
        </view>
        <view class="hub" :class="{ busy: spinning }" @click="d.freeLeft > 0 ? spin(false) : d.paidLeft > 0 ? spin(true) : null">
          <text>{{ spinning ? '…' : '抽' }}</text>
        </view>
      </view>

      <view class="row gap12" style="width: 100%; margin-top: 16px">
        <view v-if="d.freeLeft > 0" class="btn flex1" @click="spin(false)">免费抽（余 {{ d.freeLeft }} 次）</view>
        <view v-else-if="d.paidLeft > 0" class="btn gold flex1" @click="spin(true)">{{ d.paidCost }} 积分抽一次（余 {{ d.paidLeft }} 次）</view>
        <view v-else class="btn flex1 off">今日次数已用完，明天再来</view>
      </view>
      <text class="t-xs c3">当前健康存折 {{ d.balance }} 积分 · 积分抽奖每日 3 次</text>

      <view v-if="result" class="result col gap6">
        <text class="t-lg semi">{{ result.prize.type === 'none' ? '谢谢参与' : `恭喜抽中：${result.prize.label}` }}</text>
        <text class="t-sm c2">{{ result.prize.type === 'lead' ? '专属顾问会尽快联系您安排发放' : (result.prize.type === 'points' ? '积分已计入健康存折' : '明天再来转一转') }}</text>
      </view>
    </view>

    <view class="card stack">
      <view class="row-between" @click="showOdds = !showOdds">
        <text class="t-lg">奖品与概率公示</text>
        <XIcon :name="showOdds ? 'chevron-right' : 'chevron-right'" :size="20" :style="{ transform: showOdds ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }" />
      </view>
      <view v-if="showOdds" class="stack gap4">
        <view v-for="p in d.prizes" :key="p.label" class="row-between t-sm">
          <text>{{ p.label }}</text>
          <text class="c2">{{ p.pct }}%</text>
        </view>
        <text class="t-xs c3">奖品数量与概率按后台配置公示，中奖结果由服务端随机产生。</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.wheel-wrap { position: relative; width: 280px; height: 280px; margin-top: 18px; padding: 10px; border-radius: 50%; box-sizing: border-box; background: radial-gradient(circle at 30% 25%, var(--brand-line), var(--brand-dark)); box-shadow: 0 18px 36px -18px rgba(107, 78, 46, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.5); }
.wheel { width: 260px; height: 260px; border-radius: 50%; position: relative; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6); transition: transform 4s cubic-bezier(0.18, 0.75, 0.22, 1); }
/* 每个奖品从圆心沿半径排开：图标在外圈、文字朝圆心，读起来顺着扇区方向 */
.wheel-item { position: absolute; left: 50%; top: 0; width: 64px; height: 50%; margin-left: -32px; display: flex; flex-direction: column; align-items: center; padding-top: 18px; gap: 4px; box-sizing: border-box; transform-origin: 50% 100%; }
.wheel-label { font-size: 12px; font-weight: 700; color: var(--brand-ink); text-align: center; line-height: 1.25; max-width: 56px; }
.wheel-label.muted { color: var(--ink-3); font-weight: 600; }
.pointer { position: absolute; top: -6px; left: 50%; z-index: 3; width: 0; height: 0; margin-left: -12px; border-left: 12px solid transparent; border-right: 12px solid transparent; border-top: 22px solid var(--price); filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.18)); }
.hub { position: absolute; left: 50%; top: 50%; z-index: 2; width: 68px; height: 68px; margin: -34px 0 0 -34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--brand); color: var(--on-brand); font-size: 22px; font-weight: 800; border: 4px solid var(--surface); box-shadow: 0 6px 14px -6px rgba(0, 0, 0, 0.35); transition: transform 0.15s; }
.hub:active { transform: scale(0.94); }
.hub.busy { opacity: 0.85; }
.result { margin-top: 14px; padding: 14px; border-radius: var(--r-inner); background: var(--brand-soft); width: 100%; box-sizing: border-box; text-align: center; }
.btn.off { opacity: 0.55; }
</style>
