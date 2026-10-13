<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'

definePage({ style: { navigationBarTitleText: '会员等级与权益' } })

const xj = useXj()
const d = ref<any>(null)
onLoad(async () => { d.value = await http.get('/app/tier') })
</script>

<template>
  <view :class="xj.pageClass">
    <view v-if="d" class="stack" style="padding-top: 12px">
      <view class="tcard" :class="`t${d.tier}`">
        <text class="t-sm" style="opacity: 0.8">当前等级</text>
        <text class="t-hero">{{ d.tierName }}</text>
        <view class="row gap8 wrap"><text v-for="b in d.benefits" :key="b" class="b t-sm">{{ b }}</text></view>
        <text v-if="d.keepUntil" class="t-sm">保级期至 {{ d.keepUntil }}</text>
      </view>
      <view class="card">
        <view class="trow head"><text class="flex1">权益</text><text class="c">臻享</text><text class="c">尊享</text><text class="c">悦享</text></view>
        <view v-for="r in d.table" :key="r.name" class="trow">
          <text class="flex1 t-sm">{{ r.name }}</text>
          <text class="c t-xs" :class="{ hl: d.tier === 'A' }">{{ r.A }}</text>
          <text class="c t-xs" :class="{ hl: d.tier === 'B' }">{{ r.B }}</text>
          <text class="c t-xs" :class="{ hl: d.tier === 'C' }">{{ r.C }}</text>
        </view>
      </view>
      <view class="card stack">
        <text class="t-md">等级规则（公开）</text>
        <view v-for="r in d.rules" :key="r" class="row gap8" style="align-items: flex-start"><XIcon name="check" :size="18" color="var(--brand-ink)" /><text class="t-sm">{{ r }}</text></view>
        <text class="t-xs c3">就医建议、红旗处理、体检推荐不因会员等级而不同。</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.tcard { border-radius: 20px; padding: 18px; display: flex; flex-direction: column; gap: 8px; }
.tC { background: var(--brand-soft); color: var(--brand-ink); }
.tB { background: var(--brand); color: var(--on-brand); }
.tA { background: #262019; color: #d2b47a; }
.b { padding: 2px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.18); }
.tC .b { background: #fff; }
.trow { display: flex; align-items: center; gap: 4px; padding: 10px 0; border-top: 1px solid var(--line); }
.trow.head { border-top: 0; font-weight: 700; font-size: var(--fs-sm); }
.c { width: 64px; text-align: center; }
.hl { color: var(--brand-ink); font-weight: 700; }
</style>
