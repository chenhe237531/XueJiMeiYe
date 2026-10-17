<script lang="ts" setup>
import { ref } from 'vue'
import { getTier, setTier } from '@/xj/motion'
import type { MoTier } from '@/xj/motion'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { themeHex, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '设置' } })

const xj = useXj()
const personalization = ref(true)
const autoRead = ref(true)
const lang = ref('zh')
/* 省流模式（D9）：显式开关，默认「跟随设备」。
   xj/motion.ts 的 setTier() 会写入 xj_mo_tier 并更新模块内档位；
   页面根节点的档位 class 来自 store 的 pageClass，而 store.ts 归 XJ-204 所有、本卡不能改，
   因此这里的切换对**其它页面**在下一次冷启动时生效（文案如实说明），本页通过 getTier() 即时回显。 */
const eco = ref<'auto' | MoTier>(getTier() === 'lite' ? 'lite' : 'auto')
const ECO_OPTS: { v: 'auto' | MoTier, n: string, d: string }[] = [
  { v: 'auto', n: '跟随设备', d: '按手机性能自动决定，多数人选这个' },
  { v: 'full', n: '完整动效', d: '动画最多，视觉最好' },
  { v: 'lite', n: '省流', d: '少一些动画和动图，手机发烫或流量紧张时选' },
  { v: 'off', n: '关闭动效', d: '全部直接呈现，最省电' },
]
function setEco(v: 'auto' | MoTier) {
  eco.value = v
  if (v === 'auto')
    uni.removeStorageSync('xj_mo_tier')
  else setTier(v)
  toast(v === 'auto' ? '已恢复跟随设备，下次打开小程序生效' : '已保存，下次打开小程序生效')
}

onShow(async () => {
  await xj.loadMe()
  personalization.value = xj.me?.personalization !== false
  autoRead.value = xj.me?.autoRead !== false
  lang.value = xj.me?.lang || 'zh'
})

async function set(k: string, v: any) {
  await http.patch('/app/me/settings', { [k]: v })
  await xj.loadMe()
}

function subscribe() {
  // #ifdef MP-WEIXIN
  uni.requestSubscribeMessage({ tmplIds: [], complete: () => toast('订阅消息模板待在小程序后台配置') } as any)
  // #endif
  // #ifndef MP-WEIXIN
  toast('小程序内可订阅：预约成功、体检提醒、报告回传')
  // #endif
}
</script>

<template>
  <view :class="xj.pageClass">
    <view class="stack mo-rise mo-d1" style="padding-top: 12px">
      <view class="group mo-rise mo-d2">
        <view class="cell">
          <view class="col flex1">
            <text class="t-md">乐龄模式</text><text class="t-sm c2">字更大、按钮更大、题目和报告可以朗读</text>
          </view>
          <switch :checked="xj.elderMode" :color="themeHex().brand" @change="(e) => xj.toggleElder(e.detail.value)" />
        </view>
        <view class="cell">
          <view class="col flex1">
            <text class="t-md">语言</text><text class="t-sm c2">粤语语音在 V1.2 上线</text>
          </view>
          <view class="row gap8">
            <text class="seg" :class="{ on: lang === 'zh' }" @click="lang = 'zh'; set('lang', 'zh')">普通话</text>
            <text class="seg" :class="{ on: lang === 'yue' }" @click="lang = 'yue'; set('lang', 'yue')">粤语</text>
          </view>
        </view>
        <view class="cell">
          <view class="col flex1">
            <text class="t-md">个性化推荐</text><text class="t-sm c2">关闭后首页按默认顺序展示，价格和权益不受影响</text>
          </view>
          <switch :checked="personalization" :color="themeHex().brand" @change="(e) => set('personalization', e.detail.value)" />
        </view>
        <view class="cell">
          <view class="col flex1">
            <text class="t-md">省流模式</text>
            <text class="t-sm c2">少一些动画和动图；功能、内容与价格完全不受影响</text>
            <view class="row gap8 mt8 wrap">
              <view
                v-for="o in ECO_OPTS"
                :key="o.v"
                class="seg eco mo-press"
                :class="{ on: eco === o.v }"
                hover-class="mo-press-active"
                hover-stay-time="80"
                @click="setEco(o.v)"
              >
                <view class="col gap2" style="align-items: flex-start">
                  <text>{{ o.n }}</text>
                  <text class="t-xs" style="opacity: 0.8">{{ o.d }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view class="cell">
          <view class="col flex1">
            <text class="t-md">小镜自动朗读</text><text class="t-sm c2">乐龄模式下，小镜的回复自动播放</text>
          </view>
          <switch :checked="autoRead" :color="themeHex().brand" @change="(e) => set('autoRead', e.detail.value)" />
        </view>
        <view class="cell mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="subscribe">
          <view class="col flex1">
            <text class="t-md">消息通知</text><text class="t-sm c2">预约成功、体检前一天、报告回传</text>
          </view>
          <text class="t-sm c-brand semi">去开启</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.seg {
  padding: 6px 12px;
  border-radius: 16px;
  background: var(--bg);
  font-size: var(--fs-sm);
}
/* 省流四选一：文字较多，放宽为可换行的胶囊，选中态用品牌色描边而非整块填充 */
.seg.eco {
  padding: 8px 12px;
  border-radius: var(--r-md, 12px);
  border: 1px solid var(--line-2);
  max-width: 100%;
}
.seg.eco.on {
  border-color: var(--brand);
  color: var(--brand-ink);
  font-weight: 600;
  background: var(--brand-soft);
}
.seg.on {
  background: var(--brand);
  color: var(--on-brand);
  font-weight: 600;
}
</style>
