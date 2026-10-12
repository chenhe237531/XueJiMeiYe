<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { useXj } from '@/xj/store'

definePage({ style: { navigationBarTitleText: '记忆翻牌' } })

const xj = useXj()
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
  if (c.matched || open.value.includes(idx) || open.value.length === 2) return
  open.value.push(idx)
  if (open.value.length === 2) {
    moves.value++
    const [a, b] = open.value
    if (cards.value[a].icon === cards.value[b].icon) {
      cards.value[a].matched = cards.value[b].matched = true
      open.value = []
    }
    else setTimeout(() => { open.value = [] }, 900)
  }
}
</script>

<template>
  <view :class="xj.pageClass">
    <view class="stack" style="padding-top: 12px">
      <text class="t-sm c2">轻松小游戏，翻开两张一样的牌就配对成功。不做认知评估，放松一下就好。</text>
      <view class="row gap8">
        <view v-for="l in [[3, '简单'], [4, '普通'], [6, '有挑战']]" :key="l[0]" class="seg" :class="{ on: level === l[0] }" @click="start(l[0])">{{ l[1] }}</view>
      </view>
      <view class="grid" :style="{ gridTemplateColumns: `repeat(${level === 3 ? 3 : 4}, minmax(0, 1fr))` }">
        <view v-for="(c, i) in cards" :key="c.id" class="cardx" :class="{ up: c.matched || open.includes(i), matched: c.matched }" @click="flip(i)">
          <XIcon v-if="c.matched || open.includes(i)" :name="c.icon" :size="34" color="#8C2B56" />
          <XIcon v-else name="sparkles" :size="22" color="#fff" />
        </view>
      </view>
      <view class="row-between t-body"><text>已翻 {{ moves }} 次</text><text class="link" @click="start()">重新开始</text></view>
      <view v-if="done" class="card care t-lg" style="text-align: center">全部配对成功，真棒！</view>
    </view>
  </view>
</template>

<style scoped>
.seg { flex: 1; height: 44px; border-radius: 22px; background: #fff; display: flex; align-items: center; justify-content: center; }
.seg.on { background: var(--brand); color: #fff; font-weight: 700; }
.grid { display: grid; gap: 10px; }
.cardx { aspect-ratio: 1; min-height: 72px; border-radius: 16px; background: var(--brand); display: flex; align-items: center; justify-content: center; }
.cardx.up { background: #fff; border: 2px solid var(--brand-line); }
.cardx.matched { background: var(--care-soft); border-color: var(--care-line); }
</style>
