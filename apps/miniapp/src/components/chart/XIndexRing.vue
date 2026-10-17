<script setup lang="ts">
/**
 * XIndexRing · 健康指数环（XJ-206 / docs/08 §3.5 状态切换）
 *
 * 设计取舍：小程序不支持 <svg> 标签，SVG 只能经 data URI 用 <image> 渲染，
 * 而 image 模式下 SVG 的 SMIL/CSS 动画不播放（本项目已验证，见 docs/09 第 4 章脚注 2）。
 * 因此环的「生长」不能靠 SVG 内部 stroke-dashoffset 动画，改由组件 JS 用
 * requestAnimationFrame 推进进度值 p(0→1)，每帧重新生成 SVG 字符串并更新 image src。
 * 视觉等价于 stroke-dashoffset 从满偏移到 0，但完全在 JS 侧驱动。
 *
 * 动效规范（docs/08 §3.5）：
 *   - 环生长 800ms（本组件对外口径，略短于文档示例的 1150ms，因数字滚动 ≤600ms 收敛）
 *   - 数字滚动 ≤600ms，缓出 1-(1-p)³
 *   - 只动 transform / opacity / stroke-dashoffset（本组件只改 SVG 的 stroke-dashoffset 等价量）
 *   - mo-off 档位直接呈现终态、跳过动画（getTier()==='off'）
 *
 * 颜色：不硬编码业务色，默认读令牌 var(--brand)，可通过 color / trackColor props 覆盖。
 * 因 SVG 走 data URI 不能用 CSS 变量，颜色由 props 传入（默认值仍取令牌的十六进制兜底）。
 *
 * 用法示例（独立自检）：
 *   <XIndexRing :value="68" :size="120" prefix="综合" suffix="分" caption="六维年轻化指数" />
 *   <XIndexRing :value="d.index" :count-up="false" color="#5c7a52" />          // 乐龄墨绿、只长环不滚数字
 *   组件引用后 ref.value.replay() 可重播（滚动入场 / onShow 复用）
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import { svgUri } from '@/xj/utils'
import { getTier } from '@/xj/motion'

const props = withDefaults(defineProps<{
  /** 指数 0~100 */
  value: number
  /** 直径 px */
  size?: number
  /** 进度环色（十六进制，SVG 不能用 CSS 变量）。默认柔金 #C9A063，消费方可传乐龄墨绿 / 夜色金 */
  color?: string
  /** 轨道色。默认随皮肤底的浅灰 */
  trackColor?: string
  /** 环宽 px */
  stroke?: number
  /** 中心数字是否滚动到终值（false = 直接显示终值，只长环） */
  countUp?: boolean
  /** 中心主文字前缀（如「综合」），不参与滚动 */
  prefix?: string
  /** 中心主文字后缀（如「分」），不参与滚动 */
  suffix?: string
  /** 副标题（环下方小字） */
  caption?: string
}>(), {
  size: 120,
  color: '#C9A063',
  trackColor: '#EEE9E1',
  stroke: 10,
  countUp: true,
  prefix: '',
  suffix: '',
  caption: '',
})

/** 生长 + 数字动画总时长。环 800ms；数字 ≤600ms（验收要求） */
const RING_MS = 800
const NUM_MS = 600

/** 当前渲染进度 0~1（0 = 空，1 = 满进度环 + 终值数字） */
const progress = ref(getTier() === 'off' ? 1 : 0)
/** 当前展示的数字（滚动期间实时变化） */
const displayNum = ref(getTier() === 'off' ? Math.round(props.value) : 0)

let raf = 0
let startTs = 0

/** 缓出：1-(1-p)³，docs/08 §3.5 数字滚动指定曲线 */
const easeOut = (p: number) => 1 - (1 - p) ** 3

function tick(ts: number) {
  if (!startTs)
    startTs = ts
  const elapsed = ts - startTs
  // 环生长用满 800ms；数字滚动用 600ms 后定格
  const rp = Math.min(1, elapsed / RING_MS)
  const np = Math.min(1, elapsed / NUM_MS)
  progress.value = easeOut(rp)
  displayNum.value = Math.round(easeOut(np) * Math.round(props.value))
  if (rp < 1 || np < 1) {
    raf = requestAnimationFrame(tick)
  }
  else {
    progress.value = 1
    displayNum.value = Math.round(props.value)
    raf = 0
  }
}

function play() {
  cancel()
  if (getTier() === 'off') {
    progress.value = 1
    displayNum.value = Math.round(props.value)
    return
  }
  progress.value = 0
  displayNum.value = 0
  startTs = 0
  raf = requestAnimationFrame(tick)
}

function cancel() {
  if (raf) {
    cancelAnimationFrame(raf)
    raf = 0
  }
}

/** 生成某一进度下的圆环 SVG data URI */
const src = computed(() => {
  const size = props.size
  const c = size / 2
  const r = (size - props.stroke) / 2
  const circ = 2 * Math.PI * r
  // 进度环：dashoffset 从满偏移(circ，整圈不可见) → 0(整圈可见)，按 progress 部分可见
  const offset = circ * (1 - progress.value * (Math.max(0, Math.min(100, props.value)) / 100))
  const valTxt = props.countUp ? String(displayNum.value) : String(Math.round(props.value))
  const main = `${props.prefix}${valTxt}${props.suffix}`
  const fontSize = Math.round(size * 0.26)
  const capSize = Math.max(9, Math.round(size * 0.11))
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" font-family="-apple-system, 'PingFang SC', sans-serif">`
  // 轨道
  svg += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${props.trackColor}" stroke-width="${props.stroke}"/>`
  // 进度环（旋转 -90° 让起点在顶部）
  svg += `<g transform="rotate(-90 ${c} ${c})"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${props.color}" stroke-width="${props.stroke}" stroke-linecap="round" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"/></g>`
  // 中心数字
  svg += `<text x="${c}" y="${c + fontSize * 0.34}" font-size="${fontSize}" font-weight="700" fill="${props.color}" text-anchor="middle">${main}</text>`
  if (props.caption)
    svg += `<text x="${c}" y="${c + fontSize * 0.34 + capSize + 2}" font-size="${capSize}" fill="#8C8287" text-anchor="middle">${props.caption}</text>`
  svg += '</svg>'
  return svgUri(svg)
})

watch(() => props.value, () => play(), { immediate: true })

onUnmounted(cancel)

// 暴露重播方法，供滚动入场或父组件 onShow 复用
defineExpose({ replay: play })
</script>

<template>
  <view class="xring" :style="{ width: `${size}px`, height: `${size}px` }">
    <image :src="src" :style="{ width: `${size}px`, height: `${size}px` }" class="img" mode="aspectFit" />
  </view>
</template>

<style scoped lang="scss">
.xring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.img {
  display: block;
}
</style>
