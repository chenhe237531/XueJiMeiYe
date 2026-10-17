<script lang="ts" setup>
import { computed, ref } from 'vue'
import XGraphic from '@/components/XGraphic.vue'
import XIcon from '@/components/XIcon.vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go, toast } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '门店集章册' } })

/** /app/stores/stamps 契约（XJ-304 交付）：按 N 家门店设计（D7）；无坐标字段，商圈文案替代距离（规避地图合规） */
interface StampStore {
  id: number
  name: string
  district: string
  address: string
  phone: string
  mall: string
  visits: number
  frequent: boolean
  stampedThisMonth: boolean
  stampedAt: string | null
  totalStamps: number
}
interface StampsData {
  month: string
  storeCount: number
  stampedStores: number
  totalStamps: number
  rule: string[]
  rewardHint: string
  stores: StampStore[]
}

const xj = useXj()
const d = ref<StampsData | null>(null)

/** 常去门店卡取列表头（后端排序：本月已盖在前、到店次数降序），本月有章的店优先露脸 */
const mainStore = computed(() => d.value?.stores[0] || null)
/** 待集列表：其余门店；仅 1 家时列表为空也不塌陷（AC#3：N=1 只有常去卡） */
const restStores = computed(() => (d.value?.stores ?? []).slice(1))
/** 集满状态：集满当月显示礼遇达成（正面反馈，不做催促文案） */
const full = computed(() => (d.value?.storeCount ?? 0) > 0 && d.value.stampedStores === d.value.storeCount)

async function load() {
  d.value = await http.get<StampsData>('/app/stores/stamps')
}
onShow(load)

function bookStore() {
  go('/pkg-module/lead-form?code=store_services')
}

function callStore(s: StampStore) {
  if (/\d{6,}/.test(s.phone || '')) {
    uni.makePhoneCall({ phoneNumber: s.phone })
  }
  else {
    toast('门店电话待补充，可先在线预约')
  }
}
</script>

<template>
  <view :class="xj.pageClass">
    <XNav show-back title="门店集章册" />
    <view v-if="d" class="stack" style="padding-top: 12px">
      <!-- ① 顶部进度：金色渐变；「我的健康印章册」+ 已集 N / M 家 + 集满奖励说明 -->
      <view class="hero mo-rise mo-d1">
        <text class="t-title">我的健康印章册</text>
        <view class="row gap16 hero-nums">
          <view class="col">
            <text class="hero-num num">{{ d.stampedStores }} / {{ d.storeCount }}</text>
            <text class="hero-cap">本月已集（家）</text>
          </view>
          <view class="hero-sep" />
          <view class="col">
            <text class="hero-num num">{{ d.totalStamps }}</text>
            <text class="hero-cap">累计印章（枚）</text>
          </view>
        </view>
        <text class="t-sm hero-sub">{{ full ? '本月印章已集满，专属礼遇解锁啦' : d.rewardHint }}</text>
      </view>

      <!-- ② 常去门店卡：图形区块 + 名称 + 商圈 + 标签 + 红色圆形印章（纯 CSS，旋转 -12°，做旧侵蚀） -->
      <view v-if="mainStore" class="card raised main-store mo-rise mo-d2">
        <view class="row gap12">
          <view class="thumb">
            <XGraphic name="store-house" :size="56" />
          </view>
          <view class="col flex1 gap4">
            <text class="t-lg">{{ mainStore.name }}</text>
            <text class="t-sm c2">{{ mainStore.mall || mainStore.district }}</text>
            <view class="row gap6 wrap">
              <text v-if="mainStore.frequent" class="tag gold">常去门店</text>
              <text class="tag gray">到店 {{ mainStore.visits }} 次</text>
              <text class="tag">累计 {{ mainStore.totalStamps }} 枚</text>
            </view>
          </view>
          <!-- 已盖 = 印泥红双圈章（含日期）；未盖 = 虚线圆待集，两种状态视觉强区分（AC#1） -->
          <view v-if="mainStore.stampedThisMonth" class="stamp">
            <text class="stamp-txt">已盖章</text>
            <text class="stamp-date num">{{ mainStore.stampedAt?.slice(5) }}</text>
          </view>
          <view v-else class="stamp hollow">
            <text class="hollow-txt">待盖章</text>
          </view>
        </view>
        <view class="row gap12 mt12">
          <view class="btn small flex1" hover-class="mo-press-active" @click="bookStore">
            去门店预约
          </view>
          <view class="btn small plain flex1" hover-class="mo-press-active" @click="callStore(mainStore)">
            联系门店
          </view>
        </view>
      </view>

      <!-- ③ 待集门店列表：每行图标 + 门店名 + 商圈 + 虚线圆「待盖章」 -->
      <view v-if="restStores.length" class="card raised mo-rise mo-d3 rest">
        <text class="t-md semi">还可以去这些门店集章</text>
        <view v-for="s in restStores" :key="s.id" class="cell" hover-class="mo-press-active" @click="bookStore">
          <view class="icon-box">
            <XIcon name="building-store" :size="20" />
          </view>
          <view class="col flex1 gap2">
            <text class="t-md">{{ s.name }}</text>
            <text class="t-xs c3">{{ s.mall || s.district }} · 到店 {{ s.visits }} 次</text>
          </view>
          <view v-if="s.stampedThisMonth" class="stamp sm">
            <text class="stamp-txt">已盖章</text>
          </view>
          <view v-else class="stamp hollow sm">
            <text class="hollow-txt">待盖章</text>
          </view>
        </view>
      </view>

      <!-- ④ 盖章规则：文案取自接口 rule（与后端「一店一月一枚」校验同源，AC#4） -->
      <view class="card hint rule mo-rise mo-d3">
        <view class="row gap8">
          <XIcon name="info-circle" :size="18" color="var(--warn-ink)" />
          <text class="t-sm semi">盖章规则</text>
        </view>
        <view v-for="(r, i) in d.rule" :key="i" class="row gap8">
          <text class="rule-no num">{{ i + 1 }}</text>
          <text class="t-sm flex1">{{ r }}</text>
        </view>
        <text class="t-sm">印章由门店顾问扫码录入，随时可在本册查看。</text>
      </view>

      <!-- ⑤ 主按钮：去门店预约（最近门店商圈随行提示，无地图/坐标） -->
      <view class="col center gap6 mo-rise mo-d4">
        <view class="btn" hover-class="mo-press-active" @click="bookStore">
          去门店预约
        </view>
        <text class="t-sm c2">{{ mainStore?.mall || mainStore?.district || '最近的门店' }}，到店即可盖章</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
/* ── ① 顶部进度：金色渐变（三皮肤 --brand 系自动换色，字色 --on-brand 对比达标） ── */
.hero {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 16px;
  border-radius: var(--r-card);
  background: linear-gradient(150deg, var(--brand-hi) 0%, var(--brand) 55%, var(--brand-dark) 100%);
  color: var(--on-brand);
}
.hero-nums {
  margin-top: 4px;
}
.hero-num {
  font-size: var(--fs-hero);
  font-weight: 700;
  font-family: var(--font-title);
  line-height: 1.2;
}
.hero-cap {
  font-size: var(--fs-xs);
  opacity: 0.82;
}
.hero-sep {
  width: 1px;
  height: 34px;
  background: rgba(128, 108, 78, 0.3);
}
.hero-sub {
  opacity: 0.88;
}
/* ── ② 图形区块（门店缩略位，零图片） ── */
.main-store {
  position: relative;
}
.thumb {
  flex-shrink: 0;
  width: 88px;
  height: 88px;
  border-radius: var(--r-inner);
  background: var(--gd-bg-gold, linear-gradient(150deg, #fdf6e9 0%, #f3e4cc 100%));
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
/* ── 印章：纯 CSS 合成（AC#2）。尺寸走 em：随乐龄大字号自动放大 ── */
.stamp {
  position: relative;
  flex-shrink: 0;
  width: 5em;
  height: 5em;
  box-sizing: border-box;
  font-size: var(--fs-xs);
  border-radius: 50%;
  border: 2px solid var(--stamp-ink);
  color: var(--stamp-ink);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  transform: rotate(-12deg);
  opacity: 0.92;
}
/* 双圈结构：内细圈 */
.stamp::before {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  border: 1px solid var(--stamp-ink);
}
/* 做旧质感：印泥侵蚀斑（底色斑点叠加，零图片） */
.stamp::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    radial-gradient(circle at 78% 20%, var(--surface) 0 12%, transparent 15%),
    radial-gradient(circle at 18% 82%, var(--surface) 0 9%, transparent 12%),
    radial-gradient(circle at 66% 72%, var(--surface) 0 7%, transparent 10%);
  opacity: 0.7;
}
.stamp-txt {
  font-weight: 800;
  font-size: 1em;
  line-height: 1.1;
}
.stamp-date {
  font-size: 0.75em;
  line-height: 1.1;
}
.stamp.sm {
  font-size: var(--fs-2xs, 11px);
  width: 4.4em;
  height: 4.4em;
}
/* 待盖章：虚线圆灰字（与印泥红实心章形成强对比） */
.stamp.hollow {
  border: 2px dashed var(--ink-3);
  color: var(--ink-3);
  transform: none;
  opacity: 1;
}
.stamp.hollow::before {
  border-style: dashed;
}
.stamp.hollow::after {
  display: none;
}
.hollow-txt {
  font-size: 0.9em;
  font-weight: 600;
}
/* ── ③ 待集列表 ── */
.rest {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rest .cell {
  border-top: 1px solid var(--line);
  padding: 12px 0;
}
.rest .cell:first-of-type {
  border-top: 0;
  padding-top: 4px;
}
.gap2 {
  gap: 2px;
}
/* ── ④ 规则编号 ── */
.rule {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rule-no {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--hint-line);
  color: var(--hint-ink);
  font-size: var(--fs-xs);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
