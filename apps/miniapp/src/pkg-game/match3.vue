<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { syncMotion } from '@/xj/motion'
import type { MoTier } from '@/xj/motion'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '健康消消乐' } })

const xj = useXj()
/** 动效档位（XJ-707）：档位 class 落本页根节点；无效交换的抖动在 mo-off 下不播，状态反馈仍可见 */
const mo = ref<MoTier>(syncMotion(xj.elderMode))
watch(() => xj.elderMode, v => (mo.value = syncMotion(v)))

const TILES = ['🍎', '🥦', '💧', '🧘', '💪'] // 健康主题：水果 / 蔬菜 / 喝水 / 晨练 / 体能

const d = ref<any>(null) // { levels, maxLevel, dailyCap, pointsLeftToday }
const lv = ref<number | null>(null) // 当前关卡（null = 选关）
const grid = ref<number[]>([])
const sel = ref<number | null>(null)
const shakeIdx = ref<number[]>([])
const score = ref(0)
const moves = ref(0)
const busy = ref(false)
const won = ref<any>(null) // 通关弹层 { points, capped, next }
/** 通关积分 +N 上浮（XJ-707）：600ms 上浮淡出；mo-off 不播，通关弹层已完整告知积分 */
const float = ref<{ id: number, text: string } | null>(null)
function popPoints(n?: number) {
  if (!n || n <= 0)
    return
  if (mo.value === 'off')
    return
  float.value = { id: Date.now(), text: `+${n}` }
  setTimeout(() => (float.value = null), 650)
}
const startedAt = ref(0)
const finishSent = ref(false) // 通关上报只发一次（评审修复：失败时不重复请求）

const cfg = computed(() => d.value?.levels?.find((l: any) => l.level === lv.value) || null)
const progress = computed(() => cfg.value ? Math.min(100, Math.round(score.value / cfg.value.targetScore * 100)) : 0)

async function load() {
  d.value = await http.get('/app/games/match3/levels', undefined, { silent: true })
}
onLoad(load)

/** 生成初始棋盘：保证无初始三连 */
function makeGrid(c: any): number[] {
  const g: number[] = new Array(c.rows * c.cols).fill(0)
  for (let i = 0; i < g.length; i++) {
    const r = Math.floor(i / c.cols)
    let t = 0
    do {
      t = Math.floor(Math.random() * c.tileTypes)
    } while (
      (c.cols >= 3 && i % c.cols >= 2 && g[i - 1] === t && g[i - 2] === t)
      || (r >= 2 && g[i - c.cols] === t && g[i - 2 * c.cols] === t)
    )
    g[i] = t
  }
  return g
}

function start(level: number) {
  lv.value = level
  const c = d.value.levels.find((l: any) => l.level === level)
  grid.value = makeGrid(c)
  sel.value = null
  score.value = 0
  moves.value = 0
  won.value = null
  finishSent.value = false
  startedAt.value = Date.now()
}

/** 纯函数：横竖三连及以上 */
function findMatches(g: number[], c: any): Set<number> {
  const m = new Set<number>()
  for (let r = 0; r < c.rows; r++) {
    for (let i = 0; i < c.cols - 2; i++) {
      const k = r * c.cols + i
      if (g[k] >= 0 && g[k] === g[k + 1] && g[k] === g[k + 2]) { m.add(k); m.add(k + 1); m.add(k + 2) }
    }
  }
  for (let i = 0; i < g.length - 2 * c.cols; i++) {
    if (g[i] >= 0 && g[i] === g[i + c.cols] && g[i] === g[i + 2 * c.cols]) { m.add(i); m.add(i + c.cols); m.add(i + 2 * c.cols) }
  }
  return m
}

/** 消除并下落补新，返回处理后的棋盘与本次消除总数（级联） */
function resolve(g: number[], c: any): { grid: number[], cleared: number } {
  const out = [...g]
  let cleared = 0
  for (;;) {
    const m = findMatches(out, c)
    if (!m.size)
      break
    cleared += m.size
    m.forEach((i) => { out[i] = -1 })
    for (let col = 0; col < c.cols; col++) {
      const column: number[] = []
      for (let row = c.rows - 1; row >= 0; row--) {
        if (out[row * c.cols + col] >= 0)
          column.push(out[row * c.cols + col])
      }
      for (let row = c.rows - 1, k = 0; row >= 0; row--, k++) {
        out[row * c.cols + col] = k < column.length ? column[k] : Math.floor(Math.random() * c.tileTypes)
      }
    }
  }
  return { grid: out, cleared }
}

function adjacent(a: number, b: number, c: any) {
  const ra = Math.floor(a / c.cols); const rb = Math.floor(b / c.cols)
  const ca = a % c.cols; const cb = b % c.cols
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1
}

/** 两次 tap 选中交换（乐龄友好，不依赖滑动） */
function tap(i: number) {
  if (busy.value || won.value || finishSent.value)
    return // 达标后等待结算，棋盘不再响应
  if (sel.value === null) { sel.value = i; return }
  if (sel.value === i) { sel.value = null; return }
  if (!adjacent(sel.value, i, cfg.value)) { sel.value = i; return }
  const a = sel.value
  const b = i
  sel.value = null
  busy.value = true
  const g = [...grid.value]
  ;[g[a], g[b]] = [g[b], g[a]]
  const m = findMatches(g, cfg.value)
  if (!m.size) {
    // 无匹配：保持原棋盘不变，仅回弹抖动提示（评审修复：此前误把交换后的棋盘写回，且不计步数可随意摆盘）
    shakeIdx.value = [a, b]
    setTimeout(() => {
      shakeIdx.value = []
      busy.value = false
    }, 350)
    return
  }
  moves.value += 1
  const r = resolve(g, cfg.value)
  grid.value = r.grid
  score.value += r.cleared * 10
  busy.value = false
  if (score.value >= cfg.value.targetScore)
    finish()
}

async function finish() {
  if (finishSent.value)
    return
  finishSent.value = true
  try {
    const res: any = await http.post('/app/games/match3/complete', { level: lv.value, moves: moves.value, score: score.value, seconds: Math.round((Date.now() - startedAt.value) / 1000) }, { silent: true })
    won.value = { ...res, next: (lv.value || 1) < d.value.levels.length ? lv.value! + 1 : null }
    if (!res.capped && res.points)
      popPoints(res.points)
    load()
  }
  catch (e: any) {
    // 评审修复：上报失败给明确提示并回选关，避免对局卡在"每走一步重复请求"的状态
    toast(e?.message || '结果提交失败，稍后再试')
    lv.value = null
  }
}

function nextLevel() {
  if (won.value?.next) {
    start(won.value.next)
  }
  else {
    won.value = null
    lv.value = null
  }
}
</script>

<template>
  <view :class="[xj.pageClass, `mo-${mo}`]">
    <view v-if="!d" class="page-loading col gap12">
      <view class="gd-spin spin-ring" />
      <text class="t-sm c2">加载中…</text>
    </view>
    <template v-else>
      <!-- 选关 -->
      <view v-if="!lv" class="page-head">
        <view class="ph-deco i-tabler-grid-dots" />
        <text class="ph-title">健康消消乐</text>
        <text class="ph-sub">三个相同连成一线即消除，通关得积分</text>
        <view class="ph-meta">
          <view><XIcon name="award" :size="14" />已通关 {{ d.maxLevel }} 关</view>
          <view><XIcon name="coins" :size="14" />今日还可得 {{ d.pointsLeftToday }} 分</view>
        </view>
      </view>
      <view v-if="!lv" class="card stack mo-rise mo-d1">
        <view class="section-title" style="margin-top: 0">
          <text>选择关卡</text>
        </view>
        <view v-for="l in d.levels" :key="l.level" class="lvrow row-between mo-press" :class="{ lock: l.level > d.maxLevel + 1 }" hover-class="mo-press-active" :hover-stay-time="80" @click="l.level <= d.maxLevel + 1 && start(l.level)">
          <view class="row gap8">
            <text class="lvno">{{ l.level }}</text>
            <view class="col">
              <text class="t-md semi">{{ l.rows }}×{{ l.cols }} · {{ l.tileTypes }} 种图标 · 目标 {{ l.targetScore }} 分</text>
              <text class="t-xs c3">{{ l.level <= 2 ? '小盘少色，轻松上手' : '大盘多色，动动脑筋' }}</text>
            </view>
          </view>
          <XIcon :name="l.level <= d.maxLevel + 1 ? 'chevron-right' : 'lock'" :size="20" />
        </view>
        <text class="t-xs c3">通关得 5 积分，每日上限 {{ d.dailyCap }} 分（今日还可得 {{ d.pointsLeftToday }} 分）。</text>
      </view>

      <!-- 对局 -->
      <view v-else class="stack">
        <view class="card stack mo-rise mo-d2">
          <view class="row-between">
            <text class="t-md semi">第 {{ lv }} 关 · {{ score }} / {{ cfg.targetScore }} 分</text>
            <text class="t-sm c2">步数 {{ moves }}</text>
          </view>
          <view class="bar">
            <view class="bar-in" :style="{ transform: `scaleX(${progress / 100})` }" />
          </view>
          <view class="board" :style="{ gridTemplateColumns: `repeat(${cfg.cols}, 1fr)` }">
            <view v-for="(t, i) in grid" :key="i" class="tile" :class="{ sel: sel === i, shake: shakeIdx.includes(i) && mo !== 'off' }" :style="{ fontSize: cfg.cols <= 5 ? '28px' : '21px' }" @click="tap(i)">
              <text>{{ TILES[t] }}</text>
            </view>
          </view>
          <text class="t-xs c3" style="text-align: center">点一下选中，再点相邻的交换 · 三个相同连成一线即消除</text>
        </view>
        <view class="btn plain mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="lv = null">
          返回选关
        </view>
      </view>

      <!-- 通关弹层 -->
      <view v-if="won" class="mask" @click="won = null">
        <view class="card stack won mo-pop" @click.stop>
          <text class="t-title">🎉 过关啦！</text>
          <text class="t-body c2">第 {{ lv }} 关完成，用了 {{ moves }} 步</text>
          <text class="t-lg semi">{{ won.capped ? '今日积分已领满，继续玩吧' : `+${won.points} 积分已入账` }}</text>
          <view class="row gap12">
            <view class="btn plain flex1 mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="start(lv!)">
              再玩一次
            </view>
            <view v-if="won.next" class="btn flex1 mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="nextLevel">
              下一关
            </view>
            <view v-else class="btn flex1 mo-press" hover-class="mo-press-active" :hover-stay-time="80" @click="nextLevel">
              全部通关
            </view>
          </view>
          <view v-if="float" :key="float.id" class="float-plus" :class="{ anim: mo !== 'off' }">
            {{ float.text }}
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.lvrow {
  padding: 14px 0;
  border-top: 1px solid var(--line);
  min-height: 60px;
}
.lvrow.lock {
  opacity: 0.45;
}
.lvno {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: linear-gradient(145deg, var(--brand-hi), var(--brand-dark));
  color: var(--on-brand);
  box-shadow: 0 4px 10px -4px rgba(168, 130, 77, 0.6);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bar {
  width: 100%;
  height: 10px;
  border-radius: 5px;
  background: var(--placeholder);
  overflow: hidden;
}
/* 进度条用 scaleX 而非 width 过渡（docs/08：只动 transform/opacity），时长随 --mo-* 档位变量降级 */
.bar-in {
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, var(--brand-soft), var(--brand));
  transform-origin: 0 50%;
  transition: transform var(--mo-base) var(--mo-ease);
}
.board {
  display: grid;
  gap: 6px;
  margin-top: 12px;
  padding: 8px;
  border-radius: 16px;
  background: var(--placeholder);
}
.tile {
  aspect-ratio: 1;
  border-radius: 12px;
  background: var(--surface);
  box-shadow:
    0 2px 6px -2px rgba(60, 48, 34, 0.25),
    inset 0 -2px 0 rgba(60, 48, 34, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
}
.tile.sel {
  background: var(--brand-soft);
  border: 2px solid var(--brand);
  transform: scale(0.94);
}
.tile.shake {
  animation: tile-shake 0.3s ease;
}
@keyframes tile-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  30% {
    transform: translateX(-4px);
  }
  60% {
    transform: translateX(4px);
  }
}
.mask {
  position: fixed;
  inset: 0;
  background: rgba(28, 23, 18, 0.5);
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.won {
  position: relative;
  width: 100%;
  max-width: 360px;
  text-align: center;
  align-items: center;
  gap: 10px;
}
/* 上浮积分气泡（通关 +N，与签到页 float-plus 同款 600ms 上浮淡出） */
.float-plus {
  position: absolute;
  top: 10px;
  right: 14px;
  font-size: 20px;
  font-weight: 700;
  color: var(--brand-ink);
}
.float-plus.anim {
  animation: float-up 600ms ease-out both;
}
@keyframes float-up {
  0% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(-30px);
    opacity: 0;
  }
}
/* 加载态（docs/09 §3.6）：功能性加载环，mo-off 下静止为静态环仍可识别 */
.page-loading {
  padding: 64px 0;
  align-items: center;
  justify-content: center;
}
.spin-ring {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid var(--line-2);
  border-top-color: var(--brand);
  box-sizing: border-box;
}
</style>
