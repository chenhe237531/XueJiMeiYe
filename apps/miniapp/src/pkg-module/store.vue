<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { call, go, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '门店项目' } })

const xj = useXj()
const d = ref<any>(null)

onLoad(async () => {
  d.value = await http.get('/app/store')
})

function book(item?: any) {
  if (!xj.loggedIn) return go('/pkg-auth/login')
  if (item) uni.setStorageSync('xj_lead_prefill', { project: item.shortName || item.name })
  go('/pkg-module/lead-form?code=store_services')
}

function phone() {
  const p = d.value?.store?.phone || ''
  if (/\d{6,}/.test(p)) call(p)
  else toast('门店电话待补充，可先在线预约')
}
</script>

<template>
  <view :class="[...xj.pageClass, 'has-footer']">
    <view v-if="d?.store" class="stack" style="padding-top: 12px">
      <view class="card stack">
        <text class="t-xl">{{ d.store.name }}</text>
        <view class="row gap8 wrap">
          <text class="tag">{{ d.store.category }}</text>
          <view v-if="d.store.rating" class="row gap4 t-sm"><XIcon name="star" :size="16" color="#D9A441" /><text class="semi">{{ d.store.rating }}</text><text class="c2">{{ d.store.reviewCount }} 条评价</text></view>
        </view>
        <view class="row gap8"><XIcon name="clock" :size="18" color="#5C5358" /><text class="t-body">营业时间 {{ d.store.openHours }}</text></view>
        <view class="row gap8" style="align-items: flex-start">
          <XIcon name="map-pin" :size="18" color="#5C5358" style="margin-top: 3px" />
          <view class="col"><text class="t-body">{{ d.store.address }}</text><text class="t-sm c2">{{ d.store.mall }}</text></view>
        </view>
        <view class="row gap6 wrap"><text v-for="f in d.store.facilities" :key="f" class="tag gray">{{ f }}</text></view>
      </view>

      <view class="card promises">
        <view v-for="p in d.store.promises" :key="p" class="row gap6"><XIcon name="circle-check" :size="18" color="#1F6E68" /><text class="t-sm">{{ p }}</text></view>
      </view>

      <view v-for="g in d.groups" :key="g.title" class="stack">
        <text class="section-title">{{ g.title }}</text>
        <view class="group">
          <view v-for="it in g.items" :key="it.code" class="item" @click="book(it)">
            <view class="col gap4 flex1">
              <text class="t-md" style="line-height: 1.4">{{ it.name }}</text>
              <text class="t-xs c2">{{ [it.durationMin ? `${it.durationMin} 分钟` : '', it.audience, it.salesNote].filter(Boolean).join(' · ') }}</text>
              <view class="row gap6" style="align-items: baseline">
                <text class="price num">¥{{ it.groupPrice }}</text>
                <text v-if="it.priceRef" class="t-xs c3" style="text-decoration: line-through">¥{{ it.priceRef }}</text>
                <text v-if="it.priceNote" class="t-xs c-warn">{{ it.priceNote }}</text>
              </view>
            </view>
            <view class="mini">预约</view>
          </view>
        </view>
      </view>
      <text class="t-xs c3">{{ d.priceNote }} 团购可在美团 App 搜索门店名称购买。</text>
    </view>
    <view class="footer-bar">
      <view class="row gap12">
        <view class="btn ghost flex1" @click="phone"><XIcon name="phone" />联系门店</view>
        <view class="btn flex1" @click="book()"><XIcon name="calendar-plus" />预约到店</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.promises { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 6px; }
.item { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-top: 1px solid var(--line); }
.item:first-child { border-top: 0; }
.price { font-size: var(--fs-lg); font-weight: 700; color: var(--brand); }
.mini { height: 34px; padding: 0 14px; border-radius: 17px; background: var(--brand-soft); color: var(--brand); font-weight: 700; font-size: var(--fs-sm); display: flex; align-items: center; flex-shrink: 0; }
</style>
