<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { absUrl, confirm, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '结伴拼团' } })

const xj = useXj()
const d = ref<any>({ activities: [], mine: [] })
const imgErr = ref(new Set<number>())
async function load() { d.value = await http.get('/app/groupbuys') }
onShow(load)

async function openGroup(a: any) {
  if (!(await confirm('发起拼团', `${a.groupSize} 人成团，${a.hours} 小时内有效，成团后锁定拼团价 ¥${a.price}，到店或线下支付。未成团自动关闭，无费用。`, '发起'))) return
  await http.post(`/app/groupbuys/${a.id}/groups`)
  toast('已发起，可以邀请老姐妹参团')
  load()
}

async function join(g: any) {
  const r: any = await http.post(`/app/groupbuys/groups/${g.id}/join`)
  toast(r.success ? '已成团！顾问会联系您确认时间' : '已参团')
  load()
}
</script>

<template>
  <view :class="xj.pageClass">
    <view class="page-head">
      <view class="ph-deco i-tabler-users-group" />
      <text class="ph-title">结伴拼团</text>
      <text class="ph-sub">约上老姐妹一起来，成团后顾问联系确认时间</text>
      <view class="ph-meta">
        <view><XIcon name="calendar-check" :size="14" />预约制</view>
        <view><XIcon name="wallet" :size="14" />平台不在线收款</view>
        <view><XIcon name="shield-check" :size="14" />无分享奖励</view>
      </view>
    </view>
    <view class="stack">
      <view v-for="a in d.activities" :key="a.id" class="card stack act">
        <view class="row gap12" style="align-items: stretch">
          <view class="photo-slot cover">
            <image v-if="a.cover && !imgErr.has(a.id)" class="cover-img" :src="absUrl(a.cover)" mode="aspectFill" @error="imgErr.add(a.id)" />
            <view v-else class="cover-fallback"><XIcon name="users-group" :size="32" /></view>
            <text class="corner-tag">{{ a.groupSize }} 人团</text>
          </view>
          <view class="col flex1 gap4">
            <text class="t-lg" style="line-height: 1.35">{{ a.title }}</text>
            <text class="t-sm c2">{{ a.desc }}</text>
            <view class="row gap6 wrap">
              <text class="tag line">{{ a.hours }} 小时内有效</text>
              <text v-if="a.needVisit" class="tag line">需到店</text>
            </view>
            <view class="row gap6" style="align-items: baseline; margin-top: auto">
              <text class="t-xs c-brand semi">拼团价</text>
              <view class="gprice"><text class="yen">¥</text><text class="amt num">{{ a.price }}</text></view>
              <text v-if="a.origPrice" class="price-orig">¥{{ a.origPrice }}</text>
            </view>
          </view>
        </view>
        <!-- 正在拼的团：成员头像 + 还差几人进度 -->
        <view v-for="g in a.openGroups" :key="g.id" class="og">
          <view class="row gap12">
            <view class="faces">
              <view v-for="(m, k) in g.members" :key="k" class="face">{{ m.slice(0, 1) }}</view>
              <view v-for="k in Math.max(0, a.groupSize - g.members.length)" :key="`e${k}`" class="face empty-face">?</view>
            </view>
            <view class="col flex1">
              <text class="t-md">{{ g.members.join('、') }} 的团</text>
              <text class="t-xs c2">还差 <text class="c-brand semi">{{ a.groupSize - g.members.length }}</text> 人 · {{ g.expiresAt }} 截止</text>
            </view>
            <view class="btn small" @click="join(g)">参团</view>
          </view>
          <view class="gbar"><view :style="{ width: `${Math.round((g.members.length / a.groupSize) * 100)}%` }" /></view>
        </view>
        <view class="btn" @click="openGroup(a)"><XIcon name="users-group" />发起拼团</view>
      </view>
      <view v-if="!d.activities.length" class="card empty">暂时没有进行中的拼团活动</view>

      <view v-if="d.mine.length" class="section-title"><text>我的拼团</text></view>
      <view v-if="d.mine.length" class="group">
        <view v-for="g in d.mine" :key="g.id" class="cell">
          <view class="icon-box" :class="g.status === 'success' ? 'care' : g.status === 'closed' ? 'gray' : 'rose'"><XIcon name="users" /></view>
          <view class="col flex1"><text class="t-md">{{ g.members.join('、') }}</text><text class="t-xs c2">{{ g.expiresAt }} 截止</text></view>
          <text class="tag" :class="g.status === 'success' ? 'care' : g.status === 'closed' ? 'gray' : ''">{{ g.status === 'success' ? '已成团' : g.status === 'closed' ? '已关闭' : '拼团中' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.act { padding: 14px; }
.cover { position: relative; width: 104px; min-height: 104px; border-radius: 12px; flex-shrink: 0; }
.elder .cover { width: 96px; min-height: 96px; }
.cover-img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.cover-fallback { position: absolute; left: 0; top: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; color: var(--brand-ink); background: radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.75) 0, rgba(255, 255, 255, 0) 42%), linear-gradient(145deg, var(--brand-soft), var(--brand-line)); }
.gprice { display: inline-flex; align-items: baseline; color: var(--brand-ink); font-weight: 700; }
.gprice .yen { font-size: 13px; }
.gprice .amt { font-size: 26px; line-height: 1; letter-spacing: -0.02em; }
.og { padding: 12px; border-radius: 14px; background: var(--brand-soft); display: flex; flex-direction: column; gap: 10px; }
.faces { display: flex; flex-shrink: 0; }
.face { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #fff; margin-left: -8px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--on-brand); background: linear-gradient(145deg, var(--brand-hi), var(--brand-dark)); }
.face:first-child { margin-left: 0; }
.face.empty-face { background: var(--surface); color: var(--ink-3); border: 2px dashed var(--brand-line); }
.elder .face { width: 36px; height: 36px; font-size: 15px; }
.gbar { height: 6px; border-radius: 3px; background: rgba(255, 255, 255, 0.8); overflow: hidden; }
.gbar > view { height: 6px; border-radius: 3px; background: linear-gradient(90deg, var(--brand-hi), var(--brand-dark)); }
</style>
