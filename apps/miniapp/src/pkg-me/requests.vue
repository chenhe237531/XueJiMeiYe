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
const orders = ref<any[]>([])
const loaded = ref(false)
/** 意向进度三步：已提交 → 顾问已联系 → 已完成 */
const STEP: Record<string, number> = { new: 0, contacted: 1, negotiating: 1, won: 2, lost: 2 }
/** 在线订单（先买后约）标签色调 */
const O_TONE: Record<string, string> = { unpaid: 'warn', paid: 'gold', booked: 'care', used: 'gray', cancelled: 'gray' }

onShow(async () => {
  const [l, r, o] = await Promise.all([
    http.get('/app/leads', undefined, { silent: true }).catch(() => []),
    http.get('/app/referrals', undefined, { silent: true }).catch(() => []),
    http.get('/app/store/orders', undefined, { silent: true }).catch(() => []),
  ])
  leads.value = l as any[]
  refs.value = r as any[]
  orders.value = o as any[]
  loaded.value = true
})
</script>

<template>
  <view :class="xj.pageClass">
    <view class="stack mo-rise mo-d1" style="padding-top: 12px">
      <template v-if="!loaded">
        <view class="card skeleton" style="height: 120px" />
        <view class="card skeleton" style="height: 150px" />
        <view class="card skeleton" style="height: 150px" />
      </template>
      <view class="section-title mo-rise mo-d2" style="margin-top: 0">
        <text>体检与就医</text>
      </view>
      <view class="group mo-rise mo-d3">
        <view v-for="r in refs" :key="r.id" class="cell mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="go(r.isCheckup ? '/pkg-checkup/coupons' : '/pkg-archive/hospital')">
          <view class="icon-box care">
            <XIcon :name="r.isCheckup ? 'ticket' : 'building-hospital'" />
          </view>
          <view class="col flex1">
            <text class="t-md">{{ r.isCheckup ? '体检预约' : '转介就诊' }} · {{ r.hospitalName }}</text>
            <text class="t-sm c2">{{ r.appointmentAt ? `预约时间 ${r.appointmentAt}` : `提交于 ${r.createdAt}，等待医院确认` }}</text>
          </view>
          <text class="tag care">{{ r.statusName }}</text>
        </view>
        <view v-if="loaded && !refs.length" class="empty">
          还没有体检预约。完成测评领取体检券后即可预约
        </view>
      </view>

      <view class="section-title mo-rise mo-d4">
        <text>门店项目订单</text><text class="more" @click="go('/pkg-module/orders')">全部</text>
      </view>
      <view class="group mo-rise mo-d5">
        <view v-for="o in orders.slice(0, 3)" :key="o.id" class="cell mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-module/orders')">
          <view class="icon-box" :class="o.status === 'booked' ? 'care' : ['used', 'cancelled'].includes(o.status) ? 'gray' : ''">
            <XIcon name="ticket" />
          </view>
          <view class="col flex1">
            <text class="t-md">{{ o.projectName }}</text>
            <text class="t-sm c2">{{ o.status === 'booked' ? `已预约 ${o.bookDate} 到店` : o.statusName }}</text>
          </view>
          <text class="tag" :class="O_TONE[o.status]">{{ o.statusName }}</text>
        </view>
        <view v-if="loaded && !orders.length" class="empty" style="padding: 14px">
          在线购买的项目会显示在这里，先买后约更省心
        </view>
      </view>

      <view class="section-title">
        <text>门店项目与服务意向</text>
      </view>
      <view v-for="l in leads" :key="l.id" class="card stack">
        <view class="row gap12">
          <view class="icon-box" :class="l.status === 'won' ? 'care' : l.status === 'lost' ? 'gray' : ''">
            <XIcon name="calendar-event" />
          </view>
          <text class="t-md flex1">{{ l.name }}</text>
          <text class="tag" :class="l.status === 'won' ? 'care' : l.status === 'lost' ? 'gray' : ''">{{ l.statusName }}</text>
        </view>
        <view class="timeline">
          <view v-for="(s, i) in ['已提交', '顾问已联系', l.status === 'lost' ? '已结束' : '已完成']" :key="s" class="tl-step" :class="{ on: i <= STEP[l.status] }">
            <view class="tl-dot" />
            <text>{{ s }}</text>
          </view>
        </view>
        <text class="t-sm c2">
          提交于 {{ l.createdAt }}{{ l.contactedAt ? `，顾问 ${l.contactedAt} 已联系` : l.slaDueAt ? `，顾问会在 ${l.slaDueAt} 前联系您` : '' }}
        </text>
      </view>
      <view v-if="loaded && !leads.length" class="card empty stack">
        <text class="t-md">还没有提交过意向</text>
        <view class="btn ghost small mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-module/store')">
          看看门店项目
        </view>
      </view>

      <view class="row gap8 t-sm c2 mo-press" style="justify-content: center; padding: 8px" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-me/advisor')">
        <XIcon name="headset" :size="18" />
        <text>等太久了？直接联系我的顾问</text>
      </view>
    </view>
  </view>
</template>
