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
  if (!a.value)
    return null
  if (!safety.value?.done)
    return safety.value
  return dims.value.find((l: any) => !l.done) || (women.value && !women.value.done ? women.value : null)
})
const allDone = computed(() => !!a.value && safety.value?.done && dims.value.every((l: any) => l.done))

async function load() {
  if (!xj.me)
    await xj.loadMe()
  // 没有出生年份时先回介绍页补填，否则分支题按兜底年龄出题
  if (xj.me && !xj.me.birthYear)
    return uni.redirectTo({ url: '/pkg-assess/intro' })
  a.value = await http.get('/app/assessments/current')
  if (!a.value)
    go('/pkg-assess/intro')
}
onShow(load)

async function openLevel(l: any) {
  if (l.code !== 'safety' && !safety.value?.done)
    return toast('请先完成健康安全关，保障门店项目安全')
  if (l.code === 'women' && !(await confirm('女性健康进阶关', '以下问题涉及女性健康隐私，用于判断是否需要就医。可以跳过任意一题。', '开始')))
    return
  go(`/pkg-assess/question?id=${a.value.id}&level=${l.code}`)
}

async function finish() {
  const r: any = await http.post(`/app/assessments/${a.value.id}/complete`, {}, { loading: '正在生成报告' })
  uni.redirectTo({ url: `/pkg-assess/result?id=${r.id}` })
}

async function demoFill() {
  if (!(await confirm('演示助手', '用示例答案填完剩余题目（仅黑客松演示使用）', '填写')))
    return
  a.value = await http.post(`/app/assessments/${a.value.id}/demo-fill`, {}, { loading: '填写中' })
}
</script>

<template>
  <view class="has-footer" :class="[...xj.pageClass]">
    <view v-if="a" class="stack" style="padding-top: 12px">
      <!-- 进度总览卡：完成关数 + 剩余时间 + 积分 -->
      <view class="card raised prog mo-rise">
        <view class="row-between" style="align-items: flex-end">
          <view class="col gap4">
            <text class="t-sm c2">测评进度</text>
            <view class="row gap4" style="align-items: baseline">
              <text class="prog-n num">{{ a.doneCount }}</text>
              <text class="t-md c2">/ {{ a.totalLevels }} 关</text>
            </view>
          </view>
          <view class="col gap4" style="align-items: flex-end">
            <text class="t-sm" :class="allDone ? 'c-care semi' : 'c2'">{{ allDone ? '可以查看结果了' : `还需约 ${a.remainingMinutes} 分钟` }}</text>
            <text class="tag gold"><XIcon name="coins" :size="14" />已得 {{ a.earnedPoints }} 积分</text>
          </view>
        </view>
        <view class="progress" style="margin-top: 12px">
          <view :style="{ width: `${(a.doneCount / a.totalLevels) * 100}%` }" />
        </view>
        <text class="t-xs c3" style="display: block; margin-top: 8px">每完成一关 +10 积分</text>
        <view v-if="a.assistCode" class="tag care" style="margin-top: 8px">
          顾问陪填码 {{ a.assistCode }}
        </view>
      </view>

      <view class="card dots mo-rise mo-d1">
        <view v-for="(l, i) in [safety, ...dims]" :key="l.code" class="dot-item" hover-class="mo-press-active" hover-stay-time="80" @click="openLevel(l)">
          <view class="dot" :class="{ 'done': l.done, 'safety': l.code === 'safety', 'cur': next && next.code === l.code, 'gd-pulse': next && next.code === l.code }">
            <XIcon v-if="l.done" name="check" :size="16" :color="l.code === 'safety' ? '#fff' : 'var(--on-brand)'" />
            <XIcon v-else-if="l.code === 'safety'" name="shield-check" :size="16" />
            <text v-else>{{ i }}</text>
          </view>
          <text class="t-xs" :class="{ semi: l.done }">{{ l.short }}</text>
        </view>
      </view>

      <view class="group mo-rise mo-d2">
        <view v-for="l in [safety, ...dims]" :key="l.code" class="cell" hover-class="mo-press-active" hover-stay-time="80" @click="openLevel(l)">
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

      <view v-if="women" class="card row gap12" hover-class="mo-press-active" hover-stay-time="80" @click="openLevel(women)">
        <view class="icon-box gray">
          <XIcon name="lock" />
        </view>
        <view class="col flex1">
          <text class="t-md">女性健康进阶关</text><text class="t-sm c2">涉及隐私，每题都可跳过</text>
        </view>
        <text class="t-sm" :class="women.done ? 'c-care semi' : 'c2'">{{ women.done ? '已完成' : '可选' }}</text>
      </view>
      <text class="t-xs c3" style="text-align: center" @click="demoFill">演示助手：一键填完剩余题目</text>
    </view>
    <view v-else class="stack" style="padding-top: 12px">
      <view class="card skeleton" style="height: 132px" />
      <view class="card skeleton" style="height: 104px" />
      <view class="group skeleton" style="height: 208px" />
    </view>
    <view v-if="a" class="footer-bar">
      <text v-if="next && !allDone" class="t-sm c2" style="text-align: center">{{ next.name }}共 {{ next.total }} 题，约 {{ next.minutes }} 分钟</text>
      <view v-if="allDone" class="btn mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="finish">
        查看测评结果
      </view>
      <view v-else-if="next" class="btn mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="openLevel(next)">
        继续：{{ next.name }}{{ next.code === 'safety' ? '' : '关' }}
      </view>
      <view v-if="allDone && women && !women.done" class="t-sm c2" style="text-align: center" @click="openLevel(women)">
        先做女性健康进阶关
      </view>
    </view>
  </view>
</template>

<style scoped>
.prog {
  padding: 16px;
  background: radial-gradient(circle at 100% 0%, var(--brand-soft) 0, rgba(255, 255, 255, 0) 60%), var(--surface);
}
.prog-n {
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
  color: var(--brand-ink);
}
.dots {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  padding: 14px 8px;
}
.dot-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--ink-2);
}
/* 关卡之间的连接线 */
.dot-item + .dot-item::before {
  content: '';
  position: absolute;
  top: 14px;
  left: -50%;
  right: 50%;
  height: 2px;
  background: var(--line-2);
}
.dot {
  position: relative;
  z-index: 1;
  width: 30px;
  height: 30px;
  border-radius: 15px;
  background: var(--placeholder);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}
.dot.done {
  background: linear-gradient(145deg, var(--brand-hi), var(--brand-dark));
  box-shadow: 0 4px 10px -4px rgba(168, 130, 77, 0.6);
}
.dot.done.safety {
  background: linear-gradient(145deg, #b3c69b, #6e7f5c);
  box-shadow: 0 4px 10px -4px rgba(102, 120, 78, 0.6);
}
.dot.cur {
  background: #fff;
  border: 2px solid var(--brand);
  color: var(--brand-ink);
  font-weight: 700;
  box-sizing: border-box;
  box-shadow: 0 0 0 4px var(--brand-soft);
}
</style>
