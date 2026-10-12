<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '每日打卡' } })

const xj = useXj()
const d = ref<any>({ today: [], streak: 0 })
const sleepAt = ref('22:30')
const wakeAt = ref('06:30')
const minutes = ref(30)
const cups = ref(6)
const TYPES = [
  { k: 'sleep', n: '睡眠', icon: 'moon' },
  { k: 'exercise', n: '运动', icon: 'run' },
  { k: 'water', n: '喝水', icon: 'droplet' },
]

async function load() { d.value = await http.get('/app/checkins') }
onShow(load)

async function submit(type: string) {
  const data: any = type === 'sleep' ? { sleepAt: sleepAt.value, wakeAt: wakeAt.value, summary: `${sleepAt.value} 睡，${wakeAt.value} 起` } : type === 'exercise' ? { minutes: minutes.value, summary: `运动 ${minutes.value} 分钟` } : { cups: cups.value, summary: `喝水 ${cups.value} 杯` }
  const r: any = await http.post('/app/checkins', { type, data })
  toast(r.points ? `打卡成功 +${r.points} 积分` : '已更新今天的记录')
  load()
}
</script>

<template>
  <view :class="xj.pageClass">
    <view class="stack" style="padding-top: 12px">
      <view class="card row gap12">
        <XIcon name="calendar-check" :size="36" color="var(--brand-ink)" />
        <view class="col flex1"><text class="t-lg">已连续打卡 {{ d.streak }} 天</text><text class="t-sm c2">每次打卡 +2 积分，每天最多 6 分</text></view>
      </view>
      <view v-for="t in TYPES" :key="t.k" class="card stack">
        <view class="row gap8">
          <XIcon :name="t.icon" :size="24" color="var(--brand-ink)" />
          <text class="t-lg flex1">{{ t.n }}</text>
          <text v-if="d.today.includes(t.k)" class="tag care">今天已打卡</text>
        </view>
        <view v-if="t.k === 'sleep'" class="row gap12">
          <picker mode="time" :value="sleepAt" class="flex1" @change="(e) => (sleepAt = e.detail.value)"><view class="input row-between"><text class="c2 t-sm">几点睡</text><text>{{ sleepAt }}</text></view></picker>
          <picker mode="time" :value="wakeAt" class="flex1" @change="(e) => (wakeAt = e.detail.value)"><view class="input row-between"><text class="c2 t-sm">几点醒</text><text>{{ wakeAt }}</text></view></picker>
        </view>
        <view v-if="t.k === 'exercise'" class="row gap8 wrap"><view v-for="m in [15, 30, 45, 60]" :key="m" class="chip" :class="{ on: minutes === m }" @click="minutes = m">{{ m }} 分钟</view></view>
        <view v-if="t.k === 'water'" class="row gap8 wrap"><view v-for="c in [4, 6, 8]" :key="c" class="chip" :class="{ on: cups === c }" @click="cups = c">{{ c }} 杯</view></view>
        <view class="btn small" @click="submit(t.k)">{{ d.today.includes(t.k) ? '更新' : '打卡' }}</view>
      </view>
      <text class="t-xs c3">经期日记需要单独同意健康信息处理（C2），在 V1.2 开放。</text>
    </view>
  </view>
</template>

<style scoped>
.chip { height: 40px; padding: 0 16px; border-radius: 20px; background: var(--bg); display: flex; align-items: center; }
.chip.on { background: var(--brand); color: var(--on-brand); font-weight: 600; }
</style>
