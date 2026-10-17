<script lang="ts" setup>
import { computed, ref } from 'vue'
import XGraphic from '@/components/XGraphic.vue'
import XIcon from '@/components/XIcon.vue'
import XRadar from '@/components/XRadar.vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { toast } from '@/xj/utils'
import { DIM_GRAPHIC } from '@/xj/graphics'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '六维周报' } })

/** /app/archive/weekly?week= 契约（XJ-302 交付）：周聚合 + 第 N 期 + 指数环比 + dims 环比 + three（D5：仅站内，不做推送） */
interface DimRow { code: string, name: string, score: number | null, prev: number | null, delta: number | null }
interface WeeklyData {
  weekStart: string
  weekEnd: string
  issue: number
  index: { value: number | null, prev: number | null, delta: number | null }
  riskLevel: string | null
  dims: DimRow[]
  three: { good: string, attention: string, next: string }
}

const xj = useXj()
const d = ref<WeeklyData | null>(null)
const weekParam = ref<string | null>(null)

async function load(week?: string | null) {
  d.value = await http.get<WeeklyData>('/app/archive/weekly', week ? { week } : undefined, { loading: '生成周报中' })
}
onLoad((opts: any) => {
  weekParam.value = opts?.week || null
  load(weekParam.value)
})

/** 雷达图数据：scores / prevScores（XRadar dark 模式走固定金线，封面黑金不随皮肤） */
const scores = computed(() => Object.fromEntries((d.value?.dims ?? []).filter(x => x.score != null).map(x => [x.code, x.score])))
const prevScores = computed(() => Object.fromEntries((d.value?.dims ?? []).filter(x => x.prev != null).map(x => [x.code, x.prev])))
const hasData = computed(() => d.value?.index.value != null)

/** 环比三态（AC#2）：改善绿 / 持平灰 / 下降琥珀——不用红色、不用焦虑措辞（禁焦虑） */
function deltaCls(delta: number | null) {
  if (delta == null || delta === 0)
    return 'flat'
  return delta > 0 ? 'up' : 'down'
}
function deltaTxt(delta: number | null) {
  if (delta == null)
    return '暂无对比'
  if (delta === 0)
    return '持平'
  return delta > 0 ? `+${delta}` : `${delta}`
}
/** 进度条比例（0~1）：null 视为 0，超界收敛到 [0,100] */
function ratio(v: number | null) {
  return Math.max(0, Math.min(100, v ?? 0)) / 100
}

/** 上一期：当前周起始日往前推 7 天（YYYY-MM-DD） */
function prevMonday(ws: string) {
  const dt = new Date(ws.replace(/-/g, '/'))
  dt.setDate(dt.getDate() - 7)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
function goPrev() {
  if (!d.value)
    return
  const w = prevMonday(d.value.weekStart)
  weekParam.value = w
  load(w)
}
function goLatest() {
  weekParam.value = null
  load(null)
}

/** 分享内容不含个人健康数据（AC#5）：只带期数与日期区间，不带分数/维度值 */
onShareAppMessage(() => ({
  title: `我的六维周报第 ${d.value?.issue ?? 1} 期出炉啦，来看看吧`,
  path: '/pages/index/index',
}))
function shareH5() {
  toast('点击右上角"···"转发给家人')
}
</script>

<template>
  <view class="has-footer" :class="[...xj.pageClass]">
    <XNav show-back title="六维周报" />
    <view v-if="d" class="stack" style="padding-top: 12px">
      <!-- ① 封面卡：夜色黑金（--report-* 三套皮肤同值，刻意不随皮肤变化，AC#1）；左指数环比 + 右雷达；右上第 N 期 -->
      <view class="cover mo-rise mo-d1">
        <view class="row-between">
          <view class="col gap2">
            <text class="cover-kicker">六维年轻化指数周报</text>
            <text class="cover-range num">{{ d.weekStart.slice(5).replace('-', '.') }} - {{ d.weekEnd.slice(5).replace('-', '.') }}</text>
          </view>
          <text class="issue-tag">第 {{ d.issue }} 期</text>
        </view>
        <view class="row gap16 cover-body">
          <view class="col flex1 gap4">
            <text class="cover-idx num">{{ hasData ? d.index.value : '--' }}</text>
            <text class="cover-cap">本期指数</text>
            <text class="cover-delta num" :class="deltaCls(d.index.delta)">{{ hasData ? deltaTxt(d.index.delta) : '完成测评后生成' }}</text>
            <text v-if="hasData && d.index.delta != null && d.index.delta > 0" class="cover-note">比上期更进一步</text>
          </view>
          <XRadar :scores="scores" :prev="prevScores" dark :size="150" />
        </view>
      </view>

      <!-- ② 本周三件事：做得不错（绿）/ 需要留意（琥珀）/ 下一步（金），复用 assess 的 three 结构 -->
      <view class="card raised stack mo-rise mo-d2">
        <text class="t-lg">本周三件事</text>
        <view class="row gap12">
          <view class="icon-box care">
            <XIcon name="heart" />
          </view>
          <view class="col gap4 flex1">
            <text class="t-sm semi c-care">做得不错</text>
            <text class="t-md">{{ d.three.good }}</text>
          </view>
        </view>
        <view class="row gap12">
          <view class="icon-box terra">
            <XIcon name="alert-triangle" />
          </view>
          <view class="col gap4 flex1">
            <text class="t-sm semi c-warn">需要留意</text>
            <text class="t-md">{{ d.three.attention }}</text>
          </view>
        </view>
        <view class="row gap12">
          <view class="icon-box">
            <XIcon name="arrow-right" />
          </view>
          <view class="col gap4 flex1">
            <text class="t-sm semi c-brand">下一步</text>
            <text class="t-md">{{ d.three.next }}</text>
          </view>
        </view>
      </view>

      <!-- ③ 六维变化：色块图形 + 维度名 + 进度条 + 环比三态（+4 / 持平 / -N） -->
      <view class="card raised stack mo-rise mo-d3">
        <text class="t-lg">六维变化</text>
        <view v-for="dim in d.dims" :key="dim.code" class="row gap12 dim-row">
          <view class="dim-ic">
            <XGraphic :name="DIM_GRAPHIC[dim.code]" :size="22" />
          </view>
          <view class="col flex1 gap6">
            <view class="row-between">
              <text class="t-md semi">{{ dim.name }}</text>
              <text class="t-sm delta num" :class="deltaCls(dim.delta)">{{ deltaTxt(dim.delta) }}</text>
            </view>
            <view class="bar">
              <view class="bar-in" :class="deltaCls(dim.delta)" :style="{ transform: `scaleX(${ratio(dim.score)})` }" />
            </view>
          </view>
        </view>
      </view>

      <!-- ④ 操作：分享给家人 + 看看上期（AC#3：week 参数回溯上一周）；历史期可回最新 -->
      <view class="row gap12 mo-rise mo-d4">
        <!-- #ifdef MP-WEIXIN -->
        <button class="btn flex1 share-btn" hover-class="mo-press-active" open-type="share">
          分享给家人
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view class="btn flex1" hover-class="mo-press-active" @click="shareH5">
          分享给家人
        </view>
        <!-- #endif -->
        <view class="btn plain flex1" hover-class="mo-press-active" @click="goPrev">
          看看上期
        </view>
      </view>
      <view v-if="weekParam" class="center mo-rise mo-d4">
        <text class="link t-sm" @click="goLatest">回到最新一期</text>
      </view>
    </view>

    <!-- ⑤ 底部固定合规条：不随滚动消失（AC#4） -->
    <view class="disclaimer-bar">
      雪姬六维指数为品牌指数，不是医学指标
    </view>
  </view>
</template>

<style scoped>
/* ── ① 封面：夜色黑金（--report-bg/--report-ink 三皮肤同值固定，AC#1「报告=珍视」） ── */
.cover {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 16px;
  border-radius: var(--r-card);
  background: var(--report-bg, #1c1712);
  color: var(--report-ink, #d2b47a);
}
.cover-kicker {
  font-size: var(--fs-sm);
  font-weight: 600;
  letter-spacing: 1px;
  opacity: 0.92;
}
.cover-range {
  font-size: var(--fs-xs);
  opacity: 0.65;
}
.issue-tag {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid rgba(210, 180, 122, 0.55);
  font-size: var(--fs-xs);
  font-weight: 700;
  white-space: nowrap;
}
.cover-body {
  align-items: center;
}
.cover-idx {
  font-size: 52px;
  font-weight: 700;
  font-family: var(--font-title);
  line-height: 1.05;
}
.cover-cap {
  font-size: var(--fs-xs);
  opacity: 0.65;
}
.cover-note {
  font-size: var(--fs-xs);
  opacity: 0.75;
}
/* 封面内环比色：夜黑底上提高亮度的绿 / 琥珀 / 灰金（与皮肤令牌解耦，固定取值保证三皮肤一致） */
.cover-delta.up {
  color: #8fbf7a;
}
.cover-delta.down {
  color: #eab254;
}
.cover-delta.flat {
  opacity: 0.75;
}
/* ── ③ 六维行 ── */
.dim-row {
  align-items: center;
}
.dim-ic {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--gd-bg-gold, linear-gradient(150deg, #fdf6e9 0%, #f3e4cc 100%));
  display: flex;
  align-items: center;
  justify-content: center;
}
.bar {
  height: 8px;
  border-radius: 4px;
  background: var(--placeholder);
  overflow: hidden;
}
.bar-in {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--brand-hi), var(--brand-dark));
  transform-origin: 0 50%;
  /* 进度条用 scaleX 而非 width 过渡（docs/08：只动 transform/opacity），时长随 --mo-* 档位变量降级 */
  transition: transform var(--mo-base) var(--mo-ease);
}
/* 环比三态（AC#2）：改善绿 / 持平灰 / 下降琥珀，不用警示红（禁焦虑措辞） */
.delta.up {
  color: var(--meter-ok);
  font-weight: 700;
}
.delta.down {
  color: var(--meter-near);
  font-weight: 700;
}
.delta.flat {
  color: var(--ink-3);
}
/* ── ⑤ 固定合规条 ── */
.disclaimer-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  background: var(--bg);
  border-top: 1px solid var(--line);
  text-align: center;
  font-size: var(--fs-xs);
  color: var(--ink-3);
}
button.share-btn {
  margin: 0;
  line-height: var(--btn-h);
}
button.share-btn::after {
  border: 0;
}
</style>
