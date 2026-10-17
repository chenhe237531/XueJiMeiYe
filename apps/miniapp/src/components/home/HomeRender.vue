<script setup lang="ts">
/**
 * 首页配置驱动渲染（设计文档 5.6）：greeting / tierCard / healthCard / entryGrid / banner / moduleList / activityCard / notice / mirrorFab / divider
 * 不认识的组件类型直接跳过，保证老版本兼容。
 */
import { computed, ref } from 'vue'
import HomeElder from '@/components/home/HomeElder.vue'
import HomeSignin from '@/components/home/HomeSignin.vue'
import HomeTasks from '@/components/home/HomeTasks.vue'
import { applyMatrix, GATE_TYPES } from '@/components/home/HomeGate.vue'
import XIcon from '@/components/XIcon.vue'
import XMascot from '@/components/XMascot.vue'
import XRadar from '@/components/XRadar.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { absUrl, go, themeHex, toast } from '@/xj/utils'

const props = defineProps<{ components: any[], night?: boolean }>()
const xj = useXj()
const elder = computed(() => xj.elderMode)
// XJ-202：KNOWN 含矩阵全部类型，applyMatrix 按 §4.1 矩阵过滤 + 兜底注入
const KNOWN = Array.from(new Set(['greeting', 'tierCard', 'healthCard', 'elderToday', 'checkinBar', 'taskList', 'entryGrid', 'banner', 'moduleList', 'activityCard', 'notice', 'mirrorFab', 'divider', ...GATE_TYPES]))
const list = computed(() => {
  const gated = applyMatrix(props.components || [], { tier: xj.tier, isGuest: !xj.loggedIn, elder: xj.elderMode })
  // XJ-203 / D21：乐龄下不渲染 mirrorFab 悬浮球（避免遮挡大字内容），由底部语音条替代
  return gated.filter(c => KNOWN.includes(c.type) && !(xj.elderMode && c.type === 'mirrorFab'))
})

/** XJ-203：乐龄「2 件小事」取自原始布局 taskList（矩阵按 §4.1 会剔除 taskList，故从过滤前取） */
const elderTasks = computed(() => {
  const tl = (props.components || []).find(c => c.type === 'taskList')
  return (tl?.props?.tasks || []).slice(0, 2)
})
const elderDone = computed(() => {
  const tl = (props.components || []).find(c => c.type === 'taskList')
  return tl?.props?.doneToday || []
})

function open(item: any, component: string) {
  if (item?.code) http.post('/app/events', { event: 'home_component_click', props: { component, moduleCode: item.code } }, { silent: true }).catch(() => {})
  if (!xj.loggedIn && item?.link && !item.link.startsWith('/pkg-module/detail') && !item.link.startsWith('/pages/')) {
    go('/pkg-auth/login')
    return
  }
  /** issue #5：商城类模块一步直达——微信端 navigateToMiniProgram（失败回退详情页），H5 走 h5Url 降级 */
  if (item?.entryType === 'miniprogram') {
    const cfg = item.entryConfig || {}
    // #ifdef MP-WEIXIN
    uni.navigateToMiniProgram({
      appId: cfg.appId,
      path: cfg.path,
      fail: () => go(item.link),
    })
    return
    // #endif
    // #ifdef H5
    if (cfg.h5Url) { window.location.href = cfg.h5Url; return }
    // #endif
    toast(cfg.tip || '商城请在微信小程序内访问')
    return
  }
  go(item.link)
}

/** 封面图加载失败回退占位（issue #6）：按模块 code 记录 */
const imgErr = ref(new Set<string>())

const featuredFirst = (items: any[], featured?: string) => {
  if (!featured) return { feature: null, rest: items }
  const f = items.find(i => i.code === featured)
  return { feature: f || null, rest: items.filter(i => i.code !== featured) }
}
/** 三列宫格最后一行补满：剩 1 个占满一行，剩 2 个时最后一个占两格 */
function tailSpan(g: { feature: any, rest: any[] }, i: number) {
  const cells = (g.feature ? 2 : 0) + g.rest.length
  const left = cells % 3
  if (i !== g.rest.length - 1 || !left) return ''
  return left === 1 ? 'span3' : 'span2'
}

/**
 * 入口彩色图标块的色系：常用模块固定配色（体检 = 健康绿），其余按后台 tone，缺省按序轮换，
 * 保证同屏相邻入口颜色不重复（参考商业小程序多色入口的识别度）。
 */
const CHIP_TONES = ['brand', 'rose', 'sky', 'plum', 'terra', 'care', 'green']
const TONE_BY_CODE: Record<string, string> = {
  assessment: 'brand',
  checkup_coupon: 'care',
  my_plan: 'rose',
  mirror: 'plum',
  store_services: 'terra',
  buddy_group: 'sky',
  daily_quiz: 'brand',
  family: 'rose',
  game_tree: 'green',
  game_wheel: 'plum',
  memory_cards: 'sky',
  passbook: 'brand',
}
const ROTATE = ['brand', 'rose', 'sky', 'plum', 'terra']
function chipTone(it: any, i: number | string) {
  return TONE_BY_CODE[it?.code] || (CHIP_TONES.includes(it?.tone) ? it.tone : ROTATE[Number(i) % ROTATE.length])
}

/** 「会员价 ¥299 起」拆成 前缀 / 金额 / 后缀，金额放大显示；不含 ¥ 的文案原样展示 */
function splitPrice(t?: string | null) {
  const i = t ? t.indexOf('¥') : -1
  if (!t || i < 0)
    return null
  const rest = t.slice(i + 1).trim()
  const amt = rest.match(/^\d[\d.,]*/)?.[0]
  return amt ? { pre: t.slice(0, i).trim(), amt, post: rest.slice(amt.length).trim() } : null
}

/** 六维测评卖点宫格（issue #4）：XIcon 均在 uno safelist 内 */
const DIMS = [
  { icon: 'droplet', tone: '', name: '肌肤', sub: '水润与细腻' },
  { icon: 'scale', tone: 'terra', name: '体型', sub: '紧致与匀称' },
  { icon: 'flower', tone: 'rose', name: '轮廓', sub: '立体与流畅' },
  { icon: 'heartbeat', tone: 'care', name: '体能', sub: '活力与耐力' },
  { icon: 'user', tone: 'sky', name: '体态', sub: '挺拔与平衡' },
  { icon: 'mood-smile', tone: 'plum', name: '心灵', sub: '松弛与愉悦' },
]
</script>

<template>
  <view class="home-render stack">
    <template v-for="(c, i) in list" :key="i">
      <!-- 问候栏 -->
      <view v-if="c.type === 'greeting'" class="greet row-between">
        <view class="col gap6 flex1">
          <text class="t-hero">{{ c.props.text }}</text>
          <view class="row gap8">
            <text class="tag" :class="{ gold: c.props.tier === 'A' }">{{ c.props.isGuest ? '访客' : c.props.tierName }}</text>
            <text v-if="c.props.isGuest" class="t-sm c-brand semi" @click="go('/pkg-auth/login')">登录 / 注册</text>
          </view>
        </view>
        <view class="row gap12" style="align-items: center">
          <view v-if="c.props.showElderToggle" class="col gap4" style="align-items: flex-end" @click="xj.toggleElder()">
            <text class="t-sm c2">乐龄模式</text>
            <view class="toggle" :class="{ on: elder }"><view class="knob" /></view>
          </view>
          <!-- 小镜入口（D21）：问候栏头像为魔镜第二入口，与 mirrorFab 悬浮球并存 -->
          <view class="mascot-entry" hover-class="mo-press-active" :hover-stay-time="80" @click="go('/pages/mirror/index')">
            <XMascot :size="32" state="online" />
          </view>
        </view>
      </view>

      <!-- 等级卡（issue #4 三档质感 + 权益图标化 + 水印字） -->
      <view v-else-if="c.type === 'tierCard'" class="tier-card" :class="`tier-${c.props.tier}`" @click="go('/pkg-me/tier')">
        <view class="row-between">
          <text class="t-lg tier-name">{{ c.props.tierName }}</text>
          <view class="row gap4 t-sm tier-more"><text>全部权益</text><XIcon name="chevron-right" :size="16" /></view>
        </view>
        <view class="tier-line" />
        <view class="row wrap gap8">
          <view v-for="b in c.props.benefits" :key="b.text" class="benefit row gap4">
            <XIcon :name="b.icon" :size="14" />
            <text class="t-sm">{{ b.text }}</text>
          </view>
        </view>
        <view class="row-between">
          <text v-if="c.props.keepUntil" class="t-xs" style="opacity: 0.8">保级至 {{ c.props.keepUntil }}</text>
          <text v-else class="t-xs" style="opacity: 0" aria-hidden> </text>
          <view v-if="c.props.tier !== 'A'" class="tier-up row gap4" @click.stop="go('/pkg-me/tier')">
            <text class="t-sm semi">了解升级</text><XIcon name="chevron-right" :size="14" />
          </view>
        </view>
      </view>

      <!-- 连续签到激活条（XJ-201）：数据由 HomeSignin 自取 /app/checkins -->
      <HomeSignin v-else-if="c.type === 'checkinBar'" :night="night" />

      <!-- 今日 3 件事任务卡（XJ-201 / XJ-305 / D1）：任务由后端动态生成 -->
      <HomeTasks v-else-if="c.type === 'taskList'" :title="c.props.title" :tasks="c.props.tasks" :done-today="c.props.doneToday" />

      <!-- 健康卡 -->
      <view v-else-if="c.type === 'healthCard'" class="card raised health">
        <template v-if="c.props.hasAssessment">
          <view class="row-between" @click="go('/pages/archive/index')">
            <view class="col gap4">
              <text class="t-body c2">六维年轻化指数</text>
              <view class="row gap8" style="align-items: baseline">
                <text class="num bold" :style="{ fontSize: elder ? '60px' : '52px', lineHeight: 1.05 }">{{ c.props.index }}</text>
                <text v-if="c.props.delta" class="semi" :class="c.props.delta > 0 ? 'c-care' : 'c-warn'">比上次 {{ c.props.delta > 0 ? '+' : '' }}{{ c.props.delta }}</text>
              </view>
              <text class="t-sm c3">上次测评 {{ c.props.lastAssessedAt }}</text>
            </view>
            <XRadar :scores="c.props.dims" :size="elder ? 104 : 96" :dark="night" />
          </view>
        </template>
        <view v-else class="col gap12" @click="go(xj.loggedIn ? '/pkg-assess/intro' : '/pkg-auth/login')">
          <text class="t-lg">了解自己的六个维度</text>
          <view class="dim-grid">
            <view v-for="dm in DIMS" :key="dm.name" class="dim col gap4">
              <view class="icon-box sm" :class="dm.tone"><XIcon :name="dm.icon" :size="18" /></view>
              <text class="t-sm semi">{{ dm.name }}</text>
              <text class="t-xs c3">{{ dm.sub }}</text>
            </view>
          </view>
          <view class="btn">{{ c.props.cta || '开始六维测评，约 8 分钟' }}</view>
          <text class="t-sm c-care semi" style="text-align: center">完成测评可以领取免费体检券</text>
        </view>
        <view v-for="t in c.props.todos" :key="t.text" class="todo row gap12" @click="go(t.link)">
          <view class="ic-chip" :class="t.tone === 'care' ? 'care' : 'brand'"><XIcon :name="t.icon" /></view>
          <view class="col flex1">
            <text class="t-md">{{ t.text }}</text>
            <text v-if="t.sub" class="t-sm c2">{{ t.sub }}</text>
          </view>
          <XIcon name="chevron-right" :size="20" color="#786E74" />
        </view>
      </view>

      <!-- 乐龄 · 今日健康（XJ-203 / docs/07 §4.3）：问候 + 2 件小事 + 家人前置 + 健康概览，由 HomeElder 承载 -->
      <HomeElder v-else-if="c.type === 'elderToday'" :c="c" :tasks="elderTasks" :done-today="elderDone" :night="night" />

      <!-- 入口宫格 -->
      <view v-else-if="c.type === 'entryGrid'">
        <view v-if="elder || c.props.columns === 3" class="grid3">
          <view v-if="featuredFirst(c.props.items, c.props.featured).feature" class="tile featured" @click="open(featuredFirst(c.props.items, c.props.featured).feature, 'entryGrid')">
            <XIcon :name="featuredFirst(c.props.items, c.props.featured).feature.icon" :size="30" />
            <view class="col">
              <text class="t-xl">{{ featuredFirst(c.props.items, c.props.featured).feature.name }}</text>
              <text class="t-sm" style="opacity: 0.88">{{ featuredFirst(c.props.items, c.props.featured).feature.summary }}</text>
            </view>
          </view>
          <view v-for="(it, i) in featuredFirst(c.props.items, c.props.featured).rest" :key="it.code" class="tile" :class="tailSpan(featuredFirst(c.props.items, c.props.featured), i)" @click="open(it, 'entryGrid')">
            <XIcon :name="it.icon" :size="30" :color="it.code === 'checkup_coupon' ? 'var(--care)' : (night ? '#D2B47A' : 'var(--brand-ink)')" />
            <view class="col tile-text">
              <text class="tile-name">{{ it.name }}</text>
              <text v-if="tailSpan(featuredFirst(c.props.items, c.props.featured), i) && it.summary" class="t-sm c2 tile-sub">{{ it.summary }}</text>
            </view>
          </view>
        </view>
        <view v-else class="grid4 card">
          <view v-for="(it, k) in c.props.items" :key="it.code" class="g4 col gap8" @click="open(it, 'entryGrid')">
            <view class="ic-chip" :class="chipTone(it, k)"><XIcon :name="it.icon" :size="24" /></view>
            <text class="t-sm g4-name">{{ it.name }}</text>
          </view>
        </view>
      </view>

      <!-- 轮播（乐龄模式停用自动轮播） -->
      <swiper v-else-if="c.type === 'banner'" class="banner" :autoplay="c.props.autoplay" circular :indicator-dots="c.props.items.length > 1" indicator-color="rgba(60, 50, 42, 0.14)" :indicator-active-color="themeHex().brand">
        <swiper-item v-for="it in c.props.items" :key="it.code">
          <!-- 大图横幅：封面铺满 + 底部渐变压字（参考商业小程序首页主视觉）；无封面时用品牌渐变底 -->
          <view class="hero" @click="open(it, 'banner')">
            <image v-if="it.cover && !imgErr.has(it.code)" class="ph-img" :src="absUrl(it.cover)" mode="aspectFill" @error="imgErr.add(it.code)" />
            <view v-else class="ph-fallback hero-fallback"><XIcon :name="it.icon || 'sparkles'" :size="64" /></view>
            <view class="hero-shade" />
            <view class="hero-text col gap4">
              <text class="hero-kicker">{{ it.name }}</text>
              <text class="hero-title">{{ it.summary }}</text>
              <view class="row gap8">
                <text class="hero-cta">{{ it.priceText || '查看详情' }}</text>
              </view>
            </view>
          </view>
        </swiper-item>
      </swiper>

      <!-- 分组标题 -->
      <view v-else-if="c.type === 'divider'" class="section-title">
        <text>{{ c.props.title }}</text>
      </view>

      <!-- 模块列表 -->
      <view v-else-if="c.type === 'moduleList'" class="stack">
        <text v-if="c.props.title" class="t-lg">{{ c.props.title }}</text>
        <template v-if="c.props.style === 'card'">
          <!-- 内容卡：大缩略图 + 左上角标 + 放大金额 + 右侧行动胶囊 -->
          <view v-for="it in c.props.items" :key="it.code" class="card row gap12 mcard" @click="open(it, 'moduleList')">
            <view class="photo-slot mthumb">
              <image v-if="it.cover && !imgErr.has(it.code)" class="ph-img" :src="absUrl(it.cover)" mode="aspectFill" @error="imgErr.add(it.code)" />
              <view v-else class="ph-fallback"><XIcon :name="it.icon || 'sparkles'" :size="30" /></view>
              <text v-if="it.days && !it.summary?.includes(it.days)" class="corner-tag">{{ it.days }}</text>
            </view>
            <view class="col flex1 mbody">
              <view class="col gap4">
                <text class="t-lg mname">{{ it.name }}</text>
                <text v-if="it.summary" class="t-sm c2 clamp1">{{ it.summary }}</text>
              </view>
              <view class="row-between gap8">
                <view v-if="splitPrice(it.priceText)" class="mprice">
                  <text v-if="splitPrice(it.priceText)!.pre" class="mprice-aux">{{ splitPrice(it.priceText)!.pre }}</text>
                  <text class="mprice-yen">¥</text>
                  <text class="mprice-amt">{{ splitPrice(it.priceText)!.amt }}</text>
                  <text v-if="splitPrice(it.priceText)!.post" class="mprice-aux">{{ splitPrice(it.priceText)!.post }}</text>
                </view>
                <text v-else-if="it.priceText" class="t-md c-brand bold">{{ it.priceText }}</text>
                <view v-else />
                <!-- 有价格时收成圆形箭头，给「会员价 ¥4,680 起」留足宽度 -->
                <view v-if="!elder && it.priceText" class="go-round">
                  <XIcon name="chevron-right" :size="16" />
                </view>
                <view v-else-if="!elder" class="go-pill">去看看<XIcon name="chevron-right" :size="14" /></view>
              </view>
            </view>
          </view>
        </template>
        <!-- 标准模式：双列小卡；乐龄模式保留单列大行，热区与字号更友好 -->
        <view v-else-if="!elder" class="grid2">
          <view v-for="(it, k) in c.props.items" :key="it.code" class="mini row gap10" :class="{ span2: c.props.items.length % 2 === 1 && k === c.props.items.length - 1 }" @click="open(it, 'moduleList')">
            <view class="ic-chip sm" :class="chipTone(it, k)"><XIcon :name="it.icon" :size="18" /></view>
            <view class="col flex1">
              <text class="t-body semi clamp1">{{ it.name }}</text>
              <text class="t-xs c3 clamp1">{{ it.summary }}</text>
            </view>
          </view>
        </view>
        <view v-else class="group">
          <view v-for="(it, k) in c.props.items" :key="it.code" class="cell" @click="open(it, 'moduleList')">
            <view class="ic-chip sm" :class="chipTone(it, k)"><XIcon :name="it.icon" :size="22" /></view>
            <view class="col flex1">
              <text class="t-md">{{ it.name }}</text>
              <text class="t-sm c2">{{ it.summary }}</text>
            </view>
            <XIcon name="chevron-right" :size="20" color="#786E74" />
          </view>
        </view>
      </view>

      <!-- 活动卡 -->
      <view v-else-if="c.type === 'activityCard'" class="card row gap12" @click="open(c.props, 'activityCard')">
        <view class="ic-chip care"><XIcon name="calendar-event" /></view>
        <view class="col flex1"><text class="t-md">{{ c.props.name }}</text><text class="t-sm c2">{{ c.props.summary }}</text></view>
        <XIcon name="chevron-right" :size="20" color="#786E74" />
      </view>

      <!-- 公告条 -->
      <view v-else-if="c.type === 'notice'" class="card hint row gap8" @click="go(c.props.link)">
        <XIcon name="info-circle" /><text class="t-sm">{{ c.props.text }}</text>
      </view>

      <!-- B 级：升级进度条（tierProgress，§4.1 矩阵 B 专属） -->
      <view v-else-if="c.type === 'tierProgress'" class="card row gap12" @click="go('/pkg-me/tier')">
        <view class="col flex1">
          <view class="row-between">
            <text class="t-sm c2">{{ c.props.title || '距下个等级' }}</text>
            <text class="t-sm c-brand semi">{{ c.props.progress || '' }}</text>
          </view>
          <view v-if="c.props.pct != null" class="progress" style="margin-top: 8px">
            <view :style="{ width: `${c.props.pct}%` }" />
          </view>
        </view>
        <XIcon name="chevron-right" :size="20" color="#786E74" />
      </view>

      <!-- A 级：专属顾问卡（advisorCard，§4.1 矩阵 A 专属） -->
      <view v-else-if="c.type === 'advisorCard'" class="card row gap12" @click="go('/pkg-me/advisor')">
        <view class="ic-chip plum">
          <XIcon name="headset" />
        </view>
        <view class="col flex1">
          <text class="t-md semi">{{ c.props.name || '专属顾问' }}</text>
          <text class="t-sm c2">{{ c.props.summary || '4 小时内响应' }}</text>
        </view>
        <XIcon name="chevron-right" :size="20" color="#786E74" />
      </view>

      <!-- A 级：权益网格（benefitGrid，§4.1 矩阵 A 专属 6 项） -->
      <view v-else-if="c.type === 'benefitGrid'" class="card">
        <text class="t-lg">
          {{ c.props.title || '臻享权益' }}
        </text>
        <view class="dim-grid">
          <view v-for="b in (c.props.items || c.props.benefits || [])" :key="b.text" class="dim col gap4">
            <view class="icon-box sm plum">
              <XIcon :name="b.icon" :size="18" />
            </view>
            <text class="t-xs">{{ b.text }}</text>
          </view>
        </view>
      </view>

      <!-- A 级：年度报告入口（annualReport，§4.1 矩阵 A 专属） -->
      <view v-else-if="c.type === 'annualReport'" class="card row gap12" @click="go('/pages/archive/index')">
        <view class="ic-chip ink">
          <XIcon name="report-medical" />
        </view>
        <view class="col flex1">
          <text class="t-md semi">{{ c.props.title || '年度个人健康报告' }}</text>
          <text class="t-sm c2">{{ c.props.summary || '全年六维趋势与解读' }}</text>
        </view>
        <XIcon name="chevron-right" :size="20" color="#786E74" />
      </view>

      <!-- B 级：结伴拼团卡（groupCard，§4.1 矩阵 B 专属） -->
      <view v-else-if="c.type === 'groupCard'" class="card row gap12" @click="go(c.props.link || '/pkg-module/detail')">
        <view class="ic-chip terra">
          <XIcon name="users-group" />
        </view>
        <view class="col flex1">
          <text class="t-md semi">{{ c.props.name || '结伴拼团' }}</text>
          <text class="t-sm c2">{{ c.props.summary || '和同龄人一起，更有动力' }}</text>
        </view>
        <XIcon name="chevron-right" :size="20" color="#786E74" />
      </view>

      <!-- 访客专属：测评引导卡（assessGuide，§4.1 矩阵访客专属） -->
      <view v-else-if="c.type === 'assessGuide'" class="card col gap12" @click="go('/pkg-assess/intro')">
        <text class="t-lg">{{ c.props.title || '六个维度是什么' }}</text>
        <text class="c2">{{ c.props.summary || '完成免费测评，领体检券' }}</text>
        <view class="btn small">
          {{ c.props.cta || '开始测评' }}
        </view>
      </view>

      <!-- 访客专属：门店与品牌（storeBrand，§4.1 矩阵访客专属） -->
      <view v-else-if="c.type === 'storeBrand'" class="card row gap12" @click="go('/pkg-module/store')">
        <view class="ic-chip brand">
          <XIcon name="building-store" />
        </view>
        <view class="col flex1">
          <text class="t-md semi">{{ c.props.name || '门店与品牌' }}</text>
          <text class="t-sm c2">{{ c.props.summary || '' }}</text>
        </view>
        <XIcon name="chevron-right" :size="20" color="#786E74" />
      </view>

      <!-- 魔镜悬浮入口（乐龄下已被 list 过滤剔除，由底部语音条替代，XJ-203 / D21） -->
      <view v-else-if="c.type === 'mirrorFab'" class="fab" :class="{ night }" @click="go('/pages/mirror/index')">
        <XIcon name="sparkles" :size="22" />
        <text>{{ c.props.label || '小镜' }}</text>
      </view>
    </template>

    <!-- 乐龄语音小镜条（XJ-203 / D21）：替代 mirrorFab 悬浮球，一次点击直达小镜 -->
    <view v-if="elder" class="voice-bar" hover-class="mo-press-active" :hover-stay-time="80" @click="go('/pages/mirror/index')">
      <XIcon name="microphone" :size="24" />
      <text>按住说话，问问小镜</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.greet { padding-top: 4px; }
/* 小镜头像入口：按压反馈走 hover-class，热区比 32px 头像大一圈 */
.mascot-entry {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}
.toggle { width: 50px; height: 30px; border-radius: 15px; background: #d8d0d4; position: relative; transition: background 0.2s; }
.toggle .knob { position: absolute; left: 3px; top: 3px; width: 24px; height: 24px; border-radius: 12px; background: #fff; box-shadow: 0 1px 2px rgba(60, 24, 44, 0.25); transition: left 0.2s; }
.toggle.on { background: var(--brand); }
.toggle.on .knob { left: 23px; }
.night .toggle.on { background: var(--gold); }

.tier-card { position: relative; overflow: hidden; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 10px 24px -16px rgba(60, 48, 34, 0.35); }
.tier-card::before { position: absolute; right: 10px; top: -8px; font-family: var(--font-title); font-size: 58px; font-weight: 700; opacity: 0.08; pointer-events: none; line-height: 1; }
.tier-C::before { content: '悦'; }
.tier-B::before { content: '悦'; }
.tier-A::before { content: '臻'; }
.tier-C { background: radial-gradient(circle at 88% 12%, rgba(255, 255, 255, 0.9) 0, rgba(255, 255, 255, 0) 45%), linear-gradient(135deg, #fbf4e8 0%, #f0dcbc 100%); color: var(--brand-ink); border: 1px solid rgba(201, 160, 99, 0.35); }
.tier-B { background: linear-gradient(135deg, #d9b984 0%, #c9a063 55%, #a8824d 100%); color: var(--on-brand); }
.tier-A { background: linear-gradient(150deg, #262019 0%, #1c1712 70%); color: #f2ece8; border: 1px solid rgba(210, 180, 122, 0.35); }
.tier-A .tier-name { color: #d2b47a; font-family: var(--font-title); }
.tier-line { height: 1px; background: currentColor; opacity: 0.2; }
.benefit { padding: 3px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.35); align-items: center; }
.tier-C .benefit { background: #fff; }
.tier-A .benefit { background: rgba(210, 180, 122, 0.14); color: #e6d3ad; }
.tier-up { color: var(--on-brand); opacity: 0.9; }
.tier-B .tier-up { opacity: 0.85; }

.dim-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.dim { align-items: center; text-align: center; padding: 12px 4px 10px; border-radius: var(--r-inner); background: var(--placeholder); }
.icon-box.sm { width: 34px; height: 34px; border-radius: 10px; }

.tone-care { color: var(--care); }
.tone-green { color: var(--aux-green); }
.tone-terra { color: var(--aux-terra); }
.tone-rose { color: var(--aux-rose); }
.tone-sky { color: var(--aux-sky); }
.tone-plum { color: var(--aux-plum); }

.health { padding-bottom: 4px; background: radial-gradient(circle at 92% 0%, var(--brand-soft) 0, rgba(255, 255, 255, 0) 55%), var(--surface); }
.night .health { background: var(--surface); }
.todo { border-top: 1px solid var(--line); padding: 14px 0 12px; margin-top: 12px; }

.grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.tile { height: 100px; border-radius: 20px; background: var(--surface); padding: 14px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03), 0 8px 18px -14px rgba(34, 24, 40, 0.28); }
.elder .tile { height: 108px; padding: 12px 10px; }
.tile-name { font-size: var(--fs-md); font-weight: 600; line-height: 1.3; text-wrap: balance; }
.tile.featured { grid-column: span 2; background: var(--brand); color: var(--on-brand); height: 112px; box-shadow: 0 10px 22px -12px rgba(168, 130, 77, 0.5); }
.night .tile.featured { color: #1c1712; }
/* 最后一行只剩 1~2 个时拉宽补满，不留孤零零的一格 */
.tile.span2 { grid-column: span 2; }
.tile.span3 { grid-column: span 3; }
.tile.span2, .tile.span3 { flex-direction: row; align-items: center; justify-content: flex-start; gap: 14px; }
.tile-sub { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.grid4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px 4px; padding: 16px 8px; }
.g4 { align-items: center; text-align: center; text-wrap: balance; }
.g4-name { color: var(--ink); font-weight: 500; line-height: 1.3; }
.night .g4-name { color: var(--ink); }

.clamp1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }

.banner { height: 156px; }
.hero { position: relative; height: 150px; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 24px -14px rgba(60, 48, 34, 0.45); }
.hero-fallback { justify-content: flex-end; padding-right: 24px; }
.hero-shade { position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: linear-gradient(90deg, rgba(43, 32, 22, 0.72) 0%, rgba(43, 32, 22, 0.35) 55%, rgba(43, 32, 22, 0) 100%); }
.hero-text { position: absolute; left: 18px; top: 0; bottom: 0; right: 40%; justify-content: center; color: #fff; }
.hero-kicker { font-size: 12px; font-weight: 600; letter-spacing: 1px; opacity: 0.9; }
.hero-title { font-family: var(--font-title); font-size: 21px; font-weight: 700; line-height: 1.3; text-wrap: balance; }
.hero-cta { margin-top: 4px; padding: 3px 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.94); color: var(--brand-ink); font-size: 12px; font-weight: 700; }

.mcard { padding: 12px; align-items: stretch; }
.mthumb { width: 104px; height: 104px; border-radius: 12px; }
.elder .mthumb { width: 96px; height: 96px; }
.mbody { justify-content: space-between; gap: 8px; }
.mname { line-height: 1.35; }
.mprice { display: flex; align-items: baseline; gap: 1px; color: var(--brand-ink); font-weight: 700; white-space: nowrap; }
.mprice-yen { font-size: 13px; margin-left: 2px; }
.mprice-amt { font-size: 24px; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.elder .mprice-amt { font-size: 28px; }
.mprice-aux { font-size: var(--fs-xs); font-weight: 500; color: var(--ink-2); margin-left: 2px; white-space: nowrap; }
.go-round { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--brand-soft); border: 1px solid var(--brand-line); color: var(--brand-ink); }

.grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.mini { padding: 12px; border-radius: var(--r-card); background: var(--surface); border: 1px solid var(--card-line); box-shadow: var(--shadow-card); }
.mini.span2 { grid-column: span 2; }
.gap10 { gap: 10px; }
.photo-slot { position: relative; overflow: hidden; }
.ph-img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
/* 没有实拍图时的品牌底图：柔金渐变 + 光斑 + 图标，不再露出"实拍位"字样 */
.ph-fallback { position: absolute; left: 0; top: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; color: var(--brand-ink); background: radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.75) 0, rgba(255, 255, 255, 0) 42%), linear-gradient(145deg, var(--brand-soft), var(--brand-line)); }
.night .ph-fallback { color: #d2b47a; background: radial-gradient(circle at 78% 18%, rgba(210, 180, 122, 0.28) 0, rgba(210, 180, 122, 0) 45%), linear-gradient(145deg, #3a3026, #2a231c); box-shadow: inset 0 0 0 1px rgba(210, 180, 122, 0.22); }

.fab { position: fixed; right: 16px; bottom: calc(76px + env(safe-area-inset-bottom)); z-index: 60; height: 48px; padding: 0 16px; border-radius: 24px; background: var(--brand); color: var(--on-brand); display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 15px; box-shadow: 0 8px 24px -8px rgba(168, 130, 77, 0.5); }
.fab.night { color: #1c1712; }

/* 乐龄语音小镜条（XJ-203 / D21）：固定在 tabbar 之上（对齐 .xj.has-tabbar 的 96px + 安全区留白），
   只在乐龄态渲染，--care 继承乐龄皮肤墨绿 #5c7a52；全宽热区 52px ≥44px */
.voice-bar {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(96px + env(safe-area-inset-bottom));
  z-index: 60;
  height: 52px;
  border-radius: 26px;
  background: var(--care);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: var(--fs-sm);
  font-weight: 700;
  box-shadow: 0 8px 24px -10px rgba(63, 107, 79, 0.55);
}
</style>
