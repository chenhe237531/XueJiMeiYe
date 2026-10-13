<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { back, speak } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '每日健康问答' } })

const xj = useXj()
const qs = ref<any[]>([])
const i = ref(0)
const res = ref<any>(null)
const chosen = ref<number | null>(null)
const score = ref(0)
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
  if (res.value) return
  chosen.value = k
  res.value = await http.post('/app/quiz/answers', { id: q.value.id, answer: k })
  score.value += res.value.points || 0
}

function next() {
  i.value++
  res.value = null
  chosen.value = null
}
</script>

<template>
  <view :class="xj.pageClass">
    <view v-if="q" class="stack" style="padding-top: 12px">
      <text class="c2">第 {{ i + 1 }} 题，共 {{ qs.length }} 题</text>
      <text class="t-title">{{ q.title }}</text>
      <view class="pill" style="align-self: flex-start" @click="speak(q.title)"><XIcon name="volume" :size="18" /><text>朗读</text></view>
      <view v-for="(o, k) in q.options" :key="k" class="option" :class="{ on: chosen === k, right: res && res.answer === k, wrong: res && chosen === k && !res.correct }" @click="answer(k)">
        <view class="dot" /><text class="flex1">{{ o }}</text>
      </view>
      <view v-if="res" class="card stack" :class="res.correct ? 'care' : 'hint'">
        <text class="t-lg">{{ res.correct ? `答对了${res.points ? `，+${res.points} 积分` : ''}` : '再接再厉' }}</text>
        <text class="t-body">{{ res.knowledge }}</text>
      </view>
      <view v-if="res && i < qs.length - 1" class="btn" @click="next">下一题</view>
      <view v-else-if="res" class="btn" @click="next">看看今天的成绩</view>
    </view>
    <view v-else-if="qs.length" class="card empty stack" style="margin-top: 16px">
      <text class="t-lg">今天的问答完成啦</text>
      <text>获得 {{ score }} 积分，明天再来</text>
      <view class="btn" @click="back()">返回</view>
    </view>
  </view>
</template>

<style scoped>
.option.right { border: 2px solid var(--care); background: var(--care-soft); color: var(--care); }
.option.wrong { border: 2px solid #d9a441; background: var(--hint); color: var(--warn-ink); }
</style>
