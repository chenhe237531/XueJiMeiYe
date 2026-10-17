<script lang="ts" setup>
import { computed, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { themeHex, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '体检预约' } })

const xj = useXj()
const mode = ref<'coupon' | 'referral'>('coupon')
const coupon = ref<any>(null)
const slots = ref<any[]>([])
const date = ref('')
const c3 = ref(false)
const c4 = ref(false)
const transport = ref(false)
const note = ref('')
const result = ref<any>(null)
const hospitalName = computed(() => coupon.value?.hospital?.name || '合作医院·健康管理中心（演示）')
const dateText = computed(() => (date.value ? `${Number(date.value.slice(5, 7))}月${Number(date.value.slice(8))}日` : ''))

onLoad(async (q: any) => {
  if (q?.mode === 'referral') {
    mode.value = 'referral'
    uni.setNavigationBarTitle({ title: '预约合作医院' })
    result.value = await http.get('/app/assessments/latest-result')
    return
  }
  const list: any[] = await http.get('/app/coupons')
  coupon.value = list.find(x => x.id === Number(q.couponId))
  if (coupon.value)
    slots.value = await http.get('/app/checkup/slots', { hospitalId: coupon.value.hospital.id, packageCode: coupon.value.package.code })
})

async function submit() {
  if (mode.value === 'coupon' && !date.value)
    return toast('请先选择体检日期')
  if (!c3.value)
    return toast(`需要同意向${hospitalName.value}提供预约信息`)
  const body: any = { c3: true, c4: c4.value, transportNeeded: transport.value, note: note.value }
  if (mode.value === 'coupon')
    Object.assign(body, { couponId: coupon.value.id, date: date.value })
  else Object.assign(body, { services: result.value?.medical?.map((m: any) => m.code) || [] })
  await http.post('/app/checkup/bookings', body, { loading: '提交中' })
  await new Promise(r => uni.showModal({ title: '已提交', content: mode.value === 'coupon' ? `您预约了 ${dateText.value} 的体检，医院确认后会通知您。体检前一晚 10 点后请不要进食。` : '合作医院会尽快联系您安排就诊，顾问也会协助您。', showCancel: false, confirmText: '好的', confirmColor: themeHex().ink, complete: r }))
  uni.navigateBack()
}
</script>

<template>
  <view class="has-footer" :class="[...xj.pageClass]">
    <view class="page-head mo-rise mo-d1">
      <view class="ph-deco" :class="mode === 'coupon' ? 'i-tabler-calendar-event' : 'i-tabler-building-hospital'" />
      <text class="ph-title">{{ mode === 'coupon' ? '预约体检' : '转介就诊' }}</text>
      <text class="ph-sub">{{ hospitalName }}</text>
      <view class="ph-meta">
        <view><XIcon name="shield-check" :size="14" />合作医院执行</view>
        <view><XIcon name="lock" :size="14" />只提供必要信息</view>
      </view>
    </view>
    <view class="stack mo-rise mo-d2">
      <view v-if="mode === 'coupon' && coupon" class="card care col gap4 mo-rise mo-d3">
        <text class="t-lg">{{ coupon.typeName }} · {{ coupon.package?.name }}</text>
        <text class="t-sm">{{ coupon.promise }}</text>
      </view>
      <view v-if="mode === 'referral'" class="card care stack mo-rise mo-d4">
        <text class="t-lg">转介到{{ hospitalName }}</text>
        <view v-for="m in result?.medical || []" :key="m.code" class="col">
          <text class="t-md">{{ m.name }}</text><text class="t-sm" style="color: #4d5a3f">{{ m.reason }}</text>
        </view>
        <textarea v-model="note" class="textarea" placeholder="想补充给医生的情况（可不填）" />
      </view>

      <view v-if="mode === 'coupon'" class="stack mo-rise mo-d5">
        <view class="section-title" style="margin-top: 0">
          <text>选择体检日期</text><text class="more">近 3 周号源</text>
        </view>
        <view class="days">
          <view v-for="s in slots" :key="s.date" class="day mo-press" :class="{ on: date === s.date, full: !s.remaining }" hover-class="mo-press-active" hover-stay-time="80" @click="s.remaining ? (date = s.date) : toast('这一天约满了')">
            <text class="t-xs">周{{ s.week }}</text>
            <text class="t-lg num">{{ Number(s.date.slice(8)) }}</text>
            <text class="t-xs" :class="date === s.date ? '' : s.remaining <= 2 ? 'c-warn' : 'c-care'">{{ s.remaining ? `余 ${s.remaining}` : '约满' }}</text>
          </view>
        </view>
      </view>

      <view class="card stack">
        <view class="row gap12">
          <view class="icon-box care">
            <XIcon name="shield-check" />
          </view>
          <view class="col flex1">
            <view class="row gap6" style="align-items: flex-start">
              <text class="t-md">向{{ hospitalName }}提供预约信息</text><text class="t-xs c-brand semi need">必需</text>
            </view>
            <text class="t-sm c2">称呼、性别、年龄、手机号、推荐的检查项目、相关测评要点</text>
          </view>
          <switch :checked="c3" :color="themeHex().brand" @change="(e) => (c3 = e.detail.value)" />
        </view>
        <view class="divider" />
        <view class="row gap12">
          <view class="icon-box sky">
            <XIcon name="refresh" />
          </view>
          <view class="col flex1">
            <view class="row gap6" style="align-items: flex-start">
              <text class="t-md">允许医院把结果回传给顾问</text><text class="t-xs c2 need">可选</text>
            </view>
            <text class="t-sm c2">让顾问按医生意见调整您的门店方案；不影响就诊</text>
          </view>
          <switch :checked="c4" :color="themeHex().brand" @change="(e) => (c4 = e.detail.value)" />
        </view>
        <view class="divider" />
        <view class="row gap12 mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="transport = !transport">
          <view class="icon-box terra">
            <XIcon name="car" />
          </view>
          <view class="col flex1">
            <text class="t-md">需要顾问陪同或接送</text><text class="t-sm c2">臻享会员或 70 岁以上可申请，顾问会提前一天和您确认</text>
          </view>
          <view class="check" :class="{ on: transport }">
            <XIcon v-if="transport" name="check" :size="16" color="var(--on-brand)" />
          </view>
        </view>
      </view>
      <view class="row gap6 t-xs c3 privacy">
        <XIcon name="lock" :size="14" /><text>不会向医院提供：消费记录、会员等级、门店方案、魔镜聊天内容。</text>
      </view>
    </view>
    <view class="footer-bar">
      <view v-if="mode === 'coupon'" class="row gap6 t-sm c-warn foot-tip">
        <XIcon name="info-circle" :size="16" /><text>体检前一晚 10 点后请不要进食</text>
      </view>
      <view class="btn mo-press" :class="{ disabled: !c3 || (mode === 'coupon' && !date) }" hover-class="mo-press-active" hover-stay-time="80" @click="submit">
        {{ mode === 'coupon' ? `确认预约${date ? ` ${dateText}` : ''}` : '确认提交转介' }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}
.day {
  min-height: 74px;
  padding: 6px 0;
  box-sizing: border-box;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--card-line);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.day.on {
  background: linear-gradient(160deg, var(--brand-hi), var(--brand-dark));
  color: var(--on-brand);
  box-shadow: 0 8px 16px -8px rgba(168, 130, 77, 0.7);
}
.day.full {
  background: var(--placeholder);
  color: #786e74;
  box-shadow: none;
}
.privacy {
  align-items: flex-start;
}
.foot-tip {
  justify-content: center;
}
.elder .day .t-lg {
  font-size: 20px;
}
.need {
  flex-shrink: 0;
  white-space: nowrap;
  margin-top: 3px;
}
.check {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 2px solid #c9bec4;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  flex-shrink: 0;
}
.check.on {
  background: var(--brand);
  border-color: var(--brand);
}
</style>
