<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { back, go, themeHex } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '六维测评' } })

const xj = useXj()
const mode = ref('self')
const current = ref<any>(null)
const hasC2 = ref(false)
const c2 = ref<any>(null)
const showFull = ref(false)

onShow(async () => {
  if (!xj.loggedIn) return go('/pkg-auth/login')
  current.value = await http.get('/app/assessments/current', undefined, { silent: true }).catch(() => null)
  const list: any[] = await http.get('/app/consents', undefined, { silent: true }).catch(() => [])
  c2.value = list.find(x => x.type === 'C2')
  hasC2.value = !!c2.value?.granted
})

async function startNow() {
  if (!hasC2.value) await http.post('/app/consents', { type: 'C2', granted: true })
  const a: any = await http.post('/app/assessments', { mode: mode.value }, { loading: '准备题目' })
  if (a?.assistCode) {
    await new Promise(r => uni.showModal({ title: `陪填码 ${a.assistCode}`, content: '请把这 6 位数字告诉顾问，顾问在移动工作台输入后就能陪您一起填。', showCancel: false, confirmText: '知道了', confirmColor: themeHex().ink, complete: r }))
  }
  go('/pkg-assess/map')
}
</script>

<template>
  <view :class="[...xj.pageClass, 'has-footer']">
    <view class="col gap6" style="padding: 16px 0">
      <text class="t-title">六维年轻化测评</text>
      <text class="c2">约 8 分钟，可以分几次完成，每题自动保存</text>
    </view>
    <view v-if="current" class="card hint row gap12" @click="go('/pkg-assess/map')">
      <XIcon name="history" :size="24" />
      <view class="col flex1"><text class="t-md">上次的测评还没做完</text><text class="t-sm">已完成 {{ current.doneCount }}/{{ current.totalLevels }} 关，点这里继续</text></view>
      <XIcon name="chevron-right" :size="20" />
    </view>
    <view class="stack mt12">
      <view class="group">
        <view class="cell"><XIcon name="shield-check" color="var(--care)" /><text class="flex1 t-md">健康安全关</text><text class="t-sm c2">约 2 分钟，必答</text></view>
        <view class="cell"><XIcon name="hexagon" color="var(--brand-ink)" /><text class="flex1 t-md">六个维度</text><text class="t-sm c2">肌肤 体型 轮廓 体能 体态 心灵</text></view>
        <view v-if="xj.me?.gender !== 'male'" class="cell"><XIcon name="lock" color="#5C5358" /><text class="flex1 t-md">女性健康进阶关</text><text class="t-sm c2">涉及隐私，可跳过</text></view>
      </view>

      <view class="card care stack">
        <view class="row gap8"><XIcon name="shield-check" color="var(--care-dark)" /><text class="t-md bold" style="color: var(--care-dark)">健康信息处理，单独同意</text></view>
        <view class="col gap6 t-body" style="color: #3f4a35">
          <view class="row gap8"><XIcon name="check" :size="18" color="var(--care)" /><text>只用于测评、健康档案和养护方案</text></view>
          <view class="row gap8"><XIcon name="check" :size="18" color="var(--care)" /><text>只有您和授权的健康顾问能看到</text></view>
          <view class="row gap8"><XIcon name="check" :size="18" color="var(--care)" /><text>随时可以在“我的”里撤回</text></view>
        </view>
        <text class="t-sm semi" style="color: var(--care)" @click="showFull = !showFull">{{ hasC2 ? `已于 ${c2?.at} 同意` : '查看完整说明' }}</text>
        <view v-if="showFull && !hasC2" class="t-sm" style="color: #3f4a35">包括测评答案（含女性健康）、门店测量数据、打卡记录；保存到账号注销为止。不同意也可以继续使用其他功能。</view>
      </view>

      <text class="t-sm c2 semi">选择填写方式</text>
      <view class="group">
        <view class="cell" @click="mode = 'self'">
          <view class="radio" :class="{ on: mode === 'self' }" /><text class="flex1 t-md">我自己填</text><text class="t-sm c2">字大，可以语音作答</text>
        </view>
        <view class="cell" @click="mode = 'staff_assisted'">
          <view class="radio" :class="{ on: mode === 'staff_assisted' }" /><text class="flex1 t-md">顾问陪我填</text><text class="t-sm c2">生成 6 位陪填码</text>
        </view>
        <view class="cell" @click="mode = 'family'">
          <view class="radio" :class="{ on: mode === 'family' }" /><text class="flex1 t-md">家人帮我填</text><text class="t-sm c2">仅限已绑定的家人</text>
        </view>
      </view>
    </view>
    <view class="footer-bar">
      <view class="btn" @click="startNow">{{ hasC2 ? '开始测评' : '同意并开始' }}</view>
      <view class="t-body c2" style="text-align: center; padding: 4px" @click="back()">暂不测评</view>
    </view>
  </view>
</template>

<style scoped>
.radio { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #c9bec4; box-sizing: border-box; }
.radio.on { border: 7px solid var(--brand); }
</style>
