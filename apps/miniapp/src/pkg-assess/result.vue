<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import XRadar from '@/components/XRadar.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go, riskText, speak } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '测评结果' } })

const xj = useXj()
const r = ref<any>(null)
const prevDims = ref<any>(null)
const scores = computed(() => Object.fromEntries((r.value?.dims || []).filter((d: any) => d.score !== null).map((d: any) => [d.code, d.score])))
const paused = computed(() => ['L2', 'L3'].includes(r.value?.riskLevel))

onLoad(async (q: any) => {
  r.value = q?.id ? await http.get(`/app/assessments/${q.id}/result`) : await http.get('/app/assessments/latest-result')
  if (r.value) {
    const prev = Object.fromEntries(r.value.dims.filter((d: any) => d.prev !== null).map((d: any) => [d.code, d.prev]))
    prevDims.value = Object.keys(prev).length ? prev : null
  }
})

function readThree() {
  const t = r.value.three
  speak(`您需要知道的三件事。做得不错：${t.good}。需要留意：${t.attention}。下一步：${t.next}。`)
}

function readAll() {
  const t = r.value.three
  speak(`您的六维年轻化指数是 ${r.value.index} 分。${t.good}。需要留意：${t.attention}。下一步：${t.next}。${r.value.dims.map((d: any) => `${d.name}${d.grade}，${d.note}`).join('。')}`)
}
</script>

<template>
  <view :class="[...xj.pageClass, 'has-footer']">
    <view v-if="r" class="stack" style="padding-top: 12px">
      <view class="card stack">
        <view class="row-between">
          <text class="t-lg">您需要知道的三件事</text>
          <view class="pill" @click="readThree"><XIcon name="volume" :size="18" /></view>
        </view>
        <view class="col gap4">
          <text class="t-sm semi c-care">做得不错</text>
          <text class="t-lg" style="font-weight: 500">{{ r.three.good }}</text>
        </view>
        <view class="col gap4">
          <text class="t-sm semi c-warn">需要留意</text>
          <text class="t-lg" style="font-weight: 500">{{ r.three.attention }}</text>
        </view>
        <view class="col gap4">
          <text class="t-sm semi c-brand">下一步</text>
          <text class="t-lg" style="font-weight: 500">{{ r.three.next }}</text>
        </view>
      </view>

      <view class="card col gap12">
        <view class="col gap4">
          <text class="t-sm c2">六维年轻化指数</text>
          <view class="row gap8" style="align-items: baseline">
            <text class="num bold" style="font-size: 50px; line-height: 1.1">{{ r.index }}</text>
            <text v-if="r.prevIndex !== null" class="semi" :class="r.index >= r.prevIndex ? 'c-care' : 'c-warn'">{{ r.index >= r.prevIndex ? '+' : '' }}{{ r.index - r.prevIndex }}</text>
          </view>
          <view class="row gap12 t-xs c2">
            <view class="row gap4"><view class="lg brand" /><text>本次</text></view>
            <view v-if="prevDims" class="row gap4"><view class="lg dash" /><text>上次</text></view>
          </view>
          <text class="t-xs c3">雪姬美业品牌指数，不是医学指标</text>
        </view>
        <view class="center"><XRadar :scores="scores" :prev="prevDims" :size="170" labels /></view>
      </view>

      <view class="group">
        <view v-for="d in r.dims" :key="d.code" class="cell">
          <text class="t-md" style="width: 48px">{{ d.name }}</text>
          <view class="col flex1">
            <text class="t-sm c2">{{ d.note }}</text>
          </view>
          <text class="tag" :class="d.tone === 'good' ? 'care' : d.tone === 'attention' ? 'warn' : 'gray'">{{ d.grade }} {{ d.score ?? '' }}</text>
        </view>
      </view>

      <view v-if="r.medical.length" class="card care stack">
        <text class="t-md bold" style="color: #57664a">{{ paused ? '请先就医，门店项目暂停' : '就医建议，请优先安排' }}</text>
        <view v-for="m in r.medical" :key="m.code" class="row gap12">
          <view class="col flex1">
            <text class="t-lg">{{ m.name }}</text>
            <text class="t-sm" style="color: #31524e">{{ m.reason }}</text>
          </view>
          <text class="t-sm semi c-care">顾问可代约</text>
        </view>
        <view v-if="paused" class="btn care" @click="go('/pkg-checkup/book?mode=referral')">预约合作医院</view>
      </view>

      <view class="group">
        <view v-if="r.coupon" class="cell" @click="go('/pkg-checkup/coupons')">
          <view class="icon-box care"><XIcon name="ticket" /></view>
          <view class="col flex1">
            <text class="t-md">{{ r.coupon.type === 'BASIC_ELDER' ? '乐龄基础体检券' : '基础体检券' }}</text>
            <text class="t-sm c2">已发放，到店领取后可预约</text>
          </view>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
        <view v-if="r.plan" class="cell" @click="go('/pkg-plan/detail')">
          <view class="icon-box"><XIcon name="clipboard-heart" /></view>
          <view class="col flex1">
            <text class="t-md">初步方案：{{ r.plan.packages.map((p) => p.name).join(' + ') }}</text>
            <text class="t-sm c2">{{ paused ? '医生确认后再安排门店项目' : '顾问会在 24 小时内联系您确认' }}</text>
          </view>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
        <view class="cell">
          <view class="icon-box gray"><XIcon name="info-circle" /></view>
          <view class="col flex1">
            <text class="t-md">风险等级 {{ r.riskLevel }}</text>
            <text class="t-sm c2">{{ riskText(r.riskLevel) }}，由医生确认的规则判断</text>
          </view>
        </view>
      </view>
      <text class="t-xs c3" style="text-align: center">完成时间 {{ r.completedAt }}。结果仅作生活美容参考，不作为医学诊断。</text>
    </view>
    <view v-if="r" class="footer-bar">
      <view class="row gap12">
        <view class="btn ghost flex1" @click="readAll"><XIcon name="volume" />朗读全部</view>
        <view class="btn flex1" @click="go('/pkg-family/list')"><XIcon name="share" />分享给家人</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.lg { width: 14px; height: 2px; }
.lg.brand { background: var(--brand); }
.lg.dash { border-top: 2px dashed #9a8f95; height: 0; }
</style>
