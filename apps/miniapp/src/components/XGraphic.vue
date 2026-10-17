<script setup lang="ts">
import type { GraphicName } from '@/xj/graphics'
import { computed } from 'vue'
import { graphicClass } from '@/xj/graphics'

/**
 * 彩色图形组件（开源图形，MIT 许可，见 src/icons/graphics/LICENSE.md）。
 *
 * 与 `XIcon` 对称：`XIcon` 是单色可改色图标（mask 模式），本组件是自带颜色的图形（bg 模式）。
 * 两种用法：
 *   裸图形 —— <XGraphic name="dim-skin" :size="22" />
 *   带底座 —— <XGraphic name="dim-skin" chip chip-size="md" tone="gold" />
 *
 * 为什么要 `chip`（浅色底座）：
 *   1. 部分图形主色偏浅或偏灰（如 dim-posture 的灰调、dim-skin 的浅蓝），直接放在
 *      夜色金 / 乐龄墨绿的深色底上对比不足；浅底能稳定对比度。
 *   2. 一组图形混排时，各图形自身留白不同会导致视觉大小参差，统一底座可把它们
 *      "对齐"到同一占位尺寸。
 *
 * 为什么 chip 尺寸走 CSS 变量而不是内联像素：
 *   乐龄模式与夜色皮肤都会改变底座尺寸与配色，写死像素会导致乐龄下图形不跟着放大。
 *   尺寸变量（--gd-size-*）与比例（--gd-ratio）随皮肤继承，图形尺寸自动跟随。
 */
const props = withDefaults(defineProps<{
  /** 图形名，见 xj/graphics.ts 的 GRAPHICS；传未知值时不渲染（不出现空白块） */
  name: GraphicName | string
  /** 裸图形尺寸（px 或 CSS 长度），仅 chip=false 时生效 */
  size?: number | string
  /** 是否加浅色底座（深色皮肤下提升对比） */
  chip?: boolean
  /** 底座档位，对齐 index.scss 的图标底座规范 28 / 38 / 46（乐龄自动放大） */
  chipSize?: 'sm' | 'md' | 'lg'
  /** 底座色调，与 index.scss 的 .icon-box / .ic-chip 色名一一对应 */
  tone?: 'plain' | 'gold' | 'care' | 'terra' | 'rose' | 'sky' | 'plum'
}>(), {
  size: 22,
  chip: false,
  chipSize: 'md',
  tone: 'plain',
})

const cls = computed(() => graphicClass(props.name))

const style = computed(() => {
  if (props.chip) {
    // 底座内图形 = 底座边长 × 比例；两者都是继承变量，随皮肤与乐龄档位变化
    return { fontSize: `calc(var(--gd-size-${props.chipSize}, 38px) * var(--gd-ratio, 0.64))` }
  }
  return { fontSize: typeof props.size === 'number' ? `${props.size}px` : (props.size || '22px') }
})
</script>

<template>
  <view v-if="cls" class="xg-wrap" :class="chip && ['xg-chip', `xg-${chipSize}`, `xg-tone-${tone}`]">
    <view class="xg-img" :class="cls" :style="style" />
  </view>
</template>

<style scoped>
/* 单类选择器：小程序端 scoped 会编译成「类 + data-v」组合，不会退化为后代选择器 */
.xg-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.xg-img {
  display: block;
  width: 1em;
  height: 1em;
}
</style>
