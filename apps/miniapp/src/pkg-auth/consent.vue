<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { back, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '授权确认' } })

const xj = useXj()
const text = ref<any>(null)
const full = ref(false)
const type = ref('C2')

onLoad(async (q: any) => {
  type.value = q?.type || 'C2'
  text.value = await http.get(`/app/consents/texts/${type.value}`)
  uni.setNavigationBarTitle({ title: text.value.title.replace('（单独同意）', '') })
})

async function decide(granted: boolean) {
  await http.post('/app/consents', { type: type.value, granted })
  toast(granted ? '已同意，随时可以在"我的"撤回' : '已记录，不影响其他功能')
  setTimeout(() => back(), 500)
}
</script>

<template>
  <view class="has-footer" :class="[...xj.stdPageClass]">
    <view v-if="text" class="page-head consent-head mo-rise mo-d1">
      <view class="ph-deco i-tabler-shield-check" />
      <text class="ph-title">{{ text.title }}</text>
      <text class="ph-sub">请先看看以下要点，再决定是否同意</text>
    </view>
    <view v-if="text" class="stack mo-rise mo-d2">
      <view class="card care stack mo-rise mo-d3">
        <view v-for="s in text.summary" :key="s" class="row gap8" style="align-items: flex-start">
          <view class="tick">
            <XIcon name="check" :size="14" color="#fff" />
          </view>
          <text class="t-body" style="color: #3f4a35">{{ s }}</text>
        </view>
        <text class="link t-sm" style="color: var(--care)" @click="full = !full">{{ full ? '收起' : '查看完整说明' }}</text>
      </view>
      <view v-if="full" class="card t-sm c2 mo-rise mo-d4" style="white-space: pre-wrap">
        {{ text.content }}
      </view>
      <text class="t-xs c3">文本版本 {{ text.version }}。本授权为单独同意，不会默认勾选；授权行为不发放积分。</text>
    </view>
    <view class="footer-bar">
      <view class="row gap12">
        <view class="btn plain flex1 mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="decide(false)">
          不同意
        </view>
        <view class="btn care flex1 mo-press" style="flex: 2" hover-class="mo-press-active" hover-stay-time="80" @click="decide(true)">
          同意
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
/* 健康授权用鼠尾草绿（健康语义）：头部晕染与对勾统一为绿 */
.consent-head {
  background: linear-gradient(180deg, var(--care-soft) 0%, var(--bg) 100%);
}
.consent-head .ph-deco {
  color: var(--care);
}
.tick {
  width: 20px;
  height: 20px;
  margin-top: 3px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #b3c69b, #6e7f5c);
}
</style>
