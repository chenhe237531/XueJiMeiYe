<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { back, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '授权确认' } })

const xj = useXj()
const text = ref<any>(null)
const full = ref(false)
const type = ref('C2')

onLoad(async (q: any) => {
  type.value = q?.type || 'C2'
  text.value = await http.get(`/app/consents/texts/${type.value}`)
  uni.setNavigationBarTitle({ title: text.value.title.replace('（单独同意）', '') })
})

async function decide(granted: boolean) {
  await http.post('/app/consents', { type: type.value, granted })
  toast(granted ? '已同意，随时可以在"我的"撤回' : '已记录，不影响其他功能')
  setTimeout(() => back(), 500)
}
</script>

<template>
  <view :class="[...xj.stdPageClass, 'has-footer']">
    <view v-if="text" class="stack" style="padding-top: 16px">
      <view class="row gap8">
        <XIcon name="shield-check" :size="28" color="var(--care)" />
        <text class="t-title">{{ text.title }}</text>
      </view>
      <view class="card care stack">
        <view v-for="s in text.summary" :key="s" class="row gap8" style="align-items: flex-start">
          <XIcon name="check" :size="18" color="var(--care)" style="margin-top: 4px" />
          <text class="t-body" style="color: #3f4a35">{{ s }}</text>
        </view>
        <text class="link t-sm" style="color: var(--care)" @click="full = !full">{{ full ? '收起' : '查看完整说明' }}</text>
      </view>
      <view v-if="full" class="card t-sm c2" style="white-space: pre-wrap">{{ text.content }}</view>
      <text class="t-xs c3">文本版本 {{ text.version }}。本授权为单独同意，不会默认勾选；授权行为不发放积分。</text>
    </view>
    <view class="footer-bar">
      <view class="btn" @click="decide(true)">同意</view>
      <view class="btn plain" @click="decide(false)">不同意</view>
    </view>
  </view>
</template>
