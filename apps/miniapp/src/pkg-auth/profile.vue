<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { confirm, go, themeHex, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '基础资料' } })

const xj = useXj()
const salutation = ref('')
const gender = ref('female')
const years = Array.from({ length: 70 }, (_, i) => new Date().getFullYear() - 18 - i)
/** 不预选年份：默认停在某个年份时，顺手点"保存"就会存下错误年龄 */
const yearIdx = ref(-1)

onLoad(() => {
  if (xj.me?.salutation)
    salutation.value = xj.me.salutation
  if (xj.me?.birthYear)
    yearIdx.value = Math.max(0, years.indexOf(xj.me.birthYear))
})

async function save(skip = false) {
  if (!skip && !salutation.value)
    return toast('请填写您希望的称呼，如"王女士"')
  if (!skip && yearIdx.value < 0)
    return toast('请选择出生年份')
  if (skip && !(await confirm('跳过基础资料？', '出生年份会影响测评题目、体检券类型和养护方案。跳过后，开始测评前还会再请您选一次。', '先跳过')))
    return
  const res: any = skip ? {} : await http.patch('/app/me', { salutation: salutation.value, birthYear: years[yearIdx.value], gender: gender.value }, { loading: '保存中' })
  await xj.loadMe()
  if (res.elderAuto) {
    await new Promise(r => uni.showModal({ title: '已为您开启乐龄模式', content: '字更大、颜色更柔和。可以在"我的 - 设置"里随时切换。', showCancel: false, confirmText: '好的', confirmColor: themeHex().ink, complete: r }))
  }
  go('/pages/index/index')
}
</script>

<template>
  <view class="washed" :class="[...xj.stdPageClass]">
    <view class="page-head mo-rise mo-d1" style="background: none">
      <view class="ph-deco i-tabler-user-heart" />
      <text class="ph-title">怎么称呼您？</text>
      <text class="ph-sub">称呼用于问候和顾问联系；出生年份用于测评题目和方案</text>
      <view class="ph-meta">
        <view><XIcon name="clock" :size="14" />30 秒填完</view>
        <view><XIcon name="lock" :size="14" />仅您和顾问可见</view>
      </view>
    </view>
    <view class="card raised stack mo-rise mo-d2">
      <text class="t-md semi">称呼</text>
      <input v-model="salutation" class="input" placeholder="如：王女士、小李、Anna" maxlength="16">
      <text class="t-md semi">出生年份</text>
      <picker mode="selector" :range="years" :value="yearIdx < 0 ? 30 : yearIdx" @change="(e) => (yearIdx = Number(e.detail.value))">
        <view class="input row-between">
          <text :class="{ c3: yearIdx < 0 }">{{ yearIdx < 0 ? '请选择' : `${years[yearIdx]} 年` }}</text><text class="c3">选择</text>
        </view>
      </picker>
      <text class="t-sm c2">会影响测评题目和养护方案，请按实际选择</text>
      <text class="t-md semi">性别</text>
      <view class="choice-grid two">
        <view class="choice mo-press" :class="{ on: gender === 'female' }" hover-class="mo-press-active" hover-stay-time="80" @click="gender = 'female'">
          <view class="icon-box rose">
            <XIcon name="user-heart" />
          </view>
          <text class="t-md">女士</text>
        </view>
        <view class="choice mo-press" :class="{ on: gender === 'male' }" hover-class="mo-press-active" hover-stay-time="80" @click="gender = 'male'">
          <view class="icon-box sky">
            <XIcon name="user" />
          </view>
          <text class="t-md">先生</text>
        </view>
      </view>
    </view>
    <view class="stack mt24 mo-rise mo-d3">
      <view class="btn mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="save()">
        保存
      </view>
      <view class="t-body c2 mo-press" style="text-align: center; padding: 8px" hover-class="mo-press-active" hover-stay-time="80" @click="save(true)">
        跳过
      </view>
    </view>
  </view>
</template>
