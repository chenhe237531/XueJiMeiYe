<script lang="ts" setup>
import { ref } from 'vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'

definePage({ style: { navigationBarTitleText: '关于' } })

const xj = useXj()
const d = ref<any>(null)
onLoad(async () => { d.value = await http.get('/app/about') })
</script>

<template>
  <view :class="xj.pageClass">
    <view class="stack" style="padding-top: 12px">
      <view class="card stack">
        <text class="t-lg">雪姬美业</text>
        <text class="t-sm c2">雪姬 AI 智能健康美容体验馆以"科技护美"为理念：用 AI 帮助了解肌肤与身体状态，结合专业顾问的一对一服务，制定个性化的养护方案。门店承诺：无推销办卡、无隐形消费、不满意重做、保证正品、一对一服务、一次性用品。</text>
        <text class="t-sm c2">雪姬美业是生活美容与健康管理连锁机构，不是医疗机构。平台提供六维测评、免费体检转介、健康档案、门店养护方案和 AI 陪伴；诊断与医疗方案由合作医院医生出具。</text>
      </view>
      <view class="card stack">
        <text class="t-md">AI 使用说明</text>
        <text class="t-sm c2">AI 会帮忙把方案写得更通俗、把医生原话整理得更好懂、陪您聊天。方案里的项目、就医建议和风险等级由医生确认的规则决定，AI 不做诊断、不推荐商品。AI 生成的内容都有标注，并经健康顾问审核。</text>
      </view>
      <view v-if="d" class="card stack">
        <text class="t-md">合作机构与资质</text>
        <view v-for="h in d.hospitals" :key="h.name" class="col">
          <text class="t-sm">{{ h.name }}</text><text class="t-xs c3">医疗机构执业许可证：{{ h.licenseNo }}</text>
        </view>
        <view v-for="p in d.partners" :key="p.name" class="col">
          <text class="t-sm">{{ p.name }}</text><text class="t-xs c3">{{ (p.licenses || []).map((l) => `${l.name} ${l.no}`).join('；') }}</text>
        </view>
      </view>
      <view v-if="d" class="card stack">
        <text class="t-md">门店</text>
        <view v-for="s in d.stores" :key="s.id" class="col">
          <text class="t-sm">{{ s.name }}</text><text class="t-xs c3">{{ [s.address, s.mall, s.openHours ? `营业 ${s.openHours}` : ''].filter(Boolean).join(' · ') }}</text>
        </view>
      </view>
      <text class="t-xs c3" style="text-align: center">投诉与举报：请联系门店或客服电话 [客服电话]</text>
    </view>
  </view>
</template>
