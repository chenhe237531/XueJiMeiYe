<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import XMascot from '@/components/XMascot.vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import type { MoTier } from '@/xj/motion'
import { syncMotion } from '@/xj/motion'
import { go } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '家人邀请' } })

const xj = useXj()
/** 动效档位（AC#4）：本页刻意保持简洁不做动效堆叠，仅一次淡入，mo-off 下直达终态 */
const mo = ref<MoTier>(syncMotion(xj.elderMode))
watch(() => xj.elderMode, v => (mo.value = syncMotion(v)))

const token = ref('')
const info = ref<any>(null)
const done = ref(false)

onLoad(async (q: any) => {
  token.value = q.token
  info.value = await http.get(`/app/family/invites/${q.token}`)
})

/**
 * 邀请状态四态（AC#2，与 list/view 的健康状态点同一套视觉语言；受邀方尚无健康数据查看权限，
 * 本页承载的是邀请状态）：等待接受（金）/ 已申请待确认（绿）/ 已过期（灰）/ 已失效（灰）。
 * 颜色必须配文字，灰态再以虚线空心点做形状区分。
 */
const state = computed(() => {
  if (done.value)
    return { tone: 'applied', text: '已申请，等待确认' }
  if (!info.value || info.value.expired)
    return { tone: 'invalid', text: '邀请已过期' }
  if (info.value.status !== 'pending')
    return { tone: 'invalid', text: '邀请已失效' }
  return { tone: 'pending', text: '等待您接受' }
})

async function accept() {
  if (!xj.loggedIn) return go('/pkg-auth/login')
  await http.post(`/app/family/invites/${token.value}/accept`)
  done.value = true
}
</script>

<template>
  <view :class="[...xj.pageClass, `mo-${mo}`]">
    <XNav show-back title="家人邀请" />
    <view v-if="info" class="col gap16 mo-fade mo-d1" style="align-items: center; text-align: center; padding: 48px 8px">
      <!-- 邀请人头像：XMascot 纯 CSS 合成（AC#1，不引入图片资源） -->
      <XMascot :size="88" tone="gold" />
      <text class="t-title">{{ info.elder.salutation }}邀请您成为她的健康家人</text>
      <text class="c2">绑定后，您可以查看{{ info.elder.salutation }}授权给您的内容，例如测评结果和复查提醒。需要{{ info.elder.salutation }}再次确认。</text>
      <view class="hd">
        <view class="hd-dot" :class="state.tone" />
        <text class="t-sm hd-txt" :class="state.tone">{{ state.text }}</text>
      </view>
      <view v-if="done" class="card care t-md">已申请，等待{{ info.elder.salutation }}确认</view>
      <view v-else-if="info.expired || info.status !== 'pending'" class="card hint t-md">邀请已失效（72 小时有效），请让家人重新发送</view>
      <view v-else class="btn" style="width: 100%" hover-class="mo-press-active" @click="accept">
        接受邀请
      </view>
    </view>
  </view>
</template>

<style scoped>
/* 状态点四态（AC#2）：pending 金 / applied 绿 / invalid 灰虚线；点 + 文字双重可辨 */
.hd {
  display: flex;
  align-items: center;
  gap: 4px;
}
.hd-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-sizing: border-box;
}
.hd-dot.pending {
  background: var(--brand);
}
.hd-dot.applied {
  background: var(--meter-ok);
}
.hd-dot.invalid {
  background: transparent;
  border: 2px dashed var(--ink-3);
}
.hd-txt.pending {
  color: var(--brand-ink);
}
.hd-txt.applied {
  color: var(--meter-ok);
}
.hd-txt.invalid {
  color: var(--ink-3);
}
</style>
