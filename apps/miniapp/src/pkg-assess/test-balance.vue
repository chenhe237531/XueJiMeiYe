<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { back, speak, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '单腿站立小测' } })

const xj = useXj()
const id = ref(0)
const code = ref('F03')
const company = ref(false)
const running = ref(false)
const sec = ref(0)
const done = ref(false)
let timer: any = null
let started = 0
const GUIDE = '扶好椅背，有人陪同。睁开眼睛，抬起一只脚，站稳后点开始，脚落地时点结束。最长 30 秒。'

onLoad((q: any) => {
  id.value = Number(q.id)
  code.value = q.code || 'F03'
})
onUnload(() => clearInterval(timer))

function toggle() {
  if (!company.value) return toast('请先确认身边有人陪同')
  if (!running.value) {
    running.value = true
    started = Date.now()
    sec.value = 0
    timer = setInterval(() => {
      sec.value = Math.min(30, Math.floor((Date.now() - started) / 1000))
      if (sec.value >= 30) stop()
    }, 200)
  }
  else stop()
}

async function stop() {
  clearInterval(timer)
  running.value = false
  done.value = true
  await http.put(`/app/assessments/${id.value}/answers`, { questionCode: code.value, answer: { value: sec.value } })
}

async function skip() {
  await http.put(`/app/assessments/${id.value}/answers`, { questionCode: code.value, answer: { skipped: true } })
  uni.navigateBack()
}
</script>

<template>
  <view :class="[...xj.pageClass, 'has-footer']">
    <view class="stack" style="padding-top: 12px">
      <view class="row-between">
        <text class="t-title">单腿站立小测</text>
        <view class="pill" @click="speak(GUIDE)"><XIcon name="volume" :size="18" /><text>朗读</text></view>
      </view>
      <view class="card hint stack">
        <text class="t-body">只做睁眼测试。请扶好椅背、有人陪同，感到不稳马上放下脚。</text>
        <view class="row gap8" @click="company = !company">
          <view class="check" :class="{ on: company }"><XIcon v-if="company" name="check" :size="16" color="#fff" /></view>
          <text class="t-md">身边有人陪同</text>
        </view>
      </view>
      <view class="col" style="align-items: center; padding: 32px 0">
        <view class="row gap8" style="align-items: baseline">
          <text class="num bold" style="font-size: 76px; line-height: 1.1">{{ sec }}</text>
          <text class="t-xl">秒</text>
        </view>
        <text v-if="done" class="t-md c-care">单腿站立 {{ sec }} 秒，已记录</text>
      </view>
    </view>
    <view class="footer-bar">
      <view v-if="!done" class="btn big-btn" @click="toggle">{{ running ? '脚落地了，结束' : '站稳了，开始' }}</view>
      <view v-else class="btn" @click="back()">记录好了，返回</view>
      <text class="t-body" style="text-align: center; color: #3b3337" @click="skip">跳过，到店再测</text>
    </view>
  </view>
</template>

<style scoped>
.check { width: 24px; height: 24px; border-radius: 6px; border: 2px solid #c9a35e; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.check.on { background: var(--brand); border-color: var(--brand); }
.big-btn { height: 80px; font-size: 23px; }
</style>
