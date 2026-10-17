<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { afterSubmit, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '提交意向' } })

const xj = useXj()
const m = ref<any>(null)
const fields = ref<any[]>([])
const form = ref<Record<string, any>>({})
const today = new Date().toISOString().slice(0, 10)

onLoad(async (q: any) => {
  m.value = await http.get(`/app/modules/${q.code}`)
  fields.value = m.value.entryConfig?.fields || [{ key: 'note', label: '您的需求', type: 'textarea' }]
  fields.value.forEach((f: any) => {
    if (f.default !== undefined)
      form.value[f.key] = f.default
    if (f.type === 'number' && form.value[f.key] === undefined)
      form.value[f.key] = f.min || 1
  })
  const prefill = uni.getStorageSync('xj_lead_prefill')
  if (prefill) {
    Object.assign(form.value, prefill)
    uni.removeStorageSync('xj_lead_prefill')
  }
})

async function submit() {
  for (const f of fields.value) {
    const empty = form.value[f.key] === undefined || form.value[f.key] === ''
    // 手机号留空时默认联系账号绑定的手机（服务端补全）
    if (f.required && empty && !(f.type === 'phone' && xj.me?.phone))
      return toast(`请填写：${f.label}`)
    if (f.type === 'phone' && !empty && !/^1\d{10}$/.test(String(form.value[f.key])))
      return toast('请填写 11 位手机号')
  }
  const res: any = await http.post('/app/leads', { moduleCode: m.value.code, form: form.value, ackNotices: uni.getStorageSync('xj_ack') || [] }, { loading: '提交中' })
  afterSubmit(`顾问会在 ${res.slaHours} 小时内联系您。`)
}
</script>

<template>
  <view class="has-footer" :class="[...xj.pageClass]">
    <view v-if="m" class="page-head mo-rise mo-d1">
      <view class="ph-deco" :class="`i-tabler-${m.icon || 'calendar-plus'}`" />
      <text class="ph-title">{{ m.name }}</text>
      <text class="ph-sub">填写意向，顾问会尽快联系您确认</text>
      <view class="ph-meta">
        <view><XIcon name="headset" :size="14" />顾问一对一跟进</view>
        <view><XIcon name="wallet" :size="14" />平台不在线收款</view>
      </view>
    </view>
    <view v-if="m" class="stack mo-rise mo-d2">
      <view class="card stack mo-rise mo-d3">
        <view v-for="f in fields" :key="f.key" class="col gap8">
          <view class="row gap4">
            <text class="t-md">{{ f.label }}</text><text v-if="f.required && !(f.type === 'phone' && xj.me?.phone)" class="c-brand">*</text>
          </view>
          <view v-if="f.type === 'number'" class="row gap16">
            <view class="step mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="form[f.key] = Math.max(f.min || 0, (form[f.key] || 0) - 1)">
              -
            </view>
            <text class="t-xl num">{{ form[f.key] }}</text>
            <view class="step mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="form[f.key] = Math.min(f.max || 99, (form[f.key] || 0) + 1)">
              +
            </view>
          </view>
          <picker v-else-if="f.type === 'date' || f.type === 'dateRange'" mode="date" :start="today" :value="form[f.key] || today" @change="(e) => (form[f.key] = e.detail.value)">
            <view class="input row-between">
              <text>{{ form[f.key] || '请选择日期' }}</text><text class="c3">选择</text>
            </view>
          </picker>
          <view v-else-if="f.type === 'radio'" class="row gap8 wrap">
            <view v-for="o in f.options" :key="o" class="chip mo-press" :class="{ on: form[f.key] === o }" hover-class="mo-press-active" hover-stay-time="80" @click="form[f.key] = o">
              {{ o }}
            </view>
          </view>
          <textarea v-else-if="f.type === 'textarea'" v-model="form[f.key]" class="textarea" :placeholder="f.placeholder || '可不填'" />
          <input v-else v-model="form[f.key]" class="input" :type="f.type === 'phone' ? 'number' : 'text'" :placeholder="f.type === 'phone' ? (xj.me?.phone ? `留空则联系 ${xj.me.phone}` : '联系手机号') : '请填写'">
        </view>
      </view>
      <text class="t-xs c3">{{ m?.code === 'store_services' ? '提交后由门店顾问电话确认时间；也可以在门店项目页直接在线购买，先买后约更省心。' : '提交后由顾问联系您，第三方服务由有资质的合作方提供，平台不在线收款。' }}</text>
    </view>
    <view class="footer-bar">
      <view class="btn mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="submit">
        提交意向
      </view>
    </view>
  </view>
</template>

<style scoped>
.step {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background: var(--brand-soft);
  color: var(--brand-ink);
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chip {
  height: 44px;
  padding: 0 18px;
  border-radius: 22px;
  background: var(--surface);
  border: 1.5px solid var(--line-2);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  font-size: var(--fs-body);
}
.chip.on {
  background: linear-gradient(160deg, var(--surface), var(--brand-soft));
  border-color: var(--brand-dark);
  color: var(--brand-ink);
  font-weight: 700;
}
</style>
