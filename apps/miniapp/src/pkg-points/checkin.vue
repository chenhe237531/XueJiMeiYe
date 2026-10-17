<script lang="ts" setup>
import { ref } from 'vue'
import CalendarGrid from '@/components/points/CalendarGrid.vue'
import RewardTrack from '@/components/points/RewardTrack.vue'
import XIcon from '@/components/XIcon.vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { toast } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '签到日历' } })

const xj = useXj()
const d = ref<any>({ today: [], streak: 0, streakDays: 0, monthSignedDates: [] })
const sleepAt = ref('22:30')
const wakeAt = ref('06:30')
const minutes = ref(30)
const cups = ref(6)
/** 签到成功的 +N 上浮气泡（XJ-401：600ms 上浮淡出；mo-off 档位不播动画，积分变化由 toast 清晰提示） */
const float = ref<{ id: number, type: string, text: string } | null>(null)
const TYPES = [
  { k: 'sleep', n: '睡眠', icon: 'moon', tone: 'plum' },
  { k: 'exercise', n: '运动', icon: 'run', tone: 'terra' },
  { k: 'water', n: '喝水', icon: 'droplet', tone: 'sky' },
]

const signed = ref<string[]>([])
const streakDays = ref(0)
const monthDays = ref(0)

async function load() {
  d.value = await http.get('/app/checkins')
  // XJ-302 契约：streakDays 与 monthSignedDates（旧字段 streak / recent 保留兼容）
  streakDays.value = d.value.streakDays ?? d.value.streak ?? 0
  signed.value = d.value.monthSignedDates || []
  monthDays.value = signed.value.length
}
onShow(load)

async function submit(type: string) {
  const data: any = type === 'sleep' ? { sleepAt: sleepAt.value, wakeAt: wakeAt.value, summary: `${sleepAt.value} 睡，${wakeAt.value} 起` } : type === 'exercise' ? { minutes: minutes.value, summary: `运动 ${minutes.value} 分钟` } : { cups: cups.value, summary: `喝水 ${cups.value} 杯` }
  const r: any = await http.post('/app/checkins', { type, data })
  if (r.points > 0) {
    toast(`打卡成功 +${r.points} 积分`)
    if (xj.moTier !== 'off') {
      float.value = { id: Date.now(), type, text: `+${r.points}` }
      setTimeout(() => (float.value = null), 650)
    }
  }
  else {
    toast('已更新今天的记录')
  }
  load()
}
</script>

<template>
  <view :class="xj.pageClass">
    <XNav show-back title="签到日历" />
    <view class="stack" style="padding-top: 12px">
      <!-- ① 连签卡：金色渐变，左连签大数字、右本月已签（docs/07 §3.1） -->
      <view class="card raised streak row gap12 mo-rise mo-d1">
        <view class="col flex1 gap4">
          <text class="t-sm on-gold">已连续签到</text>
          <view class="row gap4" style="align-items: baseline">
            <text class="streak-n num">{{ streakDays }}</text>
            <text class="t-md on-gold">天</text>
          </view>
        </view>
        <view class="col gap4" style="align-items: flex-end">
          <text class="t-xs on-gold soft">本月已签</text>
          <text class="t-xl semi num on-gold">{{ monthDays }} 天</text>
        </view>
        <view class="streak-egg">
          <view class="egg-art" />
        </view>
      </view>

      <!-- ② 月历网格：四态（已签 / 今日 / 过去未签 / 未来） -->
      <view class="card raised mo-rise mo-d2">
        <CalendarGrid :signed="signed" />
      </view>

      <!-- ③ 连签奖励轨道 + 金蛋里程碑 -->
      <view class="card raised mo-rise mo-d3">
        <RewardTrack :streak="streakDays" />
      </view>

      <!-- ④ 今日还可做：已完成项降级为灰字 + ✓ -->
      <view class="section-title">
        <text>今日还可做</text>
      </view>
      <view v-for="(t, i) in TYPES" :key="t.k" class="card stack task mo-rise" :class="`mo-d${i + 4}`">
        <view class="row gap8">
          <view class="icon-box" :class="t.tone">
            <XIcon :name="t.icon" />
          </view>
          <text class="t-lg flex1" :class="{ 'c3 done': d.today.includes(t.k) }">{{ t.n }}</text>
          <text v-if="d.today.includes(t.k)" class="tag gray">✓ 已完成</text>
        </view>
        <view v-if="t.k === 'sleep'" class="row gap12">
          <picker mode="time" :value="sleepAt" class="flex1" @change="(e: any) => (sleepAt = e.detail.value)">
            <view class="input row-between">
              <text class="c2 t-sm">几点睡</text><text>{{ sleepAt }}</text>
            </view>
          </picker>
          <picker mode="time" :value="wakeAt" class="flex1" @change="(e: any) => (wakeAt = e.detail.value)">
            <view class="input row-between">
              <text class="c2 t-sm">几点醒</text><text>{{ wakeAt }}</text>
            </view>
          </picker>
        </view>
        <view v-if="t.k === 'exercise'" class="row gap8 wrap">
          <view v-for="m in [15, 30, 45, 60]" :key="m" class="chip" :class="{ on: minutes === m }" @click="minutes = m">
            {{ m }} 分钟
          </view>
        </view>
        <view v-if="t.k === 'water'" class="row gap8 wrap">
          <view v-for="c in [4, 6, 8]" :key="c" class="chip" :class="{ on: cups === c }" @click="cups = c">
            {{ c }} 杯
          </view>
        </view>
        <view class="row-between" style="align-items: center">
          <text class="t-xs c3">打卡 +2 积分，每天最多 6 分</text>
          <view class="btn small mo-press" :class="{ ghost: d.today.includes(t.k) }" hover-class="mo-press-active" @click="submit(t.k)">
            {{ d.today.includes(t.k) ? '更新' : '打卡' }}
          </view>
        </view>
        <!-- +N 上浮淡出 600ms（mo-off 不播，toast 已提示积分变化） -->
        <view v-if="float && float.type === t.k" :key="float.id" class="float-plus" :class="{ anim: xj.moTier !== 'off' }">
          {{ float.text }}
        </view>
      </view>

      <text class="t-xs c3">漏签不清空成就，从今天继续就好。经期日记需单独同意（C2），V1.2 开放。</text>
    </view>
  </view>
</template>

<style scoped>
.streak {
  padding: 16px;
  background: linear-gradient(135deg, var(--gold) 0%, var(--brand-dark) 100%);
}
.on-gold {
  color: var(--on-brand);
}
.on-gold.soft {
  opacity: 0.82;
}
.streak-n {
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
  color: var(--on-brand);
}
.streak-egg {
  display: flex;
  align-items: center;
}
.egg-art {
  width: 30px;
  height: 40px;
  border-radius: 50% 50% 50% 50% / 58% 58% 42% 42%;
  background: linear-gradient(160deg, #f2e3c2 0%, rgba(255, 255, 255, 0.75) 45%, rgba(255, 255, 255, 0.35) 100%);
  box-shadow: 0 3px 8px -2px rgba(60, 44, 20, 0.35);
}
.task {
  position: relative;
}
.chip {
  height: 40px;
  padding: 0 16px;
  border-radius: 20px;
  background: var(--surface);
  border: 1.5px solid var(--line-2);
  box-sizing: border-box;
  display: flex;
  align-items: center;
}
.chip.on {
  background: linear-gradient(160deg, var(--surface), var(--brand-soft));
  border-color: var(--brand-dark);
  color: var(--brand-ink);
  font-weight: 700;
}
.float-plus {
  position: absolute;
  top: 10px;
  right: 14px;
  font-size: 20px;
  font-weight: 700;
  color: var(--brand-ink);
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
</style>
