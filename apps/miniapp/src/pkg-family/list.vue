<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import XIcon from '@/components/XIcon.vue'
import XMascot from '@/components/XMascot.vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import type { MoTier } from '@/xj/motion'
import { syncMotion } from '@/xj/motion'
import { confirm, go, themeHex, toast } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '我的家人' } })

const xj = useXj()
/** 动效档位挂在页面根节点（AC#4）：mo-off（乐龄）下 mo-rise 入场直达终态、无动画 */
const mo = ref<MoTier>(syncMotion(xj.elderMode))
watch(() => xj.elderMode, v => (mo.value = syncMotion(v)))

const data = ref<any>({ myFamily: [], iCareFor: [] })
const relay = ref<any>(null)
const relation = ref('daughter')
const invite = ref<any>(null)
const REL: Record<string, string> = { daughter: '女儿', son: '儿子', spouse: '配偶', other: '其他' }
/** 关系 → 镜灵头像色调（AC#1：XMascot 纯 CSS 合成，零图片资源；mascot.scss 色调类本就为家人头像复用而设） */
const TONE: Record<string, 'rose' | 'sky' | 'terra' | 'gold'> = { daughter: 'rose', son: 'sky', spouse: 'terra', other: 'gold' }
const PERMS = [
  { k: 'view_report', n: '查看测评和报告', d: '包括医生建议摘要' },
  { k: 'receive_reminder', n: '接收复查和体检提醒', d: '提醒会同时发给家人' },
  { k: 'book_for', n: '代为预约', d: '体检和门店项目' },
  { k: 'fill_for', n: '代填测评', d: '帮您回答测评题目' },
]
const pendingPerms = ref<Record<number, string[]>>({})
/** elderId → 健康状态（我关心的家人，AC#2 数据源为家人视角总览接口） */
const health = ref<Record<number, { tone: string, text: string }>>({})

/**
 * 健康状态四态（AC#2，与 view/accept 同一套视觉语言；色觉障碍：颜色必须配文字，
 * none 态再叠一层「虚线空心」形状区分）：
 *   none   未授权查看 —— 无 summary 且无 reminders（未授权任何健康内容）
 *   watch  需要留意 —— 待办里有健康预警（alert，如门店项目暂停）
 *   follow 事项待跟进 —— 有养护/测评/体检待办，或已授权报告但测评未完成
 *   ok    状态平稳 —— 已有测评结论且无待办
 */
function healthOf(ov: any): { tone: string, text: string } {
  if (!ov || (!ov.summary && !ov.reminders))
    return { tone: 'none', text: '未授权查看' }
  const todos = ov.reminders || []
  if (todos.some((t: any) => t.kind === 'alert'))
    return { tone: 'watch', text: '需要留意' }
  if (todos.length || ov.summary?.index == null)
    return { tone: 'follow', text: '事项待跟进' }
  return { tone: 'ok', text: '状态平稳' }
}

async function load() {
  const [links, r] = await Promise.all([
    http.get('/app/family/links'),
    http.get('/app/family/relay', undefined, { silent: true }).catch(() => null),
  ])
  data.value = links
  relay.value = r
  data.value.myFamily.filter((l: any) => l.status === 'applied').forEach((l: any) => { pendingPerms.value[l.id] = ['view_report', 'receive_reminder'] })
  // 我关心的家人：并行拉各自总览（未授权/失败 → none 态），让「谁需要关心」一眼可见
  const elders: any[] = data.value.iCareFor || []
  const ovs = await Promise.all(elders.map(l => http.get(`/app/family/elders/${l.elderId}/overview`, undefined, { silent: true }).catch(() => null)))
  health.value = Object.fromEntries(elders.map((l, i) => [l.elderId, healthOf(ovs[i])]))
}
onShow(load)

/** 接力入口副标（AC#3）：读 /app/family/relay 显示真实接力状态，不做静态占位文案 */
const relayHint = computed(() => {
  if (!relay.value?.bound)
    return '绑定家人后，每天互相接棒打卡，各得 5 积分'
  if ((relay.value.streak ?? 0) > 0)
    return `与${relay.value.peer?.name || '家人'}已连续接棒 ${relay.value.streak} 天`
  return `和${relay.value.peer?.name || '家人'}接出第一棒`
})

async function createInvite() {
  invite.value = await http.post('/app/family/invites', { relation: relation.value, permissions: ['view_report', 'receive_reminder'] })
  load()
}

function shareInvite() {
  // #ifdef H5
  const url = `${location.origin}${location.pathname}#${invite.value.path}`
  uni.setClipboardData({ data: url, success: () => toast('邀请链接已复制，发给家人打开即可') })
  // #endif
  // #ifndef H5
  toast('点击右上角"···"转发给家人')
  // #endif
}

async function togglePerm(l: any, k: string) {
  const perms = l.permissions.includes(k) ? l.permissions.filter((x: string) => x !== k) : [...l.permissions, k]
  await http.patch(`/app/family/links/${l.id}`, { permissions: perms })
  l.permissions = perms
}

function togglePending(id: number, k: string) {
  const cur = pendingPerms.value[id] || []
  pendingPerms.value[id] = cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k]
}

async function confirmLink(l: any) {
  await http.post(`/app/family/links/${l.id}/confirm`, { permissions: pendingPerms.value[l.id] || [] })
  toast('已确认绑定')
  load()
}

async function unlink(l: any) {
  if (!(await confirm('解除绑定', `解除后，${l.name}将立即无法查看您的信息`, '解除绑定'))) return
  await http.del(`/app/family/links/${l.id}`)
  load()
}

onShareAppMessage(() => ({ title: `${xj.me?.salutation || ''}邀请您成为她的健康家人`, path: invite.value?.path || '/pages/index/index' }))
</script>

<template>
  <view :class="[...xj.pageClass, `mo-${mo}`]">
    <XNav show-back title="我的家人" />
    <view class="stack" style="padding-top: 12px">
      <!-- 接力棒入口（家人列表顶部，docs/07 §3.7；AC#3：显示真实接力状态，点击进入接力页） -->
      <view class="card raised relay-entry mo-rise mo-d1" hover-class="mo-press-active" @click="go('/pkg-family/relay')">
        <view class="handshake">
          <XIcon name="heart-handshake" :size="22" color="var(--on-brand)" />
        </view>
        <view class="col flex1 gap2">
          <text class="t-md semi">健康接力棒</text>
          <text class="t-sm c2">{{ relayHint }}</text>
        </view>
        <text v-if="relay?.bound" class="relay-tag" :class="{ done: relay.todayPassed }">
          {{ relay.todayPassed ? '今日已接棒' : '今日待接棒' }}
        </text>
        <XIcon v-else name="chevron-right" :size="20" color="#786E74" />
      </view>

      <view v-for="l in data.myFamily.filter((x) => x.status === 'active')" :key="l.id" class="card stack mo-rise mo-d2">
        <view class="row gap12">
          <XMascot :size="48" :tone="TONE[l.relation] || 'gold'" />
          <view class="col flex1">
            <text class="t-lg">{{ REL[l.relation] || l.relation }} {{ l.name }}</text>
            <text class="t-sm c2">已绑定，可查看您授权的内容</text>
          </view>
        </view>
        <text class="t-sm c2 semi">{{ l.name }}可以看到什么</text>
        <view v-for="p in PERMS" :key="p.k" class="row gap12">
          <view class="col flex1"><text class="t-md">{{ p.n }}</text><text class="t-sm c2">{{ p.d }}</text></view>
          <switch :checked="l.permissions.includes(p.k)" :color="themeHex().brand" @change="togglePerm(l, p.k)" />
        </view>
        <text class="t-sm c2" @click="unlink(l)">不想继续分享时，可以<text class="link" style="color: #5c5358; text-decoration: underline">解除绑定</text></text>
      </view>

      <view v-for="l in data.myFamily.filter((x) => x.status === 'applied')" :key="l.id" class="card hint stack mo-rise mo-d2">
        <view class="row gap12">
          <XMascot :size="44" :tone="TONE[l.relation] || 'gold'" />
          <view class="col flex1 gap4">
            <text class="t-md">{{ l.name }}申请作为您的{{ REL[l.relation] }}绑定</text>
            <text class="t-sm">请勾选允许查看的内容（单独同意 C6）</text>
          </view>
        </view>
        <view v-for="p in PERMS" :key="p.k" class="row gap8" @click="togglePending(l.id, p.k)">
          <view class="check" :class="{ on: (pendingPerms[l.id] || []).includes(p.k) }"><XIcon v-if="(pendingPerms[l.id] || []).includes(p.k)" name="check" :size="16" color="var(--on-brand)" /></view>
          <text class="t-body">{{ p.n }}</text>
        </view>
        <view class="btn" hover-class="mo-press-active" @click="confirmLink(l)">
          确认绑定
        </view>
      </view>

      <view class="card stack mo-rise mo-d3">
        <view class="col gap4">
          <text class="t-lg">邀请家人一起关心您</text>
          <text class="t-sm c2">家人能看到的内容由您决定，可以随时修改</text>
        </view>
        <view class="row gap8 wrap">
          <view v-for="(n, k) in REL" :key="k" class="chip" :class="{ on: relation === k }" @click="relation = k">{{ n }}</view>
        </view>
        <view v-if="invite" class="invite row gap12">
          <view class="icon-box"><XIcon name="users" /></view>
          <view class="col flex1">
            <text class="t-md">{{ xj.me?.salutation }}邀请您成为她的健康家人</text>
            <text class="t-xs c2">72 小时内有效，需要{{ xj.me?.salutation }}再次确认</text>
          </view>
        </view>
        <!-- #ifdef MP-WEIXIN -->
        <button v-if="invite" class="btn" hover-class="mo-press-active" open-type="share">
          发送给微信好友
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view v-if="invite" class="btn" hover-class="mo-press-active" @click="shareInvite">
          复制邀请链接
        </view>
        <!-- #endif -->
        <view v-if="!invite" class="btn" hover-class="mo-press-active" @click="createInvite">
          生成邀请
        </view>
      </view>

      <view v-if="data.myFamily.some((x) => x.status === 'pending')" class="group mo-rise mo-d4">
        <view v-for="l in data.myFamily.filter((x) => x.status === 'pending')" :key="l.id" class="cell">
          <text class="flex1 t-body">邀请{{ REL[l.relation] }}（等待接受）</text>
          <text class="t-xs c3">{{ l.expiresAt }} 前有效</text>
        </view>
      </view>

      <view v-if="data.iCareFor.length" class="stack mo-rise mo-d4">
        <text class="section-title">我关心的家人</text>
        <view v-for="l in data.iCareFor" :key="l.id" class="card row gap12" hover-class="mo-press-active" @click="go(`/pkg-family/view?elderId=${l.elderId}`)">
          <XMascot :size="48" tone="care" />
          <view class="col flex1 gap4">
            <view class="row gap8">
              <text class="t-lg">{{ l.name }}</text>
              <view class="hd">
                <view class="hd-dot" :class="health[l.elderId]?.tone || 'none'" />
                <text class="t-xs hd-txt" :class="health[l.elderId]?.tone || 'none'">{{ health[l.elderId]?.text || '状态读取中' }}</text>
              </view>
            </view>
            <text class="t-sm c2">查看授权范围内的健康信息</text>
          </view>
          <XIcon name="chevron-right" :size="20" color="#786E74" />
        </view>
      </view>
    </view>

    <!-- UnoCSS safelist 字面量登记：heart-handshake 不在 uno.config safelist（该文件不在本卡 files_own），
         按 uno.config 注释允许的方式在页面内写字面量类名让扫描进包（与 relay.vue 同款做法） -->
    <view class="uno-keep i-tabler-heart-handshake" />
  </view>
</template>

<style scoped>
/* ── 接力棒入口（AC#3）── */
.relay-entry {
  display: flex;
  align-items: center;
  gap: 12px;
}
.handshake {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--brand-hi) 0%, var(--brand) 55%, var(--brand-dark) 100%);
  box-shadow: 0 6px 14px -6px rgba(168, 130, 77, 0.55);
}
.relay-tag {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1.5px dashed var(--care);
  color: var(--care);
  font-size: var(--fs-xs);
  font-weight: 600;
  white-space: nowrap;
}
.relay-tag.done {
  border-style: solid;
  background: var(--care-soft);
}
/* ── 健康状态点（AC#2 四态：ok 绿 / watch 红 / follow 琥珀 / none 灰虚线；色必须配文字） ── */
.hd {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.hd-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-sizing: border-box;
}
.hd-dot.ok {
  background: var(--meter-ok);
}
.hd-dot.watch {
  background: var(--meter-low);
}
.hd-dot.follow {
  background: var(--meter-near);
}
.hd-dot.none {
  background: transparent;
  border: 2px dashed var(--ink-3);
}
.hd-txt.ok {
  color: var(--meter-ok);
}
.hd-txt.watch {
  color: var(--meter-low);
}
.hd-txt.follow {
  color: var(--meter-near);
}
.hd-txt.none {
  color: var(--ink-3);
}
.chip { height: 40px; padding: 0 16px; border-radius: 20px; background: var(--bg); display: flex; align-items: center; }
.chip.on { background: var(--brand); color: var(--on-brand); font-weight: 600; }
.invite { background: #f7f3f5; border-radius: 14px; padding: 12px; }
.check { width: 22px; height: 22px; border-radius: 6px; border: 2px solid #c9a35e; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.check.on { background: var(--brand); border-color: var(--brand); }
button.btn { margin: 0; line-height: var(--btn-h); }
button.btn::after { border: 0; }
.uno-keep { display: none; }
</style>
