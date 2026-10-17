<script lang="ts" setup>
import { ref } from 'vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go, srcStyle } from '@/xj/utils'
import { useReveal } from '@/xj/motion'

definePage({ style: { navigationBarTitleText: '时间轴' } })

const xj = useXj()
const list = ref<any[]>([])
const type = ref('')
const loading = ref(true)
/** 时间轴在首屏以下：滚动到才淡入 */
const revealList = useReveal('ar-tl')
/** 节点颜色走语义色令牌（XJ-102），不再硬编码十六进制 */
function dotColor(source: string) {
  return source === 'HOSPITAL' ? 'var(--care)' : source === 'STORE' ? 'var(--brand)' : 'var(--ink-3)'
}
const TYPES = [
  { v: '', n: '全部' },
  { v: 'assessment', n: '测评' },
  { v: 'measurement', n: '门店测量' },
  { v: 'hospital_report', n: '医院报告' },
  { v: 'plan', n: '方案' },
  { v: 'checkin', n: '打卡' },
]

async function load() {
  loading.value = true
  list.value = await http.get('/app/archive/records', type.value ? { type: type.value } : undefined)
  loading.value = false
}
onLoad(load)

function open(r: any) {
  if (r.refTable === 'report')
    go(`/pkg-archive/report?id=${r.refId}`)
  else if (r.refTable === 'assessment')
    go(`/pkg-assess/result?id=${r.refId}`)
  else if (r.refTable === 'plan')
    go('/pkg-plan/detail')
}
</script>

<template>
  <view :class="xj.pageClass">
    <scroll-view scroll-x class="mo-fade" style="white-space: nowrap; padding: 12px 0">
      <view v-for="t in TYPES" :key="t.v" class="chip" hover-class="mo-press-active" hover-stay-time="80" :class="{ on: type === t.v }" @click="type = t.v; load()">
        {{ t.n }}
      </view>
    </scroll-view>
    <view id="ar-tl" class="timeline mo-reveal" :class="{ 'is-in': revealList }">
      <view v-for="r in list" :key="r.id" class="node" hover-class="mo-press-active" hover-stay-time="80" @click="open(r)">
        <view class="dot" :style="{ background: dotColor(r.source) }" />
        <view class="card col gap4">
          <view class="row-between">
            <text class="t-sm c2 num">{{ r.date }}</text>
            <text class="tag" :style="{ background: srcStyle(r.source).bg, color: srcStyle(r.source).fg }">{{ r.sourceName }}</text>
          </view>
          <text class="t-md">{{ r.title }}</text>
          <text v-if="r.summary" class="t-sm c2">{{ r.summary }}</text>
        </view>
      </view>
      <view v-if="!list.length && !loading" class="empty">
        暂无记录
      </view>
      <view v-if="loading" class="card skeleton" style="height: 96px" />
    </view>
  </view>
</template>

<style scoped>
.chip {
  display: inline-flex;
  height: 36px;
  align-items: center;
  padding: 0 14px;
  margin-right: 8px;
  border-radius: 18px;
  background: #fff;
  font-size: var(--fs-sm);
}
.chip.on {
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 600;
}
.timeline {
  position: relative;
  padding-left: 18px;
  border-left: 2px solid var(--line-2);
  margin-left: 6px;
}
.node {
  position: relative;
  margin-bottom: 12px;
}
.dot {
  position: absolute;
  left: -26px;
  top: 18px;
  width: 12px;
  height: 12px;
  border-radius: 6px;
  border: 2px solid var(--bg);
}
</style>
