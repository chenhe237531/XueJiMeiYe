<script lang="ts">
// 纯逻辑编排层以 .vue 承载（本卡 files_own 约定）：默认导出空组件占位，不渲染任何 UI，渲染由 HomeRender 完成
export default {}
/**
 * HomeGate · 首页组件启用矩阵编排层（XJ-202 / docs/07 §4.1）
 *
 * 不渲染任何 UI，只导出矩阵配置与 applyMatrix 编排函数，供 HomeRender 调用。
 * 后端 home.service.resolve 已按 layout 表输出 components，本层做**前端兜底**：
 * ① 当后端配置与 §4.1 矩阵不符时（如 A 级布局误配 checkinBar、乐龄被自动补 taskList），
 *   按用户状态过滤掉不该出现的组件；
 * ② 后端 layout 不下发的矩阵专属卡（访客测评引导/门店品牌、B 结伴/升级进度、
 *   A 顾问/权益/年报）由本层注入，确保四类用户首屏与 §4.1 矩阵逐项一致。
 *
 * 矩阵（✓=显示，✗=过滤）—— 对齐 docs/07 §4.1：
 *   组件          访客  C悦享  B尊享  A臻享  乐龄
 *   greeting       ✓    ✓     ✓     ✓     ✗(并入elderToday)
 *   elderToday     ✗    ✗     ✗     ✗     ✓
 *   checkinBar     ✗    ✓     ✗     ✗     ✗
 *   taskList       ✗    ✓     ✗     ✗     ✗(乐龄弱化游戏化)
 *   healthCard     ✗    ✓     ✓     ✓     ✓(并入elderToday)
 *   tierCard       ✗    ✓     ✗     ✗     ✗
 *   tierProgress   ✗    ✗     ✓     ✗     ✗
 *   advisorCard    ✗    ✗     ✗     ✓     ✗
 *   benefitGrid    ✗    ✗     ✗     ✓     ✗
 *   annualReport   ✗    ✗     ✗     ✓     ✗
 *   groupCard      ✗    ✗     ✓     ✗     ✗
 *   entryGrid      ✗    4列   4列   ✗     3列
 *   banner         ✗    ✓     ✓     ✗     ✗
 *   moduleList     ✗    ✓     ✓     ✓     ✓
 *   activityCard   ✗    ✓     ✓     ✓私享  ✗
 *   notice         —    —     —     —     —(全状态都显示，通告性质)
 *   mirrorFab      ✗    ✓     ✓     ✓     语音条(乐龄仍保留 fab)
 *   assessGuide    ✓    ✗     ✗     ✗     ✗(访客专属)
 *   storeBrand     ✓    ✗     ✗     ✗     ✗(访客专属)
 *
 * 编排不改变后端已排好的顺序（XJ-305 personalization），只做两件事：
 * 过滤「不该出现的」+ 注入「矩阵要求但后端未下发的」，插入位置按 §4.2 各变体首屏主张。
 */
export interface GateState {
  tier: string // 'A' | 'B' | 'C' | ''(访客)
  isGuest: boolean
  elder: boolean
}

/** §4.1 矩阵：组件类型 → 各状态是否显示。true=允许，false=过滤。 */
const MATRIX: Record<string, { guest?: boolean, C?: boolean, B?: boolean, A?: boolean, elder?: boolean }> = {
  greeting: { guest: true, C: true, B: true, A: true, elder: false },
  elderToday: { guest: false, C: false, B: false, A: false, elder: true },
  checkinBar: { guest: false, C: true, B: false, A: false, elder: false },
  taskList: { guest: false, C: true, B: false, A: false, elder: false },
  healthCard: { guest: false, C: true, B: true, A: true, elder: true },
  tierCard: { guest: false, C: true, B: false, A: false, elder: false },
  tierProgress: { guest: false, C: false, B: true, A: false, elder: false },
  advisorCard: { guest: false, C: false, B: false, A: true, elder: false },
  benefitGrid: { guest: false, C: false, B: false, A: true, elder: false },
  annualReport: { guest: false, C: false, B: false, A: true, elder: false },
  groupCard: { guest: false, C: false, B: true, A: false, elder: false },
  entryGrid: { guest: false, C: true, B: true, A: false, elder: true },
  banner: { guest: false, C: true, B: true, A: false, elder: false },
  moduleList: { guest: false, C: true, B: true, A: true, elder: true },
  activityCard: { guest: false, C: true, B: true, A: true, elder: false },
  notice: { guest: true, C: true, B: true, A: true, elder: true },
  mirrorFab: { guest: false, C: true, B: true, A: true, elder: true },
  divider: { guest: true, C: true, B: true, A: true, elder: true },
  // 访客专属
  assessGuide: { guest: true, C: false, B: false, A: false, elder: false },
  storeBrand: { guest: true, C: false, B: false, A: false, elder: false },
}

/** A 级六项权益（§4.1 benefitGrid「✓（6 项）」）：后端 layout 不下发 benefitGrid，前端兜底常量，文案与 TIER_BENEFITS.A 对齐 */
const A_BENEFITS = [
  { icon: 'headset', text: '专属顾问 4 小时内响应' },
  { icon: 'plane', text: '海外 VIP 通道' },
  { icon: 'car', text: '接送车' },
  { icon: 'heart-rate-monitor', text: '高端体检与优先号源' },
  { icon: 'gift', text: '私享活动与礼盒' },
  { icon: 'report-medical', text: '年度个人健康报告' },
]

function stateKey(state: GateState) {
  return state.elder
    ? 'elder'
    : state.isGuest
      ? 'guest'
      : (state.tier || 'C')
}

/** 按 §4.1 矩阵过滤 components，返回该用户状态应显示的组件列表（保留后端顺序） */
export function gateLayout(components: any[], state: GateState): any[] {
  const key = stateKey(state)
  return (components || []).filter((c) => {
    const row = MATRIX[c.type]
    // 矩阵未列的组件类型（如自定义扩展）默认放行，保证后端下发不丢
    if (!row)
      return true
    return row[key] !== false
  })
}

/**
 * 各状态需前端兜底注入的矩阵专属卡（后端 layout 不下发这些类型，XJ-202 编排层补齐）：
 * after = 插在该类型最后一次出现之后，未找到时插到首位。
 */
const INJECT: Record<string, { type: string, after: string, props?: Record<string, any> }[]> = {
  guest: [
    { type: 'assessGuide', after: 'greeting' },
    { type: 'storeBrand', after: 'assessGuide' },
  ],
  B: [
    { type: 'groupCard', after: 'greeting' },
    { type: 'tierProgress', after: 'healthCard', props: { progress: '了解升级路径' } },
  ],
  A: [
    { type: 'advisorCard', after: 'greeting' },
    { type: 'benefitGrid', after: 'healthCard', props: { items: A_BENEFITS } },
    { type: 'annualReport', after: 'benefitGrid' },
  ],
}

/**
 * §4.1 编排入口：先按矩阵过滤（不该出现的不出现），清理「后面没有实质内容」的孤儿分组标题
 * （与后端 home.service 的 cleaned 规则一致，避免访客态过滤后残留光秃 divider），
 * 最后兜底注入后端未下发的矩阵专属卡（访客测评引导/门店品牌、B 结伴/升级进度、
 * A 顾问/权益/年报），顺序与 §4.2 各变体首屏主张一致。
 */
export function applyMatrix(components: any[], state: GateState): any[] {
  const gated = gateLayout(components, state)
  const out = gated.filter((c, i) => c.type !== 'divider' || (gated[i + 1] && !['divider', 'mirrorFab'].includes(gated[i + 1].type)))
  for (const inj of INJECT[stateKey(state)] || []) {
    if (out.some(c => c.type === inj.type))
      continue // 后端已下发同类型组件时不重复注入
    const at = out.map(c => c.type).lastIndexOf(inj.after)
    out.splice(at + 1, 0, { type: inj.type, props: { ...(inj.props || {}) } })
  }
  return out
}

/** 供 HomeRender 的 KNOWN 白名单补全：矩阵涉及的全部类型 */
export const GATE_TYPES = Object.keys(MATRIX)
</script>

<template>
  <view />
</template>
