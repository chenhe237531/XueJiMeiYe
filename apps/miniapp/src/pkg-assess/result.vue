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
const RISK_LABEL: Record<string, string> = { L0: '状态良好', L1: '需要留意', L2: '建议就医', L3: '请尽快就医' }
/** 测完是动机最高的时刻：页脚主按钮直接给"下一步"，按就医 → 体检券 → 方案的优先级 */
const nextStep = computed(() => {
  if (!r.value) return null
  if (paused.value && r.value.medical?.length) return { text: '预约合作医院', icon: 'building-hospital', link: '/pkg-checkup/book?mode=referral' }
  if (r.value.coupon) return { text: '查看我的体检券', icon: 'ticket', link: '/pkg-checkup/coupons' }
  if (r.value.plan) return { text: '查看初步方案', icon: 'clipboard-heart', link: '/pkg-plan/detail' }
  return { text: '回到首页', icon: 'home', link: '/pages/index/index' }
})

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
        <text class="t-md bold" style="color: var(--care-dark)">{{ paused ? '请先就医，门店项目暂停' : '就医建议，请优先安排' }}</text>
        <view v-for="m in r.medical" :key="m.code" class="row gap12">
          <view class="col flex1">
            <text class="t-lg">{{ m.name }}</text>
            <text class="t-sm" style="color: #4d5a3f">{{ m.reason }}</text>
          </view>
          <view class="row gap4 t-sm semi c-care book-link" @click="go('/pkg-checkup/book?mode=referral')">请顾问代约<XIcon name="chevron-right" :size="16" /></view>
        </view>
      </view>

      <view class="group">
        <view v-if="r.coupon" class="cell" @click="go('/pkg-checkup/coupons')">
          <view class="icon-box care"><XIcon name="ticket" /></view>
          <view class="col flex1">
            <text class="t-md">{{ r.coupon.type === 'BASIC_ELDER' ? '乐龄基础体检券' : '基础体检券' }}</text>
            <text class="t-sm c2">已发放，到店领取（或请顾问代领）后可预约</text>
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
            <text class="t-md">{{ RISK_LABEL[r.riskLevel] || '风险等级' }}<text class="t-sm c3">（{{ r.riskLevel }}）</text></text>
            <text class="t-sm c2">{{ riskText(r.riskLevel) }}，由医生确认的规则判断</text>
          </view>
        </view>
        <view class="cell" @click="go('/pkg-family/list')">
          <view class="icon-box"><XIcon name="users" /></view>
          <view class="col flex1">
            <text class="t-md">邀请家人一起关注</text>
            <text class="t-sm c2">生成邀请，家人确认后可以看到报告、收到复查提醒</text>
          </view>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
      </view>
      <text class="t-xs c3" style="text-align: center">完成时间 {{ r.completedAt }}。结果仅作生活美容参考，不作为医学诊断。</text>
    </view>
    <view v-if="r" class="footer-bar">
      <view class="row gap12">
        <view class="btn ghost icon-btn" @click="readAll"><XIcon name="volume" /></view>
        <view v-if="nextStep" class="btn flex1" :class="{ care: paused }" @click="go(nextStep.link)"><XIcon :name="nextStep.icon" />{{ nextStep.text }}</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.lg { width: 14px; height: 2px; }
.lg.brand { background: var(--brand); }
.lg.dash { border-top: 2px dashed #9a8f95; height: 0; }
.book-link { flex-shrink: 0; align-items: center; min-height: 44px; }
</style>
