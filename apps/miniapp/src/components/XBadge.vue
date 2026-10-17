<script setup lang="ts">
import type { GraphicName } from '@/xj/graphics'
import { computed } from 'vue'

/**
 * 成就徽章（见 docs/09）。
 *
 * 视觉语言刻意做成「线稿 → 上色」两态，而不是靠灰度滤镜：
 *   未解锁 = Tabler 单色线稿（mask 模式，灰色）+ 虚线盘 + 半透明进度条
 *   已解锁 = Fluent Emoji 彩色图形（bg 模式）+ 金环盘 + 立体投影
 *   新解锁 = 已解锁态 + 一次性弹入与光晕扩散
 *
 * 为什么不用 `filter: grayscale()` 做未解锁态：
 *   小程序端 CSS filter 在部分低端安卓机表现不一致；而线稿/彩图两套来源都是现成的
 *   （Tabler 已在项目里、Fluent 图形也已引入），零额外体积且语义更清楚——
 *   用户一眼能看出"这是同一枚徽章，只是还没点亮"。
 *
 * 尺寸不写死像素：走 --xb-sz-* / --xb-icon-ratio 继承变量，
 * 乐龄模式下盘径自动放大（56 / 68 / 80），组件里不需要任何 .elder 选择器。
 */
const props = withDefaults(defineProps<{
  /** 已解锁时显示的彩色图形名（xj/graphics.ts 的 GRAPHICS） */
  icon: GraphicName | string
  /** 未解锁时的 Tabler 线稿图标名（需在 uno.config.ts safelist 内） */
  outline?: string
  /** 徽章名称 */
  label?: string
  /** 状态：未解锁 / 已解锁 / 新解锁 */
  state?: 'locked' | 'unlocked' | 'new'
  /** 盘径档位 */
  size?: 'sm' | 'md' | 'lg'
  /** 未解锁时的进度 0~1；不传则不显示进度条 */
  progress?: number
}>(), {
  outline: 'award',
  state: 'unlocked',
  size: 'md',
})

const unlocked = computed(() => props.state !== 'locked')

/** 盘内图形尺寸 = 盘径 × 占比，两者都是继承变量，乐龄下自动跟随放大 */
const iconSize = computed(() => `calc(var(--xb-sz-${props.size}, 58px) * var(--xb-icon-ratio, 0.54))`)
/** 线稿略小于彩图：线稿笔画到边缘会更"满"，略缩才与彩图视觉等重 */
const outlineSize = computed(() => `calc(var(--xb-sz-${props.size}, 58px) * 0.4)`)

const barStyle = computed(() => ({
  transform: `scaleX(${Math.min(1, Math.max(0, props.progress ?? 0))})`,
}))
</script>

<template>
  <view class="xbadge">
    <view
      class="xb-disc"
      :class="[`xb-sz-${size}`, `xb-disc-${state}`, state === 'new' && 'gd-pop']"
    >
      <XGraphic v-if="unlocked" :name="icon" :size="iconSize" />
      <XIcon v-else :name="outline" :size="outlineSize" />
      <view v-if="state === 'new'" class="xb-halo gd-halo" />
    </view>

    <text v-if="label" class="xb-label" :class="{ 'xb-label-locked': !unlocked }">{{ label }}</text>

    <view v-if="!unlocked && progress != null" class="xb-bar">
      <view class="xb-fill" :style="barStyle" />
    </view>
  </view>
</template>

<style scoped>
.xbadge {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

/* 盘体：所有尺寸类都写成「类 + 类」，不用后代选择器——小程序端 scoped 会编译成
   「类 + data-v」组合，后代选择器在组件边界的表现不可靠 */
.xb-disc {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 50%;
  border: 1.5px solid var(--xb-ring, rgba(201, 160, 99, 0.45));
  background: var(--xb-disc, linear-gradient(150deg, #fef8ee 0%, #f1ddba 100%));
  box-shadow: var(--xb-shadow, 0 4px 14px -8px rgba(60, 48, 34, 0.32));
}

.xb-disc.xb-sz-sm {
  width: var(--xb-sz-sm, 48px);
  height: var(--xb-sz-sm, 48px);
}
.xb-disc.xb-sz-md {
  width: var(--xb-sz-md, 58px);
  height: var(--xb-sz-md, 58px);
}
.xb-disc.xb-sz-lg {
  width: var(--xb-sz-lg, 70px);
  height: var(--xb-sz-lg, 70px);
}

/* 未解锁：灰底 + 虚线盘，与已解锁的实线金环形成明确区分 */
.xb-disc.xb-disc-locked {
  background: var(--xb-locked-bg, #f4f0ea);
  border-style: dashed;
  border-color: var(--xb-locked-line, #ded7cd);
  box-shadow: none;
  color: var(--xb-locked-ink, #b6ada3);
}

/* 新解锁的光晕：向外扩散一次，之后静止（乐龄与轻效档位下动画被置零） */
.xb-halo {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    var(--xb-halo, rgba(210, 180, 122, 0.5)) 0%,
    var(--xb-halo-0, rgba(210, 180, 122, 0)) 70%
  );
}

.xb-label {
  max-width: 76px;
  font-size: var(--fs-xs, 12px);
  line-height: 1.25;
  text-align: center;
  color: var(--xb-label, #5c544d);
}

.xb-label.xb-label-locked {
  color: var(--xb-label-locked, #8d8479);
}

/* 未解锁进度：用 scaleX 而非 width，避免逐帧重排 */
.xb-bar {
  width: 60%;
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
  background: var(--xb-bar, #e8e0d5);
}

.xb-fill {
  width: 100%;
  height: 100%;
  border-radius: 2px;
  transform-origin: left center;
  background: var(--xb-bar-fill, linear-gradient(90deg, #dcc190 0%, #c9a063 100%));
  transition: transform var(--mo-emph, 420ms) var(--mo-ease-out, cubic-bezier(0.3, 0, 1, 1));
}
</style>
