<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { back, speak, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '30 秒坐站小测' } })

const xj = useXj()
const id = ref(0)
const code = ref('F02')
const ref0 = ref(0)
const company = ref(false)
const running = ref(false)
const left = ref(30)
const count = ref(0)
const done = ref(false)
let timer: any = null
const GUIDE = '请在有人陪同、身边有稳固椅子时进行。双手交叉放在胸前，从椅子上站起来再坐下，算一次。头晕或疼痛请立即停止。'

onLoad((q: any) => {
  id.value = Number(q.id)
  code.value = q.code || 'F02'
  ref0.value = Number(q.ref || 0)
})
onUnload(() => clearInterval(timer))

function start() {
  if (!company.value)
    return toast('请先确认身边有人陪同')
  running.value = true
  count.value = 0
  left.value = 30
  timer = setInterval(() => {
    left.value--
    if (left.value <= 0)
      finish()
  }, 1000)
}

function tap() {
  if (!running.value)
    return start()
  count.value++
}

async function finish() {
  clearInterval(timer)
  running.value = false
  done.value = true
  await http.put(`/app/assessments/${id.value}/answers`, { questionCode: code.value, answer: { value: count.value } })
}

async function skip() {
  await http.put(`/app/assessments/${id.value}/answers`, { questionCode: code.value, answer: { skipped: true } })
  uni.navigateBack()
}
</script>

<template>
  <view class="has-footer" :class="[...xj.pageClass]">
    <view class="stack" style="padding-top: 12px">
      <view class="row-between mo-rise">
        <text class="t-title">30 秒坐站小测</text>
        <view class="pill" hover-class="mo-press-active" hover-stay-time="80" @click="speak(GUIDE)">
          <XIcon name="volume" :size="18" /><text>朗读</text>
        </view>
      </view>
      <view class="card hint stack mo-rise mo-d1">
        <text class="t-body">请在有人陪同、身边有稳固椅子时进行。头晕或疼痛请立即停止。</text>
        <view class="row gap8" hover-class="mo-press-active" hover-stay-time="80" @click="company = !company">
          <view class="check" :class="{ on: company }">
            <XIcon v-if="company" name="check" :size="16" color="var(--on-brand)" />
          </view>
          <text class="t-md">身边有人陪同</text>
        </view>
      </view>
      <view class="photo-slot row gap12" style="height: 96px; flex-direction: row; padding: 0 16px; justify-content: flex-start">
        <view class="play">
          <XIcon name="player-play" :size="22" color="var(--brand-ink)" />
        </view>
        <view class="col" style="align-items: flex-start">
          <text class="t-md" style="color: #1e191c">先看示范</text><text class="t-sm">10 秒视频，起身再坐下（待替换门店示范视频）</text>
        </view>
      </view>
      <view class="col mo-rise mo-d2" style="align-items: center; padding: 16px 0">
        <text class="c2 t-body">{{ done ? '已完成' : running ? `剩余 0:${String(left).padStart(2, '0')}` : '准备好了就点下方按钮开始' }}</text>
        <view class="row gap8" style="align-items: baseline">
          <text class="num bold" style="font-size: 76px; line-height: 1.1">{{ count }}</text>
          <text class="t-xl">次</text>
        </view>
        <!-- 计时反馈：剩余时间条随倒计时收缩（scaleX + transform） -->
        <view class="tbar">
          <view class="tfill" :style="{ transform: `scaleX(${left / 30})` }" />
        </view>
        <view v-if="done" class="gd-pop">
          <text class="t-md" :class="ref0 && count < ref0 ? 'c-warn' : 'c-care'">30 秒完成 {{ count }} 次{{ ref0 ? `（同年龄参考 ${ref0} 次）` : '' }}</text>
        </view>
      </view>
    </view>
    <view class="footer-bar">
      <view v-if="!done" class="btn big-btn mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="tap">
        {{ running ? '站起一次，点一下' : '开始 30 秒计时' }}
      </view>
      <view v-else class="btn" hover-class="mo-press-active" hover-stay-time="80" @click="back()">
        记录好了，返回
      </view>
      <text v-if="!done" class="t-sm c2" style="text-align: center">陪同的人帮您点也可以，30 秒后自动记录</text>
      <text v-if="!done" class="t-body" style="text-align: center; color: #3b3337" @click="skip">跳过，到店再测</text>
    </view>
  </view>
</template>

<style scoped>
.check {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 2px solid #c9a35e;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.check.on {
  background: var(--brand);
  border-color: var(--brand);
}
.play {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.big-btn {
  height: 80px;
  font-size: 23px;
}
/* 计时刻度：1s 一次 tick，过渡与之一致；剩余时间越长条越满 */
.tbar {
  width: 180px;
  height: 6px;
  margin-top: 12px;
  border-radius: 3px;
  background: var(--placeholder);
  overflow: hidden;
}
.tfill {
  width: 100%;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--brand-hi), var(--brand-dark));
  transform-origin: left center;
  transition: transform 1s linear;
}
</style>
