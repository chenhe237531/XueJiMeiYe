<script setup lang="ts">
/**
 * HomeElder · 乐龄版首页「今日健康」卡（XJ-203 / docs/07 §4.3 / D10 / D21）
 *
 * 乐龄版与标准版的可截图差异（AC#1）由本卡承载：
 *   1. 「今天要做的 2 件小事」：只取 2 项（标准版 taskList 为 3 件），去游戏化——
 *      无积分徽章、无进度环，完成即灰字 ✓（AC#5）；
 *   2. 家人入口前置到任务之后、健康概览之前，首屏无需滚动即可见（AC#3）；
 *   3. 六维大数字 + XRadar 概览保留；任务行 ≥56px、图标热区 ≥44px（AC#4）；
 *   4. 本卡不挂任何 mo-* 入场动画类，乐龄档位由全局 mo-off 兜底（AC#2 / D10）；
 *   5. 乐龄下不渲染 mirrorFab 悬浮球（HomeRender 渲染层过滤），小镜入口改为
 *      底部语音条（D21，语音条在 HomeRender 内，本卡不渲染任何悬浮入口）。
 *
 * 任务数据由 HomeRender 从原始布局（矩阵过滤前）的 taskList 截取前 2 项传入；
 * 完成判定与 HomeTasks 一致（doneToday 含 code，或 current >= target）；
 * 图标映射为 HomeTasks 同款内联副本（XJ-602 收敛前的过渡方案，均在 uno safelist）。
 */
import { computed } from 'vue'
import XIcon from '@/components/XIcon.vue'
import XRadar from '@/components/XRadar.vue'
import { go } from '@/xj/utils'
import { useXj } from '@/xj/store'

interface TaskItem {
  code: string
  icon?: string
  title: string
  sub?: string
  target?: number
  current?: number
  link?: string
}

const props = withDefaults(defineProps<{
  c: any
  tasks?: TaskItem[]
  doneToday?: string[]
  night?: boolean
}>(), {
  tasks: () => [],
  doneToday: () => [],
  night: false,
})

const xj = useXj()
const elder = computed(() => xj.elderMode)

/** D15 语义枚举 → tabler 图标名（HomeTasks 同款映射副本，全部在 safelist） */
const ICON_MAP: Record<string, string> = {
  skin: 'droplet',
  body: 'run',
  mind: 'mood-smile',
  assess: 'hexagon',
  checkup: 'ticket',
  plan: 'clipboard-heart',
  checkin: 'calendar-check',
}
const FALLBACK_ICON = 'circle-check'

const rows = computed(() => (props.tasks || []).map((t) => {
  const done = (props.doneToday || []).includes(t.code) || (t.target != null && t.current != null && t.current >= t.target)
  return { ...t, iconResolved: ICON_MAP[t.icon || ''] || FALLBACK_ICON, done }
}))
const doneCount = computed(() => rows.value.filter(r => r.done).length)
</script>

<template>
  <view class="card elder-today">
    <!-- 问候 + 乐龄开关（乐龄下小镜入口在底部语音条，不展示头像悬浮入口） -->
    <view class="row-between gap8">
      <view class="col gap6 flex1">
        <text class="t-title">{{ c.props.text }}</text>
        <view class="row gap8">
          <text class="tag">{{ c.props.isGuest ? '访客' : c.props.tierName }}</text>
          <text v-if="c.props.isGuest" class="t-sm c-brand semi" @click="go('/pkg-auth/login')">登录 / 注册</text>
        </view>
      </view>
      <view v-if="c.props.showElderToggle" class="col gap4" style="align-items: flex-end" @click="xj.toggleElder()">
        <text class="t-sm c2">乐龄模式</text>
        <view class="toggle" :class="{ on: elder }">
          <view class="knob" />
        </view>
      </view>
    </view>

    <!-- 今天要做的 2 件小事（去游戏化：无积分 / 无进度环，完成即灰字 ✓） -->
    <view class="et-tasks">
      <view class="row-between">
        <text class="t-lg">今天要做的 2 件小事</text>
        <text class="t-sm c3">{{ doneCount }}/{{ rows.length }} 完成</text>
      </view>
      <view
        v-for="t in rows"
        :key="t.code"
        class="et-task row gap12"
        :class="{ done: t.done }"
        hover-class="mo-press-active"
        :hover-stay-time="80"
        @click="t.link && go(t.link)"
      >
        <view class="et-task-ic" :class="{ done: t.done }">
          <XIcon v-if="!t.done" :name="t.iconResolved" :size="24" />
          <text v-else class="et-task-check">✓</text>
        </view>
        <view class="col flex1 gap2">
          <text class="et-task-title">{{ t.title }}</text>
          <text v-if="t.sub" class="t-sm c2 clamp1">{{ t.sub }}</text>
        </view>
        <XIcon v-if="!t.done" name="chevron-right" :size="22" color="#786E74" />
      </view>
      <view v-if="!rows.length" class="t-sm c2" style="text-align: center; padding: 8px 0">
        今天的安排都完成了，明天见
      </view>
    </view>

    <!-- 家人入口前置（AC#3）：任务之后、健康概览之前，首屏无需滚动 -->
    <view class="et-family row gap12" hover-class="mo-press-active" :hover-stay-time="80" @click="go('/pkg-family/list')">
      <view class="icon-box family-ic">
        <XIcon name="users" :size="26" />
      </view>
      <view class="col flex1">
        <text class="et-family-t">家人</text>
        <text class="t-sm" style="opacity: 0.92">让子女随时了解您的健康情况，更放心</text>
      </view>
      <XIcon name="chevron-right" :size="22" color="rgba(255,255,255,0.9)" />
    </view>

    <!-- 健康概览：六维大数字 + XRadar -->
    <template v-if="c.props.health.hasAssessment">
      <view class="row-between et-index" @click="go('/pages/archive/index')">
        <view class="col gap4">
          <text class="t-body c2">六维年轻化指数</text>
          <view class="row gap8" style="align-items: baseline">
            <text class="num bold" style="font-size: 60px; line-height: 1.05">{{ c.props.health.index }}</text>
            <text v-if="c.props.health.delta" class="semi" :class="c.props.health.delta > 0 ? 'c-care' : 'c-warn'">比上次 {{ c.props.health.delta > 0 ? '+' : '' }}{{ c.props.health.delta }}</text>
          </view>
          <text class="t-sm c3">上次测评 {{ c.props.health.lastAssessedAt }}</text>
        </view>
        <XRadar :scores="c.props.health.dims" :size="104" :dark="night" />
      </view>
    </template>
    <view v-else class="col gap8 et-cta" @click="go(xj.loggedIn ? '/pkg-assess/intro' : '/pkg-auth/login')">
      <text class="t-lg">了解自己的六个维度</text>
      <text class="c2">完成测评可以领取免费体检券。</text>
      <view class="btn">
        {{ c.props.health.cta || '开始六维测评，约 8 分钟' }}
      </view>
    </view>

    <!-- 今日养护 -->
    <view v-for="t in c.props.health.todos" :key="t.text" class="todo row gap12" hover-class="mo-press-active" :hover-stay-time="80" @click="go(t.link)">
      <view class="ic-chip" :class="t.tone === 'care' ? 'care' : 'brand'">
        <XIcon :name="t.icon" />
      </view>
      <view class="col flex1">
        <text class="t-md">{{ t.text }}</text>
        <text v-if="t.sub" class="t-sm c2">{{ t.sub }}</text>
      </view>
      <XIcon name="chevron-right" :size="22" color="#786E74" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.elder-today {
  padding: 18px 16px 8px;
}

/* 乐龄开关（HomeRender 同款副本：scoped 样式不跨组件） */
.toggle {
  width: 50px;
  height: 30px;
  border-radius: 15px;
  background: #d8d0d4;
  position: relative;
  transition: background 0.2s;
}
.toggle .knob {
  position: absolute;
  left: 3px;
  top: 3px;
  width: 24px;
  height: 24px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(60, 24, 44, 0.25);
  transition: left 0.2s;
}
.toggle.on {
  background: var(--brand);
}
.toggle.on .knob {
  left: 23px;
}

/* 2 件小事：去游戏化行（无积分徽章 / 无进度环），行高 ≥56px、图标热区 ≥44px（AC#4） */
.et-tasks {
  margin-top: 14px;
}
.et-task {
  border-top: 1px solid var(--line);
  padding: 12px 0;
  min-height: 56px;
}
.et-task-ic {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand-soft);
  color: var(--brand-ink);
}
.et-task-ic.done {
  background: var(--task-done);
  color: var(--care);
}
.et-task-check {
  font-size: 22px;
  font-weight: 700;
}
.et-task-title {
  font-size: var(--fs-lg);
  font-weight: 600;
  line-height: 1.4;
}
.et-task.done .et-task-title {
  color: var(--ink-3);
  font-weight: 500;
}
.et-task.done .et-task-ic {
  opacity: 0.85;
}

/* 家人大卡：墨绿底（--care 乐龄取值 #5c7a52），min-height 64px 保证热区（AC#4） */
.et-family {
  margin-top: 14px;
  border-radius: var(--r-inner);
  background: var(--care);
  color: #fff;
  padding: 16px 14px;
  min-height: 64px;
}
.et-family .icon-box.family-ic {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
.et-family-t {
  font-size: var(--fs-lg);
  font-weight: 700;
  line-height: 1.3;
}

.et-index {
  border-top: 1px solid var(--line);
  margin-top: 14px;
  padding-top: 14px;
}
.et-cta {
  margin-top: 14px;
}
.todo {
  border-top: 1px solid var(--line);
  padding: 14px 0 12px;
  margin-top: 12px;
}
.clamp1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
