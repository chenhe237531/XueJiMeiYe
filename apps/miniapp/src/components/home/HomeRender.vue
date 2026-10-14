<script setup lang="ts">
/**
 * 首页配置驱动渲染（设计文档 5.6）：greeting / tierCard / healthCard / entryGrid / banner / moduleList / activityCard / notice / mirrorFab / divider
 * 不认识的组件类型直接跳过，保证老版本兼容。
 */
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import XRadar from '@/components/XRadar.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { absUrl, go, themeHex, toast } from '@/xj/utils'

const props = defineProps<{ components: any[], night?: boolean }>()
const xj = useXj()
const elder = computed(() => xj.elderMode)
const KNOWN = ['greeting', 'tierCard', 'healthCard', 'elderToday', 'entryGrid', 'banner', 'moduleList', 'activityCard', 'notice', 'mirrorFab', 'divider']
const list = computed(() => (props.components || []).filter(c => KNOWN.includes(c.type)))

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
        <view v-if="c.props.showElderToggle" class="col gap4" style="align-items: flex-end" @click="xj.toggleElder()">
          <text class="t-sm c2">乐龄模式</text>
          <view class="toggle" :class="{ on: elder }"><view class="knob" /></view>
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
          <view class="icon-box" :class="t.tone === 'care' ? 'care' : ''"><XIcon :name="t.icon" /></view>
          <view class="col flex1">
            <text class="t-md">{{ t.text }}</text>
            <text v-if="t.sub" class="t-sm c2">{{ t.sub }}</text>
          </view>
          <XIcon name="chevron-right" :size="20" color="#786E74" />
        </view>
      </view>

      <!-- 乐龄 · 今日健康（issue #8）：问候 + 健康概览 + 今日养护 + 家人大入口 -->
      <view v-else-if="c.type === 'elderToday'" class="card elder-today">
        <view class="row-between gap8">
          <view class="col gap6 flex1">
            <text class="t-title">{{ c.props.text }}</text>
            <view class="row gap8">
              <text class="tag">{{ c.props.isGuest ? '访客' : c.props.tierName }}</text>
              <text v-if="c.props.isGuest" class="t-sm c-brand semi" @click="go('/pkg-auth/login')">登录 / 注册</text>
            </view>
          </view>
          <view v-if="c.props.showElderToggle" class="col gap4" style="align-items: flex-end" @click="xj.toggleElder()">
            <text class="t-sm c2">乐龄模式</text>
            <view class="toggle" :class="{ on: elder }"><view class="knob" /></view>
          </view>
        </view>
        <template v-if="c.props.health.hasAssessment">
          <view class="row-between et-index" @click="go('/pages/archive/index')">
            <view class="col gap4">
              <text class="t-body c2">六维年轻化指数</text>
              <view class="row gap8" style="align-items: baseline">
                <text class="num bold" style="font-size: 60px; line-height: 1.05">{{ c.props.health.index }}</text>
                <text v-if="c.props.health.delta" class="semi" :class="c.props.health.delta > 0 ? 'c-care' : 'c-warn'">比上次 {{ c.props.health.delta > 0 ? '+' : '' }}{{ c.props.health.delta }}</text>
              </view>
              <text class="t-sm c3">上次测评 {{ c.props.health.lastAssessedAt }}</text>
            </view>
            <XRadar :scores="c.props.health.dims" :size="104" :dark="night" />
          </view>
        </template>
        <view v-else class="col gap8 et-cta" @click="go(xj.loggedIn ? '/pkg-assess/intro' : '/pkg-auth/login')">
          <text class="t-lg">了解自己的六个维度</text>
          <text class="c2">完成测评可以领取免费体检券。</text>
          <view class="btn">{{ c.props.health.cta || '开始六维测评，约 8 分钟' }}</view>
        </view>
        <view v-for="t in c.props.health.todos" :key="t.text" class="todo row gap12" @click="go(t.link)">
          <view class="icon-box" :class="t.tone === 'care' ? 'care' : ''"><XIcon :name="t.icon" /></view>
          <view class="col flex1">
            <text class="t-md">{{ t.text }}</text>
            <text v-if="t.sub" class="t-sm c2">{{ t.sub }}</text>
          </view>
          <XIcon name="chevron-right" :size="22" color="#786E74" />
        </view>
        <view class="et-family row gap12" @click="go('/pkg-family/list')">
          <view class="icon-box family-ic"><XIcon name="users" :size="26" /></view>
          <view class="col flex1">
            <text class="et-family-t">家人</text>
            <text class="t-sm" style="opacity: 0.92">让子女随时了解您的健康情况，更放心</text>
          </view>
          <XIcon name="chevron-right" :size="22" color="rgba(255,255,255,0.9)" />
        </view>
      </view>

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
          <view v-for="it in c.props.items" :key="it.code" class="g4 col gap6" @click="open(it, 'entryGrid')">
            <view class="icon-box" :class="it.code === 'checkup_coupon' ? 'care' : ''"><XIcon :name="it.icon" :size="24" /></view>
            <text class="t-sm">{{ it.name }}</text>
          </view>
        </view>
      </view>

      <!-- 轮播（乐龄模式停用自动轮播） -->
      <swiper v-else-if="c.type === 'banner'" class="banner" :autoplay="c.props.autoplay" circular :indicator-dots="c.props.items.length > 1" indicator-color="rgba(60, 50, 42, 0.14)" :indicator-active-color="themeHex().brand">
        <swiper-item v-for="it in c.props.items" :key="it.code">
          <view class="card row gap12 banner-card" @click="open(it, 'banner')">
            <view class="photo-slot" style="width: 84px; height: 84px">
              <image v-if="it.cover && !imgErr.has(it.code)" class="ph-img" :src="absUrl(it.cover)" mode="aspectFill" @error="imgErr.add(it.code)" />
              <view v-else class="ph-fallback"><XIcon :name="it.icon || 'sparkles'" :size="30" /></view>
            </view>
            <view class="col gap4 flex1">
              <text class="t-xs semi" :class="`tone-${it.tone || 'care'}`">{{ it.name }}</text>
              <text class="t-lg">{{ it.summary }}</text>
              <text class="t-sm c-brand semi">{{ it.priceText || '查看详情' }}</text>
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
          <view v-for="it in c.props.items" :key="it.code" class="card row gap12 mcard" @click="open(it, 'moduleList')">
            <view class="photo-slot" :style="{ width: elder ? '92px' : '84px', height: elder ? '92px' : '84px' }">
              <image v-if="it.cover && !imgErr.has(it.code)" class="ph-img" :src="absUrl(it.cover)" mode="aspectFill" @error="imgErr.add(it.code)" />
              <view v-else class="ph-fallback"><XIcon :name="it.icon || 'sparkles'" :size="30" /></view>
            </view>
            <view class="col gap4 flex1">
              <text class="t-lg" style="line-height: 1.35">{{ it.name }}</text>
              <text class="t-sm c2">{{ it.days || it.summary }}</text>
              <text v-if="it.priceText" class="t-md c-brand bold">{{ it.priceText }}</text>
            </view>
          </view>
        </template>
        <view v-else class="group">
          <view v-for="it in c.props.items" :key="it.code" class="cell" @click="open(it, 'moduleList')">
            <view class="icon-box" :class="it.tone || ''"><XIcon :name="it.icon" /></view>
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
        <view class="icon-box care"><XIcon name="calendar-event" /></view>
        <view class="col flex1"><text class="t-md">{{ c.props.name }}</text><text class="t-sm c2">{{ c.props.summary }}</text></view>
      </view>

      <!-- 公告条 -->
      <view v-else-if="c.type === 'notice'" class="card hint row gap8" @click="go(c.props.link)">
        <XIcon name="info-circle" /><text class="t-sm">{{ c.props.text }}</text>
      </view>

      <!-- 魔镜悬浮入口 -->
      <view v-else-if="c.type === 'mirrorFab'" class="fab" :class="{ elder, night }" @click="go('/pages/mirror/index')">
        <XIcon name="sparkles" :size="elder ? 26 : 22" />
        <text>{{ elder ? (c.props.label || '和小镜聊聊') : (c.props.label || '小镜') }}</text>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.greet { padding-top: 4px; }
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
.tier-C { background: var(--brand-soft); color: var(--brand-ink); border: 1px solid var(--brand-line); }
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

.health { padding-bottom: 4px; }
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
.grid4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px 4px; }
.g4 { align-items: center; text-align: center; text-wrap: balance; }

.banner { height: 120px; }
.banner-card { height: 116px; }
.mcard { padding: 12px; }
.photo-slot { position: relative; overflow: hidden; }
.ph-img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
/* 没有实拍图时的品牌底图：柔金渐变 + 光斑 + 图标，不再露出"实拍位"字样 */
.ph-fallback { position: absolute; left: 0; top: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; color: var(--brand-ink); background: radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.75) 0, rgba(255, 255, 255, 0) 42%), linear-gradient(145deg, var(--brand-soft), var(--brand-line)); }
.night .ph-fallback { color: #d2b47a; background: radial-gradient(circle at 78% 18%, rgba(210, 180, 122, 0.28) 0, rgba(210, 180, 122, 0) 45%), linear-gradient(145deg, #3a3026, #2a231c); box-shadow: inset 0 0 0 1px rgba(210, 180, 122, 0.22); }

.fab { position: fixed; right: 16px; bottom: calc(76px + env(safe-area-inset-bottom)); z-index: 60; height: 48px; padding: 0 16px; border-radius: 24px; background: var(--brand); color: var(--on-brand); display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 15px; box-shadow: 0 8px 24px -8px rgba(168, 130, 77, 0.5); }
.fab.elder { height: 58px; padding: 0 20px; font-size: 18px; bottom: calc(88px + env(safe-area-inset-bottom)); }
.fab.night { color: #1c1712; }

.elder-today { padding: 18px 16px 8px; }
.et-index { border-top: 1px solid var(--line); margin-top: 14px; padding-top: 14px; }
.et-cta { margin-top: 14px; }
.et-family { margin: 14px 0 10px; border-radius: var(--r-inner); background: var(--care); color: #fff; padding: 16px 14px; min-height: 64px; }
.et-family .icon-box.family-ic { background: rgba(255, 255, 255, 0.2); color: #fff; }
.et-family-t { font-size: var(--fs-lg); font-weight: 700; line-height: 1.3; }
</style>
