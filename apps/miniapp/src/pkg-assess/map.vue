<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { confirm, go, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '六维测评' } })

const xj = useXj()
const a = ref<any>(null)
const dims = computed(() => (a.value?.levels || []).filter((l: any) => !['safety', 'women'].includes(l.code)))
const safety = computed(() => a.value?.levels?.find((l: any) => l.code === 'safety'))
const women = computed(() => a.value?.levels?.find((l: any) => l.code === 'women'))
const next = computed(() => {
  if (!a.value) return null
  if (!safety.value?.done) return safety.value
  return dims.value.find((l: any) => !l.done) || (women.value && !women.value.done ? women.value : null)
})
const allDone = computed(() => !!a.value && safety.value?.done && dims.value.every((l: any) => l.done))

async function load() {
  a.value = await http.get('/app/assessments/current')
  if (!a.value) go('/pkg-assess/intro')
}
onShow(load)

async function openLevel(l: any) {
  if (l.code !== 'safety' && !safety.value?.done) return toast('请先完成健康安全关，保障门店项目安全')
  if (l.code === 'women' && !(await confirm('女性健康进阶关', '以下问题涉及女性健康隐私，用于判断是否需要就医。可以跳过任意一题。', '开始'))) return
  go(`/pkg-assess/question?id=${a.value.id}&level=${l.code}`)
}

async function finish() {
  const r: any = await http.post(`/app/assessments/${a.value.id}/complete`, {}, { loading: '正在生成报告' })
  uni.redirectTo({ url: `/pkg-assess/result?id=${r.id}` })
}

async function demoFill() {
  if (!(await confirm('演示助手', '用示例答案填完剩余题目（仅黑客松演示使用）', '填写'))) return
  a.value = await http.post(`/app/assessments/${a.value.id}/demo-fill`, {}, { loading: '填写中' })
}
</script>

<template>
  <view :class="[...xj.pageClass, 'has-footer']">
    <view v-if="a" class="stack" style="padding-top: 12px">
      <view class="col gap8">
        <view class="row-between">
          <text class="t-xl">已完成 {{ a.doneCount }} / 6 关</text>
          <text class="t-sm c2">{{ allDone ? '可以查看结果了' : `还需约 ${a.remainingMinutes} 分钟` }}</text>
        </view>
        <view class="progress"><view :style="{ width: `${(a.doneCount / 6) * 100}%` }" /></view>
        <text class="t-sm c2">每完成一关 +10 积分，已得 {{ a.doneCount * 10 + (safety?.done ? 10 : 0) }} 积分</text>
        <view v-if="a.assistCode" class="tag care" style="align-self: flex-start">顾问陪填码 {{ a.assistCode }}</view>
      </view>

      <view class="card dots">
        <view v-for="(l, i) in [safety, ...dims]" :key="l.code" class="dot-item" @click="openLevel(l)">
          <view class="dot" :class="{ done: l.done, safety: l.code === 'safety', cur: next && next.code === l.code }">
            <XIcon v-if="l.done" name="check" :size="16" color="var(--on-brand)" />
            <text v-else>{{ i }}</text>
          </view>
          <text class="t-xs" :class="{ semi: l.done }">{{ l.short }}</text>
        </view>
      </view>

      <view class="group">
        <view v-for="l in [safety, ...dims]" :key="l.code" class="cell" @click="openLevel(l)">
          <view class="icon-box" :class="l.code === 'safety' ? 'care' : l.done ? '' : 'gray'">
            <XIcon :name="l.done ? 'circle-check' : l.code === 'safety' ? 'shield-check' : 'hexagon'" />
          </view>
          <view class="col flex1">
            <text class="t-md">{{ l.name }}{{ l.code === 'safety' ? '' : '关' }}</text>
            <text class="t-sm c2">{{ l.desc }} · {{ l.total }} 题</text>
          </view>
          <text class="t-sm" :class="l.done ? 'c-care semi' : 'c2'">{{ l.done ? '已完成' : l.answered ? `${l.answered}/${l.total}` : '去答题' }}</text>
        </view>
      </view>

      <view v-if="women" class="card row gap12" @click="openLevel(women)">
        <view class="icon-box gray"><XIcon name="lock" /></view>
        <view class="col flex1"><text class="t-md">女性健康进阶关</text><text class="t-sm c2">涉及隐私，每题都可跳过</text></view>
        <text class="t-sm" :class="women.done ? 'c-care semi' : 'c2'">{{ women.done ? '已完成' : '可选' }}</text>
      </view>
      <text class="t-xs c3" style="text-align: center" @click="demoFill">演示助手：一键填完剩余题目</text>
    </view>
    <view v-if="a" class="footer-bar">
      <text v-if="next && !allDone" class="t-sm c2" style="text-align: center">{{ next.name }}共 {{ next.total }} 题，约 {{ next.minutes }} 分钟</text>
      <view v-if="allDone" class="btn" @click="finish">查看测评结果</view>
      <view v-else-if="next" class="btn" @click="openLevel(next)">继续：{{ next.name }}{{ next.code === 'safety' ? '' : '关' }}</view>
      <view v-if="allDone && women && !women.done" class="t-sm c2" style="text-align: center" @click="openLevel(women)">先做女性健康进阶关</view>
    </view>
  </view>
</template>

<style scoped>
.dots { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); padding: 14px 8px; }
.dot-item { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--ink-2); }
.dot { width: 30px; height: 30px; border-radius: 15px; background: #efeaec; display: flex; align-items: center; justify-content: center; font-size: 13px; }
.dot.done { background: var(--brand); }
.dot.done.safety { background: var(--care); }
.dot.cur { background: #fff; border: 2px solid var(--brand); color: var(--brand-ink); font-weight: 700; box-sizing: border-box; }
</style>
