<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '体检券与预约' } })

const xj = useXj()
const list = ref<any[]>([])
const open = ref<number | null>(null)
onShow(async () => {
  list.value = await http.get('/app/coupons')
})
</script>

<template>
  <view :class="xj.pageClass">
    <view class="stack mo-rise mo-d1" style="padding-top: 12px">
      <view v-if="!list.length" class="card empty stack mo-rise mo-d2">
        <text class="t-md">完成健康安全关和六关测评，就可以领取免费基础体检券</text>
        <view class="btn care mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-assess/intro')">
          去测评
        </view>
      </view>
      <view v-for="c in list" :key="c.id" class="stack">
        <view v-if="['used', 'expired', 'void'].includes(c.status)" class="stamp">
          {{ c.statusName }}
        </view>
        <view class="ticket mo-press" :class="{ dim: ['used', 'expired', 'void'].includes(c.status) }" hover-class="mo-press-active" hover-stay-time="80" @click="open = open === c.id ? null : c.id">
          <view class="left col gap4">
            <text class="t-sm" style="opacity: 0.86">{{ c.statusName }}{{ c.status === 'claimed' ? '，可预约' : c.status === 'issued' ? '，请到店领取' : '' }}</text>
            <text class="t-xl">{{ c.typeName }}</text>
            <text class="t-sm" style="opacity: 0.9">{{ c.hospital?.name }}</text>
            <text class="t-xs" style="opacity: 0.82">{{ c.expiresAt ? `有效期至 ${c.expiresAt}` : '领取后 60 天内有效，每年 1 次' }}</text>
          </view>
          <view class="right col gap4">
            <XIcon name="qrcode" :size="44" color="#1E191C" />
            <text class="t-xs c2">到店出示</text>
            <text class="t-xs num semi coupon-no">{{ c.couponNo }}</text>
          </view>
        </view>
        <text class="t-sm" style="color: var(--care-dark)">{{ c.promise }}</text>
        <view v-if="open === c.id || c.status === 'claimed'" class="card stack mo-rise mo-d3">
          <text class="t-md">{{ c.package?.name }}</text>
          <view class="row gap6 wrap">
            <text v-for="it in c.package?.items" :key="it" class="tag gray">{{ it }}</text>
          </view>
          <text v-if="c.package?.notice" class="t-sm c2">{{ c.package.notice }}</text>
        </view>
        <view v-if="c.booking" class="card care stack mo-rise mo-d4">
          <text class="t-md">体检预约 · {{ c.booking.statusName }}</text>
          <text class="t-sm">{{ c.booking.appointmentAt || '等待医院确认时间' }}{{ c.booking.notice ? `，${c.booking.notice}` : '' }}</text>
        </view>
        <view v-if="c.status === 'claimed'" class="btn care mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="go(`/pkg-checkup/book?couponId=${c.id}`)">
          预约体检日期
        </view>
        <view v-if="c.status === 'issued'" class="card hint stack mo-rise mo-d5">
          <text class="t-sm">到店出示券码，员工扫码核销"到店领取"后即可预约体检日期。</text>
          <text class="t-sm">不方便到店？把券号 {{ c.couponNo }} 告诉顾问，顾问可以帮您登记领取，领取后这里就能直接预约。</text>
          <view class="btn ghost small mo-press" style="align-self: flex-start" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-me/advisor')">
            <XIcon name="headset" :size="18" />联系顾问代领
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.ticket {
  display: flex;
  min-height: 150px;
  position: relative;
}
.ticket .left {
  flex: 1;
  background: var(--care);
  color: #fff;
  border-radius: 20px 0 0 20px;
  padding: 16px;
  justify-content: center;
}
.ticket .right {
  width: 112px;
  background: #fff;
  border-radius: 0 20px 20px 0;
  align-items: center;
  justify-content: center;
  border-left: 2px dashed #c8d4bc;
}
.ticket.dim {
  opacity: 0.55;
}
/* 撕角（XJ-703 范围 2）：虚线撕裂线上下各挖一个半圆，露出页面底色，形成「可撕下」的票券隐喻。
   挖孔用页面底色而非透明（小程序里真挖孔需要 mask，兼容性差）。 */
.ticket::before,
.ticket::after {
  content: '';
  position: absolute;
  right: 104px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--bg);
  z-index: 1;
}
.ticket::before {
  top: -8px;
}
.ticket::after {
  bottom: -8px;
}
/* 三态区分：可用 / 待领取正常；已使用 / 已过期 / 已作废 加旋转印章，比单纯降透明度更好认 */
.stamp {
  position: absolute;
  right: 132px;
  top: 50%;
  transform: translate(-50%, -50%) rotate(-12deg);
  border: 2px solid var(--ink-3);
  color: var(--ink-3);
  border-radius: var(--r-sm, 8px);
  padding: 2px 8px;
  font-size: var(--fs-sm);
  font-weight: 700;
  background: rgba(255, 255, 255, 0.86);
  z-index: 2;
}
.ticket .left {
  min-width: 0;
}
.coupon-no {
  max-width: 100%;
  padding: 0 6px;
  box-sizing: border-box;
  font-size: 12px !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}
</style>
