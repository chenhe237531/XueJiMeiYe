<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { useXj } from '@/xj/store'
import { back, call, go, speak } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '请尽快就医', navigationBarBackgroundColor: '#FFFFFF' } })

const xj = useXj()
const page = ref<any>(uni.getStorageSync('xj_urgent') || { title: '您提到的情况需要尽快就医', body: '' })
</script>

<template>
  <view :class="xj.pageClass" style="background: #fff">
    <view class="col gap16" style="align-items: center; text-align: center; padding: 40px 8px 24px">
      <view class="alert-icon"><XIcon name="first-aid-kit" :size="40" color="#B3261E" /></view>
      <text class="t-hero">您提到的情况<br>需要尽快就医</text>
      <text class="t-lg" style="font-weight: 400; color: #3b3337">{{ page.body }}</text>
      <view class="pill" @click="speak(`${page.title}。${page.body}`)"><XIcon name="volume" :size="18" /><text>朗读</text></view>
    </view>
    <view class="stack">
      <view class="btn alert" style="height: 64px; font-size: 21px" @click="call('120')"><XIcon name="phone" :size="24" /><text>拨打 120</text></view>
      <view v-if="page.hotline" class="btn ghost" style="height: 64px; font-size: 20px" @click="call('12356')"><XIcon name="phone-call" :size="22" /><text>12356 心理援助热线</text></view>
      <view class="btn ghost" style="height: 64px; font-size: 21px" @click="go('/pkg-me/advisor')"><XIcon name="headset" :size="22" /><text>联系我的顾问</text></view>
      <view class="card" style="background: #f6f4f5">
        <view class="col gap12 t-md" style="font-weight: 400">
          <view class="row gap8"><XIcon name="clock" color="var(--brand-ink)" /><text>您的顾问会在 1 小时内给您打电话</text></view>
          <view class="row gap8"><XIcon name="heart" color="var(--brand-ink)" /><text>门店项目先暂停，身体最要紧</text></view>
          <view class="row gap8"><XIcon name="check" color="var(--brand-ink)" /><text>已答的题目都保存好了</text></view>
        </view>
      </view>
      <text class="t-md c2" style="text-align: center; padding: 8px" @click="back()">返回继续测评</text>
    </view>
  </view>
</template>

<style scoped>
.alert-icon { width: 80px; height: 80px; border-radius: 40px; background: var(--alert-soft); display: flex; align-items: center; justify-content: center; }
</style>
