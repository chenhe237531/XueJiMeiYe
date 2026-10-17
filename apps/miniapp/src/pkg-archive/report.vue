<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go, refText, speak, srcStyle, toast } from '@/xj/utils'
import { useReveal } from '@/xj/motion'

definePage({ style: { navigationBarTitleText: '报告详情' } })

const xj = useXj()
const r = ref<any>(null)
const c = computed(() => r.value?.content || {})
const TREND: Record<string, { t: string, cls: string }> = { better: { t: '比上次好', cls: 'c-care' }, same: { t: '和上次持平', cls: 'c2' }, attention: { t: '需要留意', cls: 'c-warn' }, first: { t: '首次测量', cls: 'c3' } }

/** 首屏以下两块滚动触发（useReveal → IntersectionObserver，只播一次） */
const revealMeaning = useReveal('ar-meaning')
const revealAdvice = useReveal('ar-advice')
onLoad(async (q: any) => {
  r.value = await http.get(`/app/reports/${q.id}`)
  http.post('/app/events', { event: 'report_view', props: { type: r.value.type, sourceLabel: r.value.sourceLabel } }, { silent: true }).catch(() => {})
})

function readAll() {
  if (r.value.type === 'hospital')
    return speak(c.value.plain || `${c.value.conclusion}。${c.value.advice}`)
  speak(`${r.value.title}。${(c.value.meaning || []).map((m: any) => m.text).join('')}${c.value.seeDoctor?.text || ''}`)
}
</script>

<template>
  <view class="has-footer" :class="[...xj.pageClass]">
    <view v-if="r" class="stack" style="padding-top: 12px">
      <!-- 骨架占位由下方 v-else 分支承担 -->
      <view class="col gap6 mo-rise">
        <view class="row gap8 wrap">
          <text class="t-title">{{ r.title }}</text>
          <text class="tag" :style="{ background: srcStyle(r.sourceLabel).bg, color: srcStyle(r.sourceLabel).fg }">{{ r.sourceName }}</text>
        </view>
        <text v-if="r.type === 'measurement'" class="t-sm c2">{{ c.basic?.date }}，{{ c.basic?.store }}，{{ c.basic?.device }}，操作人 {{ c.basic?.operator }}</text>
        <text v-else class="t-sm c2">{{ r.date }} · {{ c.hospital }} · {{ c.doctor }}</text>
      </view>

      <!-- 门店测量报告：固定 8 部分结构（P-16） -->
      <template v-if="r.type === 'measurement'">
        <view class="card col mo-rise mo-d1">
          <view v-for="(m, i) in c.results" :key="m.code" class="metric" :class="{ first: i === 0, abn: m.status !== 'normal' }">
            <view class="col flex1">
              <text class="t-sm c2">{{ m.name }}</text>
              <view class="row gap6" style="align-items: baseline">
                <text class="num bold" style="font-size: 24px">{{ m.value }}</text>
                <text class="t-sm">{{ m.unit }}</text>
                <text v-if="m.status !== 'normal'" class="t-xs semi abn">{{ m.status === 'high' ? '高于参考' : '低于参考' }}</text>
              </view>
            </view>
            <view class="col" style="align-items: flex-end">
              <text class="t-xs c3">{{ m.ref ? `参考 ${refText(m.ref)} ${m.unit}` : '暂无参考范围' }}</text>
              <text class="t-sm semi" :class="TREND[c.compare.find((x) => x.code === m.code)?.trend || 'first'].cls">
                {{ c.compare.find((x) => x.code === m.code)?.prev !== null && c.compare.find((x) => x.code === m.code)?.prev !== undefined ? `上次 ${c.compare.find((x) => x.code === m.code).prev}，` : '' }}{{ TREND[c.compare.find((x) => x.code === m.code)?.trend || 'first'].t }}
              </text>
            </view>
          </view>
          <text class="t-xs c3 mt8">参考范围出处：{{ [...new Set(c.results.map((x) => x.refSource).filter(Boolean))].join('、') || '设备说明书' }}</text>
        </view>
        <view id="ar-meaning" class="col gap8 mo-reveal" :class="{ 'is-in': revealMeaning }">
          <text class="t-lg">这代表什么</text>
          <text v-for="m in c.meaning" :key="m.metric" class="t-body" style="color: #3b3337">{{ m.text }}</text>
          <text v-if="c.meaning?.some((m) => m.ai)" class="ai-note">由 AI 辅助撰写，经规则校验</text>
        </view>
        <view id="ar-advice" class="group mo-reveal" :class="{ 'is-in': revealAdvice }">
          <view class="cell col" style="align-items: stretch">
            <view class="row-between">
              <text class="t-sm c2">门店建议</text>
              <text class="t-sm link" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-plan/detail')">查看方案</text>
            </view>
            <view class="row gap6 wrap mt8">
              <text v-for="a in c.storeAdvice || []" :key="a" class="tag advice-tag">{{ a }}</text>
            </view>
          </view>
          <view class="cell">
            <view class="col flex1">
              <text class="t-sm c2">要不要看医生</text>
              <text class="t-md" :class="c.seeDoctor?.need ? 'c-warn' : 'c-care'">{{ c.seeDoctor?.need ? c.seeDoctor.text : '目前不需要' }}</text>
            </view>
            <text class="t-xs c2">按医生定的规则判断</text>
          </view>
        </view>
        <text class="t-xs c3">{{ c.disclaimer }}</text>
      </template>

      <!-- 医院报告（P-19） -->
      <template v-else>
        <view class="card stack">
          <text class="t-sm c2 semi">医生结论（原文）</text>
          <text class="t-md" style="font-weight: 500">{{ c.conclusion }}</text>
          <text class="t-sm c2 semi">医生建议（原文）</text>
          <text class="t-md" style="font-weight: 500">{{ c.advice }}</text>
        </view>
        <view v-if="c.plain" class="card care stack">
          <text class="t-sm semi" style="color: var(--care-dark)">通俗版（根据医生原话整理）</text>
          <text class="t-body" style="white-space: pre-wrap">{{ c.plain }}</text>
        </view>
        <view class="group">
          <view v-if="c.recheckDate" class="cell">
            <XIcon name="calendar-event" color="var(--care)" /><text class="flex1 t-md">复查日期</text><text class="t-md semi c-care">{{ c.recheckDate }}</text>
          </view>
          <view v-for="m in c.metrics" :key="m.code" class="cell">
            <XIcon name="chart-line" color="var(--care)" /><text class="flex1 t-md">{{ m.code === 'BMD_T_LUMBAR' ? '腰椎骨密度 T 值' : m.code }}</text><text class="t-md semi num">{{ m.value }} {{ m.unit }}</text>
          </view>
          <view v-if="c.restrictions?.length" class="cell">
            <XIcon name="alert-triangle" color="#7A4A08" /><text class="flex1 t-md">门店项目调整</text><text class="t-sm c-warn semi">{{ c.restrictions.join('、') }}</text>
          </view>
          <view class="cell" hover-class="mo-press-active" hover-stay-time="80" @click="toast('报告原件以临时链接提供，10 分钟有效（演示环境未上传原件）')">
            <XIcon name="file-text" color="#5C5358" /><text class="flex1 t-md">报告原件 PDF</text><XIcon name="chevron-right" :size="18" color="#786E74" />
          </view>
        </view>
        <text class="t-xs c3">诊断与医疗建议由医院医生出具，平台只做通俗化整理。如有疑问请以医生解释为准。</text>
      </template>
    </view>
    <view v-else class="stack" style="padding-top: 12px">
      <view class="card skeleton" style="height: 56px" />
      <view class="card skeleton" style="height: 240px" />
      <view class="card skeleton" style="height: 120px" />
    </view>
    <view v-if="r" class="footer-bar">
      <view class="row gap12">
        <view class="btn plain icon-btn" hover-class="mo-press-active" hover-stay-time="80" @click="readAll">
          <XIcon name="volume" />
        </view>
        <view class="btn plain icon-btn" hover-class="mo-press-active" hover-stay-time="80" @click="toast('PDF 生成后可保存到手机（演示）')">
          <XIcon name="download" />
        </view>
        <view class="btn flex1 mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-family/list')">
          <XIcon name="share" />分享给家人
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.metric {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--line);
}
/* 异常项高亮（XJ-701 范围第 4 条）：行首 3px 竖条 + 状态字与数值都用 --meter-low（XJ-102 语义令牌） */
.metric.abn {
  box-shadow: inset 3px 0 0 var(--meter-low, var(--alert));
  padding-left: 8px;
  border-radius: 2px;
}
.abn {
  color: var(--meter-low, var(--alert));
}
.metric.first {
  border-top: 0;
  padding-top: 0;
}
.advice-tag {
  max-width: 100%;
  height: auto;
  padding-top: 4px;
  padding-bottom: 4px;
  white-space: normal;
  line-height: 1.4;
  box-sizing: border-box;
}
</style>
