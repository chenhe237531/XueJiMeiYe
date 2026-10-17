<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import XIcon from '@/components/XIcon.vue'
import XNav from '@/components/XNav.vue'
import { syncMotion } from '@/xj/motion'
import type { MoTier } from '@/xj/motion'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { toast } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '健康盲盒' } })

/** /app/games/box 契约（XJ-304 交付，XJ-404 消费）：prizes=概率公示；bonus 三来源当日实时判定 */
interface BoxBonus { available: boolean, consumed: boolean, hint: string }
interface BoxData {
  prizes: { type: string, value: number, label: string, pct: number }[]
  freeLeft: number
  totalLeft: number
  bonus: { checkin: BoxBonus, task: BoxBonus, relay: BoxBonus }
  balance: number
  disclaimer: string
}
interface OpenResult {
  prize: { type: string, value: number, label: string, pct: number }
  card: { title: string, knowledge: string, tag: string, source: string, disclaimer: string } | null
  source: 'free' | 'checkin' | 'task' | 'relay'
  totalLeft: number
}

const xj = useXj()
/** 动效档位（XJ-707）：档位 class 落本页根节点；mo-off 下开盒动效跳过、结果直接呈现 */
const mo = ref<MoTier>(syncMotion(xj.elderMode))
watch(() => xj.elderMode, v => (mo.value = syncMotion(v)))

const d = ref<BoxData | null>(null)
const opening = ref(false)
const result = ref<OpenResult | null>(null)

const PRIZE_ICON: Record<string, string> = { knowledge: 'cards', points: 'coins', lead: 'ticket', none: 'mood-smile' }
/** 稀有奖品差异化标识（AC#2）：体验券走玫瑰红族（--price 系），与常见奖品拉开 */
const isRare = (t: string) => t === 'lead'

const canOpen = computed(() => (d.value?.totalLeft ?? 0) > 0 && !opening.value)
/** 奖品 icon 色彩语义：知识卡 = 墨绿（收藏主题，与转盘的金区分）；积分 = 金；体验券 = 玫瑰红 */
function prizeColor(t: string) {
  if (t === 'knowledge')
    return 'var(--care)'
  if (t === 'lead')
    return 'var(--price-ink)'
  if (t === 'none')
    return 'var(--ink-3)'
  return 'var(--brand-ink)'
}

async function load() {
  d.value = await http.get<BoxData>('/app/games/box', undefined, { silent: true })
}
onShow(load)

/** 拆盒：结果由服务端加权随机（前端不算概率不发奖）；连点由 opening 锁 + 后端乐观锁双防 */
async function open() {
  if (opening.value)
    return
  if ((d.value?.totalLeft ?? 0) <= 0) {
    toast('今天的盲盒已经拆完啦，明天再来')
    return
  }
  opening.value = true
  try {
    const r = await http.post<OpenResult>('/app/games/box/open', undefined, { silent: true })
    if (mo.value === 'off') {
      // mo-off（乐龄）：跳过开盒动效，结果直接呈现（AC#3 任何档位结果明确感知）
      result.value = r
      opening.value = false
      toast(r.prize.type === 'none' ? '谢谢参与，明天再来' : `拆出：${r.prize.label}`)
      load()
      return
    }
    // 开盒动效：盒盖抬起（450ms）→ 结果弹入，只动 transform/opacity
    setTimeout(() => {
      result.value = r
      opening.value = false
      load()
    }, 500)
  }
  catch (e: any) {
    opening.value = false
    toast(e?.message || '稍后再试')
  }
}
</script>

<template>
  <view :class="[xj.pageClass, `mo-${mo}`]">
    <XNav show-back title="健康盲盒" />
    <view v-if="d" class="stack" style="padding-top: 12px">
      <!-- ① 头部：与转盘区分——图标 sparkles / 文案主打知识卡收藏 / 右上今日剩余次数 -->
      <view class="page-head mo-rise mo-d1">
        <view class="ph-deco i-tabler-sparkles" />
        <text class="ph-title">健康盲盒</text>
        <text class="ph-sub">拆盲盒，收一张健康知识卡</text>
        <view class="ph-meta">
          <view><XIcon name="cards" :size="14" />今日余 {{ d.totalLeft }} 次</view>
          <view><XIcon name="coins" :size="14" />存折 {{ d.balance }} 积分</view>
        </view>
      </view>

      <!-- ② 盲盒区 + ⑤ 主按钮：可拆 = 金渐变 + 十字缎带；已拆完 = 灰底虚线 + 灰度图形（纯 CSS 合成） -->
      <view class="card raised box-card mo-rise mo-d2">
        <view class="box-stage">
          <view v-if="canOpen" class="box-art" :class="{ opening: opening && mo !== 'off' }">
            <view class="halo" :class="{ on: opening && mo !== 'off' }" />
            <view class="box-lid" />
            <view class="box-body" />
            <view class="ribbon-v" />
            <view class="bow-l" /><view class="bow-r" /><view class="knot" />
            <view class="box-float">
              <text class="t-xs c2">今日可拆 {{ d.totalLeft }} 次</text>
            </view>
          </view>
          <view v-else class="box-locked col center gap8">
            <XIcon name="gift" :size="44" color="var(--ink-3)" />
            <text class="t-sm c3">{{ opening ? '拆盒中…' : '今日次数已拆完，明天再来' }}</text>
          </view>
        </view>

        <view v-if="canOpen" class="col center gap6">
          <view class="btn" hover-class="mo-press-active" @click="open">
            拆一个盲盒
          </view>
          <text class="t-sm c2">每日免费 1 次</text>
        </view>
        <view v-else-if="!opening" class="btn off" @click="open">
          今日已拆完，明天再来
        </view>

        <!-- 开盒结果：知识卡收藏形态（墨绿卡面）；体验券带「稀有」玫瑰红标（AC#2） -->
        <view v-if="result" class="result col gap8 mo-pop">
          <template v-if="result.prize.type === 'knowledge' && result.card">
            <view class="row gap8 center">
              <XIcon name="cards" :size="22" color="var(--care)" />
              <text class="t-lg semi c-care">拆出一张健康知识卡</text>
            </view>
            <view class="knowledge-card col gap6">
              <view class="row gap8">
                <text class="tag care">{{ result.card.tag }}</text>
                <text class="t-xs c3">{{ result.card.source }}</text>
              </view>
              <text class="t-md semi">{{ result.card.title }}</text>
              <text class="t-sm c2">{{ result.card.knowledge }}</text>
              <text class="t-xs c3">{{ result.card.disclaimer }}</text>
            </view>
          </template>
          <template v-else>
            <view class="icon-box result-ic" :class="{ gray: result.prize.type === 'none' }">
              <XIcon :name="PRIZE_ICON[result.prize.type] || 'gift'" :size="26" :color="prizeColor(result.prize.type)" />
            </view>
            <text class="t-lg semi">{{ result.prize.type === 'none' ? '谢谢参与' : `恭喜拆出：${result.prize.label}` }}</text>
            <view class="row gap8 center">
              <text v-if="isRare(result.prize.type)" class="tag promo">稀有奖品</text>
              <text class="t-sm c2">{{ result.prize.type === 'lead' ? '专属顾问会尽快联系您安排体验' : result.prize.type === 'points' ? '积分已计入健康存折' : '明天再来拆一拆' }}</text>
            </view>
          </template>
        </view>
      </view>

      <!-- ③ 奖品说明与概率公示（合规：页面内可查，服务端随机） -->
      <view class="card stack mo-rise mo-d3">
        <text class="t-md semi">奖品与概率公示</text>
        <view class="stack gap4">
          <view v-for="p in d.prizes" :key="p.label" class="row-between">
            <view class="row gap6">
              <XIcon :name="PRIZE_ICON[p.type] || 'gift'" :size="16" :color="prizeColor(p.type)" />
              <text class="t-sm" :class="{ c3: p.type === 'none' }">{{ p.label }}</text>
              <text v-if="isRare(p.type)" class="tag promo">稀有</text>
              <text v-else class="t-xs c3">常见</text>
            </view>
            <text class="t-sm c2 num">{{ p.pct }}%</text>
          </view>
        </view>
        <text class="t-xs c3">中奖结果由服务端按以上公示概率随机产生，前端不可预知。</text>
      </view>

      <!-- ④ 次数获取说明：三来源当日实时判定（checkin / task / relay） -->
      <view class="card stack mo-rise mo-d4">
        <text class="t-md semi">怎么获得拆盒次数</text>
        <view v-for="(b, k) in d.bonus" :key="k" class="row-between">
          <text class="t-sm">{{ b.hint }}</text>
          <text v-if="b.consumed" class="t-xs c3">已用</text>
          <text v-else-if="b.available" class="t-xs c-care semi">+1 可拆</text>
          <text v-else class="t-xs c3">今日未达成</text>
        </view>
        <text class="t-xs c3">知识卡内容{{ d.disclaimer }}。</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
/* ── ② 盲盒合成：金渐变盒身 + 十字缎带 + 蝴蝶结（零图片，动效只动 transform/opacity） ── */
.box-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
  padding-bottom: 20px;
}
.box-stage {
  position: relative;
  width: 100%;
  padding: 24px 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.box-art {
  position: relative;
  width: 168px;
  height: 128px;
  animation: box-bob 2.4s ease-in-out infinite;
}
/* 可拆态轻浮动（mo-off 档由下方 .mo-off 置 paused 静止） */
@keyframes box-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
.box-lid {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 3;
  width: 168px;
  height: 34px;
  border-radius: 10px 10px 4px 4px;
  background: linear-gradient(160deg, var(--brand-hi) 0%, var(--brand) 60%, var(--brand-dark) 100%);
  box-shadow: 0 3px 6px -2px rgba(107, 78, 46, 0.4);
  transition:
    transform 450ms var(--mo-ease-out, cubic-bezier(0.3, 0, 1, 1)),
    opacity 450ms ease;
  transform-origin: 50% 100%;
}
.box-body {
  position: absolute;
  left: 6px;
  top: 30px;
  width: 156px;
  height: 94px;
  border-radius: 8px 8px 14px 14px;
  background: linear-gradient(170deg, var(--brand) 0%, var(--brand-dark) 100%);
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.28);
}
.ribbon-v {
  position: absolute;
  left: 50%;
  top: 30px;
  z-index: 2;
  width: 20px;
  height: 94px;
  margin-left: -10px;
  border-radius: 0 0 4px 4px;
  background: rgba(255, 255, 255, 0.72);
}
/* 蝴蝶结：两个斜置圆角矩形 + 中央结点（盖沿中点） */
.bow-l,
.bow-r {
  position: absolute;
  top: 12px;
  z-index: 4;
  width: 34px;
  height: 18px;
  border-radius: 9px;
  background: linear-gradient(160deg, var(--brand-hi), var(--gold));
  box-shadow: 0 2px 4px -1px rgba(107, 78, 46, 0.35);
  transition:
    transform 450ms var(--mo-ease-out, cubic-bezier(0.3, 0, 1, 1)),
    opacity 450ms ease;
}
.bow-l {
  left: 44px;
  transform: rotate(-18deg);
}
.bow-r {
  right: 44px;
  transform: rotate(18deg);
}
.knot {
  position: absolute;
  left: 50%;
  top: 15px;
  z-index: 5;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.55);
  transition:
    transform 450ms var(--mo-ease-out, cubic-bezier(0.3, 0, 1, 1)),
    opacity 450ms ease;
}
/* 开盒：盖 + 结飞起淡出（动效只动 transform/opacity） */
.box-art.opening .box-lid {
  transform: translateY(-40px) rotate(-10deg);
  opacity: 0;
}
.box-art.opening .bow-l,
.box-art.opening .bow-r,
.box-art.opening .knot {
  transform: translateY(-40px);
  opacity: 0;
}
.box-art.opening {
  animation: none;
}
/* 光晕：径向金斑在盒后升起 */
.halo {
  position: absolute;
  left: 50%;
  top: -26px;
  width: 190px;
  height: 190px;
  margin-left: -95px;
  border-radius: 50%;
  z-index: 1;
  opacity: 0;
  background: radial-gradient(circle, rgba(210, 180, 122, 0.65) 0%, rgba(210, 180, 122, 0) 68%);
  transition: opacity 380ms ease 120ms;
  pointer-events: none;
}
.halo.on {
  opacity: 1;
}
.box-float {
  position: absolute;
  left: 50%;
  bottom: -22px;
  white-space: nowrap;
  transform: translateX(-50%);
}
/* 已拆完态：灰底虚线 + 灰度图形（mask 单色图标天然灰度） */
.box-locked {
  width: 168px;
  height: 128px;
  border-radius: 14px;
  border: 2px dashed var(--line-2);
  background: var(--placeholder);
  justify-content: center;
}
/* ── 开盒结果卡 ── */
.result {
  width: 100%;
  box-sizing: border-box;
  padding: 16px 14px;
  border-radius: var(--r-card);
  background: linear-gradient(160deg, var(--surface), var(--care-soft));
  border: 1px solid var(--care-line);
  text-align: center;
  align-items: center;
}
.icon-box.result-ic {
  width: 48px;
  height: 48px;
  border-radius: 16px;
}
.icon-box.result-ic.gray {
  background: var(--line);
}
/* 知识卡卡面：墨绿收藏主题（与转盘金结果卡区分，AC#5） */
.knowledge-card {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border-radius: var(--r-inner);
  background: var(--surface);
  border: 1.5px solid var(--care-line);
  text-align: left;
  align-items: flex-start;
}
.btn.off {
  opacity: 0.55;
}
/* mo-off（乐龄/关闭档）：浮动动画静止，开盒直接出结果 */
.mo-off .box-art {
  animation-play-state: paused;
}
</style>
