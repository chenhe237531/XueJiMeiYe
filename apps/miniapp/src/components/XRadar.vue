<script setup lang="ts">
/**
 * XRadar · 六维雷达图（XJ-208 / docs/07 §5、决议 D17）
 *
 * 小程序不支持 <svg> 标签，SVG 只能经 data URI 由 <image> 渲染，且 image 模式下
 * SVG 内部的 SMIL/CSS 动画不播放（docs/09 第 4 章脚注）。所以「从中心生长」不能靠
 * stroke-dashoffset 动效，改由**图层拆分 + transform: scale()** 实现：
 *
 *   底图层（baseSrc）  —— 只画网格 + 「上次」虚线，始终在原位、不参与动画
 *   数据层（dataSrc）  —— 只画本次多边形与数据点，套一层 view 做 scale(0→1)
 *
 * 为什么不整体缩放一张图：那样网格会跟着一起放大，读起来像「镜头推近」，
 * 而不是「数据从中心长出来」。拆成两层后，网格稳住、数据生长，语义才对。
 *
 * 生长时长 800ms，与 XIndexRing 的环生长对齐（同一页面上两个图元同步收）。
 * 档位：满效播放；轻效 / 关闭（含乐龄）**直接呈现终态**——由 getTier() 在 JS 侧判定，
 * 不使用 CSS 后代选择器（组件边界上不可靠）。
 *
 * D17：维度图形只能作为**兄弟节点**叠加在雷达图四角（小程序 SVG 内部不能嵌外部图形）。
 * 故 graphics 模式渲染 6 个绝对定位的顶点节点，与 labels 共用同一套顶点坐标。
 *
 * 兼容性：grow / graphics 默认关闭，关闭时走「单张完整图」的老路径，
 * 渲染结果与 XJ-208 之前完全一致（档案页 XJ-207 不受影响）。
 */
import { computed } from 'vue'
import XGraphic from '@/components/XGraphic.vue'
import { DIM_GRAPHIC } from '@/xj/graphics'
import { getTier } from '@/xj/motion'
import { DIMS, radarLabels, radarSvg, svgUri, themeHex } from '@/xj/utils'

const props = defineProps<{
  scores: Record<string, number>
  prev?: Record<string, number> | null
  size?: number
  /** 顶点显示「维度名 + 得分」文本 */
  labels?: boolean
  /** 夜色金皮肤（SVG 走 data URI，不能用 CSS 变量，只能靠 prop 传） */
  dark?: boolean
  /** 本次数据从中心生长；mo-off / 轻效直接呈现终态 */
  grow?: boolean
  /** 按 D17 在六个顶点叠加维度图形（与 labels 互斥：图形模式下分数交给分维度卡片） */
  graphics?: boolean
}>()

const size = computed(() => props.size || 200)
const color = computed(() => themeHex().brand)
const opts = computed(() => ({ size: size.value, dark: props.dark, color: color.value }))

/** 老路径：单张完整图（网格 + 本次 + 上次虚线） */
const src = computed(() => radarSvg(props.scores || {}, props.prev, opts.value))
/** 生长模式底图：scores 传空 → 不画本次多边形，只留网格与「上次」虚线 */
const baseSrc = computed(() => radarSvg({}, props.prev, opts.value))
/** 生长模式数据层：仅本次多边形 + 数据点 */
const dataSrc = computed(() => dataPolygonSvg(props.scores || {}, opts.value))

const animate = computed(() => !!props.grow && getTier() === 'full')
const labelList = computed(() => radarLabels(props.scores || {}))
const padX = computed(() => (props.labels || props.graphics ? 76 : 0))
/** 图形模式比纯文本多一行图形，纵向留白略大 */
const padY = computed(() => (props.graphics ? 58 : props.labels ? 44 : 0))

/**
 * 只画「本次」的数据多边形与数据点。
 * 几何必须与 utils.radarSvg 完全一致（R = size*0.42、起始 -90°、每维 60°、0.06 下限），
 * 否则数据层会与网格错位。utils.radarSvg 归 XJ-206 所有，本卡不改它，故此处局部实现。
 */
function dataPolygonSvg(scores: Record<string, number>, o: { size: number, dark?: boolean, color: string }) {
  const { size: s, dark, color: stroke } = o
  const c = s / 2
  const R = s * 0.42
  const pt = (i: number, r: number) => {
    const ang = -Math.PI / 2 + (i * Math.PI * 2) / 6
    return [c + r * Math.cos(ang), c + r * Math.sin(ang)] as const
  }
  const [cr, cg, cb] = [1, 3, 5].map(i => Number.parseInt(stroke.slice(i, i + 2), 16))
  const area = dark ? 'rgba(210,180,122,0.18)' : `rgba(${cr},${cg},${cb},0.3)`
  const pts = DIMS.map((d, i) => pt(i, R * Math.max(0.06, (scores?.[d.code] ?? 0) / 100)))
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">`
  svg += `<polygon points="${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${area}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`
  DIMS.forEach((d, i) => {
    if (scores?.[d.code] !== undefined) {
      const [x, y] = pts[i]
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${stroke}"/>`
    }
  })
  svg += '</svg>'
  return svgUri(svg)
}
</script>

<template>
  <view
    class="radar"
    :class="{ labeled: labels || graphics }"
    :style="{ width: `${size + padX}px`, height: `${size + padY}px` }"
  >
    <!-- 老路径：一张图搞定，渲染结果与改造前完全一致 -->
    <image v-if="!grow" :src="src" :style="{ width: `${size}px`, height: `${size}px` }" class="img" mode="aspectFit" />

    <!-- 生长路径：网格不动、数据层缩放 -->
    <template v-else>
      <image :src="baseSrc" :style="{ width: `${size}px`, height: `${size}px` }" class="img" mode="aspectFit" />
      <view class="data" :style="{ width: `${size}px`, height: `${size}px` }">
        <view class="data-in" :class="{ 'rd-grow': animate }">
          <image :src="dataSrc" :style="{ width: `${size}px`, height: `${size}px` }" class="img" mode="aspectFit" />
        </view>
      </view>
    </template>

    <!-- D17：维度图形作为兄弟节点叠在顶点（图形 + 维度名；分数由分维度卡片承载） -->
    <template v-if="graphics">
      <view
        v-for="l in labelList"
        :key="l.code"
        class="vt"
        :style="{ left: `${l.left}%`, top: `${l.top}%` }"
      >
        <XGraphic :name="DIM_GRAPHIC[l.code]" :size="18" />
        <text class="vt-n">{{ l.name }}</text>
      </view>
    </template>

    <template v-else-if="labels">
      <view v-for="l in labelList" :key="l.code" class="lbl" :class="{ dark }" :style="{ left: `${l.left}%`, top: `${l.top}%` }">
        <text>{{ l.name }}</text>
        <text class="sc num">{{ l.score ?? '-' }}</text>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.radar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.img {
  display: block;
}
/* 顶部 / 底部标签会超出容器半个标签高，留出空间避免压到上下文字 */
.radar.labeled {
  margin: 16px auto;
}

/* 数据层：绝对居中在雷达图上，不参与布局 */
.data {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}
.data-in {
  width: 100%;
  height: 100%;
  transform-origin: center center;
}
/* 从中心生长：只动 transform 与 opacity（满效档位才挂这个类） */
.rd-grow {
  animation: xj-radar-grow 800ms var(--mo-ease-out, cubic-bezier(0.3, 0, 1, 1)) both;
}
@keyframes xj-radar-grow {
  from {
    transform: scale(0.02);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.lbl {
  position: absolute;
  transform: translate(-50%, -50%);
  width: max-content;
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
  color: var(--ink-2);
  line-height: 1.2;
}
.elder .lbl {
  font-size: 14px;
}
.lbl .sc {
  font-weight: 700;
  color: var(--ink);
  font-size: 13px;
}
.lbl.dark {
  color: #b3a8a2;
}
.lbl.dark .sc {
  color: #f2ece8;
}

/* 顶点图形节点：图形在上、维度名在下 */
.vt {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.vt-n {
  font-size: 11px;
  line-height: 1.1;
  color: var(--ink-2);
  white-space: nowrap;
}
.elder .vt-n {
  font-size: 13px;
}
</style>
