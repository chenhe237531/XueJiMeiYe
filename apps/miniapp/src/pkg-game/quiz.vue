<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { syncMotion } from '@/xj/motion'
import type { MoTier } from '@/xj/motion'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { back, speak } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '每日健康问答' } })

const xj = useXj()
/** 动效档位（XJ-707）：档位 class 落本页根节点；对错结果与积分呈现不依赖动画完成 */
const mo = ref<MoTier>(syncMotion(xj.elderMode))
watch(() => xj.elderMode, v => (mo.value = syncMotion(v)))

const qs = ref<any[]>([])
const i = ref(0)
const res = ref<any>(null)
const chosen = ref<number | null>(null)
const score = ref(0)
/** 答对积分 +N 上浮（XJ-707）：600ms 上浮淡出；mo-off 不播，结果卡已完整告知对错与积分 */
const float = ref<{ id: number, text: string } | null>(null)
function popPoints(n?: number) {
  if (!n || n <= 0)
    return
  if (mo.value === 'off')
    return
  float.value = { id: Date.now(), text: `+${n}` }
  setTimeout(() => (float.value = null), 650)
}
const q = computed(() => qs.value[i.value])

onLoad(async () => {
  const d: any = await http.get('/app/quiz/today')
  qs.value = d.questions
  score.value = d.pointsToday || 0
  // 今天答过的题不再重答：从第一道没答的开始，全答完直接显示成绩
  const first = qs.value.findIndex((x: any) => !x.answered)
  i.value = first >= 0 ? first : qs.value.length
})

async function answer(k: number) {
  if (res.value)
    return
  chosen.value = k
  res.value = await http.post('/app/quiz/answers', { id: q.value.id, answer: k })
  score.value += res.value.points || 0
  if (res.value.correct && res.value.points)
    popPoints(res.value.points)
}

function next() {
  i.value++
  res.value = null
  chosen.value = null
}
</script>

<template>
  <view :class="[xj.pageClass, `mo-${mo}`]">
    <view v-if="!qs.length" class="page-loading col gap12">
      <view class="gd-spin spin-ring" />
      <text class="t-sm c2">加载中…</text>
    </view>
    <view v-else-if="q" class="stack" style="padding-top: 12px">
      <view class="card qhead mo-rise mo-d1">
        <view class="row-between">
          <view class="row gap8">
            <view class="icon-box sm-ic">
              <XIcon name="bulb" :size="18" />
            </view><text class="t-md semi">每日健康问答</text>
          </view>
          <text class="t-sm c2">第 <text class="c-brand semi">{{ i + 1 }}</text> / {{ qs.length }} 题 · 已得 {{ score }} 分</text>
        </view>
        <view class="progress" style="margin-top: 10px">
          <view :style="{ width: `${((i + 1) / qs.length) * 100}%` }" />
        </view>
        <view v-if="float" :key="float.id" class="float-plus" :class="{ anim: mo !== 'off' }">
          {{ float.text }}
        </view>
      </view>
      <text class="t-title mo-rise mo-d2">{{ q.title }}</text>
      <view class="pill mo-press mo-rise mo-d2" style="align-self: flex-start" hover-class="mo-press-active" :hover-stay-time="80" @click="speak(q.title)">
        <XIcon name="volume" :size="18" /><text>朗读</text>
      </view>
      <view v-for="(o, k) in q.options" :key="k" class="option mo-press mo-rise mo-d3" :class="{ on: chosen === k, right: res && res.answer === k, wrong: res && chosen === k && !res.correct }" hover-class="mo-press-active" :hover-stay-time="80" @click="answer(k)">
        <view class="dot" /><text class="flex1">{{ o }}</text>
        <text v-if="res && res.answer === k" class="mark ok">✓</text>
        <text v-else-if="res && chosen === k && !res.correct" class="mark no">✗</text>
      </view>
      <view v-if="res" class="card stack mo-pop" :class="res.correct ? 'care' : 'hint'">
        <view class="row gap12">
          <view class="icon-box" :class="res.correct ? 'care' : 'terra'">
            <XIcon :name="res.correct ? 'circle-check' : 'bulb'" />
          </view>
          <text class="t-lg flex1">{{ res.correct ? `答对了${res.points ? `，+${res.points} 积分` : ''}` : '再接再厉' }}</text>
        </view>
        <text class="t-body">{{ res.knowledge }}</text>
      </view>
      <view v-if="res && i < qs.length - 1" class="btn mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="next">
        下一题
      </view>
      <view v-else-if="res" class="btn mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="next">
        看看今天的成绩
      </view>
    </view>
    <view v-else-if="qs.length" class="card empty stack" style="margin-top: 16px">
      <text class="t-lg">今天的问答完成啦</text>
      <text>获得 {{ score }} 积分，明天再来</text>
      <view class="btn mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="back()">
        返回
      </view>
    </view>
  </view>
</template>

<style scoped>
.option.right {
  border: 2px solid var(--care);
  background: var(--care-soft);
  color: var(--care);
}
.option.wrong {
  border: 2px solid #d9a441;
  background: var(--hint);
  color: var(--warn-ink);
}
.qhead {
  padding: 12px 14px;
}
.icon-box.sm-ic {
  width: 30px;
  height: 30px;
  border-radius: 10px;
}
.mark {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 15px;
  font-weight: 800;
}
.mark.ok {
  background: var(--care);
}
.mark.no {
  background: #d9a441;
}
/* 上浮积分气泡锚点（答对 +N，与签到页 float-plus 同款 600ms 上浮淡出） */
.qhead {
  position: relative;
}
.float-plus {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 20px;
  font-weight: 700;
  color: var(--brand-ink);
  z-index: 3;
}
.float-plus.anim {
  animation: float-up 600ms ease-out both;
}
@keyframes float-up {
  0% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(-30px);
    opacity: 0;
  }
}
/* 加载态（docs/09 §3.6）：功能性加载环，mo-off 下静止为静态环仍可识别 */
.page-loading {
  padding: 64px 0;
  align-items: center;
  justify-content: center;
}
.spin-ring {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid var(--line-2);
  border-top-color: var(--brand);
  box-sizing: border-box;
}
</style>
