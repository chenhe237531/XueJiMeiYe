<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import DimCard from '@/components/archive/DimCard.vue'
import XIcon from '@/components/XIcon.vue'
import XMascot from '@/components/XMascot.vue'
import XNav from '@/components/XNav.vue'
import XRadar from '@/components/XRadar.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import type { MoTier } from '@/xj/motion'
import { syncMotion } from '@/xj/motion'
import { DIMS, go } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '家人的健康' } })

const xj = useXj()
/** 动效档位挂在页面根节点（AC#4）：mo-off（乐龄）下入场动画直达终态 */
const mo = ref<MoTier>(syncMotion(xj.elderMode))
watch(() => xj.elderMode, v => (mo.value = syncMotion(v)))

const d = ref<any>(null)
/** 关系 → 镜灵头像色调（AC#1：XMascot 纯 CSS 合成，零图片资源），与 list 同源 */
const TONE: Record<string, 'rose' | 'sky' | 'terra' | 'gold'> = { daughter: 'rose', son: 'sky', spouse: 'terra', other: 'gold' }
const title = computed(() => (d.value?.elder?.relation === 'daughter' || d.value?.elder?.relation === 'son' ? '妈妈的健康' : `${d.value?.elder?.salutation || '家人'}的健康`))

/**
 * 健康状态四态（AC#2，与 list/accept 同一套视觉语言；颜色必须配文字，none 再叠虚线空心形状）：
 *   none 未授权查看 / watch 需要留意（有健康预警待办）/ follow 事项待跟进（有待办或测评未完成）/ ok 状态平稳
 */
function healthOf(ov: any): { tone: string, text: string } {
  if (!ov || (!ov.summary && !ov.reminders))
    return { tone: 'none', text: '未授权查看' }
  const todos = ov.reminders || []
  if (todos.some((t: any) => t.kind === 'alert'))
    return { tone: 'watch', text: '需要留意' }
  if (todos.length || ov.summary?.index == null)
    return { tone: 'follow', text: '事项待跟进' }
  return { tone: 'ok', text: '状态平稳' }
}

onLoad(async (q: any) => {
  d.value = await http.get(`/app/family/elders/${q.elderId}/overview`)
})
const health = computed(() => healthOf(d.value))
/** 六维细览：复用档案页 DimCard（保持表达一致），无测评的维度由组件内兜底「完成测评后生成」 */
const dimScore = (code: string) => d.value?.summary?.dims?.[code] ?? null
</script>

<template>
  <view :class="[...xj.pageClass, `mo-${mo}`]">
    <XNav show-back :title="title" />
    <view v-if="d" class="stack" style="padding-top: 12px">
      <!-- 长辈头部：XMascot 头像（AC#1）+ 健康状态点四态（AC#2） -->
      <view class="card raised row gap12 elder-head mo-rise mo-d1">
        <XMascot :size="56" :tone="TONE[d.elder.relation] || 'gold'" />
        <view class="col flex1 gap4">
          <text class="t-title">{{ d.elder.salutation }}</text>
          <view class="hd">
            <view class="hd-dot" :class="health.tone" />
            <text class="t-sm hd-txt" :class="health.tone">{{ health.text }}</text>
          </view>
        </view>
      </view>
      <text class="t-sm c2">{{ d.elder.salutation }}授权您查看以下内容，可随时调整</text>

      <view v-if="d.summary" class="card stack mo-rise mo-d2">
        <text class="t-lg">一页纸摘要</text>
        <view class="col gap4"><text class="t-sm semi c-brand">妈妈的情况</text><text class="t-body">{{ d.summary.situation }}</text></view>
        <view class="col gap4"><text class="t-sm semi c-care">医生的建议</text><text class="t-body">{{ d.summary.doctor }}</text></view>
        <view class="col gap4"><text class="t-sm semi" style="color: #5c5358">门店的安排</text><text class="t-body">{{ d.summary.store }}</text></view>
        <view v-if="d.summary.dims" class="center"><XRadar :scores="d.summary.dims" :size="150" labels /></view>
      </view>

      <!-- 六维细览：复用档案页 DimCard（与 pages/archive 同款网格），家人视角与自己的档案表达一致 -->
      <view v-if="d.summary?.dims" class="dims mo-rise mo-d3">
        <DimCard v-for="dim in DIMS" :key="dim.code" :code="dim.code" :score="dimScore(dim.code)" />
      </view>

      <view v-if="d.reminders" class="group mo-rise mo-d3">
        <view class="cell"><text class="t-md">需要提醒的事</text></view>
        <view v-for="t in d.reminders" :key="t.text" class="cell">
          <XIcon :name="t.icon" color="var(--care)" />
          <view class="col flex1"><text class="t-md">{{ t.text }}</text><text class="t-sm c2">{{ t.sub }}</text></view>
        </view>
        <view v-if="!d.reminders.length" class="cell"><text class="c2">暂无待办</text></view>
      </view>
      <view v-if="!d.summary && !d.reminders" class="card empty">{{ d.elder.salutation }}暂未授权查看内容</view>
      <view class="btn ghost" hover-class="mo-press-active" @click="go('/pkg-family/list')">
        管理家人绑定
      </view>
    </view>
  </view>
</template>

<style scoped>
.elder-head {
  align-items: center;
}
/* 健康状态点（AC#2 四态；色配文字，none 虚线空心做形状区分） */
.hd {
  display: flex;
  align-items: center;
  gap: 4px;
}
.hd-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-sizing: border-box;
}
.hd-dot.ok {
  background: var(--meter-ok);
}
.hd-dot.watch {
  background: var(--meter-low);
}
.hd-dot.follow {
  background: var(--meter-near);
}
.hd-dot.none {
  background: transparent;
  border: 2px dashed var(--ink-3);
}
.hd-txt.ok {
  color: var(--meter-ok);
}
.hd-txt.watch {
  color: var(--meter-low);
}
.hd-txt.follow {
  color: var(--meter-near);
}
.hd-txt.none {
  color: var(--ink-3);
}
/* 与 pages/archive/index 的 .dims 同款网格 */
.dims {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
</style>
