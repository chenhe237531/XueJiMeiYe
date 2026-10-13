<script lang="ts" setup>
import { ref } from 'vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '基础资料' } })

const xj = useXj()
const salutation = ref('')
const gender = ref('female')
const years = Array.from({ length: 70 }, (_, i) => new Date().getFullYear() - 18 - i)
const yearIdx = ref(30)

onLoad(() => {
  if (xj.me?.salutation) salutation.value = xj.me.salutation
  if (xj.me?.birthYear) yearIdx.value = Math.max(0, years.indexOf(xj.me.birthYear))
})

async function save(skip = false) {
  if (!skip && !salutation.value) return toast('请填写您希望的称呼，如"王阿姨"')
  const res: any = skip ? {} : await http.patch('/app/me', { salutation: salutation.value, birthYear: years[yearIdx.value], gender: gender.value }, { loading: '保存中' })
  await xj.loadMe()
  if (res.elderAuto) {
    await new Promise(r => uni.showModal({ title: '已为您开启乐龄模式', content: '字更大、颜色更柔和。可以在"我的 - 设置"里随时切换。', showCancel: false, confirmText: '好的', confirmColor: '#6B4E2E', complete: r }))
  }
  go('/pages/index/index')
}
</script>

<template>
  <view :class="xj.pageClass">
    <view class="col gap6" style="padding: 20px 4px">
      <text class="t-title">怎么称呼您？</text>
      <text class="c2">只用于问候和顾问联系，可以跳过</text>
    </view>
    <view class="card stack">
      <text class="t-md">称呼</text>
      <input v-model="salutation" class="input" placeholder="如：王阿姨、李女士" maxlength="16">
      <text class="t-md">出生年份</text>
      <picker mode="selector" :range="years" :value="yearIdx" @change="(e) => (yearIdx = Number(e.detail.value))">
        <view class="input row-between"><text>{{ years[yearIdx] }} 年</text><text class="c3">选择</text></view>
      </picker>
      <text class="t-md">性别</text>
      <view class="row gap12">
        <view class="option flex1" :class="{ on: gender === 'female' }" @click="gender = 'female'"><view class="dot" />女</view>
        <view class="option flex1" :class="{ on: gender === 'male' }" @click="gender = 'male'"><view class="dot" />男</view>
      </view>
    </view>
    <view class="stack mt24">
      <view class="btn" @click="save()">保存</view>
      <view class="t-body c2" style="text-align: center; padding: 8px" @click="save(true)">跳过</view>
    </view>
  </view>
</template>
