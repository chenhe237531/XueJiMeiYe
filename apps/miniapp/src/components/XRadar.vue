<script setup lang="ts">
import { computed } from 'vue'
import { radarLabels, radarSvg } from '@/xj/utils'

const props = defineProps<{ scores: Record<string, number>, prev?: Record<string, number> | null, size?: number, labels?: boolean, dark?: boolean }>()
const size = computed(() => props.size || 200)
const src = computed(() => radarSvg(props.scores || {}, props.prev, { size: size.value, dark: props.dark }))
const labelList = computed(() => radarLabels(props.scores || {}))
</script>

<template>
  <view class="radar" :style="{ width: `${size + (labels ? 76 : 0)}px`, height: `${size + (labels ? 44 : 0)}px` }">
    <image :src="src" :style="{ width: `${size}px`, height: `${size}px` }" class="img" mode="aspectFit" />
    <template v-if="labels">
      <view v-for="l in labelList" :key="l.code" class="lbl" :class="{ dark }" :style="{ left: `${l.left}%`, top: `${l.top}%` }">
        <text>{{ l.name }}</text>
        <text class="sc num">{{ l.score ?? '-' }}</text>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.radar { position: relative; display: flex; align-items: center; justify-content: center; }
.img { display: block; }
.lbl { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; font-size: 12px; color: var(--ink-2); line-height: 1.2; }
.elder .lbl { font-size: 14px; }
.lbl .sc { font-weight: 700; color: var(--ink); font-size: 13px; }
.lbl.dark { color: #b3a8a2; }
.lbl.dark .sc { color: #f2ece8; }
</style>
