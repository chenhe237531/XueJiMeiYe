<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { call, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '我的顾问' } })

const xj = useXj()
const d = ref<any>(null)
onLoad(async () => { d.value = await http.get('/app/advisor') })
</script>

<template>
  <view :class="xj.pageClass">
    <view v-if="d" class="stack mo-rise mo-d1" style="padding-top: 12px">
      <view class="card col gap12 mo-rise mo-d2" style="align-items: center; text-align: center">
        <view class="av">
          {{ d.advisor?.name?.slice(0, 1) || '顾' }}
        </view>
        <text class="t-xl">{{ d.advisor?.name || '门店顾问' }}</text>
        <text class="t-sm c2">{{ d.store?.name }}</text>
        <text v-if="d.vip" class="tag gold">臻享专属顾问 · {{ d.responseHours }} 小时内响应</text>
        <view class="qr photo-slot">
          <XIcon name="qrcode" :size="56" /><text>企业微信"联系我"二维码</text>
        </view>
        <text class="t-sm c2">已添加的话，直接在微信里找{{ d.advisor?.name }}顾问</text>
      </view>
      <view class="btn mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="d.advisor?.phone ? call(d.advisor.phone) : toast('顾问电话待配置')">
        <XIcon name="phone" />打电话给顾问
      </view>
      <view class="btn ghost mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="d.store?.phone ? call(d.store.phone) : toast('门店电话待补充')">
        <XIcon name="building-hospital" />联系门店
      </view>
    </view>
  </view>
</template>

<style scoped>
.av {
  width: 72px;
  height: 72px;
  border-radius: 24px;
  background: var(--brand-soft);
  color: var(--brand-ink);
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr {
  width: 180px;
  height: 180px;
}
</style>
