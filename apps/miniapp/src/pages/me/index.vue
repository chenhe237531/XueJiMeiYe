<script lang="ts" setup>
import XIcon from '@/components/XIcon.vue'
import XNav from '@/components/XNav.vue'
import { useXj } from '@/xj/store'
import { confirm, go } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '我的' } })

const xj = useXj()

/** 我的服务：彩色图标块（tone 对应 .ic-chip 色系，体检 = 健康绿） */
const quick = [
  { name: '体检券', icon: 'ticket', link: '/pkg-checkup/coupons', tone: 'care', key: 'coupons' },
  { name: '我的方案', icon: 'clipboard-heart', link: '/pkg-plan/detail', tone: 'rose' },
  { name: '我的顾问', icon: 'headset', link: '/pkg-me/advisor', tone: 'sky' },
  { name: '每日打卡', icon: 'calendar-check', link: '/pkg-points/checkin', tone: 'brand' },
]

/** 菜单分两组：服务与预约 / 账户与隐私 */
const menus = [
  { name: '我的预约与意向', icon: 'calendar-event', link: '/pkg-me/requests', tone: 'brand' },
  { name: '门店项目与预约', icon: 'building-store', link: '/pkg-module/store', tone: 'terra' },
  { name: '会员等级与权益', icon: 'crown', link: '/pkg-me/tier', tone: 'brand' },
  { name: '我的家人', icon: 'users', link: '/pkg-family/list', key: 'family', tone: 'rose' },
  { name: '消息中心', icon: 'bell', link: '/pkg-me/messages', key: 'msg', tone: 'sky' },
]
const accountMenus = [
  { name: '授权管理', icon: 'shield-check', link: '/pkg-me/consents', tone: 'care' },
  { name: '小镜记得的事', icon: 'notebook', link: '/pkg-me/memories', tone: 'plum' },
  { name: '隐私与数据', icon: 'lock', link: '/pkg-me/privacy', tone: 'sky' },
  { name: '设置', icon: 'settings', link: '/pkg-me/settings', tone: 'ink' },
  { name: '关于雪姬美业', icon: 'info-circle', link: '/pkg-me/about', tone: 'terra' },
]

onShow(() => {
  if (xj.loggedIn) xj.loadMe()
})

async function logout() {
  if (await confirm('退出登录', '退出后可以切换其他演示账号', '确认退出')) {
    xj.logout()
    uni.removeStorageSync('xj_home_cache')
    go('/pkg-auth/login')
  }
}
</script>

<template>
  <view :class="[...xj.pageClass, 'has-tabbar', 'washed']">
    <XNav transparent />
    <view v-if="!xj.me" class="card empty stack">
      <text>登录后查看个人中心</text>
      <view class="btn" @click="go('/pkg-auth/login')">登录 / 注册</view>
    </view>
    <view v-else class="stack">
      <!-- 个人信息卡 + 数据统计行 -->
      <view class="card raised profile">
        <view class="row gap12" @click="go('/pkg-auth/profile')">
          <view class="avatar">{{ (xj.me.salutation || '客').slice(0, 1) }}</view>
          <view class="col flex1 gap4">
            <view class="row gap8">
              <text class="t-xl">{{ xj.me.salutation || '未填写称呼' }}</text>
              <text class="tag" :class="{ gold: xj.me.tier === 'A' }">{{ xj.me.tierName }}</text>
            </view>
            <view class="row gap4 t-sm c2">
              <XIcon name="map-pin" :size="14" />
              <text class="clamp1">{{ xj.me.advisor ? `顾问 ${xj.me.advisor.name} · ` : '' }}{{ xj.me.store?.name || '未绑定门店' }}</text>
            </view>
          </view>
          <XIcon name="chevron-right" :size="20" color="#786E74" />
        </view>
        <view class="stat-row">
          <view class="stat" @click="go('/pkg-points/passbook')">
            <text class="stat-n c-brand">{{ xj.me.points ?? 0 }}</text><text class="stat-l">积分</text>
          </view>
          <view class="stat" @click="go('/pkg-checkup/coupons')">
            <text class="stat-n">{{ xj.me.coupons ?? 0 }}</text><text class="stat-l">体检券</text>
          </view>
          <view class="stat" @click="go('/pkg-family/list')">
            <text class="stat-n">{{ xj.me.familyCount ?? 0 }}</text><text class="stat-l">家人</text>
          </view>
          <view class="stat" @click="go('/pkg-me/messages')">
            <text class="stat-n" :class="{ 'c-alert': xj.me.unreadMessages }">{{ xj.me.unreadMessages ?? 0 }}</text><text class="stat-l">未读消息</text>
          </view>
        </view>
      </view>

      <!-- 健康存折横幅 -->
      <view class="passbook row-between" @click="go('/pkg-points/passbook')">
        <view class="col gap4">
          <text class="t-lg">健康存折</text>
          <text class="t-xs" style="opacity: 0.82">积分换讲座、体验和好物</text>
        </view>
        <view class="redeem">去兑换<XIcon name="chevron-right" :size="16" /></view>
      </view>

      <view class="card">
        <view class="section-title" style="margin-top: 0"><text>我的服务</text></view>
        <view class="quick">
          <view v-for="q in quick" :key="q.name" class="col gap8 q" @click="go(q.link)">
            <view class="ic-chip" :class="q.tone">
              <XIcon :name="q.icon" :size="24" />
              <text v-if="q.key === 'coupons' && xj.me.coupons" class="dot-n">{{ xj.me.coupons }}</text>
            </view>
            <text class="t-sm">{{ q.name }}</text>
          </view>
        </view>
      </view>

      <view class="group">
        <view v-for="m in menus" :key="m.name" class="cell" @click="go(m.link)">
          <view class="ic-chip sm" :class="m.tone"><XIcon :name="m.icon" :size="18" /></view>
          <text class="flex1 t-md">{{ m.name }}</text>
          <text v-if="m.key === 'msg' && xj.me.unreadMessages" class="tag alert">{{ xj.me.unreadMessages }}</text>
          <text v-if="m.key === 'family' && xj.me.familyPending" class="tag alert">待确认</text>
          <text v-else-if="m.key === 'family' && xj.me.familyCount" class="t-sm c2">{{ xj.me.familyCount }} 位</text>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
      </view>

      <view class="group">
        <view class="cell" @click="xj.toggleElder()">
          <view class="ic-chip sm green"><XIcon name="accessible" :size="18" /></view>
          <text class="flex1 t-md">乐龄模式</text>
          <text class="t-sm c2">{{ xj.elderMode ? '已开启' : '已关闭' }}</text>
        </view>
        <view v-for="m in accountMenus" :key="m.name" class="cell" @click="go(m.link)">
          <view class="ic-chip sm" :class="m.tone"><XIcon :name="m.icon" :size="18" /></view>
          <text class="flex1 t-md">{{ m.name }}</text>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
      </view>

      <view class="logout" @click="logout">退出登录 / 切换演示账号</view>
    </view>
  </view>
</template>

<style scoped>
.profile { padding: 16px 16px 2px; }
.avatar { width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(145deg, #f7ede0, #dcbd88); border: 3px solid #fff; box-shadow: 0 6px 16px -8px rgba(168, 130, 77, 0.6); color: var(--brand-ink); font-family: var(--font-title); font-size: 24px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.elder .avatar { width: 68px; height: 68px; font-size: 28px; }
.night .avatar { border-color: #3a3026; }
.profile .stat-row { margin-top: 14px; border-top: 1px solid var(--line); }
.clamp1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.passbook { position: relative; overflow: hidden; background: linear-gradient(120deg, #ecd7b2 0%, #c9a063 55%, #a8824d 100%); color: var(--on-brand); border-radius: var(--r-card); padding: 14px 16px; box-shadow: 0 10px 24px -14px rgba(168, 130, 77, 0.6); }
.passbook::after { content: ''; position: absolute; right: -28px; top: -40px; width: 120px; height: 120px; border-radius: 50%; background: rgba(255, 255, 255, 0.18); pointer-events: none; }
.elder .passbook { background: linear-gradient(120deg, #7fa48a 0%, #3f6b4f 60%, #345a41 100%); color: #fff; box-shadow: 0 10px 24px -14px rgba(63, 107, 79, 0.6); }
.redeem { position: relative; z-index: 1; display: flex; align-items: center; gap: 2px; height: 34px; padding: 0 12px 0 14px; border-radius: 999px; background: rgba(34, 34, 34, 0.86); color: #f2e6d5; font-size: var(--fs-sm); font-weight: 600; flex-shrink: 0; }
.quick { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 14px 0 4px; }
.q { align-items: center; }
.ic-chip { position: relative; }
.dot-n { position: absolute; right: -6px; top: -6px; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 9px; border: 2px solid #fff; background: var(--alert); color: #fff; font-size: 10px; font-weight: 700; line-height: 14px; text-align: center; }
.logout { margin-top: 4px; height: 48px; border-radius: var(--r-card); background: var(--surface); color: var(--ink-2); font-size: var(--fs-md); display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-card); border: 1px solid var(--card-line); }
</style>
