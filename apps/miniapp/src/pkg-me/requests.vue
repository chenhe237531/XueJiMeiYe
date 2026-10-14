<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '我的预约与意向' } })

const xj = useXj()
const leads = ref<any[]>([])
const refs = ref<any[]>([])
const loaded = ref(false)
/** 意向进度三步：已提交 → 顾问已联系 → 已完成 */
const STEP: Record<string, number> = { new: 0, contacted: 1, negotiating: 1, won: 2, lost: 2 }

onShow(async () => {
  const [l, r] = await Promise.all([
    http.get('/app/leads', undefined, { silent: true }).catch(() => []),
    http.get('/app/referrals', undefined, { silent: true }).catch(() => []),
  ])
  leads.value = l as any[]
  refs.value = r as any[]
  loaded.value = true
})
</script>

<template>
  <view :class="xj.pageClass">
    <view class="stack" style="padding-top: 12px">
      <text class="section-title">体检与就医</text>
      <view class="group">
        <view v-for="r in refs" :key="r.id" class="cell" @click="go(r.isCheckup ? '/pkg-checkup/coupons' : '/pkg-archive/hospital')">
          <view class="icon-box care"><XIcon :name="r.isCheckup ? 'ticket' : 'building-hospital'" /></view>
          <view class="col flex1">
            <text class="t-md">{{ r.isCheckup ? '体检预约' : '转介就诊' }} · {{ r.hospitalName }}</text>
            <text class="t-sm c2">{{ r.appointmentAt ? `预约时间 ${r.appointmentAt}` : `提交于 ${r.createdAt}，等待医院确认` }}</text>
          </view>
          <text class="tag care">{{ r.statusName }}</text>
        </view>
        <view v-if="loaded && !refs.length" class="empty">还没有体检预约。完成测评领取体检券后即可预约</view>
      </view>

      <text class="section-title">门店项目与服务意向</text>
      <view v-for="l in leads" :key="l.id" class="card stack">
        <view class="row-between">
          <text class="t-md flex1">{{ l.name }}</text>
          <text class="tag" :class="l.status === 'won' ? 'care' : l.status === 'lost' ? 'gray' : ''">{{ l.statusName }}</text>
        </view>
        <view class="steps">
          <view v-for="(s, i) in ['已提交', '顾问已联系', l.status === 'lost' ? '已结束' : '已完成']" :key="s" class="step" :class="{ on: i <= STEP[l.status] }">
            <view class="sdot" />
            <text class="t-xs">{{ s }}</text>
          </view>
        </view>
        <text class="t-sm c2">
          提交于 {{ l.createdAt }}{{ l.contactedAt ? `，顾问 ${l.contactedAt} 已联系` : l.slaDueAt ? `，顾问会在 ${l.slaDueAt} 前联系您` : '' }}
        </text>
      </view>
      <view v-if="loaded && !leads.length" class="card empty stack">
        <text class="t-md">还没有提交过意向</text>
        <view class="btn ghost small" @click="go('/pkg-module/store')">看看门店项目</view>
      </view>

      <view class="row gap8 t-sm c2" style="justify-content: center; padding: 8px" @click="go('/pkg-me/advisor')">
        <XIcon name="headset" :size="18" />
        <text>等太久了？直接联系我的顾问</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.step { display: flex; flex-direction: column; gap: 4px; color: var(--ink-3); }
.step.on { color: var(--ink); font-weight: 600; }
.sdot { width: 14px; height: 14px; border-radius: 8px; border: 2px solid #d3c8ce; background: #fff; box-sizing: border-box; }
.step.on .sdot { background: var(--brand); border-color: var(--brand); }
</style>
