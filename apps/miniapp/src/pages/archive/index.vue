<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go, lineSvg, SOURCE_STYLE } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '档案' } })

const xj = useXj()
const d = ref<any>(null)
const todos = ref<any[]>([])
const trendSrc = computed(() => lineSvg((d.value?.indexTrend || []).map((p: any) => ({ ...p, source: 'SELF' })), { width: 300, height: 110 }))
const delta = computed(() => {
  const t = d.value?.indexTrend || []
  return t.length > 1 ? t[t.length - 1].value - t[0].value : null
})

function openRecord(r: any) {
  if (r.refTable === 'report') go(`/pkg-archive/report?id=${r.refId}`)
  else if (r.refTable === 'assessment') go(`/pkg-assess/result?id=${r.refId}`)
  else if (r.refTable === 'plan') go('/pkg-plan/detail')
}

onShow(async () => {
  if (!xj.loggedIn) return
  d.value = await http.get('/app/archive/overview', undefined, { silent: true }).catch(() => null)
  const home: any = await http.get('/app/home', undefined, { silent: true }).catch(() => null)
  todos.value = home?.components?.find((c: any) => c.type === 'healthCard')?.props?.todos || []
})
</script>

<template>
  <view :class="[...xj.pageClass, 'has-tabbar']">
    <XNav title="健康档案" big />
    <view v-if="!xj.loggedIn" class="card empty stack">
      <text>登录后查看您的健康档案</text>
      <view class="btn" @click="go('/pkg-auth/login')">登录</view>
    </view>
    <view v-else-if="d && d.index === null && !d.metrics.length" class="card empty stack">
      <XIcon name="clipboard-heart" :size="48" color="var(--brand-ink)" />
      <text class="t-md">完成六维测评后，这里会记录您的每一次变化。</text>
      <view class="btn" @click="go('/pkg-assess/intro')">开始六维测评</view>
    </view>
    <view v-else-if="d" class="stack">
      <view class="card raised" @click="go('/pkg-archive/trend?code=INDEX')">
        <view class="row-between">
          <view class="col">
            <text class="t-sm c2">六维年轻化指数</text>
            <view class="row gap8" style="align-items: baseline">
              <text class="num bold" style="font-size: 44px; line-height: 1.1">{{ d.index ?? '-' }}</text>
              <text v-if="delta" class="semi t-sm" :class="delta > 0 ? 'c-care' : 'c-warn'">{{ d.indexTrend.length }} 次测评 {{ delta > 0 ? '+' : '' }}{{ delta }}</text>
            </view>
          </view>
          <text class="t-xs c3">{{ d.lastAssessedAt }}</text>
        </view>
        <image v-if="d.indexTrend.length > 1" :src="trendSrc" style="width: 100%; height: 110px" mode="aspectFit" />
      </view>

      <view class="row gap8 t-sm c2 wrap">
        <text>数据来源</text>
        <text v-for="(s, k) in SOURCE_STYLE" :key="k" class="tag" :style="{ background: s.bg, color: s.fg }">{{ s.name }}</text>
      </view>

      <view class="metrics">
        <view v-for="m in d.metrics" :key="m.code" class="card col gap4" @click="go(`/pkg-archive/trend?code=${m.code}`)">
          <text class="t-sm c2">{{ m.name }}</text>
          <view class="row gap4" style="align-items: baseline">
            <text class="num bold" style="font-size: 28px">{{ m.value }}</text>
            <text class="t-sm c2">{{ m.unit }}</text>
            <XIcon v-if="m.arrow !== 'flat'" :name="m.arrow === 'up' ? 'arrow-up' : 'arrow-down'" :size="16" :color="m.better === null ? '#786E74' : m.better ? 'var(--care)' : '#7A4A08'" />
          </view>
          <view class="row gap6 t-xs c2">
            <text class="tag" :style="{ background: SOURCE_STYLE[m.source].bg, color: SOURCE_STYLE[m.source].fg }">{{ m.sourceName }}</text>
            <text style="white-space: nowrap">{{ m.date }}</text>
          </view>
        </view>
      </view>

      <view v-if="todos.length" class="group">
        <view v-for="t in todos" :key="t.text" class="cell" @click="go(t.link)">
          <text class="flex1 t-md">{{ t.text }}</text>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
      </view>

      <view class="group">
        <view class="cell" @click="go('/pkg-archive/hospital')">
          <view class="icon-box care"><XIcon name="building-hospital" /></view>
          <text class="flex1 t-md">医院报告</text>
          <text class="t-sm c2">{{ d.hospitalReports }} 份</text>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
        <view class="cell" @click="go('/pkg-archive/trend')">
          <view class="icon-box"><XIcon name="chart-line" /></view>
          <text class="flex1 t-md">指标趋势</text>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
        <view v-if="d.lastAssessmentId" class="cell" @click="go(`/pkg-assess/result?id=${d.lastAssessmentId}`)">
          <view class="icon-box"><XIcon name="hexagon" /></view>
          <text class="flex1 t-md">最近一次测评结果</text>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
      </view>

      <view class="section-title">
        <text>最近记录</text>
        <text class="t-sm c2" style="font-weight: 400" @click="go('/pkg-archive/timeline')">全部</text>
      </view>
      <view class="group">
        <view v-for="r in d.records" :key="r.id" class="cell" @click="openRecord(r)">
          <text class="t-sm c2 num" style="width: 52px">{{ r.date.slice(5).replace('-', '/') }}</text>
          <text class="flex1 t-body">{{ r.title }}</text>
          <text class="t-xs semi" :style="{ color: SOURCE_STYLE[r.source].fg }">{{ r.sourceName }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
</style>
