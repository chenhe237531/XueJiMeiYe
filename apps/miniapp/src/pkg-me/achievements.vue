<script lang="ts" setup>
import { computed, ref } from 'vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go, themeHex, toast } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '成就徽章墙' } })

/** /app/achievements 契约（XJ-303 交付）：{ unlocked, total, groups[] } */
interface Badge {
  code: string
  name: string
  icon: string
  outline: string
  desc: string
  target: number
  progress: number
  unlocked: boolean
  unlockedAt: string | null
}
interface Group { key: string, name: string, badges: Badge[] }

const xj = useXj()
const d = ref<{ unlocked: number, total: number, groups: Group[] } | null>(null)
const tab = ref('keep')
const detail = ref<Badge | null>(null)

/** 称号梯度（纯展示，接口不含称号）：与 docs/07 §3.3 示例对齐——8 枚时提示「再点亮 2 枚解锁健康达人」 */
const TITLES = [
  { min: 0, name: '健康新人' },
  { min: 6, name: '健康行家' },
  { min: 10, name: '健康达人' },
  { min: 18, name: '健康大师' },
  { min: 24, name: '全勤传说' },
]

function today() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/**
 * XJ-303 的 outline 目录里 "ball" 不存在于 tabler 集合（只有 ball-tennis 等具体球类），
 * 前端做等价映射；后端契约文件属 XJ-303 的 files_own，不在本卡范围内改动
 */
const OUTLINE_FIX: Record<string, string> = { ball: 'ball-tennis' }
function outlineOf(b: Badge): string {
  return OUTLINE_FIX[b.outline] ?? b.outline
}

/** 当天点亮的徽章按「新解锁」态呈现：弹入 + 光晕由 XBadge 自带（gd-pop 420ms），乐龄档自动静止 */
function stateOf(b: Badge): 'locked' | 'unlocked' | 'new' {
  if (!b.unlocked)
    return 'locked'
  return b.unlockedAt === today() ? 'new' : 'unlocked'
}

const pct = computed(() => (d.value && d.value.total > 0 ? Math.round((d.value.unlocked / d.value.total) * 100) : 0))
const titleNow = computed(() => [...TITLES].reverse().find(t => (d.value?.unlocked ?? 0) >= t.min)!)
const titleNext = computed(() => TITLES.find(t => t.min > (d.value?.unlocked ?? 0)))
const badges = computed(() => d.value?.groups.find(g => g.key === tab.value)?.badges ?? [])

async function load() {
  d.value = await http.get('/app/achievements')
}
onShow(load)

function openDetail(b: Badge) {
  detail.value = b
}
</script>

<template>
  <view :class="xj.pageClass">
    <XNav show-back title="成就徽章墙" />
    <view v-if="d" class="stack" style="padding-top: 12px">
      <!-- ① 顶部进度：环 = 点亮比例（乐龄环色自动转墨绿），右侧当前称号与下一目标 -->
      <view class="card raised row gap16 mo-rise mo-d1">
        <XIndexRing :value="pct" :size="112" :color="themeHex().brand" suffix="%" caption="点亮进度" />
        <view class="col flex1 gap8">
          <view class="row gap8 wrap" style="align-items: center">
            <text class="t-title">{{ titleNow.name }}</text>
            <text class="tag gold">当前称号</text>
          </view>
          <view class="row gap6" style="align-items: baseline">
            <text class="t-hero num">已点亮 {{ d.unlocked }} / {{ d.total }}</text>
          </view>
          <text v-if="titleNext" class="t-sm c2">再点亮 {{ titleNext.min - d.unlocked }} 枚解锁「{{ titleNext.name }}」</text>
          <text v-else class="t-sm c2">{{ d.total }} 枚徽章全部点亮，感谢一路坚持</text>
        </view>
      </view>

      <!-- ② 分组 Tab：选中金底白字，其余白底描边（组名取自接口 groups，不前端硬编码） -->
      <view class="row gap8 mo-rise mo-d2">
        <view
          v-for="g in d.groups"
          :key="g.key"
          class="tab"
          :class="{ on: tab === g.key }"
          hover-class="mo-press-active"
          @click="tab = g.key"
        >
          {{ g.name }}
        </view>
      </view>

      <!-- ③ 徽章网格：3 列；已解锁 = 彩图 + 名称，未解锁 = 线稿虚线盘 + 进度条 + 进度数字 -->
      <view class="card raised mo-rise mo-d3 grid">
        <view
          v-for="b in badges"
          :key="b.code"
          class="cell col"
          hover-class="mo-press-active"
          @click="openDetail(b)"
        >
          <XBadge
            :icon="b.icon"
            :outline="outlineOf(b)"
            :label="b.name"
            :state="stateOf(b)"
            size="md"
            :progress="b.unlocked ? undefined : Math.min(1, b.progress / b.target)"
          />
          <text v-if="!b.unlocked" class="t-xs c3 num">{{ b.progress }}/{{ b.target }}</text>
        </view>
      </view>

      <text class="t-xs c3 mo-rise mo-d4">徽章由日常坚持自动点亮，无需手动领取；点亮当天会带光晕标记。</text>
    </view>

    <!-- ④ 徽章详情：底部抽屉（上滑入场只动 transform/opacity；mo-off 档位直接呈现终态） -->
    <view v-if="detail" class="detail-mask" @click="detail = null">
      <view class="detail-sheet" :class="{ anim: xj.moTier !== 'off' }" @click.stop>
        <view class="detail-grip" />
        <view class="col" style="align-items: center; gap: 6px">
          <XBadge
            :icon="detail.icon"
            :outline="outlineOf(detail)"
            :label="detail.name"
            :state="stateOf(detail)"
            size="lg"
            :progress="detail.unlocked ? undefined : Math.min(1, detail.progress / detail.target)"
          />
          <text class="t-md semi">{{ detail.desc }}</text>
          <text v-if="detail.unlocked" class="t-sm c2">点亮于 {{ detail.unlockedAt }}</text>
          <text v-else class="t-sm c2">当前进度 {{ detail.progress }} / {{ detail.target }}</text>
        </view>
        <view class="row gap12 mt12">
          <view class="btn flex1" hover-class="mo-press-active" @click="go('/pkg-family/list')">
            分享给家人
          </view>
          <view class="btn plain flex1" hover-class="mo-press-active" @click="toast('家人的点亮动态将在 V1.2 开放')">
            看别人点亮
          </view>
        </view>
      </view>
    </view>

    <!-- UnoCSS safelist 字面量登记：7 枚徽章的未解锁线稿图标不在 uno.config.ts safelist 内（该文件不在本卡
         files_own），按 uno.config 注释允许的方式在页面内写字面量类名，让 UnoCSS 扫描进包；
         ball 在 tabler 集合中不存在，经 OUTLINE_FIX 映射为 ball-tennis，此处登记映射后的实际类名 -->
    <view class="uno-keep i-tabler-glass i-tabler-checklist i-tabler-book i-tabler-chart-dots i-tabler-id i-tabler-tree i-tabler-ball-tennis" />
  </view>
</template>

<style scoped>
.tab {
  flex: 1;
  height: 40px;
  border-radius: 20px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1.5px solid var(--line-2);
  font-size: var(--fs-sm);
}
.tab.on {
  background: linear-gradient(160deg, var(--gold) 0%, var(--brand-dark) 100%);
  border-color: transparent;
  color: var(--on-brand);
  font-weight: 700;
}
/* 3 列网格：格宽 ~100px，乐龄下 XBadge 盘径 58→68px 仍留有余量，不溢出 */
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px 8px;
  padding: 20px 14px;
}
.cell {
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  border-radius: 12px;
}
.detail-mask {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(28, 23, 18, 0.5);
  display: flex;
  align-items: flex-end;
}
.detail-sheet {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 20px calc(24px + env(safe-area-inset-bottom));
  border-radius: 24px 24px 0 0;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.detail-sheet.anim {
  animation: sheet-up 300ms var(--mo-ease-out, cubic-bezier(0.3, 0, 1, 1)) both;
}
@keyframes sheet-up {
  0% {
    transform: translateY(100%);
    opacity: 0.6;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}
.detail-grip {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--line-2);
  margin: 0 auto;
}
.uno-keep {
  display: none;
}
</style>
