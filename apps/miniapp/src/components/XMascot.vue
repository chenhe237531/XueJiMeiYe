<script setup lang="ts">
import { computed } from 'vue'

/**
 * 小镜 CSS 合成形象（见 docs/07 §2、docs/08 §5.6，决议 D19）
 *
 * 「镜灵」方案：金色渐变圆底 + 镜面高光 + 两点眼 + 弧线微笑 + 淡腮红。
 * 全部由 border-radius + linear-gradient + 绝对定位子元素合成，**零图片资源、零新增依赖**。
 * 为什么不用位图 / 插画：零包体积增量、三套皮肤自动换色；且插画无法随皮肤变化（D19）。
 * 为什么不用 <svg>：小程序不支持 <svg> 标签。
 *
 * 结构层（docs/07 §2.2，层序号即绘制顺序）：
 *   底   容器     100%      圆形，border: 2px solid var(--brand)（乐龄 3px）
 *   1    高光     left14%/top9% w40%/h30%   rotate(-20deg)
 *   2/3  左/右眼  top42% w14%/h17%，left/right 31%
 *   4    微笑     居中 top57% w26%/h15%，border-bottom + radius 0 0 45% 45%
 *   5/6  左/右腮红 top56% w16%/h11%，left/right 15%
 *
 * 三皮肤与三级动效档位**全部走继承的自定义属性**（定义在 style/mascot.scss 的
 * page,.xj / .xj.elder / .xj.night / .mo-lite / .mo-off），组件里不写任何 .elder / .night
 * 选择器——自定义属性跨小程序自定义组件边界稳定继承，后代选择器不可靠。
 *
 * 动效只动 transform / opacity；不监听 onPageScroll、无 setData、无 will-change 常驻。
 */

/** 尺寸阶梯（docs/07 §2.4）。也接受任意数值：44px（魔镜页头部）等非阶梯尺寸按比例插值描边。 */
const props = withDefaults(defineProps<{
  /** 尺寸：阶梯值 32 / 48 / 72 / 88，默认 48。传其他数值按 0.042 比例插值描边宽度 */
  size?: number
  /** 状态：在线 / 思考中 / 说话中 / 离线夜间 */
  state?: 'online' | 'thinking' | 'speaking' | 'night'
  /** 色调：auto 跟随皮肤（默认）；指定色调则放弃皮肤跟随，用于家人头像等多角色复用 */
  tone?: 'auto' | 'gold' | 'care' | 'terra' | 'rose' | 'sky' | 'plum'
}>(), {
  size: 48,
  state: 'online',
  tone: 'auto',
})

/** 阶梯描边宽度：规格值，非线性（32→1.5 / 48→2 / 72→2.5 / 88→3），故写死而非按比例推算 */
const STROKE_LADDER: Record<number, number> = { 32: 1.5, 48: 2, 72: 2.5, 88: 3 }

const rootStyle = computed(() => {
  const sz = props.size
  const w = STROKE_LADDER[sz] ?? Math.max(1, sz * 0.042)
  return {
    '--mas-sz': `${sz}px`,
    '--mas-stroke': `${Number(w.toFixed(2))}px`,
  }
})

const rootClass = computed(() => [
  props.tone !== 'auto' && `xm-tone-${props.tone}`,
  props.state === 'night' && 'xm-is-night',
])

/** 在线绿点在「离线 / 夜间」态不出现 */
const showDot = computed(() => props.state !== 'night')
</script>

<template>
  <!-- 纯装饰性插画：语义由使用处的文案承载（如魔镜页头的「在线陪伴您」），对读屏隐藏 -->
  <view class="xm" :class="rootClass" :style="rootStyle" aria-hidden="true">
    <view class="xm-body">
      <!-- 五官整体成一簇，乐龄下对整簇施加 scale，比逐个改百分比更能保持相对位置 -->
      <view class="xm-face">
        <view class="xm-eye xm-eye-l" />
        <view class="xm-eye xm-eye-r" />
        <view class="xm-mouth" />
        <view class="xm-blush xm-blush-l" />
        <view class="xm-blush xm-blush-r" />
      </view>
    </view>

    <view v-if="showDot" class="xm-dot" />

    <!-- 思考中：外圈 2px 弧线旋转。属状态指示，乐龄与 mo-off 档位下**保留**（docs/07 §7） -->
    <view v-if="state === 'thinking'" class="xm-arc" />

    <!-- 说话中：右侧三根声波条。属装饰性循环，轻效 / 关闭 / 乐龄下静止 -->
    <view v-if="state === 'speaking'" class="xm-wave">
      <view class="xm-bar xm-bar-1" />
      <view class="xm-bar xm-bar-2" />
      <view class="xm-bar xm-bar-3" />
    </view>
  </view>
</template>

<style scoped>
/* 全部为单类 / 「类 + 类」组合选择器：小程序端 scoped 会编译成「类 + data-v」，
   不会退化为不可靠的后代选择器；皮肤与档位差异一律由继承变量承担。 */

.xm {
  position: relative;
  flex-shrink: 0;
  width: var(--mas-sz, 48px);
  height: var(--mas-sz, 48px);
}

/* ── 镜身 ── */
.xm-body {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border-radius: 50%;
  background: var(--mas-bg, linear-gradient(135deg, #f7ede0 0%, #dcbd88 55%, #c9a063 100%));
  border-style: solid;
  border-color: var(--mas-ring, #c9a063);
  /* 乐龄把 --mas-stroke-elder 继承下来压过按 size 写入的 --mas-stroke，实现「加粗到 3px」 */
  border-width: var(--mas-stroke-elder, var(--mas-stroke, 2px));
  box-shadow: var(--mas-shadow, 0 5px 12px -5px rgba(168, 130, 77, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.7));
}

/* ── 1 镜面高光：斜置白色椭圆，模拟反光 ── */
.xm-body::before {
  content: '';
  position: absolute;
  left: 14%;
  top: 9%;
  width: 40%;
  height: 30%;
  border-radius: 50%;
  background: var(--mas-gloss, rgba(255, 255, 255, 0.72));
  transform: rotate(-20deg);
}

/* ── 五官簇：乐龄下整体放大 15%，位置关系自动保持 ── */
.xm-face {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  transform: scale(var(--mas-feature, 1));
  transform-origin: 50% 52%;
}

/* ── 2/3 两点眼 ── */
.xm-eye {
  position: absolute;
  top: 42%;
  width: 14%;
  height: 17%;
  border-radius: 50%;
  background: var(--mas-ink, #6b4e2e);
}

.xm-eye-l {
  left: 31%;
}

.xm-eye-r {
  right: 31%;
}

/* ── 4 弧线微笑：只留底边 + 下圆角，即得向上弯的弧 ── */
.xm-mouth {
  position: absolute;
  left: 50%;
  top: 57%;
  width: 26%;
  height: 15%;
  box-sizing: border-box;
  transform: translateX(-50%);
  border-bottom-style: solid;
  border-bottom-width: var(--mas-stroke-elder, var(--mas-stroke, 2px));
  border-bottom-color: var(--mas-ink, #6b4e2e);
  border-radius: 0 0 45% 45%;
}

/* ── 5/6 腮红 ── */
.xm-blush {
  position: absolute;
  top: 56%;
  width: 16%;
  height: 11%;
  border-radius: 50%;
  background: var(--mas-blush, rgba(200, 138, 148, 0.5));
}

.xm-blush-l {
  left: 15%;
}

.xm-blush-r {
  right: 15%;
}

/* ── 在线绿点：尺寸随镜身等比（13px @ 48px），描边固定在镜身外沿 ── */
.xm-dot {
  position: absolute;
  right: -2%;
  bottom: 2%;
  box-sizing: border-box;
  width: calc(var(--mas-sz, 48px) * 0.27);
  height: calc(var(--mas-sz, 48px) * 0.27);
  border-radius: 50%;
  border: 2px solid var(--mas-dot-ring, #ffffff);
  background: var(--mas-dot, #66784e);
}

/* ── 思考中：外圈弧线（只上边着色 → 90° 弧） ──
   --mas-spin-dur 不被 mo-lite / mo-off / 乐龄归零，因此关闭档位下仍在转（状态指示） */
.xm-arc {
  position: absolute;
  left: calc(var(--mas-sz, 48px) * -0.08);
  top: calc(var(--mas-sz, 48px) * -0.08);
  right: calc(var(--mas-sz, 48px) * -0.08);
  bottom: calc(var(--mas-sz, 48px) * -0.08);
  box-sizing: border-box;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: var(--mas-ring, #c9a063);
  animation: xj-mas-spin var(--mas-spin-dur, 1000ms) linear infinite;
}

/* ── 说话中：右侧三根声波条，仅做 scaleY 与 opacity ──
   乐龄 / 轻效 / 关闭档位下由 --mas-wave-play 置为 paused（真静止，且停在满高起点）。
   刻意贴住镜身右缘并略向外溢出：容器需留出约 25% 宽度的右侧余量。 */
.xm-wave {
  position: absolute;
  right: calc(var(--mas-sz, 48px) * -0.24);
  top: 50%;
  display: flex;
  align-items: center;
  transform: translateY(-50%);
  gap: calc(var(--mas-sz, 48px) * 0.04);
}

.xm-bar {
  width: calc(var(--mas-sz, 48px) * 0.06);
  border-radius: 999px;
  background: var(--mas-wave, #6b4e2e);
  transform-origin: center;
  animation: xj-mas-wave var(--mas-wave-dur, 900ms) var(--mo-ease, cubic-bezier(0.2, 0, 0, 1)) infinite alternate;
  animation-play-state: var(--mas-wave-play, running);
}

/* 三根条的目标高度 8 / 14 / 10 @ 48px，错峰让波形看起来在流动 */
.xm-bar-1 {
  height: calc(var(--mas-sz, 48px) * 0.167);
}

.xm-bar-2 {
  height: calc(var(--mas-sz, 48px) * 0.292);
  animation-delay: 140ms;
}

.xm-bar-3 {
  height: calc(var(--mas-sz, 48px) * 0.208);
  animation-delay: 280ms;
}

@keyframes xj-mas-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

/* 起点为满高：暂停（乐龄 / 轻效 / 关闭）时三根条自然立着，而不是停在被压扁的中间帧 */
@keyframes xj-mas-wave {
  from {
    transform: scaleY(1);
    opacity: 1;
  }

  to {
    transform: scaleY(0.45);
    opacity: 0.55;
  }
}
</style>
