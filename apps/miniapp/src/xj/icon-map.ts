/**
 * 后端语义图标枚举 → 前端图形映射层（D15 / XJ-602）。
 *
 * XIcon / XGraphic 的选用准则（docs/09 §3.7，全站适用）：
 *   - 功能性图标（箭头 / 勾选 / 表单 / tabbar）→ XIcon 单色（mask 模式），
 *     颜色跟随主题令牌，参与选中态与换肤语义——永不彩色化；
 *   - 情感化与识别性图形（六维 / 待办 / 菜单语义位）→ XGraphic 彩色（bg 模式），
 *     自带颜色不可改，深色皮肤下靠浅色底座（chip）保证对比度。
 *
 * 后端只下发语义枚举（apps/server/src/common/icon-enum.ts 的 ICON_ENUMS，共 14 个），
 * 本表负责「枚举 → 图形」的最后一公里；未收录枚举 / 空值一律回退单色 XIcon，绝不出现空白。
 * 新增枚举必须同批补 GRAPHIC_MAP / ICON_MAP 两表与 uno safelist（XJ-602 探针做全量覆盖断言）。
 */
import { graphicClass } from './graphics'
import type { GraphicName } from './graphics'

/** 枚举 → 彩色图形（XGraphic）。值必须是 xj/graphics.ts 的 GRAPHICS 键，运行期会经注册表二次校验 */
const GRAPHIC_MAP: Record<string, GraphicName> = {
  skin: 'dim-skin',
  body: 'dim-shape',
  contour: 'dim-contour',
  fitness: 'dim-fitness',
  posture: 'dim-posture',
  mind: 'dim-mind',
  assess: 'care-chart',
  checkin: 'doc-calendar',
  checkup: 'care-stethoscope',
  plan: 'doc-memo',
  points: 'play-gift',
  family: 'mood-hug',
  store: 'store-bag',
  know: 'doc-scroll',
}

/**
 * 枚举 → 单色图标（XIcon，tabler 图名）。
 * 彩色图形未命中 / 图形注册表缺名的降级通道，全部在 uno.config.ts safelist 内。
 */
const ICON_MAP: Record<string, string> = {
  skin: 'droplet',
  body: 'run',
  contour: 'flower',
  fitness: 'heartbeat',
  posture: 'user',
  mind: 'mood-smile',
  assess: 'hexagon',
  checkin: 'calendar-check',
  checkup: 'ticket',
  plan: 'clipboard-heart',
  points: 'coins',
  family: 'users',
  store: 'building-store',
  know: 'bulb',
}

/** 未收录枚举 / 空值的最终兜底（与 HomeTasks / HomeElder 的既有兜底一致） */
export const FALLBACK_ICON = 'circle-check'

export interface SemanticIcon {
  /** 彩色图形名（XGraphic），无彩色资源时为 undefined，调用方据此回退 XIcon */
  graphic?: GraphicName
  /** 单色图标名（XIcon），恒有值——彩色未命中 / 未收录枚举时的呈现，保证不出现空白 */
  icon: string
}

/**
 * 语义枚举 → 前端图标解析。graphic 经 graphics.ts 注册表二次校验：
 * 映射表写错图形名时退化为单色兜底而不是渲染空白块（XGraphic 对未知名不渲染任何节点）。
 */
export function resolveSemanticIcon(name?: string): SemanticIcon {
  const g = GRAPHIC_MAP[name || '']
  const graphic = g && graphicClass(g) ? g : undefined
  return { graphic, icon: ICON_MAP[name || ''] || FALLBACK_ICON }
}
