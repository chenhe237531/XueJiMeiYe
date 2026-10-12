<script lang="ts" setup>
import { ref } from 'vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { back, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '接送预约' } })

const xj = useXj()
const today = new Date().toISOString().slice(0, 10)
const form = ref<any>({ date: '', time: '09:30', from: '', to: '门店', people: 1, wheelchair: '不需要' })

async function submit() {
  if (!form.value.date || !form.value.from) return toast('请填写日期和上车地点')
  const res: any = await http.post('/app/transport/requests', form.value, { loading: '提交中' })
  await new Promise(r => uni.showModal({ title: '已提交', content: `门店会确认车辆和司机后通知您（单号 ${res.leadNo}）。`, showCancel: false, confirmText: '好的', confirmColor: '#8C2B56', complete: r }))
  back()
}
</script>

<template>
  <view :class="[...xj.pageClass, 'has-footer']">
    <view class="stack" style="padding-top: 12px">
      <text class="t-title">接送预约</text>
      <text class="c2 t-sm">臻享会员权益，往返门店或合作医院</text>
      <view class="card stack">
        <text class="t-md">日期</text>
        <picker mode="date" :start="today" @change="(e) => (form.date = e.detail.value)"><view class="input row-between"><text>{{ form.date || '请选择' }}</text><text class="c3">选择</text></view></picker>
        <text class="t-md">时间</text>
        <picker mode="time" :value="form.time" @change="(e) => (form.time = e.detail.value)"><view class="input row-between"><text>{{ form.time }}</text><text class="c3">选择</text></view></picker>
        <text class="t-md">上车地点</text>
        <input v-model="form.from" class="input" placeholder="小区或路口">
        <text class="t-md">目的地</text>
        <view class="row gap8"><view v-for="t in ['门店', '合作医院']" :key="t" class="chip" :class="{ on: form.to === t }" @click="form.to = t">{{ t }}</view></view>
        <text class="t-md">人数</text>
        <view class="row gap8"><view v-for="n in [1, 2, 3]" :key="n" class="chip" :class="{ on: form.people === n }" @click="form.people = n">{{ n }} 人</view></view>
        <text class="t-md">是否需要轮椅协助</text>
        <view class="row gap8"><view v-for="t in ['需要', '不需要']" :key="t" class="chip" :class="{ on: form.wheelchair === t }" @click="form.wheelchair = t">{{ t }}</view></view>
      </view>
    </view>
    <view class="footer-bar"><view class="btn" @click="submit">确认预约接送</view></view>
  </view>
</template>

<style scoped>
.chip { height: 44px; padding: 0 18px; border-radius: 22px; background: #f4f2f3; display: flex; align-items: center; }
.chip.on { background: var(--brand); color: #fff; font-weight: 600; }
</style>
