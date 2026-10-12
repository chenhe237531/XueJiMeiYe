<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { confirm, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '结伴拼团' } })

const xj = useXj()
const d = ref<any>({ activities: [], mine: [] })
async function load() { d.value = await http.get('/app/groupbuys') }
onShow(load)

async function openGroup(a: any) {
  if (!(await confirm('发起拼团', `${a.groupSize} 人成团，${a.hours} 小时内有效，成团后锁定拼团价 ¥${a.price}，到店或线下支付。未成团自动关闭，无费用。`, '发起'))) return
  await http.post(`/app/groupbuys/${a.id}/groups`)
  toast('已发起，可以邀请老姐妹参团')
  load()
}

async function join(g: any) {
  const r: any = await http.post(`/app/groupbuys/groups/${g.id}/join`)
  toast(r.success ? '已成团！顾问会联系您确认时间' : '已参团')
  load()
}
</script>

<template>
  <view :class="xj.pageClass">
    <view class="stack" style="padding-top: 12px">
      <text class="t-sm c2">预约制拼团：平台不在线收款，成团后顾问联系确认时间。只能分享给好友参团，不设置分享奖励。</text>
      <view v-for="a in d.activities" :key="a.id" class="card stack">
        <view class="row gap12">
          <view class="photo-slot" style="width: 72px; height: 72px"><XIcon name="users-group" :size="24" /></view>
          <view class="col flex1">
            <text class="t-lg">{{ a.title }}</text>
            <text class="t-sm c2">{{ a.desc }}</text>
            <view class="row gap8" style="align-items: baseline"><text class="t-xl c-brand num">¥{{ a.price }}</text><text v-if="a.origPrice" class="t-sm c3" style="text-decoration: line-through">¥{{ a.origPrice }}</text></view>
          </view>
        </view>
        <text class="t-xs c2">{{ a.groupSize }} 人成团 · {{ a.hours }} 小时内有效 · {{ a.needVisit ? '需到店' : '' }}</text>
        <view v-for="g in a.openGroups" :key="g.id" class="row gap12 og">
          <XIcon name="users" color="var(--brand-ink)" />
          <view class="col flex1"><text class="t-md">{{ g.members.join('、') }} 的团</text><text class="t-xs c2">还差 {{ a.groupSize - g.members.length }} 人 · {{ g.expiresAt }} 截止</text></view>
          <view class="btn small" @click="join(g)">参团</view>
        </view>
        <view class="btn ghost" @click="openGroup(a)">发起拼团</view>
      </view>
      <text v-if="d.mine.length" class="section-title">我的拼团</text>
      <view v-for="g in d.mine" :key="g.id" class="card row gap12">
        <view class="col flex1"><text class="t-md">{{ g.members.join('、') }}</text><text class="t-xs c2">{{ g.expiresAt }} 截止</text></view>
        <text class="tag" :class="g.status === 'success' ? 'care' : g.status === 'closed' ? 'gray' : ''">{{ g.status === 'success' ? '已成团' : g.status === 'closed' ? '已关闭' : '拼团中' }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.og { padding: 10px 12px; border-radius: 14px; background: #f7f3f5; }
</style>
