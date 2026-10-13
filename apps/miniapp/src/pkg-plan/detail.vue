<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go, speak } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '我的方案' } })

const xj = useXj()
const d = ref<any>(null)
const history = ref<any[]>([])
const c = computed(() => d.value?.plan?.content || {})
const sk = computed(() => d.value?.plan?.skeleton || {})
const WHEN: Record<string, string> = { H1: '1 小时内', D1: '明天', after_return: '回传后' }
const whenText = (w: string) => WHEN[w] || (w.startsWith('W') ? `第 ${w.slice(1)} 周` : w)

onShow(async () => {
  d.value = await http.get('/app/plans/current')
  history.value = await http.get('/app/plans', undefined, { silent: true }).catch(() => [])
})

function read() {
  speak(`${c.value.title}。${c.value.summary}${c.value.medicalIntro || ''}${(c.value.medicalItems || []).map((m: any) => `${m.name}，${m.why}`).join('。')}。门店安排：${(c.value.storeItems || []).map((s: any) => `${s.name}，${s.freq}`).join('；')}。`)
}
</script>

<template>
  <view :class="[...xj.pageClass, 'has-footer']">
    <view v-if="d && !d.plan" class="card empty stack" style="margin-top: 16px">
      <XIcon name="clipboard-heart" :size="48" color="var(--brand-ink)" />
      <text class="t-md">{{ d.preparing ? '顾问正在为您整理方案，审核后会发给您' : '完成六维测评后，顾问会为您整理养护方案' }}</text>
      <view v-if="!d.preparing" class="btn" @click="go('/pkg-assess/intro')">开始六维测评</view>
    </view>
    <view v-else-if="d" class="stack" style="padding-top: 12px">
      <view class="col gap4">
        <view class="row-between">
          <text class="t-title">{{ c.title }}</text>
          <view class="pill" @click="read"><XIcon name="volume" :size="18" /></view>
        </view>
        <text class="t-body c2">{{ c.summary }}</text>
        <text class="t-sm c3">{{ sk.packages?.map((p) => `${p.name}${p.weeks ? ` ${p.weeks} 周` : ''}`).join(' + ') }} · {{ d.plan.sentAt }} 由{{ d.plan.sentBy }}发送</text>
      </view>

      <view v-if="d.paused" class="card hint row gap8"><XIcon name="alert-triangle" /><text class="t-md">门店项目暂停中，等医生确认后再安排。</text></view>

      <view v-if="c.medicalItems?.length" class="card care stack">
        <text class="t-sm bold" style="color: var(--care-dark)">第一步，先就医</text>
        <text v-if="c.medicalIntro" class="t-sm" style="color: #3f4a35">{{ c.medicalIntro }}</text>
        <view v-for="m in c.medicalItems" :key="m.service" class="row gap12">
          <view class="col flex1"><text class="t-md">{{ m.name }}</text><text class="t-sm" style="color: #4d5a3f">{{ m.why }}</text></view>
          <text class="t-sm semi c-care">顾问代约</text>
        </view>
      </view>

      <view v-if="sk.doctorAdvice" class="card stack" style="border: 1px solid var(--care-line)">
        <view class="row gap8"><XIcon name="building-hospital" color="var(--care)" /><text class="t-md">医生建议（{{ sk.doctorAdvice.doctor }}）</text></view>
        <text class="t-body">{{ sk.doctorAdvice.advice }}</text>
        <text v-if="sk.doctorAdvice.recheckDate" class="t-sm c-care semi">复查日期：{{ sk.doctorAdvice.recheckDate }}</text>
      </view>

      <view v-if="c.storeItems?.length" class="card stack">
        <text class="t-sm c2 semi">门店安排</text>
        <view v-for="s in c.storeItems" :key="s.project" class="item">
          <view class="row-between" style="align-items: flex-start"><text class="t-md flex1">{{ s.name }}</text><text class="t-sm c2" style="margin-left: 8px">{{ s.freq }}</text></view>
          <text class="t-sm c2">{{ s.why }}</text>
          <view class="row gap8 mt8">
            <text v-if="s.planned" class="tag gray">门店筹备中</text>
            <text v-else-if="s.groupPrice" class="tag">团购价 ¥{{ s.groupPrice }}</text>
          </view>
        </view>
        <text class="t-sm c-brand semi" @click="go('/pkg-module/store')">查看门店全部项目与价格</text>
      </view>

      <view v-if="c.lifestyle?.length" class="stack">
        <text class="t-sm c2 semi">日常小事</text>
        <view class="row gap8 wrap">
          <text v-for="l in c.lifestyle" :key="l" class="life">{{ l }}</text>
        </view>
      </view>

      <view v-if="sk.followUps?.length" class="card stack">
        <text class="t-sm c2 semi">跟进计划</text>
        <view class="steps">
          <view v-for="(f, i) in sk.followUps" :key="i" class="step">
            <view class="sdot" :class="{ on: i === 0 }" />
            <text class="t-sm semi">{{ whenText(f.when) }}</text>
            <text class="t-xs c2">{{ f.action }}</text>
          </view>
        </view>
      </view>

      <text class="t-xs c3" style="text-align: center">{{ d.plan.engine === 'ai' ? '由 AI 辅助撰写，经健康顾问审核' : '由健康顾问审核的模板生成' }}。{{ c.closing }}</text>
      <view v-if="history.length > 1" class="group">
        <view v-for="h in history.slice(1)" :key="h.id" class="cell"><text class="flex1 t-body c2">{{ h.title }}</text><text class="t-sm c3">{{ h.sentAt }}</text></view>
      </view>
    </view>
    <view class="footer-bar">
      <view class="btn" @click="go('/pkg-me/advisor')"><XIcon name="headset" />联系我的顾问{{ d?.advisor ? ` ${d.advisor.name}` : '' }}</view>
    </view>
  </view>
</template>

<style scoped>
.item { padding-top: 10px; border-top: 1px solid var(--line); }
.item:first-of-type { border-top: 0; }
.life { padding: 8px 14px; border-radius: 20px; background: #fff; font-size: var(--fs-sm); }
.steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.step { display: flex; flex-direction: column; gap: 4px; }
.sdot { width: 14px; height: 14px; border-radius: 8px; border: 2px solid #d3c8ce; background: #fff; }
.sdot.on { background: var(--brand); border-color: var(--brand); }
</style>
