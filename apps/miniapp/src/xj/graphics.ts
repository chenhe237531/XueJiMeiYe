/**
 * 彩色图形注册表（开源资源，来源与许可见 src/icons/graphics/LICENSE.md）。
 *
 * 与 `XIcon` 的分工：
 *   - `XIcon`   → Tabler 单色图标，走 UnoCSS **mask** 模式，颜色跟随 `color`（可换肤、可改色）。
 *     适合：导航箭头、勾选、表单等**功能性**图标。
 *   - `XGraphic` → Fluent Emoji 彩色图形，走 UnoCSS **bg** 模式，颜色由图形自带（不可改色）。
 *     适合：六维、徽章、玩法、情绪等**情感化与识别性**位置。
 *
 * 关键技术前提：UnoCSS 的图标模式是 `auto` —— SVG 里出现 `currentColor` 就判定为 mask（单色），
 * 否则判定为 bg（保留彩色）。本目录下的图形全部为硬编码 fill，因此自动保留彩色。
 * 详见 `docs/09` 与 `scripts/fetch-graphics.js` 的注释。
 *
 * ⚠️ 维护要求：值必须写成**完整类名字面量**，不能拼接（如 `` `i-graphics-${name}` ``），
 * 否则 UnoCSS 静态扫描不到，图标不会生成。`uno.config.ts` 的 safelist 做了冗余登记。
 */
export const GRAPHICS = {
  // ── 六维（与 xj/utils.ts 的 DIMS 一一对应）──
  'dim-skin': 'i-graphics-dim-skin',
  'dim-shape': 'i-graphics-dim-shape',
  'dim-contour': 'i-graphics-dim-contour',
  'dim-fitness': 'i-graphics-dim-fitness',
  'dim-posture': 'i-graphics-dim-posture',
  'dim-mind': 'i-graphics-dim-mind',

  // ── 成就徽章 ──
  'badge-trophy': 'i-graphics-badge-trophy',
  'badge-medal-gold': 'i-graphics-badge-medal-gold',
  'badge-medal-honor': 'i-graphics-badge-medal-honor',
  'badge-star': 'i-graphics-badge-star',
  'badge-fire': 'i-graphics-badge-fire',
  'badge-crown': 'i-graphics-badge-crown',
  'badge-clover': 'i-graphics-badge-clover',

  // ── 互动玩法 ──
  'play-gift': 'i-graphics-play-gift',
  'play-celebrate': 'i-graphics-play-celebrate',
  'play-wand': 'i-graphics-play-wand',
  'play-ball': 'i-graphics-play-ball',
  'play-dice': 'i-graphics-play-dice',
  'play-ticket': 'i-graphics-play-ticket',
  'play-balloon': 'i-graphics-play-balloon',
  'play-sparkle': 'i-graphics-play-sparkle',
  'play-ring': 'i-graphics-play-ring',

  // ── 健康行为与状态 ──
  'care-salad': 'i-graphics-care-salad',
  'care-pill': 'i-graphics-care-pill',
  'care-stethoscope': 'i-graphics-care-stethoscope',
  'care-moon': 'i-graphics-care-moon',
  'care-sun': 'i-graphics-care-sun',
  'care-bell': 'i-graphics-care-bell',
  'care-wait': 'i-graphics-care-wait',
  'care-done': 'i-graphics-care-done',
  'care-cross': 'i-graphics-care-cross',
  'care-warn': 'i-graphics-care-warn',
  'care-heart': 'i-graphics-care-heart',
  'care-up': 'i-graphics-care-up',
  'care-chart': 'i-graphics-care-chart',
  'care-seed': 'i-graphics-care-seed',

  // ── 沟通 / 门店 / 文档 ──
  'talk-bubble': 'i-graphics-talk-bubble',
  'talk-megaphone': 'i-graphics-talk-megaphone',
  'store-bag': 'i-graphics-store-bag',
  'store-house': 'i-graphics-store-house',
  'doc-memo': 'i-graphics-doc-memo',
  'doc-calendar': 'i-graphics-doc-calendar',
  'doc-scroll': 'i-graphics-doc-scroll',

  // ── 情绪 / 人格化 ──
  'mood-smile': 'i-graphics-mood-smile',
  'mood-love': 'i-graphics-mood-love',
  'mood-think': 'i-graphics-mood-think',
  'mood-hug': 'i-graphics-mood-hug',
} as const

export type GraphicName = keyof typeof GRAPHICS

/** 六维 code（xj/utils.ts 的 DIMS.code）→ 彩色图形名 */
export const DIM_GRAPHIC: Record<string, GraphicName> = {
  skin: 'dim-skin',
  shape: 'dim-shape',
  contour: 'dim-contour',
  fitness: 'dim-fitness',
  posture: 'dim-posture',
  mind: 'dim-mind',
}

/** 运行期校验：传入未知图形名时返回 undefined，由组件回退到单色图标，避免出现空白 */
export function graphicClass(name?: string): string | undefined {
  if (!name)
    return undefined
  return (GRAPHICS as Record<string, string>)[name]
}
