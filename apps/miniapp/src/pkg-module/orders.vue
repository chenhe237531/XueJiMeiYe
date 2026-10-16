<script lang="ts" setup>
/** 我的项目订单：先买后约的团购券视角——待支付 / 待预约 / 已预约 / 已完成 / 已取消 */
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { confirm, go, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '我的项目订单' } })

const xj = useXj()
const list = ref<any[]>([])
const loaded = ref(false)
async function load() {
  list.value = await http.get('/app/store/orders', undefined, { silent: true }).catch(() => [])
  loaded.value = true
}
onShow(load)

const TONE: Record<string, string> = { unpaid: 'warn', paid: 'gold', booked: 'care', used: 'gray', cancelled: 'gray' }
const BOX: Record<string, string> = { unpaid: 'terra', paid: '', booked: 'care', used: 'gray', cancelled: 'gray' }

/** 待支付订单继续支付（MVP 模拟） */
async function pay(o: any) {
  await http.post(`/app/store/orders/${o.id}/pay`, {}, { loading: '支付中' })
  toast('支付成功')
  load()
}

/** 取消订单：未支付直接取消；已支付未核销取消即退款 */
async function cancel(o: any) {
  const tip = o.status === 'unpaid' ? `取消「${o.projectName}」的待支付订单？` : `取消「${o.projectName}」？¥${o.amount} 将按原支付方式退回。`
  if (!(await confirm('取消订单', tip, '确认取消'))) return
  const r: any = await http.post(`/app/store/orders/${o.id}/cancel`)
  toast(r.refunded ? '已取消，款项原路退回' : '已取消')
  load()
}
</script>

<template>
  <view :class="xj.pageClass">
    <view class="stack" style="padding-top: 12px">
      <view v-if="loaded && !list.length" class="card empty stack">
        <text class="t-md">还没有在线购买的项目</text>
        <view class="btn ghost small" @click="go('/pkg-module/store')">看看门店项目</view>
      </view>

      <view v-for="o in list" :key="o.id" class="card stack">
        <view class="row gap8">
          <view class="icon-box" :class="BOX[o.status]"><XIcon name="ticket" /></view>
          <view class="col flex1">
            <text class="t-md">{{ o.projectName }}</text>
            <text class="t-xs c3 num">{{ o.orderNo }}</text>
          </view>
          <text class="tag" :class="TONE[o.status]">{{ o.statusName }}</text>
        </view>

        <view class="row gap8" style="align-items: baseline">
          <view class="price"><text class="yen">¥</text><text class="amt">{{ o.amount }}</text></view>
          <text v-if="o.origPrice" class="price-orig">¥{{ o.origPrice }}</text>
          <view class="flex1" />
          <text class="t-xs c3">{{ o.paidAt ? `支付于 ${o.paidAt}` : o.createdAt }}</text>
        </view>

        <view v-if="o.status === 'booked'" class="card care stack" style="margin: 0">
          <text class="t-md">已预约 {{ o.bookDate }} 到店</text>
          <text v-if="o.bookNote" class="t-sm c2">备注：{{ o.bookNote }}</text>
        </view>
        <text v-if="o.status === 'used'" class="t-sm c2">已于 {{ o.usedAt }} 到店完成，欢迎再次选购。</text>
        <text v-if="o.status === 'cancelled'" class="t-sm c2">订单已取消{{ o.refunded ? '，款项已按原支付方式退回' : '' }}。</text>

        <view v-if="['unpaid', 'paid', 'booked'].includes(o.status)" class="row gap8" style="justify-content: flex-end">
          <view class="btn ghost small" @click="cancel(o)">取消{{ o.status === 'unpaid' ? '订单' : '退款' }}</view>
          <view v-if="o.status === 'unpaid'" class="btn small" @click="pay(o)">去支付</view>
          <view v-else class="btn small" @click="go(`/pkg-module/book?id=${o.id}`)">{{ o.status === 'paid' ? '预约到店' : '改期' }}</view>
        </view>
      </view>

      <view class="row gap8 t-sm c2" style="justify-content: center; padding: 8px" @click="go('/pkg-module/store')">
        <XIcon name="building-store" :size="18" />
        <text>再看看门店项目</text>
      </view>
    </view>
  </view>
</template>
