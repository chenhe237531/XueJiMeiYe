<script lang="ts" setup>
import { ref } from 'vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { confirm, go, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '授权管理' } })

const xj = useXj()
const list = ref<any[]>([])
const EFFECT: Record<string, string> = {
  C2: '撤回后停止新的健康数据收集，未发送的方案作废；已有数据可申请删除。',
  C3: '撤回后未完成的转介单会取消并通知医院，体检券作废。',
  C4: '撤回后医院不再回传结果，您仍可直接从医院拿报告。',
  C5: '撤回后删除照片及分析结果。',
  C6: '撤回后解除所有家人绑定。',
  C7: '撤回后首页按默认顺序展示。',
  C8: '撤回后停止向境外机构传输。',
  C9: '撤回后清空小镜的记忆。',
}

async function load() { list.value = await http.get('/app/consents') }
onShow(load)

async function revoke(c: any) {
  if (!(await confirm(`撤回「${c.title}」`, EFFECT[c.type] || '确认撤回？', '确认撤回')))
    return
  const r: any = await http.post(`/app/consents/${c.type}/revoke`, { keepData: true })
  toast(r.effects?.[0] || '已撤回')
  load()
}
</script>

<template>
  <view :class="xj.pageClass">
    <view class="stack" style="padding-top: 12px">
      <text class="t-sm c2">每项授权都可以单独撤回；撤回会在 15 个工作日内处理完成，结果通过站内消息告知。</text>
      <view class="group">
        <view v-for="c in list" :key="c.type" class="cell">
          <view class="col flex1">
            <text class="t-md">{{ c.title.replace('（单独同意）', '') }}</text>
            <text class="t-xs c2">{{ c.granted ? `${c.at} 同意，v${c.version}` : c.revoked ? `${c.at} 已撤回` : c.at ? '未同意' : '未开启' }}</text>
          </view>
          <text v-if="c.type === 'C1' && c.granted" class="t-sm c2">已同意</text>
          <view v-else-if="c.granted" class="mini mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="revoke(c)">
            撤回
          </view>
          <view v-else-if="!['C3', 'C4', 'C6', 'C8'].includes(c.type)" class="mini on mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="go(`/pkg-auth/consent?type=${c.type}`)">
            开启
          </view>
          <text v-else class="t-xs c3">使用时按需授权</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.mini {
  height: 30px;
  padding: 0 14px;
  border-radius: 15px;
  border: 1px solid #e0d8dc;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #3b3337;
}
.mini.on {
  border-color: var(--brand);
  color: var(--brand-ink);
  font-weight: 600;
}
</style>
