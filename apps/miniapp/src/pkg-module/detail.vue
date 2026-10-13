<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { absUrl, go, themeHex, toast } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '详情' } })

const xj = useXj()
const m = ref<any>(null)
const acked = ref<string[]>([])
const heroErr = ref(false)
const d = computed(() => m.value?.detail || {})
const needAck = computed(() => (m.value?.healthNotices || []).filter((n: any) => n.requireAck))
const allAcked = computed(() => needAck.value.every((n: any) => acked.value.includes(n.id)))

onLoad(async (q: any) => {
  m.value = await http.get(`/app/modules/${q.code}`)
})

function toggleAck(id: string) {
  acked.value = acked.value.includes(id) ? acked.value.filter(x => x !== id) : [...acked.value, id]
}

function submit() {
  if (!xj.loggedIn) return go('/pkg-auth/login')
  if (m.value.entryType === 'miniprogram') {
    // #ifdef MP-WEIXIN
    const cfg = m.value.entryConfig || {}
    uni.showModal({ title: '提示', content: cfg.tip || '即将前往商城', confirmColor: themeHex().ink, success: (r) => { if (r.confirm) uni.navigateToMiniProgram({ appId: cfg.appId, path: cfg.path, fail: () => toast('商城小程序待配置') }) } })
    // #endif
    // #ifndef MP-WEIXIN
    toast(`${m.value.entryConfig?.tip || '即将前往商城'}（小程序内可跳转）`)
    // #endif
    return
  }
  if (!allAcked.value) return toast('请先阅读健康提示，并勾选"我已了解"')
  uni.setStorageSync('xj_ack', acked.value)
  go(`/pkg-module/lead-form?code=${m.value.code}`)
}
</script>

<template>
  <view v-if="m" :class="[...xj.pageClass, 'has-footer']" style="padding: 0">
    <view class="hero photo-slot">
      <image v-if="m.cover && !heroErr" class="hero-img" :src="absUrl(m.cover)" mode="aspectFill" @error="heroErr = true" />
      <template v-else>
        <XIcon :name="m.icon" :size="40" />
        <text class="t-sm semi">实拍：{{ m.name }}</text>
        <text class="t-xs">建议尺寸 1170 x 900</text>
      </template>
    </view>
    <view class="nav-float"><XNav show-back transparent /></view>
    <view class="sheet stack">
      <view class="row gap8 wrap">
        <text v-if="m.category === 'travel'" class="tag">康养出游</text>
        <text v-if="d.days" class="t-sm c2">{{ d.days }}</text>
      </view>
      <text class="t-title">{{ m.name }}</text>
      <text v-if="m.summary" class="c2">{{ m.summary }}</text>
      <view v-if="d.priceText" class="row gap8" style="align-items: baseline">
        <text class="t-sm c2">会员价</text>
        <text class="num bold c-brand" style="font-size: 28px">{{ d.priceText.replace('会员价 ', '') }}</text>
        <text class="t-xs c3">{{ d.priceNote || '以合作方最终报价为准' }}</text>
      </view>
      <view v-if="d.highlights?.length" class="hl">
        <view v-for="h in d.highlights" :key="h" class="hl-item"><XIcon name="circle-check" :size="20" color="var(--brand-ink)" /><text class="t-sm">{{ h }}</text></view>
      </view>
      <view v-if="d.suitable" class="row gap8"><text class="t-sm c2">适合人群</text><text class="t-sm">{{ d.suitable }}</text></view>
      <view v-if="d.content?.length" class="col gap8">
        <text class="t-lg">行程与内容</text>
        <text v-for="p in d.content" :key="p" class="t-body" style="color: #3b3337">{{ p }}</text>
      </view>
      <view v-for="n in m.healthNotices" :key="n.id" class="card hint stack">
        <view class="row gap8" style="align-items: flex-start"><XIcon name="info-circle" :size="20" /><text class="t-body">{{ n.tags?.length ? '根据您的健康档案：' : '' }}{{ n.text }}</text></view>
        <view v-if="n.requireAck" class="row gap8" @click="toggleAck(n.id)">
          <view class="check" :class="{ on: acked.includes(n.id) }"><XIcon v-if="acked.includes(n.id)" name="check" :size="16" color="var(--on-brand)" /></view>
          <text class="t-md">我已了解</text>
        </view>
      </view>
      <text v-if="m.partner" class="t-xs c2">合作方：{{ m.partner.name }}{{ m.partner.licenses?.[0] ? `，${m.partner.licenses[0].name} ${m.partner.licenses[0].no}` : '' }}</text>
      <text v-if="!m.visible" class="card hint t-sm">该项目暂不对您的会员等级开放，可以咨询您的顾问。</text>
    </view>
    <view class="footer-bar">
      <view class="row gap12">
        <view v-if="m.category === 'travel'" class="btn ghost flex1" @click="go('/pkg-group/detail')">约老姐妹</view>
        <view class="btn flex1" @click="submit">{{ m.entryType === 'miniprogram' ? '前往商城' : '提交意向' }}</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.hero { height: 280px; border-radius: 0; background: #e4dee1; position: relative; overflow: hidden; }
.hero-img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.nav-float { position: absolute; top: 0; left: 16px; right: 16px; }
.sheet { background: #fff; border-radius: 24px 24px 0 0; margin-top: -24px; position: relative; padding: 20px 18px 24px; min-height: 60vh; }
.hl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.hl-item { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; padding: 10px 4px; border-radius: 14px; background: #f7f3f5; }
.check { width: 22px; height: 22px; border-radius: 6px; border: 2px solid #c9a35e; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.check.on { background: var(--brand); border-color: var(--brand); }
</style>
