<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import XRadar from '@/components/XRadar.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '家人的健康' } })

const xj = useXj()
const d = ref<any>(null)
const title = computed(() => (d.value?.elder?.relation === 'daughter' || d.value?.elder?.relation === 'son' ? '妈妈的健康' : `${d.value?.elder?.salutation || ''}的健康`))

onLoad(async (q: any) => {
  d.value = await http.get(`/app/family/elders/${q.elderId}/overview`)
  uni.setNavigationBarTitle({ title: title.value })
})
</script>

<template>
  <view :class="xj.pageClass">
    <view v-if="d" class="stack" style="padding-top: 12px">
      <text class="t-title">{{ title }}</text>
      <text class="t-sm c2">{{ d.elder.salutation }}授权您查看以下内容，可随时调整</text>
      <view v-if="d.summary" class="card stack">
        <text class="t-lg">一页纸摘要</text>
        <view class="col gap4"><text class="t-sm semi c-brand">妈妈的情况</text><text class="t-body">{{ d.summary.situation }}</text></view>
        <view class="col gap4"><text class="t-sm semi c-care">医生的建议</text><text class="t-body">{{ d.summary.doctor }}</text></view>
        <view class="col gap4"><text class="t-sm semi" style="color: #5c5358">门店的安排</text><text class="t-body">{{ d.summary.store }}</text></view>
        <view v-if="d.summary.dims" class="center"><XRadar :scores="d.summary.dims" :size="150" labels /></view>
      </view>
      <view v-if="d.reminders" class="group">
        <view class="cell"><text class="t-md">需要提醒的事</text></view>
        <view v-for="t in d.reminders" :key="t.text" class="cell">
          <XIcon :name="t.icon" color="#6E7F5C" />
          <view class="col flex1"><text class="t-md">{{ t.text }}</text><text class="t-sm c2">{{ t.sub }}</text></view>
        </view>
        <view v-if="!d.reminders.length" class="cell"><text class="c2">暂无待办</text></view>
      </view>
      <view v-if="!d.summary && !d.reminders" class="card empty">{{ d.elder.salutation }}暂未授权查看内容</view>
      <view class="btn ghost" @click="go('/pkg-family/list')">管理家人绑定</view>
    </view>
  </view>
</template>
