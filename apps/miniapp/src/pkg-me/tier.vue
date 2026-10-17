<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'

definePage({ style: { navigationBarTitleText: '会员等级与权益' } })

const xj = useXj()
const d = ref<any>(null)
/** 升级进度（XJ-706 范围 1）：来自 XJ-303 的 /app/me —— growthValue=近 12 月实付，nextTier.gap=还差多少 */
const growth = ref<any>(null)
const pct = computed(() => {
  const n = growth.value?.nextTier
  if (!n || !n.threshold)
    return 100
  return Math.max(4, Math.min(100, Math.round((growth.value.growthValue / n.threshold) * 100)))
})
onLoad(async () => {
  d.value = await http.get('/app/tier')
  const me = await http.get('/app/me', undefined, { silent: true }).catch(() => null)
  if (me)
    growth.value = { nextTier: me.nextTier ?? null, growthValue: me.growthValue ?? 0 }
})
</script>

<template>
  <view :class="xj.pageClass">
    <view v-if="d" class="stack mo-rise mo-d1" style="padding-top: 12px">
      <view class="tcard" :class="`t${d.tier}`">
        <text class="t-sm" style="opacity: 0.8">当前等级</text>
        <text class="t-hero">{{ d.tierName }}</text>
        <!-- 升级进度条（XJ-706 范围 1）：只动 transform；乐龄 / 关闭档位由 --mo-emph 兜底 -->
        <view v-if="growth?.nextTier" class="gbar">
          <view class="gfill" :style="{ transform: `scaleX(${pct / 100})` }" />
        </view>
        <text v-if="growth?.nextTier" class="t-sm" style="opacity: 0.86">
          成长值 {{ growth.growthValue }} · 再积累 {{ growth.nextTier.gap }} 升级到 {{ growth.nextTier.tierName }}
        </text>
        <view class="row gap8 wrap">
          <view v-for="b in d.benefits" :key="b.text" class="row gap4 b">
            <XIcon :name="b.icon" :size="14" /><text class="t-sm">{{ b.text }}</text>
          </view>
        </view>
        <text v-if="d.keepUntil" class="t-sm">保级期至 {{ d.keepUntil }}</text>
      </view>
      <view class="card mo-rise mo-d2">
        <view class="trow head">
          <text class="flex1">权益</text><text class="c">臻享</text><text class="c">尊享</text><text class="c">悦享</text>
        </view>
        <view v-for="r in d.table" :key="r.name" class="trow">
          <text class="flex1 t-sm">{{ r.name }}</text>
          <text class="c t-xs" :class="{ hl: d.tier === 'A' }">{{ r.A }}</text>
          <text class="c t-xs" :class="{ hl: d.tier === 'B' }">{{ r.B }}</text>
          <text class="c t-xs" :class="{ hl: d.tier === 'C' }">{{ r.C }}</text>
        </view>
      </view>
      <view class="card stack mo-rise mo-d3">
        <text class="t-md">等级规则（公开）</text>
        <view v-for="r in d.rules" :key="r" class="row gap8" style="align-items: flex-start">
          <XIcon name="check" :size="18" color="var(--brand-ink)" /><text class="t-sm">{{ r }}</text>
        </view>
        <text class="t-xs c3">就医建议、红旗处理、体检推荐不因会员等级而不同。</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.tcard {
  border-radius: 20px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* 升级进度：条放在品牌卡内，轨道用半透明白，三种等级卡上都可读 */
.gbar {
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.28);
  overflow: hidden;
}
.gfill {
  width: 100%;
  height: 100%;
  border-radius: 3px;
  background: #fff;
  transform-origin: left center;
  transition: transform var(--mo-emph, 420ms) var(--mo-ease-out);
}
.tC {
  background: var(--brand-soft);
  color: var(--brand-ink);
}
.tB {
  background: var(--brand);
  color: var(--on-brand);
}
.tA {
  background: #262019;
  color: #d2b47a;
}
.b {
  padding: 2px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
}
.tC .b {
  background: #fff;
}
.trow {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 0;
  border-top: 1px solid var(--line);
}
.trow.head {
  border-top: 0;
  font-weight: 700;
  font-size: var(--fs-sm);
}
.c {
  width: 64px;
  text-align: center;
}
.hl {
  color: var(--brand-ink);
  font-weight: 700;
}
</style>
