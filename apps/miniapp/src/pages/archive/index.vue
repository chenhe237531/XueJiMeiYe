<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import XNav from '@/components/XNav.vue'
import XIndexRing from '@/components/chart/XIndexRing.vue'
import XTrendChart from '@/components/chart/XTrendChart.vue'
import DimCard from '@/components/archive/DimCard.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { DIMS, go, SOURCE_STYLE, srcStyle } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '档案' } })

const xj = useXj()
const d = ref<any>(null)
const todos = ref<any[]>([])
/** 首次加载显示骨架屏；已加载过的 onShow 刷新不回退骨架（避免闪跳） */
const loading = ref(false)

/** 图表画布宽 = 视口 - 页边 12×2 - 卡内边 12×2（与 lineSvg 旧用法同容器宽度） */
const chartW = (uni.getSystemInfoSync().windowWidth || 375) - 48
const trendSeries = computed(() => (d.value?.indexTrend || []).map((p: any) => ({ label: p.date, value: p.value, source: 'SELF' })))
const delta = computed(() => {
  const t = d.value?.indexTrend || []
  return t.length > 1 ? t[t.length - 1].value - t[0].value : null
})
/** 指数环颜色随皮肤（SVG data URI 用不了 CSS 变量，走 props 传入） */
const ringColor = computed(() => (xj.elderMode ? '#3F6B4F' : '#C9A063'))
const ringTrack = computed(() => (xj.elderMode ? '#E7EDE7' : '#EEE9E1'))
/** D8：数字滚动只在 full 档；lite / off / 乐龄直接显示终值 */
const countUp = computed(() => xj.moTier === 'full')
/** 指数人话结论（D20：后端 verdict 同源下发；后端未合并时兜底为达标百分比） */
const indexVerdict = computed(() => d.value?.verdict || (d.value?.index != null ? `综合达标 ${d.value.index}%` : '完成测评后生成结论'))

function openRecord(r: any) {
  if (r.refTable === 'report') go(`/pkg-archive/report?id=${r.refId}`)
  else if (r.refTable === 'assessment') go(`/pkg-assess/result?id=${r.refId}`)
  else if (r.refTable === 'plan') go('/pkg-plan/detail')
}

onShow(async () => {
  if (!xj.loggedIn) return
  const first = !d.value
  loading.value = first
  d.value = await http.get('/app/archive/overview', undefined, { silent: true }).catch(() => d.value)
  const home: any = await http.get('/app/home', undefined, { silent: true }).catch(() => null)
  todos.value = home?.components?.find((c: any) => c.type === 'healthCard')?.props?.todos || []
  loading.value = false
})
</script>

<template>
  <view :class="[...xj.pageClass, 'has-tabbar', 'washed']">
    <XNav title="健康档案" big transparent />
    <view v-if="!xj.loggedIn" class="card empty stack">
      <text>登录后查看您的健康档案</text>
      <view class="btn" @click="go('/pkg-auth/login')">登录</view>
    </view>

    <!-- 骨架屏：形状与真实内容对应（指数卡 + 六维卡），交叉淡入 240ms 不做尺寸跳变 -->
    <view v-else-if="loading" class="stack">
      <view class="card raised">
        <view class="row gap12">
          <view class="skel skel-ring" />
          <view class="col flex1 gap8">
            <view class="skel skel-line" style="width: 40%" />
            <view class="skel skel-line" style="width: 88%" />
            <view class="skel skel-line" style="width: 56%" />
          </view>
        </view>
        <view class="skel skel-chart" />
      </view>
      <view class="dims">
        <view v-for="i in 6" :key="i" class="card skel-card">
          <view class="skel skel-line" style="width: 50%" />
          <view class="skel skel-bar" />
          <view class="skel skel-line" style="width: 70%" />
        </view>
      </view>
    </view>

    <view v-else-if="d && d.index === null && !d.metrics.length" class="card empty stack">
      <text class="t-md">完成六维测评后，这里会记录您的每一次变化。</text>
      <view class="btn" @click="go('/pkg-assess/intro')">开始六维测评</view>
    </view>

    <view v-else-if="d" class="stack mo-fade">
      <view class="card raised">
        <view class="row gap12">
          <XIndexRing
            v-if="d.index != null"
            :value="d.index"
            :size="xj.elderMode ? 128 : 112"
            :color="ringColor"
            :track-color="ringTrack"
            :count-up="countUp"
            caption="年轻化指数"
          />
          <view v-else class="ring-empty col center gap8" @click="go('/pkg-assess/intro')">
            <XIcon name="hexagon" :size="30" color="var(--brand)" />
            <text class="t-xs c2">去完成首次测评</text>
          </view>
          <view class="col flex1 gap4">
            <text class="t-sm c2">六维年轻化指数</text>
            <text class="t-md semi">{{ indexVerdict }}</text>
            <text class="t-xs c3">
              {{ d.lastAssessedAt || '暂无测评' }}<template v-if="d.indexTrend?.length"> · {{ d.indexTrend.length }} 次测评</template><template v-if="delta != null"> {{ delta > 0 ? '+' : '' }}{{ delta }}</template>
            </text>
          </view>
        </view>
        <XTrendChart v-if="trendSeries.length > 1" class="mt8" :series="trendSeries" :width="chartW" :height="118" unit="分" />
        <view class="row-between mt8" @click="go('/pkg-archive/trend?code=INDEX')">
          <text class="t-sm c2">查看完整趋势与结论</text>
          <XIcon name="chevron-right" :size="16" color="#786E74" />
        </view>
      </view>

      <view class="row gap8 t-sm c2 wrap">
        <text>数据来源</text>
        <text v-for="(s, k) in SOURCE_STYLE" :key="k" class="tag" :style="{ background: s.bg, color: s.fg }">{{ s.name }}</text>
      </view>

      <view class="dims">
        <DimCard v-for="dim in DIMS" :key="dim.code" :code="dim.code" :score="d.dims?.[dim.code] ?? null" />
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
            <text class="tag" :style="{ background: srcStyle(m.source).bg, color: srcStyle(m.source).fg }">{{ m.sourceName }}</text>
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
          <text class="t-xs semi" :style="{ color: srcStyle(r.source).fg }">{{ r.sourceName }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.dims {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.ring-empty {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  border: 2px dashed var(--line-2);
  flex-shrink: 0;
  justify-content: center;
}

/* 骨架屏：高度与真实卡对应（环 112 + 图表 118 / 六维卡三行），底色呼吸不引入动画变量 */
.skel {
  background: var(--placeholder, #efeae6);
  border-radius: 6px;
  animation: xj-skel 1.2s ease-in-out infinite;
}
.skel-ring {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  flex-shrink: 0;
}
.skel-line {
  height: 14px;
}
.skel-bar {
  height: 6px;
  border-radius: 3px;
}
.skel-chart {
  height: 118px;
  margin-top: 12px;
  border-radius: 8px;
}
.skel-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
  min-height: 110px;
}
@keyframes xj-skel {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
/* 乐龄 / mo-off 下骨架不做呼吸（统一降级），静态浅灰即可 */
.xj.mo-off .skel,
.xj.elder .skel {
  animation: none;
}
</style>
