<script lang="ts" setup>
import { computed, ref } from 'vue'
import XBadge from '@/components/XBadge.vue'
import XIcon from '@/components/XIcon.vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { confirm, go } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '我的' } })

const xj = useXj()

/**
 * 成长体系（XJ-501）。数据全部来自 XJ-303 已入库的接口，**不在前端重复实现徽章判定**：
 *   /app/me            → nextTier / growthValue / badges{unlocked,total,recent[]}
 *   /app/achievements  → 24 枚徽章全集（code/name/icon/outline/desc/target/progress/unlocked）
 * 徽章行取「先已点亮、未点亮按进度倒序」的前 8 枚展示，完整列表在徽章墙（XJ-403）。
 * 上一版试点（4 枚由 xj.me 字段前端推导）已被本版替换——那正是本卡禁止事项要避免的「重复实现」。
 */
const growth = ref<any>(null)
const achv = ref<any>(null)
const achvLoading = ref(true)

interface BadgeItem {
  code: string
  name: string
  icon: string
  outline: string
  desc: string
  target: number
  progress: number
  unlocked: boolean
}

/** 展平三组徽章：已点亮在前（按解锁时间倒序），未点亮按完成度倒序 */
const allBadges = computed<BadgeItem[]>(() => {
  const groups = achv.value?.groups || []
  const flat: BadgeItem[] = groups.flatMap((g: any) => g.badges || [])
  return flat.sort((a, b) => {
    if (a.unlocked !== b.unlocked)
      return a.unlocked ? -1 : 1
    if (a.unlocked)
      return 0
    return b.progress / b.target - a.progress / a.target
  })
})

/** 徽章行：最多 8 枚（范围第 2 条）；数据缺失时为空数组、走骨架 / 兜底文案 */
const badgeRow = computed(() => allBadges.value.slice(0, 8))
const badgeUnlocked = computed(() => achv.value?.unlocked ?? 0)
const badgeTotal = computed(() => achv.value?.total ?? 0)

/** 「快完成了」（范围第 4 条）：完成度 ≥80% 且未点亮的徽章里取进度最高的一张；没有则整卡不出现 */
const near = computed(() => allBadges.value
  .filter(b => !b.unlocked && b.target > 0 && b.progress / b.target >= 0.8)
  .sort((a, b) => b.progress / b.target - a.progress / a.target)[0] || null)

/** 等级进度：成长值 / 下一级门槛。growthValue 来自 XJ-303（近 N 月实付），不是积分，文案不写「积分」 */
const tierPct = computed(() => {
  const n = growth.value?.nextTier
  if (!n || !n.threshold)
    return 100
  return Math.max(4, Math.min(100, Math.round((growth.value.growthValue / n.threshold) * 100)))
})

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

onShow(async () => {
  if (!xj.loggedIn)
    return
  const me = await xj.loadMe()
  // 成长体系数据失败时静默：成长卡 / 徽章行隐藏即可，不影响页面其余部分
  growth.value = me ? { nextTier: me.nextTier ?? null, growthValue: me.growthValue ?? 0 } : null
  achvLoading.value = true
  achv.value = await http.get('/app/achievements', undefined, { silent: true }).catch(() => null)
  achvLoading.value = false
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
  <view class="has-tabbar washed" :class="[...xj.pageClass]">
    <XNav transparent />
    <view v-if="!xj.me" class="card empty stack">
      <text>登录后查看个人中心</text>
      <view class="btn" @click="go('/pkg-auth/login')">
        登录 / 注册
      </view>
    </view>
    <view v-else class="stack">
      <!-- 个人信息卡 + 数据统计行 -->
      <view class="card raised profile mo-rise">
        <view class="row gap12" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-auth/profile')">
          <view class="avatar">
            {{ (xj.me.salutation || '客').slice(0, 1) }}
          </view>
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
          <view class="stat" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-points/passbook')">
            <text class="stat-n c-brand">{{ xj.me.points ?? 0 }}</text><text class="stat-l">积分</text>
          </view>
          <view class="stat" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-checkup/coupons')">
            <text class="stat-n">{{ xj.me.coupons ?? 0 }}</text><text class="stat-l">体检券</text>
          </view>
          <view class="stat" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-family/list')">
            <text class="stat-n">{{ xj.me.familyCount ?? 0 }}</text><text class="stat-l">家人</text>
          </view>
          <view class="stat" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-me/messages')">
            <text class="stat-n" :class="{ 'c-alert': xj.me.unreadMessages }">{{ xj.me.unreadMessages ?? 0 }}</text><text class="stat-l">未读消息</text>
          </view>
        </view>
      </view>

      <!-- 会员成长（范围第 1 条）：当前成长值 → 下一等级；进度条只动 scaleX -->
      <view
        v-if="growth"
        class="card tier mo-rise mo-d1"
        hover-class="mo-press-active"
        hover-stay-time="80"
        @click="go('/pkg-me/tier')"
      >
        <view class="row-between">
          <view class="row gap8">
            <XIcon name="crown" :size="18" color="var(--brand-ink)" />
            <text class="t-md semi">会员成长</text>
          </view>
          <view class="row gap2 t-xs c2">
            <text>等级与权益</text><XIcon name="chevron-right" :size="14" color="#786E74" />
          </view>
        </view>
        <template v-if="growth.nextTier">
          <view class="row-between t-sm">
            <text class="c2">当前 {{ xj.me.tierName }} · 成长值 {{ growth.growthValue }}</text>
            <text class="c2">下一级 {{ growth.nextTier.tierName }}</text>
          </view>
          <view class="tbar">
            <view class="tfill" :style="{ transform: `scaleX(${tierPct / 100})` }" />
          </view>
          <text class="t-xs c3">再积累 {{ growth.nextTier.gap }} 成长值升级到 {{ growth.nextTier.tierName }}</text>
        </template>
        <text v-else class="t-sm c2">当前已是最高等级，权益以门店确认为准</text>
      </view>

      <!-- 健康存折横幅（范围第 3 条）：真实积分余额 + 查看明细入口 -->
      <view class="passbook row-between mo-rise mo-d1" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-points/passbook')">
        <view class="col gap2">
          <text class="t-lg">健康存折</text>
          <view class="row gap6" style="align-items: baseline">
            <text class="num bold pb-n">{{ xj.me.points ?? 0 }}</text>
            <text class="t-xs" style="opacity: 0.82">积分 · 积分换讲座、体验和好物</text>
          </view>
        </view>
        <view class="redeem">
          查看明细<XIcon name="chevron-right" :size="16" />
        </view>
      </view>

      <!-- 成就徽章（范围第 2 条）：8 枚，先已点亮；整卡可点进徽章墙 -->
      <view class="card badges mo-rise mo-d2" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-me/achievements')">
        <view class="row-between">
          <text class="t-lg">我的徽章</text>
          <view class="row gap2">
            <text class="t-sm c2">{{ badgeUnlocked }} / {{ badgeTotal }} 已点亮</text>
            <XIcon name="chevron-right" :size="16" color="#786E74" />
          </view>
        </view>
        <view v-if="badgeRow.length" class="badge-row">
          <XBadge
            v-for="b in badgeRow"
            :key="b.code"
            :icon="b.icon"
            :outline="b.outline"
            :label="b.name"
            :state="b.unlocked ? 'unlocked' : 'locked'"
            :progress="b.unlocked ? undefined : b.progress"
            size="sm"
          />
        </view>
        <view v-else-if="achvLoading" class="badge-row skel">
          <view class="skeleton" style="height: 70px; flex: 1" />
        </view>
        <text v-else class="t-sm c3">徽章还在路上，完成测评与打卡就能点亮</text>
      </view>

      <!-- 快完成了（范围第 4 条）：只有存在 ≥80% 进度的徽章时才出现，不施压 -->
      <view class="card near mo-rise mo-d3" hover-class="mo-press-active" hover-stay-time="80" @click="go('/pkg-me/achievements')">
        <XBadge :icon="near.icon" :outline="near.outline" state="locked" :progress="near.progress" size="sm" />
        <view class="col gap4 flex1">
          <text class="t-md semi">「{{ near.name }}」快点亮了</text>
          <text class="t-sm c2">{{ near.desc }}，当前进度 {{ near.progress }}/{{ near.target }}</text>
        </view>
        <XIcon name="chevron-right" :size="18" color="#786E74" />
      </view>

      <view class="card mo-rise mo-d3">
        <view class="section-title" style="margin-top: 0">
          <text>我的服务</text>
        </view>
        <view class="quick">
          <view v-for="q in quick" :key="q.name" class="col gap8 q" hover-class="mo-press-active" hover-stay-time="80" @click="go(q.link)">
            <view class="ic-chip" :class="q.tone">
              <XIcon :name="q.icon" :size="24" />
              <text v-if="q.key === 'coupons' && xj.me.coupons" class="dot-n">{{ xj.me.coupons }}</text>
            </view>
            <text class="t-sm">{{ q.name }}</text>
          </view>
        </view>
      </view>

      <view class="group mo-rise mo-d4">
        <view v-for="m in menus" :key="m.name" class="cell" hover-class="mo-press-active" hover-stay-time="80" @click="go(m.link)">
          <view class="ic-chip sm" :class="m.tone">
            <XIcon :name="m.icon" :size="18" />
          </view>
          <text class="flex1 t-md">{{ m.name }}</text>
          <text v-if="m.key === 'msg' && xj.me.unreadMessages" class="tag alert">{{ xj.me.unreadMessages }}</text>
          <text v-if="m.key === 'family' && xj.me.familyPending" class="tag alert">待确认</text>
          <text v-else-if="m.key === 'family' && xj.me.familyCount" class="t-sm c2">{{ xj.me.familyCount }} 位</text>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
      </view>

      <view class="group mo-rise mo-d4">
        <view class="cell" hover-class="mo-press-active" hover-stay-time="80" @click="xj.toggleElder()">
          <view class="ic-chip sm green">
            <XIcon name="accessible" :size="18" />
          </view>
          <text class="flex1 t-md">乐龄模式</text>
          <text class="t-sm c2">{{ xj.elderMode ? '已开启' : '已关闭' }}</text>
        </view>
        <view v-for="m in accountMenus" :key="m.name" class="cell" hover-class="mo-press-active" hover-stay-time="80" @click="go(m.link)">
          <view class="ic-chip sm" :class="m.tone">
            <XIcon :name="m.icon" :size="18" />
          </view>
          <text class="flex1 t-md">{{ m.name }}</text>
          <XIcon name="chevron-right" :size="18" color="#786E74" />
        </view>
      </view>

      <view class="logout mo-rise mo-d5" hover-class="mo-press-active" hover-stay-time="80" @click="logout">
        退出登录 / 切换演示账号
      </view>
    </view>
  </view>
</template>

<style scoped>
.badges {
  padding: 14px 14px 16px;
}
/* 徽章行从 4 枚扩到 8 枚：改用网格（4 列 × 2 行），space-between 在 8 枚时会挤成一排 */
.badge-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 4px;
  margin-top: 14px;
  justify-items: center;
}
.badge-row.skel {
  display: flex;
}
/* 等级进度条：只动 transform，不触发重排；乐龄 / 关闭档位由 --mo-emph 兜底 */
.tier {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tbar {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--placeholder);
  overflow: hidden;
}
.tfill {
  width: 100%;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--brand-hi), var(--brand-dark));
  transform-origin: left center;
  transition: transform var(--mo-emph, 420ms) var(--mo-ease-out);
}
/* 快完成了卡 */
.near {
  display: flex;
  align-items: center;
  gap: 12px;
}
/* 存折横幅里的真实积分：与标题同层级的大字 */
.pb-n {
  font-size: var(--fs-title);
  line-height: 1.1;
  color: var(--on-brand);
}
.profile {
  padding: 16px 16px 2px;
}
.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(145deg, #f7ede0, #dcbd88);
  border: 3px solid #fff;
  box-shadow: 0 6px 16px -8px rgba(168, 130, 77, 0.6);
  color: var(--brand-ink);
  font-family: var(--font-title);
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.elder .avatar {
  width: 68px;
  height: 68px;
  font-size: 28px;
}
.night .avatar {
  border-color: #3a3026;
}
.profile .stat-row {
  margin-top: 14px;
  border-top: 1px solid var(--line);
}
.clamp1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.passbook {
  position: relative;
  overflow: hidden;
  background: linear-gradient(120deg, #ecd7b2 0%, #c9a063 55%, #a8824d 100%);
  color: var(--on-brand);
  border-radius: var(--r-card);
  padding: 14px 16px;
  box-shadow: 0 10px 24px -14px rgba(168, 130, 77, 0.6);
}
.passbook::after {
  content: '';
  position: absolute;
  right: -28px;
  top: -40px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  pointer-events: none;
}
.elder .passbook {
  background: linear-gradient(120deg, #7fa48a 0%, #3f6b4f 60%, #345a41 100%);
  color: #fff;
  box-shadow: 0 10px 24px -14px rgba(63, 107, 79, 0.6);
}
.redeem {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 34px;
  padding: 0 12px 0 14px;
  border-radius: var(--r-pill);
  background: rgba(34, 34, 34, 0.86);
  color: #f2e6d5;
  font-size: var(--fs-sm);
  font-weight: 600;
  flex-shrink: 0;
}
.quick {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 14px 0 4px;
}
.q {
  align-items: center;
}
.ic-chip {
  position: relative;
}
.dot-n {
  position: absolute;
  right: -6px;
  top: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  box-sizing: border-box;
  border-radius: 9px;
  border: 2px solid #fff;
  background: var(--alert);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
}
.logout {
  margin-top: 4px;
  height: 48px;
  border-radius: var(--r-card);
  background: var(--surface);
  color: var(--ink-2);
  font-size: var(--fs-md);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--card-line);
}
</style>
