<script lang="ts" setup>
/** 确认订单：像美团团购一样在线购买，支付后再预约到店（而不是单纯预约） */
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { themeHex, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '确认订单' } })

const xj = useXj()
const it = ref<any>(null)
const paying = ref(false)

onLoad(async (q: any) => {
  const d = await http.get('/app/store')
  it.value = (d.groups || []).flatMap((g: any) => g.items).find((x: any) => x.code === q.code)
  if (!it.value)
    toast('项目不存在或已下架')
})

/** 下单 + 支付（MVP 模拟微信支付）：成功后引导去预约，形成"先买后约"闭环 */
async function pay() {
  if (paying.value || !it.value)
    return
  paying.value = true
  try {
    const o: any = await http.post('/app/store/orders', { projectCode: it.value.code }, { loading: '下单中' })
    await http.post(`/app/store/orders/${o.id}/pay`, {}, { loading: '支付中' })
    uni.showModal({
      title: '购买成功',
      content: `「${it.value.name}」已支付 ¥${o.amount}。接下来选个方便的日子预约到店；未核销可随时取消退款。`,
      confirmText: '去预约',
      cancelText: '稍后再说',
      confirmColor: themeHex().ink,
      success: (r) => {
        uni.redirectTo({ url: r.confirm ? `/pkg-module/book?id=${o.id}` : '/pkg-module/orders' })
      },
      fail: () => uni.redirectTo({ url: '/pkg-module/orders' }),
    })
  }
  catch { paying.value = false }
}
</script>

<template>
  <view class="has-footer" :class="[...xj.pageClass]">
    <view class="page-head mo-rise mo-d1">
      <view class="ph-deco i-tabler-wallet" />
      <text class="ph-title">确认订单</text>
      <text class="ph-sub">在线购买后到店预约使用，未核销随时可退</text>
      <view class="ph-meta">
        <view><XIcon name="calendar-check" :size="14" />先买后约</view>
        <view><XIcon name="rotate" :size="14" />未核销可退</view>
        <view><XIcon name="shield-check" :size="14" />与美团团购同价</view>
      </view>
    </view>

    <view v-if="it" class="stack mo-rise mo-d2">
      <view class="card stack mo-rise mo-d3">
        <view class="row gap12">
          <view class="thumb" :class="it.category === 'body' ? 'body' : 'face'">
            <XIcon :name="it.category === 'body' ? 'massage' : 'sparkles'" :size="xj.elderMode ? 38 : 34" />
            <text v-if="it.durationMin" class="thumb-label">{{ it.durationMin }} 分钟</text>
          </view>
          <view class="col flex1 gap4">
            <text class="deal-title">{{ it.name }}</text>
            <text v-if="it.audience" class="t-xs c3">{{ it.audience }}</text>
            <view class="row gap6" style="align-items: baseline">
              <view class="price">
                <text class="yen">¥</text><text class="amt">{{ it.groupPrice }}</text>
              </view>
              <text v-if="it.priceRef" class="price-orig">门市价 ¥{{ it.priceRef }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="card stack mo-rise mo-d4">
        <view class="info-row">
          <view class="ir-label">
            <XIcon name="ticket" :size="16" />订单内容
          </view><text class="ir-value">{{ it.name }}</text>
        </view>
        <view class="info-row">
          <view class="ir-label">
            <XIcon name="users" :size="16" />使用人数
          </view><text class="ir-value">1 人</text>
        </view>
        <view class="info-row">
          <view class="ir-label">
            <XIcon name="calendar-plus" :size="16" />预约方式
          </view><text class="ir-value">购买后在「我的订单」里选日期</text>
        </view>
      </view>

      <view class="card hint stack mo-rise mo-d5">
        <view class="row gap4">
          <XIcon name="circle-check" :size="15" color="var(--brand-ink)" /><text class="t-xs c2">到店出示订单号即可使用，无需再付款</text>
        </view>
        <view class="row gap4">
          <XIcon name="circle-check" :size="15" color="var(--brand-ink)" /><text class="t-xs c2">未核销可随时取消，已支付款项原路退回</text>
        </view>
        <view class="row gap4">
          <XIcon name="circle-check" :size="15" color="var(--brand-ink)" /><text class="t-xs c2">如需顾问协助，可联系门店顾问代为预约</text>
        </view>
      </view>
    </view>

    <view class="footer-bar">
      <view class="row gap12">
        <view class="col flex1" style="justify-content: center">
          <text class="t-xs c3">实付</text>
          <view class="price">
            <text class="yen">¥</text><text class="amt">{{ it?.groupPrice }}</text>
          </view>
        </view>
        <view class="btn mo-press" :class="{ disabled: !it || paying }" hover-class="mo-press-active" hover-stay-time="80" @click="pay">
          <XIcon name="wallet" />立即支付
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.footer-bar .price .amt {
  font-size: 22px;
}
</style>
