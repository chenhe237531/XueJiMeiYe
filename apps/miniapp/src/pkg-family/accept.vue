<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '家人邀请' } })

const xj = useXj()
const token = ref('')
const info = ref<any>(null)
const done = ref(false)

onLoad(async (q: any) => {
  token.value = q.token
  info.value = await http.get(`/app/family/invites/${q.token}`)
})

async function accept() {
  if (!xj.loggedIn) return go('/pkg-auth/login')
  await http.post(`/app/family/invites/${token.value}/accept`)
  done.value = true
}
</script>

<template>
  <view :class="xj.pageClass">
    <view v-if="info" class="col gap16" style="align-items: center; text-align: center; padding: 48px 8px">
      <view class="icon-box" style="width: 72px; height: 72px; border-radius: 24px"><XIcon name="users" :size="36" /></view>
      <text class="t-title">{{ info.elder.salutation }}邀请您成为她的健康家人</text>
      <text class="c2">绑定后，您可以查看{{ info.elder.salutation }}授权给您的内容，例如测评结果和复查提醒。需要{{ info.elder.salutation }}再次确认。</text>
      <view v-if="done" class="card care t-md">已申请，等待{{ info.elder.salutation }}确认</view>
      <view v-else-if="info.expired || info.status !== 'pending'" class="card hint t-md">邀请已失效（72 小时有效），请让家人重新发送</view>
      <view v-else class="btn" style="width: 100%" @click="accept">接受邀请</view>
    </view>
  </view>
</template>
