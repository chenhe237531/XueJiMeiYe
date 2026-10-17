/**
 * 后端下发的图标语义枚举（D15 / XJ-602）。
 *
 * 图标名属表现层，后端返回图标名等于把视觉实现泄露进数据契约（issues/DECISIONS.md D15）：
 * 换一次图形就要改一次接口。故面向小程序的待办 / 菜单位（首页 todos、我的页 quick·menus）
 * icon 字段只允许返回本文件的枚举值，具体图形由前端 `xj/icon-map.ts` 映射：
 *   枚举命中彩色图形 → XGraphic（bg 模式彩色）；未命中 / 未收录 → 回退 XIcon 单色，不出现空白。
 *
 * 收录范围 = D15 约定的 12 个语义位 + home.service（XJ-305）已在下发的 2 个遗留值
 * （assess / checkin），共 14 个。枚举值只增不删不换义（旧客户端会缓存历史下发值）；
 * 新增枚举必须同批更新前端映射表与 uno safelist（XJ-602 探针做全量覆盖断言）。
 */

/** 语义枚举全集：六维 6 个 + 行为与权益位 6 个 + 遗留值 2 个 */
export const ICON_ENUMS = [
  // ── 六维相关（与六维维度 code 对齐：body 对应体型 shape，其余同名）──
  'skin',
  'body',
  'contour',
  'fitness',
  'posture',
  'mind',
  // ── 行为与权益位（首页 todos / 我的页 quick·menus）──
  'checkup',
  'plan',
  'points',
  'family',
  'store',
  'know',
  // ── 遗留值：home.service（XJ-305）已按此下发，收录进契约保证映射全覆盖 ──
  'assess',
  'checkin',
] as const

export type IconEnum = (typeof ICON_ENUMS)[number]

/** 校验字符串是否为已收录的语义枚举（种子数据 / 出参守卫用，防手滑写出表外值） */
export function isIconEnum(v: unknown): v is IconEnum {
  return typeof v === 'string' && (ICON_ENUMS as readonly string[]).includes(v)
}
