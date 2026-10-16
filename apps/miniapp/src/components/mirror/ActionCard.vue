<script setup lang="ts">
import XIcon from '@/components/XIcon.vue'

/**
 * 魔镜回复内的行动卡（docs/06 §3.3「回复卡片化」、docs/07 §2.6）
 *
 * 纯展示组件：把一条可执行动作画成「浅金底小卡」；点击只向上抛 `run`，
 * 具体行为（跳页 / 就地引导）由页面决定——组件不 import 任何 uni API，便于单测与实际复用。
 *
 * 尺寸与字号**全部消费设计令牌**，因此「乐龄下同步放大」不需要任何 .elder 选择器：
 *   --sp-*（乐龄 ×1.35）· --fs-*（乐龄已加大）· --btn-h（48 / 60）· --r-md
 * 项目约定：组件内不写皮肤选择器；皮肤 / 档位差异一律走继承的自定义属性，
 * 而自定义属性可稳定穿透小程序自定义组件边界（后代选择器不可靠）。
 *
 * 图标走 XIcon（i-tabler-* + 动态类名），类名无法被 UnoCSS 静态扫描，
 * 故所用图标名必须在 uno.config.ts 的 safelist 中登记；本组件只消费调用方传入的 name。
 *
 * 按压反馈：小程序不支持 CSS :hover / :active（项目硬约束），
 * 因此用原生 hover-class 绑定全局动效类 .mo-press-active，并配 hover-stay-time="80"。
 */
withDefaults(defineProps<{
  /** 动作名，如「4-7-8 呼吸法」 */
  title: string
  /** 一句人话说明该做什么 */
  desc?: string
  /** Tabler 图标名（不含 i-tabler- 前缀），须已在 uno.config.ts safelist 登记 */
  icon?: string
  /** 右侧小字：时长（「38 秒」）或去向（「去看看」） */
  meta?: string
}>(), {
  desc: '',
  icon: 'sparkles',
  meta: '',
})

defineEmits<{ (e: 'run'): void }>()
</script>

<template>
  <view class="ac mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="$emit('run')">
    <view class="ac-ic">
      <XIcon :name="icon" size="var(--ac-ic)" />
    </view>
    <view class="ac-tx">
      <view class="ac-head">
        <text class="ac-title">{{ title }}</text>
        <text v-if="meta" class="ac-meta">{{ meta }}</text>
      </view>
      <text v-if="desc" class="ac-desc">{{ desc }}</text>
    </view>
    <XIcon name="chevron-right" size="var(--ac-meta-ic)" />
  </view>
</template>

<style scoped lang="scss">
.ac {
  /* 图标字号走令牌：乐龄 --fs-lg 22px，标准 18px。XIcon 的 size 支持字符串，直接吃 CSS 变量 */
  --ac-ic: var(--fs-lg, 18px);
  --ac-meta-ic: var(--fs-sm, 13px);

  display: flex;
  align-items: center;
  gap: var(--sp-2, 8px);
  box-sizing: border-box;
  width: 100%;
  /* 触控目标：直接复用按钮高度令牌（标准 48 / 乐龄 60），无需额外断点 */
  min-height: var(--btn-h, 48px);
  padding: var(--sp-1, 4px) var(--sp-2, 8px);
  border-radius: var(--r-md, 12px);
  border: 1px solid var(--brand-line, #e3cdb0);
  background: linear-gradient(160deg, var(--brand-soft, #f7ede0), var(--surface, #fff));
  color: var(--brand-ink, #6b4e2e);
}

/* 图标底盘：与卡片底色相反（白底 / 夜色深底），保证图标在小卡上有足够对比 */
.ac-ic {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--gd-size-sm, 28px);
  height: var(--gd-size-sm, 28px);
  border-radius: var(--r-sm, 8px);
  border: 1px solid var(--brand-line, #e3cdb0);
  background: var(--surface, #fff);
}

.ac-tx {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

/* 标题行：动作名 + 右侧时长 / 去向。meta 与标题同行，
   说明文字才能吃到整行宽度——否则乐龄大字下说明会被 meta 挤成三行锯齿。 */
.ac-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2, 8px);
}

.ac-title {
  font-size: var(--fs-body, 15px);
  font-weight: 700;
  line-height: 1.35;
}

.ac-meta {
  margin-left: auto;
  flex-shrink: 0;
  font-size: var(--fs-xs, 12px);
  font-weight: 600;
}

.ac-desc {
  margin-top: 2px;
  font-size: var(--fs-xs, 12px);
  font-weight: 400;
  line-height: 1.4;
  color: var(--ink-2, #5c544d);
}
</style>
