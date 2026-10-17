<script lang="ts" setup>
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { confirm, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '隐私与数据' } })

const xj = useXj()
const ITEMS = [
  ['账号信息', '微信标识、手机号、称呼、出生年份、性别', '提供登录和基本服务'],
  ['健康信息（单独同意）', '测评答案、门店测量、打卡记录、医院回传', '测评、档案、养护方案、风险提示'],
  ['消费信息', '从门店收银系统导入的消费记录', '计算会员等级（不用于健康推荐）'],
  ['魔镜对话', '对话原文保存 30 天，记忆需您单独同意', '陪伴聊天和风险提醒'],
]

async function req(type: string) {
  const text = type === 'export' ? '生成后通过站内消息提供下载，链接 24 小时有效。' : '注销后 15 个工作日内删除或匿名化您的个人数据（法律要求保留的除外）。'
  if (!(await confirm(type === 'export' ? '申请导出个人数据' : '申请注销账号', text, '确认申请')))
    return
  await http.post('/app/data-requests', { type })
  toast('申请已提交')
}
</script>

<template>
  <view :class="xj.pageClass">
    <view class="stack" style="padding-top: 12px">
      <text class="t-lg">我们收集了哪些信息</text>
      <view class="group">
        <view v-for="i in ITEMS" :key="i[0]" class="cell">
          <view class="col flex1">
            <text class="t-md">{{ i[0] }}</text><text class="t-sm c2">{{ i[1] }}</text><text class="t-xs c3">用途：{{ i[2] }}</text>
          </view>
        </view>
      </view>
      <text class="t-sm c2">健康数据单独加密保存，不用于营销推荐；医院只看到转介必需的信息。</text>
      <view class="btn ghost mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="req('export')">
        申请导出个人数据
      </view>
      <view class="btn plain mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="req('deactivate')">
        申请注销账号
      </view>
    </view>
  </view>
</template>
