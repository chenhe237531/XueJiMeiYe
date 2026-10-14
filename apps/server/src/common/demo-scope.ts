import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * 演示副本在管理端 / 医院端的可见范围。
 * 每台设备进入演示账号都会复制一整套演示客户（含历史预警、方案、体检券等），
 * 如果全部出现在后台，预警、待审核方案、看板数字都会成倍重复。
 * 所以副本默认对员工隐藏，访客做了需要员工跟进的事（开始测评、预约、提交意向等）后才显示。
 */
export const staffView = new AsyncLocalStorage<boolean>()

/** 带 customerId 的客户数据表（Prisma 模型名，首字母小写） */
export const CUSTOMER_SCOPED = new Set([
  'customerLabel', 'healthTag', 'consentRecord', 'consumption', 'tierHistory', 'assessment', 'measurement', 'record', 'report', 'plan', 'coupon',
  'referral', 'lead', 'pointsLedger', 'gameProgress', 'checkin', 'riskAlert', 'task', 'serviceCheck', 'mirrorSession', 'mirrorMessage', 'mirrorMemory',
  'message', 'auditLog', 'eventLog', 'healthIntake', 'followup',
])

/** 访客做了这些事，副本就出现在后台（都是员工需要看到或跟进的） */
export const DEMO_SHOW_EVENTS = new Set([
  'assessment_start', 'lead_submit', 'booking_submit', 'mirror_risk_alert', 'groupbuy_open', 'groupbuy_join', 'family_invite', 'family_bind', 'points_redeem',
])

let cache: { ids: number[], at: number } | null = null

/** 隐藏中的演示副本 id（缓存 5 秒；副本显示时立即失效） */
export async function hiddenDemoIds(load: () => Promise<number[]>) {
  if (!cache || Date.now() - cache.at > 5000) cache = { ids: await load(), at: Date.now() }
  return cache.ids
}

export function invalidateHiddenDemo() {
  cache = null
}
