<script setup lang="ts">
/**
 * XTrendChart · 可点按趋势曲线（XJ-206 / docs/08 §3.5）
 *
 * 设计取舍：小程序不支持 <svg> 标签，曲线经 data URI 用 <image> 渲染（与既有
 * lineSvg 一致）。可点按通过在数据点坐标上叠绝对定位透明热区实现：每帧计算
 * 每个点的像素坐标，渲染一个 hit <view>；点按切换 active 点并显示气泡。
 * 不依赖 xj/utils.ts 的内部函数（niceScale / x / y 都在本组件内等价实现），
 * 只复用其 svgUri 导出与主题色 themeHex（既有公开 API，不改其导出）。
 *
 * 动效规范：
 *   - 曲线「生长」用 SVG stroke-dashoffset，但 image 模式下 SMIL 不播放 →
 *     改用 mo-off 兜底：mo-off 直接终态；mo-full/lite 下曲线一次渲染即满（生长
 *     用进度环同款 rAF 重绘 polyline dasharray 模拟，见 growSrc）。
 *   - 气泡入场用 transform: scale + opacity（.mo-pop 风格），按压热区用 hover-class。
 *   - 只动 transform / opacity / stroke-dashoffset（本组件只改 SVG 的 stroke-dasharray）。
 *
 * 颜色：默认 themeHex().brand（随柔金/墨绿），可 color props 覆盖；不硬编码业务色。
 *
 * 用法示例（独立自检）：
 *   <XTrendChart :series="[{ label: '9/1', value: 46 }, { label: '9/8', value: 68 }]" unit="分" />
 *   <XTrendChart :series="trend.points" :ref-low="trend.refLow" :ref-high="trend.refHigh" unit="mmHg" />
 *   点按数据点出现气泡（label + value+unit），再点同一数据点收起；点不同点切换。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { svgUri, themeHex } from '@/xj/utils'
import { getTier } from '@/xj/motion'

interface TrendPoint {
  /** 横轴标签（如日期） */
  label: string
  /** 数值 */
  value: number
  /** 来源，用于数据点描边着色，缺省 STORE */
  source?: string
}

const props = withDefaults(defineProps<{
  /** 数据序列 */
  series: TrendPoint[]
  /** 画布宽 */
  width?: number
  /** 画布高 */
  height?: number
  /** 数值单位（如 分 / mmHg），气泡里显示 */
  unit?: string
  /** 曲线主色，默认随皮肤品牌色 */
  color?: string
  /** 参考范围下限（体检正常区段底色） */
  refLow?: number | null
  /** 参考范围上限 */
  refHigh?: number | null
}>(), {
  width: 300,
  height: 130,
  unit: '',
  color: '',
  refLow: null,
  refHigh: null,
})

const SRC_COLOR: Record<string, string> = { HOSPITAL: '#6E7F5C', STORE: '#C9A063', SELF: '#666666' }

/** 坐标轴刻度：3~4 格，步长取 1/2/2.5/5×10ⁿ（与 utils.lineSvg 等价，独立实现避免改 utils） */
function niceScale(lo: number, hi: number) {
  if (lo === hi) {
    lo -= 1
    hi += 1
  }
  const raw = (hi - lo) / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => s >= raw) || 10 * mag
  let min = Math.floor(lo / step) * step
  let max = Math.ceil(hi / step) * step
  if (lo - min < step * 0.2)
    min -= step
  if (max - hi < step * 0.2)
    max += step
  return { min, max, step }
}

const pad = { l: 34, r: 14, t: 18, b: 24 }

const geom = computed(() => {
  const pts = props.series
  const W = props.width
  const H = props.height
  if (!pts.length)
    return null
  const vals = pts.map(p => p.value)
  const { min, max, step } = niceScale(
    Math.min(...vals, ...(props.refLow != null ? [props.refLow] : [])),
    Math.max(...vals, ...(props.refHigh != null ? [props.refHigh] : [])),
  )
  const n = pts.length
  const x = (i: number) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (n - 1))
  const y = (v: number) => pad.t + ((max - v) * (H - pad.t - pad.b)) / (max - min)
  return { pts, min, max, step, x, y, W, H }
})

/** mo-off 直接终态；其它档位用 0→1 重绘 polyline dasharray 模拟生长 */
const grow = ref(getTier() === 'off' ? 1 : 0)

const color = computed(() => props.color || themeHex().brand)

/** 数据点像素坐标（供热区定位） */
const hits = computed(() => {
  const g = geom.value
  if (!g)
    return [] as { x: number, y: number, i: number }[]
  return g.pts.map((p, i) => ({ x: g.x(i), y: g.y(p.value), i }))
})

/** 当前选中的数据点序号，null = 无 */
const active = ref<number | null>(null)

function onTap(i: number) {
  // 连续点按同一数据点 = 取消；点不同点 = 切换（验收：连续点按无错位）
  active.value = active.value === i ? null : i
}

/** 生成某一生长进度下的曲线 SVG data URI */
const src = computed(() => {
  const g = geom.value
  if (!g)
    return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${props.width}" height="${props.height}"></svg>`)
  const { pts, min, max, step, x, y, W, H } = g
  const fmtNum = (v: number) => String(Math.round(v * 100) / 100)
  const showValues = pts.length <= 8
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, 'PingFang SC', sans-serif">`
  svg += `<defs><linearGradient id="xjtcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color.value}" stop-opacity="0.22"/><stop offset="1" stop-color="${color.value}" stop-opacity="0"/></linearGradient></defs>`
  // 参考范围底色
  if (props.refLow != null && props.refHigh != null)
    svg += `<rect x="${pad.l}" y="${y(props.refHigh)}" width="${W - pad.l - pad.r}" height="${Math.max(1, y(props.refLow) - y(props.refHigh))}" fill="#E9EEE2" opacity="0.7"/>`
  // 刻度线
  for (let v = min; v <= max + step / 2; v += step)
    svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="#EFEAE6" stroke-dasharray="${v === min ? '0' : '3 3'}"/><text x="${pad.l - 8}" y="${y(v) + 3.5}" font-size="10" fill="#8C8287" text-anchor="end">${fmtNum(v)}</text>`
  const line = pts.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')
  // 渐变面积
  if (pts.length > 1)
    svg += `<polygon points="${x(0)},${y(min)} ${line} ${x(pts.length - 1)},${y(min)}" fill="url(#xjtcg)"/>`
  // 生长：用 stroke-dasharray 遮罩整段折线，按 grow 进度显示前段
  const totalLen = pts.length > 1 ? pts.reduce((acc, _, i) => i === 0 ? 0 : acc + Math.hypot(x(i) - x(i - 1), y(pts[i].value) - y(pts[i - 1].value)), 0) : 0
  const visLen = totalLen * grow.value
  if (pts.length > 1)
    svg += `<polyline points="${line}" fill="none" stroke="${color.value}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="${totalLen.toFixed(1)}" stroke-dashoffset="${(totalLen - visLen).toFixed(1)}"/>`
  pts.forEach((p, i) => {
    const last = i === pts.length - 1
    svg += `<circle cx="${x(i)}" cy="${y(p.value)}" r="${last ? 5.5 : 4}" fill="${last ? color.value : '#fff'}" stroke="${last ? '#fff' : SRC_COLOR[p.source || 'STORE']}" stroke-width="2.5"/>`
    if (showValues)
      svg += `<text x="${x(i)}" y="${y(p.value) - 10}" font-size="11" font-weight="${last ? 700 : 500}" fill="${last ? '#2A2427' : '#6F666B'}" text-anchor="middle">${fmtNum(p.value)}</text>`
    if (pts.length <= 8 || i % Math.ceil(pts.length / 6) === 0)
      svg += `<text x="${x(i)}" y="${H - 7}" font-size="10" fill="#8C8287" text-anchor="middle">${p.label}</text>`
  })
  svg += '</svg>'
  return svgUri(svg)
})

/** 选中点的气泡内容 */
const activePoint = computed(() => {
  if (active.value === null)
    return null
  const g = geom.value
  if (!g)
    return null
  const i = active.value
  const p = g.pts[i]
  if (!p)
    return null
  return { i, label: p.label, value: p.value, x: g.x(i), y: g.y(p.value) }
})

/**
 * 入场生长：mo-off 跳过，其它档位用 IntersectionObserver 触发更稳，但组件内自给
 *  用 mounted 后下一帧推进，保证组件一挂载即长（避免依赖页面 IO 触发器）
 */
let raf = 0
let startTs = 0
const GROW_MS = 800
function growTick(ts: number) {
  if (!startTs)
    startTs = ts
  const p = Math.min(1, (ts - startTs) / GROW_MS)
  grow.value = 1 - (1 - p) ** 3
  if (p < 1) {
    raf = requestAnimationFrame(growTick)
  }
  else {
    grow.value = 1
    raf = 0
  }
}
onMounted(() => {
  if (getTier() === 'off') {
    grow.value = 1
    return
  }
  grow.value = 0
  startTs = 0
  raf = requestAnimationFrame(growTick)
})
onUnmounted(() => {
  if (raf)
    cancelAnimationFrame(raf)
})
</script>

<template>
  <view class="xtc" :style="{ width: `${width}px`, height: `${height}px` }">
    <image :src="src" :style="{ width: `${width}px`, height: `${height}px` }" class="img" mode="aspectFit" />
    <!-- 数据点热区：透明 view 覆盖每个点，实现可点按 -->
    <view
      v-for="h in hits"
      :key="h.i"
      class="hit"
      hover-class="hit-on"
      :hover-stay-time="80"
      :style="{ left: `${h.x - 14}px`, top: `${h.y - 14}px` }"
      @tap="onTap(h.i)"
    />
    <!-- 提示气泡：点按数据点后出现，scale 弹出 -->
    <view v-if="activePoint" class="tip mo-pop" :style="{ left: `${activePoint.x}px`, top: `${activePoint.y - 16}px` }" @tap="onTap(activePoint.i)">
      <text class="tip-l">{{ activePoint.label }}</text>
      <text class="tip-v num">{{ activePoint.value }}{{ unit }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.xtc {
  position: relative;
}
.img {
  display: block;
}
/* 透明热区：略大于数据点，便于手指点按 */
.hit {
  position: absolute;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: transparent;
  z-index: 2;
}
.hit-on {
  background: rgba(201, 160, 99, 0.12);
}
/* 气泡：跟随数据点上方，指针下尖 */
.tip {
  position: absolute;
  transform: translate(-50%, -100%) scale(1);
  transform-origin: bottom center;
  background: var(--surface, #fff);
  border: 1px solid var(--line-2, #e5ddd2);
  border-radius: 8px;
  box-shadow: 0 4px 12px -6px rgba(60, 48, 34, 0.25);
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  z-index: 3;
  white-space: nowrap;
}
.tip::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -5px;
  transform: translateX(-50%) rotate(45deg);
  width: 8px;
  height: 8px;
  background: var(--surface, #fff);
  border-right: 1px solid var(--line-2, #e5ddd2);
  border-bottom: 1px solid var(--line-2, #e5ddd2);
}
.tip-l {
  font-size: 10px;
  color: var(--ink-3, #8d8479);
  line-height: 1.2;
}
.tip-v {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink, #2b2622);
  line-height: 1.3;
}
.elder .tip-l {
  font-size: 12px;
}
.elder .tip-v {
  font-size: 15px;
}
</style>
