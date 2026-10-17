<script lang="ts" setup>
import { ref } from 'vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '消息中心' } })

const xj = useXj()
const list = ref<any[]>([])
const loaded = ref(false)
onShow(async () => {
  list.value = await http.get('/app/messages', undefined, { silent: true }).catch(() => [])
  loaded.value = true
})
</script>

<template>
  <view :class="xj.pageClass">
    <view class="stack mo-rise mo-d1" style="padding-top: 12px">
      <view v-for="m in list" :key="m.id" class="card col gap4 mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="go(m.link)">
        <view class="row-between">
          <text class="t-md">{{ m.title }}</text><text class="t-xs c3">{{ m.at }}</text>
        </view>
        <text class="t-sm c2">{{ m.content }}</text>
      </view>
      <template v-if="!list.length">
        <view class="card skeleton" style="height: 84px" />
        <view class="card skeleton" style="height: 84px" />
        <view v-if="loaded" class="empty">
          暂无消息
        </view>
      </template>
    </view>
  </view>
</template>
