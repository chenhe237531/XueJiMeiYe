<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { syncMotion } from '@/xj/motion'
import type { MoTier } from '@/xj/motion'
import { useXj } from '@/xj/store'

definePage({ style: { navigationBarTitleText: '记忆翻牌' } })

const xj = useXj()
/** 动效档位（XJ-707）：档位 class 落本页根节点，入场与按压反馈随档位降级 */
const mo = ref<MoTier>(syncMotion(xj.elderMode))
watch(() => xj.elderMode, v => (mo.value = syncMotion(v)))

const ICONS = ['flower', 'sun', 'leaf', 'heart', 'moon', 'droplet', 'gift', 'bell']
const level = ref(4)
const cards = ref<any[]>([])
const open = ref<number[]>([])
const moves = ref(0)
const done = computed(() => cards.value.length && cards.value.every(c => c.matched))

function start(n = level.value) {
  level.value = n
  const icons = ICONS.slice(0, n)
  cards.value = [...icons, ...icons].map((icon, i) => ({ id: i, icon, matched: false })).sort(() => Math.random() - 0.5)
  open.value = []
  moves.value = 0
}
start()

function flip(idx: number) {
  const c = cards.value[idx]
  if (c.matched || open.value.includes(idx) || open.value.length === 2)
    return
  open.value.push(idx)
  if (open.value.length === 2) {
    moves.value++
    const [a, b] = open.value
    if (cards.value[a].icon === cards.value[b].icon) {
      cards.value[a].matched = cards.value[b].matched = true
      open.value = []
    }
    else {
      setTimeout(() => { open.value = [] }, 900)
    }
  }
}
</script>

<template>
  <view :class="[xj.pageClass, `mo-${mo}`]">
    <view class="page-head">
      <view class="ph-deco i-tabler-cards" />
      <text class="ph-title">记忆翻牌</text>
      <text class="ph-sub">翻开两张一样的牌就配对成功。不做认知评估，放松一下就好</text>
    </view>
    <view class="stack">
      <view class="segs mo-rise mo-d1">
        <view v-for="l in [[3, '简单'], [4, '普通'], [6, '有挑战']]" :key="l[0]" class="seg mo-press" :class="{ on: level === l[0] }" hover-class="mo-press-active" :hover-stay-time="80" @click="start(l[0])">
          {{ l[1] }}
        </view>
      </view>
      <view class="card stat-row mo-rise mo-d2" style="padding: 10px 0">
        <view class="stat">
          <text class="stat-n">{{ moves }}</text><text class="stat-l">已翻次数</text>
        </view>
        <view class="stat">
          <text class="stat-n c-care">{{ cards.filter((c) => c.matched).length / 2 }}</text><text class="stat-l">已配对</text>
        </view>
        <view class="stat">
          <text class="stat-n">{{ cards.length / 2 }}</text><text class="stat-l">共几对</text>
        </view>
      </view>
      <view class="mo-rise mo-d3 grid" :style="{ gridTemplateColumns: `repeat(${level === 3 ? 3 : 4}, minmax(0, 1fr))` }">
        <view v-for="(c, i) in cards" :key="c.id" class="cardx mo-press" :class="{ up: c.matched || open.includes(i), matched: c.matched }" hover-class="mo-press-active" :hover-stay-time="80" @click="flip(i)">
          <XIcon v-if="c.matched || open.includes(i)" :name="c.icon" :size="34" color="var(--brand-ink)" />
          <XIcon v-else name="sparkles" :size="22" color="var(--on-brand)" />
        </view>
      </view>
      <view v-if="done" class="card care row gap12 done mo-pop">
        <view class="icon-box care">
          <XIcon name="award" />
        </view>
        <view class="col flex1">
          <text class="t-lg">全部配对成功，真棒！</text><text class="t-sm c2">用了 {{ moves }} 次翻牌</text>
        </view>
      </view>
      <view class="btn plain mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="start()">
        <XIcon name="refresh" />重新开始
      </view>
    </view>
  </view>
</template>

<style scoped>
.segs {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 26px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.seg {
  flex: 1;
  height: 42px;
  border-radius: 21px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-2);
}
.seg.on {
  background: linear-gradient(135deg, var(--brand-hi), var(--brand-dark));
  color: var(--on-brand);
  font-weight: 700;
  box-shadow: 0 4px 10px -4px rgba(168, 130, 77, 0.6);
}
.grid {
  display: grid;
  gap: 10px;
}
/* 牌背：渐变 + 内描边，像真牌；翻开后白底。按压反馈交给 mo-press + hover-class（小程序不支持 :active） */
.cardx {
  aspect-ratio: 1;
  min-height: 72px;
  border-radius: 16px;
  background: linear-gradient(145deg, var(--brand-hi), var(--brand-dark));
  box-shadow:
    inset 0 0 0 4px rgba(255, 255, 255, 0.28),
    0 6px 14px -8px rgba(60, 48, 34, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cardx.up {
  background: #fff;
  border: 2px solid var(--brand-line);
  box-shadow: var(--shadow-card);
}
.cardx.matched {
  background: var(--care-soft);
  border-color: var(--care-line);
}
</style>
