<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { back, go, themeHex, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '六维测评' } })

const xj = useXj()
const mode = ref('self')
const current = ref<any>(null)
const hasC2 = ref(false)
const c2 = ref<any>(null)
const showFull = ref(true)
/** 出生年份决定分支题、OSTA / SARC-F 和体检券类型；资料页跳过的用户在这里补一次 */
const MODES = [
  { value: 'self', name: '我自己填', sub: '字大，可语音作答', icon: 'user', tone: '' },
  { value: 'staff_assisted', name: '顾问陪我填', sub: '生成 6 位陪填码', icon: 'headset', tone: 'sky' },
  { value: 'family', name: '家人帮我填', sub: '仅限已绑定的家人', icon: 'users', tone: 'rose' },
]
const years = Array.from({ length: 70 }, (_, i) => new Date().getFullYear() - 18 - i)
const yearIdx = ref(-1)
const needYear = ref(false)

onShow(async () => {
  if (!xj.loggedIn)
    return go('/pkg-auth/login')
  if (!xj.me)
    await xj.loadMe()
  needYear.value = !xj.me?.birthYear
  current.value = await http.get('/app/assessments/current', undefined, { silent: true }).catch(() => null)
  const list: any[] = await http.get('/app/consents', undefined, { silent: true }).catch(() => [])
  c2.value = list.find(x => x.type === 'C2')
  hasC2.value = !!c2.value?.granted
})

async function ensureYear() {
  if (!needYear.value)
    return true
  if (yearIdx.value < 0) {
    toast('请先选择出生年份')
    return false
  }
  const res: any = await http.patch('/app/me', { birthYear: years[yearIdx.value] }, { loading: '保存中' })
  await xj.loadMe()
  needYear.value = false
  if (res?.elderAuto) {
    await new Promise(r => uni.showModal({ title: '已为您开启乐龄模式', content: '字更大、颜色更柔和。可以在"我的 - 设置"里随时切换。', showCancel: false, confirmText: '好的', confirmColor: themeHex().ink, complete: r }))
  }
  return true
}

async function resume() {
  if (await ensureYear())
    go('/pkg-assess/map')
}

async function startNow() {
  if (!(await ensureYear()))
    return
  if (!hasC2.value)
    await http.post('/app/consents', { type: 'C2', granted: true })
  const a: any = await http.post('/app/assessments', { mode: mode.value }, { loading: '准备题目' })
  if (a?.assistCode) {
    await new Promise(r => uni.showModal({ title: `陪填码 ${a.assistCode}`, content: '请把这 6 位数字告诉顾问，顾问在移动工作台输入后就能陪您一起填。', showCancel: false, confirmText: '知道了', confirmColor: themeHex().ink, complete: r }))
  }
  go('/pkg-assess/map')
}
</script>

<template>
  <view class="has-footer tall" :class="[...xj.pageClass]">
    <view class="page-head mo-rise">
      <view class="ph-deco i-tabler-hexagon" />
      <text class="ph-title">六维年轻化测评</text>
      <text class="ph-sub">可以分几次完成，每题自动保存</text>
      <view class="ph-meta">
        <view><XIcon name="clock" :size="14" />约 8 分钟</view>
        <view><XIcon name="volume" :size="14" />可语音作答</view>
        <view><XIcon name="coins" :size="14" />每关 +10 积分</view>
      </view>
    </view>
    <view v-if="current" class="card hint row gap12 mo-rise mo-d1" hover-class="mo-press-active" hover-stay-time="80" @click="resume">
      <XIcon name="history" :size="24" />
      <view class="col flex1">
        <text class="t-md">上次的测评还没做完</text><text class="t-sm">已完成 {{ current.doneCount }}/{{ current.totalLevels }} 关，点这里继续</text>
      </view>
      <XIcon name="chevron-right" :size="20" />
    </view>
    <view class="stack mt12 mo-rise mo-d2">
      <view class="section-title" style="margin-top: 0">
        <text>测评包含</text>
      </view>
      <view class="group">
        <view class="cell">
          <view class="icon-box care">
            <XIcon name="shield-check" />
          </view><view class="col gap4 flex1">
            <text class="t-md">健康安全关</text><text class="t-sm c2">约 2 分钟，必答</text>
          </view><text class="tag care">必答</text>
        </view>
        <view class="cell">
          <view class="icon-box">
            <XIcon name="hexagon" />
          </view><view class="col gap4 flex1">
            <text class="t-md">六个维度</text><text class="t-sm c2">肌肤 · 体型 · 轮廓 · 体能 · 体态 · 心灵</text>
          </view>
        </view>
        <view v-if="xj.me?.gender !== 'male'" class="cell">
          <view class="icon-box plum">
            <XIcon name="lock" />
          </view><view class="col gap4 flex1">
            <text class="t-md">女性健康进阶关</text><text class="t-sm c2">涉及隐私，每题都可跳过</text>
          </view><text class="tag gray">可选</text>
        </view>
      </view>

      <view v-if="needYear" class="card stack mo-rise mo-d3">
        <text class="t-md">您的出生年份</text>
        <text class="t-sm c2">年龄会影响题目和方案，只需选一次</text>
        <picker mode="selector" :range="years" :value="yearIdx < 0 ? 30 : yearIdx" @change="(e) => (yearIdx = Number(e.detail.value))">
          <view class="input row-between">
            <text :class="{ c3: yearIdx < 0 }">{{ yearIdx < 0 ? '请选择' : `${years[yearIdx]} 年` }}</text><text class="c3">选择</text>
          </view>
        </picker>
      </view>

      <view class="card care stack mo-rise mo-d3">
        <view class="row gap8">
          <XIcon name="shield-check" color="var(--care-dark)" /><text class="t-md bold" style="color: var(--care-dark)">健康信息处理，单独同意</text>
        </view>
        <view class="col gap6 t-body" style="color: #3f4a35">
          <view class="row gap8">
            <XIcon name="check" :size="18" color="var(--care)" /><text>只用于测评、健康档案和养护方案</text>
          </view>
          <view class="row gap8">
            <XIcon name="check" :size="18" color="var(--care)" /><text>只有您和授权的健康顾问能看到</text>
          </view>
          <view class="row gap8">
            <XIcon name="check" :size="18" color="var(--care)" /><text>随时可以在“我的”里撤回</text>
          </view>
        </view>
        <text class="t-sm semi" style="color: var(--care)" @click="showFull = !showFull">{{ hasC2 ? `已于 ${c2?.at} 同意` : showFull ? '收起完整说明' : '查看完整说明' }}</text>
        <view v-if="showFull && !hasC2" class="t-sm" style="color: #3f4a35">
          包括测评答案（含女性健康）、门店测量数据、打卡记录；保存到账号注销为止。不同意也可以继续使用其他功能。
        </view>
      </view>

      <view class="section-title mo-rise mo-d4">
        <text>选择填写方式</text>
      </view>
      <view class="choice-grid mo-rise mo-d4">
        <view v-for="o in MODES" :key="o.value" class="choice mo-press" :class="{ on: mode === o.value }" hover-class="mo-press-active" hover-stay-time="80" @click="mode = o.value">
          <view class="icon-box" :class="o.tone">
            <XIcon :name="o.icon" />
          </view>
          <view class="col gap4">
            <text class="t-md">{{ o.name }}</text>
            <text class="t-xs c2">{{ o.sub }}</text>
          </view>
        </view>
      </view>
    </view>
    <view class="footer-bar">
      <view class="btn mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="startNow">
        {{ hasC2 ? '开始测评' : '同意并开始' }}
      </view>
      <view class="t-body c2" style="text-align: center; padding: 4px" @click="back()">
        暂不测评
      </view>
    </view>
  </view>
</template>
