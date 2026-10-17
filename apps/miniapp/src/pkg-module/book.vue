<script lang="ts" setup>
/** 预约到店：已购买的项目选日期预约（先买后约；已预约的可改期） */
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { themeHex, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '预约到店' } })

const xj = useXj()
const o = ref<any>(null)
const date = ref('')
const note = ref('')
const today = new Date().toISOString().slice(0, 10)

onLoad(async (q: any) => {
  const list = await http.get('/app/store/orders')
  o.value = list.find((x: any) => x.id === Number(q.id))
  if (!o.value)
    return toast('订单不存在')
  if (!['paid', 'booked'].includes(o.value.status))
    return toast('当前订单状态不能预约')
  if (o.value.bookDate)
    date.value = o.value.bookDate
})

const dateText = computed(() => {
  const [, m, d] = date.value.split('-')
  return m && d ? `${Number(m)} 月 ${Number(d)} 日` : ''
})

async function submit() {
  if (!date.value)
    return toast('请选择到店日期')
  const r: any = await http.post(`/app/store/orders/${o.value.id}/book`, { date: date.value, note: note.value || undefined }, { loading: '提交中' })
  uni.showModal({
    title: r.rebooked ? '预约已改期' : '预约成功',
    content: `「${o.value.projectName}」${dateText.value}到店，出示订单号 ${o.value.orderNo} 即可。`,
    showCancel: false,
    confirmText: '好的',
    confirmColor: themeHex().ink,
    success: () => uni.redirectTo({ url: '/pkg-module/orders' }),
    fail: () => uni.redirectTo({ url: '/pkg-module/orders' }),
  })
}
</script>

<template>
  <view class="has-footer" :class="[...xj.pageClass]">
    <view class="page-head mo-rise mo-d1">
      <view class="ph-deco i-tabler-calendar-plus" />
      <text class="ph-title">{{ o?.status === 'booked' ? '预约改期' : '预约到店' }}</text>
      <text class="ph-sub">已购买项目，挑个方便的日子到店</text>
      <view class="ph-meta">
        <view><XIcon name="circle-check" :size="14" />已支付</view>
        <view><XIcon name="building-store" :size="14" />一对一服务</view>
      </view>
    </view>

    <view v-if="o" class="stack mo-rise mo-d2">
      <view class="card stack mo-rise mo-d3">
        <view class="row-between">
          <text class="t-md">{{ o.projectName }}</text>
          <view class="price">
            <text class="yen">¥</text><text class="amt">{{ o.amount }}</text>
          </view>
        </view>
        <view class="info-row">
          <view class="ir-label">
            <XIcon name="ticket" :size="16" />订单号
          </view><text class="ir-value num">{{ o.orderNo }}</text>
        </view>
      </view>

      <view class="card stack mo-rise mo-d4">
        <view class="col gap8">
          <view class="row gap4">
            <text class="t-md">到店日期</text><text class="c-brand">*</text>
          </view>
          <picker mode="date" :start="today" :value="date || today" @change="(e: any) => (date = e.detail.value)">
            <view class="input row-between">
              <text>{{ date ? `${date}（${dateText}）` : '请选择日期' }}</text><text class="c3">选择</text>
            </view>
          </picker>
        </view>
        <view class="col gap8">
          <view class="row gap4">
            <text class="t-md">给门店留的话</text><text class="t-xs c3">可不填</text>
          </view>
          <textarea v-model="note" class="textarea" placeholder="例如：想约王顾问 / 有精油过敏等" />
        </view>
      </view>

      <text class="t-xs c3">到店出示订单号即可开始服务；临时有事可改期或取消退款。门店营业时间可在「门店项目」页查看。</text>
    </view>

    <view class="footer-bar">
      <view class="btn mo-press" :class="{ disabled: !date }" hover-class="mo-press-active" hover-stay-time="80" @click="submit">
        确认预约{{ date ? ` ${dateText}` : '' }}
      </view>
    </view>
  </view>
</template>
