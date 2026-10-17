<script lang="ts" setup>
import { computed, ref } from 'vue'
import XGraphic from '@/components/XGraphic.vue'
import XIcon from '@/components/XIcon.vue'
import XRadar from '@/components/XRadar.vue'
import { DIM_GRAPHIC } from '@/xj/graphics'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go, riskText, speak } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '测评结果' } })

/**
 * 分维度建议（XJ-208 范围第 3 条：每维一卡，含得分、结论、建议）。
 * 后端 dims 只给 `note`（结论），没有 `advice` 字段，故建议文案由前端按维度给一条
 * **生活方式级**的通用提示：不做医学判断、不制造焦虑（健康产品红线），也不承诺效果。
 * 按 code 而非 tone 出文案——同一维度不论好坏，给的都是「怎么维持/怎么改善」的同一个方向。
 */
const ADVICE: Record<string, string> = {
  skin: '清洁与防晒优先，换季时把保湿加一档。',
  shape: '每周 3 次、每次 20 分钟快走，比偶尔一次大运动更容易坚持。',
  contour: '睡前少喝水、枕头略抬高，减少晨起浮肿。',
  fitness: '从椅子起坐练起，每天 2 组、每组 5 次。',
  posture: '久坐每 40 分钟起身活动一次，先把肩颈放松开。',
  mind: '给自己留 10 分钟安静时间，睡眠比补品更重要。',
}

const xj = useXj()
const r = ref<any>(null)
const prevDims = ref<any>(null)
const scores = computed(() => Object.fromEntries((r.value?.dims || []).filter((d: any) => d.score !== null).map((d: any) => [d.code, d.score])))
const paused = computed(() => ['L2', 'L3'].includes(r.value?.riskLevel))
const RISK_LABEL: Record<string, string> = { L0: '状态良好', L1: '需要留意', L2: '建议就医', L3: '请尽快就医' }
/** 测完是动机最高的时刻：页脚主按钮直接给"下一步"，按就医 → 体检券 → 方案的优先级 */
const nextStep = computed(() => {
  if (!r.value)
    return null
  if (paused.value && r.value.medical?.length)
    return { text: '预约合作医院', icon: 'building-hospital', link: '/pkg-checkup/book?mode=referral' }
  if (r.value.coupon)
    return { text: '查看我的体检券', icon: 'ticket', link: '/pkg-checkup/coupons' }
  if (r.value.plan)
    return { text: '查看初步方案', icon: 'clipboard-heart', link: '/pkg-plan/detail' }
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
  <view class="has-footer" :class="[...xj.pageClass]">
    <view v-if="r" class="stack" style="padding-top: 12px">
      <view class="card stack mo-rise">
        <view class="row-between">
          <text class="t-lg">您需要知道的三件事</text>
          <view class="pill" hover-class="mo-press-active" hover-stay-time="80" @click="readThree">
            <XIcon name="volume" :size="18" />
          </view>
        </view>
        <view class="three row gap12">
          <view class="icon-box care">
            <XIcon name="heart" />
          </view>
          <view class="col gap4 flex1">
            <text class="t-sm semi c-care">做得不错</text>
            <text class="t-lg" style="font-weight: 500">{{ r.three.good }}</text>
          </view>
        </view>
        <view class="three row gap12">
          <view class="icon-box terra">
            <XIcon name="alert-triangle" />
          </view>
          <view class="col gap4 flex1">
            <text class="t-sm semi c-warn">需要留意</text>
            <text class="t-lg" style="font-weight: 500">{{ r.three.attention }}</text>
          </view>
        </view>
        <view class="three row gap12">
          <view class="icon-box">
            <XIcon name="arrow-right" />
          </view>
          <view class="col gap4 flex1">
            <text class="t-sm semi c-brand">下一步</text>
            <text class="t-lg" style="font-weight: 500">{{ r.three.next }}</text>
          </view>
        </view>
      </view>

      <view class="card raised col gap12 index-card mo-rise mo-d1">
        <view class="col gap4">
          <text class="t-sm c2">六维年轻化指数</text>
          <view class="row gap8" style="align-items: baseline">
            <text class="num bold index-n">{{ r.index }}</text>
            <text v-if="r.prevIndex !== null" class="tag" :class="r.index >= r.prevIndex ? 'care' : 'warn'">较上次 {{ r.index >= r.prevIndex ? '+' : '' }}{{ r.index - r.prevIndex }}</text>
          </view>
          <view class="row gap12 t-xs c2">
            <view class="row gap4">
              <view class="lg brand" /><text>本次</text>
            </view>
            <view v-if="prevDims" class="row gap4">
              <view class="lg dash" /><text>上次</text>
            </view>
          </view>
          <text class="t-xs c3">雪姬美业品牌指数，不是医学指标</text>
        </view>
        <!-- grow：数据多边形从中心生长（mo-off / 轻效直达终态）；graphics：按 D17 在顶点叠维度图形 -->
        <view class="center">
          <XRadar :scores="scores" :prev="prevDims" :size="170" graphics grow />
        </view>
      </view>

      <view class="section-title mo-rise mo-d2">
        <text>六个维度</text>
      </view>
      <view class="dims">
        <view
          v-for="(d, i) in r.dims"
          :key="d.code"
          class="card dim-card"
          :class="`mo-rise mo-d${Math.min(i + 1, 6)}`"
        >
          <view class="row-between">
            <view class="row gap8">
              <XGraphic :name="DIM_GRAPHIC[d.code]" :size="20" />
              <text class="t-md semi">{{ d.name }}</text>
            </view>
            <view class="row gap6">
              <text v-if="d.score !== null" class="dim-score num">{{ d.score }}</text>
              <text class="tag" :class="d.tone === 'good' ? 'care' : d.tone === 'attention' ? 'warn' : 'gray'">{{ d.grade }}</text>
            </view>
          </view>
          <view v-if="d.score !== null" class="bar">
            <view :class="d.tone" :style="{ width: `${Math.max(4, Math.min(100, d.score))}%` }" />
          </view>
          <view class="dim-row">
            <text class="dim-k">结论</text>
            <text class="t-sm flex1">{{ d.note }}</text>
          </view>
          <view class="dim-row">
            <text class="dim-k">建议</text>
            <text class="t-sm c2 flex1">{{ ADVICE[d.code] }}</text>
          </view>
        </view>
      </view>

      <view v-if="r.medical.length" class="card care stack mo-rise mo-d3">
        <text class="t-md bold" style="color: var(--care-dark)">{{ paused ? '请先就医，门店项目暂停' : '就医建议，请优先安排' }}</text>
        <view v-for="m in r.medical" :key="m.code" class="row gap12">
          <view class="col flex1">
            <text class="t-lg">{{ m.name }}</text>
            <text class="t-sm" style="color: #4d5a3f">{{ m.reason }}</text>
          </view>
          <view class="row gap4 t-sm semi c-care book-link" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-checkup/book?mode=referral')">
            请顾问代约<XIcon name="chevron-right" :size="16" />
          </view>
        </view>
      </view>

      <view class="group">
        <view v-if="r.coupon" class="cell" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-checkup/coupons')">
          <view class="icon-box care">
            <XIcon name="ticket" />
          </view>
          <view class="col flex1">
            <text class="t-md">{{ r.coupon.type === 'BASIC_ELDER' ? '乐龄基础体检券' : '基础体检券' }}</text>
            <text class="t-sm c2">已发放，到店领取（或请顾问代领）后可预约</text>
          </view>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
        <view v-if="r.plan" class="cell" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-plan/detail')">
          <view class="icon-box">
            <XIcon name="clipboard-heart" />
          </view>
          <view class="col flex1">
            <text class="t-md">初步方案：{{ r.plan.packages.map((p) => p.name).join(' + ') }}</text>
            <text class="t-sm c2">{{ paused ? '医生确认后再安排门店项目' : '顾问会在 24 小时内联系您确认' }}</text>
          </view>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
        <view class="cell">
          <view class="icon-box gray">
            <XIcon name="info-circle" />
          </view>
          <view class="col flex1">
            <text class="t-md">{{ RISK_LABEL[r.riskLevel] || '风险等级' }}<text class="t-sm c3">（{{ r.riskLevel }}）</text></text>
            <text class="t-sm c2">{{ riskText(r.riskLevel) }}，由医生确认的规则判断</text>
          </view>
        </view>
        <view class="cell" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-family/list')">
          <view class="icon-box">
            <XIcon name="users" />
          </view>
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
        <view class="btn ghost icon-btn" @click="readAll">
          <XIcon name="volume" />
        </view>
        <view v-if="nextStep" class="btn flex1" :class="{ care: paused }" @click="go(nextStep.link)">
          <XIcon :name="nextStep.icon" />{{ nextStep.text }}
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.three {
  align-items: flex-start;
}
.index-card {
  background: radial-gradient(circle at 100% 0%, var(--brand-soft) 0, rgba(255, 255, 255, 0) 60%), var(--surface);
}
.index-n {
  font-size: 56px;
  line-height: 1.05;
  color: var(--brand-ink);
}
/* 分维度卡片：一维一卡，卡片间距走 --sp-4（XJ-103 阶梯），不再用 group/cell 的分隔线 */
.dims {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4, 16px);
}
.dim-card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2, 8px);
}
.dim-score {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--brand-ink);
}
.dim-row {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2, 8px);
}
.dim-k {
  flex-shrink: 0;
  font-size: var(--fs-xs);
  color: var(--ink-3);
  line-height: 1.6;
}
.bar {
  height: 6px;
  border-radius: 3px;
  background: var(--placeholder);
  overflow: hidden;
}
.bar > view {
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--brand-hi), var(--brand-dark));
}
.bar > view.good {
  background: linear-gradient(90deg, #b3c69b, #6e7f5c);
}
.bar > view.attention {
  background: linear-gradient(90deg, #f3c97f, #c98a2e);
}
.lg {
  width: 14px;
  height: 2px;
}
.lg.brand {
  background: var(--brand);
}
.lg.dash {
  border-top: 2px dashed #9a8f95;
  height: 0;
}
.book-link {
  flex-shrink: 0;
  align-items: center;
  min-height: 44px;
}
</style>
