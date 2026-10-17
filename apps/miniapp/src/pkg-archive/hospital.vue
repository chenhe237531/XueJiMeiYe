<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '医院报告' } })

const xj = useXj()
const list = ref<any[]>([])
const refs = ref<any[]>([])
onLoad(async () => {
  list.value = await http.get('/app/reports', { type: 'hospital' })
  refs.value = await http.get('/app/referrals')
})
</script>

<template>
  <view :class="xj.pageClass">
    <view class="stack mo-rise" style="padding-top: 12px">
      <view class="group mo-rise mo-d1">
        <view v-for="r in list" :key="r.id" class="cell" hover-class="mo-press-active" hover-stay-time="80" @click="go(`/pkg-archive/report?id=${r.id}`)">
          <view class="icon-box care">
            <XIcon name="building-hospital" />
          </view>
          <view class="col flex1">
            <text class="t-md">{{ r.title }}</text><text class="t-sm c2">{{ r.date }}</text>
          </view>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
        <view v-if="!list.length" class="empty">
          医院回传后，报告会出现在这里
        </view>
      </view>
      <text class="section-title mo-rise mo-d2">我的转介与预约</text>
      <view class="group mo-rise mo-d2">
        <view v-for="r in refs" :key="r.id" class="cell">
          <view class="col flex1">
            <text class="t-md">{{ r.hospitalName }}</text>
            <text class="t-sm c2">{{ r.services.map((s) => s.name).join('、') || '年度基础体检' }}{{ r.appointmentAt ? ` · ${r.appointmentAt}` : '' }}</text>
          </view>
          <text class="tag care">{{ r.statusName }}</text>
        </view>
        <view v-if="!refs.length" class="empty">
          暂无转介记录
        </view>
      </view>
    </view>
  </view>
</template>
