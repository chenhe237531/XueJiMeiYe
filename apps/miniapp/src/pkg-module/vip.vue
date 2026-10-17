<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { afterSubmit, toast } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '海外 VIP 通道', navigationBarTextStyle: 'white' } })

const xj = useXj()
const DEST = [
  { name: '香港', desc: '集团医疗机构，体检与抗衰', icon: 'building-hospital' },
  { name: '日本', desc: '精密体检', icon: 'heart-rate-monitor' },
  { name: '瑞士', desc: '高端抗衰', icon: 'mountain' },
  { name: '美国', desc: '专科诊疗，第二诊疗意见', icon: 'stethoscope' },
]
const STEPS = ['提交需求', '专属顾问对接，了解您的情况', '合作机构出具方案与报价', '签证、行程与陪同翻译', '回国随访，结果记入健康档案']
const dest = ref('香港')
const need = ref('高端体检')
const translator = ref('不需要')

async function submit() {
  if (xj.me?.tier !== 'A')
    return toast('海外 VIP 通道为臻享会员权益，可以咨询您的顾问')
  const res: any = await http.post('/app/leads', { moduleCode: 'vip_overseas', form: { destination: dest.value, need: need.value, translator: translator.value } }, { loading: '提交中' })
  afterSubmit(`专属顾问会在 ${res.slaHours} 小时内联系您。`)
}
</script>

<template>
  <view class="night has-footer" :class="[...xj.pageClass]">
    <XNav show-back />
    <view class="stack mo-rise mo-d1">
      <view class="col gap4">
        <text class="t-title">海外 VIP 通道</text>
        <text class="t-sm c2">体检、抗衰与专科诊疗，专属顾问全程陪同</text>
      </view>
      <view class="card col mo-rise mo-d2">
        <view v-for="d in DEST" :key="d.name" class="dest mo-press" :class="{ on: dest === d.name }" hover-class="mo-press-active" hover-stay-time="80" @click="dest = d.name">
          <view class="ph">
            <XIcon :name="d.icon" :size="22" color="#9D928D" />
          </view>
          <view class="col flex1">
            <text class="t-md">{{ d.name }}</text><text class="t-sm c2">{{ d.desc }}</text>
          </view>
          <XIcon v-if="dest === d.name" name="circle-check" :size="22" color="#D2B47A" />
        </view>
      </view>
      <view class="card stack mo-rise mo-d3">
        <text class="t-sm semi" style="color: #d2b47a">需求类型</text>
        <view class="row gap8 wrap">
          <view v-for="n in ['高端体检', '抗衰', '专科诊疗', '第二诊疗意见']" :key="n" class="chip mo-press" :class="{ on: need === n }" hover-class="mo-press-active" hover-stay-time="80" @click="need = n">
            {{ n }}
          </view>
        </view>
        <text class="t-sm semi" style="color: #d2b47a">是否需要陪同翻译</text>
        <view class="row gap8">
          <view v-for="n in ['需要', '不需要']" :key="n" class="chip mo-press" :class="{ on: translator === n }" hover-class="mo-press-active" hover-stay-time="80" @click="translator = n">
            {{ n }}
          </view>
        </view>
      </view>
      <view class="card stack mo-rise mo-d4">
        <text class="t-sm semi" style="color: #d2b47a">服务流程</text>
        <view v-for="(s, i) in STEPS" :key="s" class="row gap12">
          <text class="num-c">{{ i + 1 }}</text><text class="t-sm" style="color: #e2d9d3">{{ s }}</text>
        </view>
        <text class="t-xs c2">咨询阶段不会把您的健康信息传到境外。进入实际服务前，会单独征得您的同意。</text>
      </view>
    </view>
    <view class="footer-bar">
      <view class="btn gold mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="submit">
        预约咨询，4 小时内回复
      </view>
    </view>
  </view>
</template>

<style scoped>
.dest {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.dest:first-child {
  border-top: 0;
}
.ph {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: #2a2328;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chip {
  height: 40px;
  padding: 0 16px;
  border-radius: 20px;
  background: #2a2328;
  color: #e2d9d3;
  display: flex;
  align-items: center;
  font-size: var(--fs-sm);
}
.chip.on {
  background: #d2b47a;
  color: #1c1712;
  font-weight: 700;
}
.num-c {
  width: 22px;
  height: 22px;
  border-radius: 11px;
  border: 1px solid rgba(210, 180, 122, 0.5);
  color: #d2b47a;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
