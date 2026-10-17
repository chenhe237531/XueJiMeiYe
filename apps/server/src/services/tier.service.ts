import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { PrismaService } from '../common/prisma.service'
import { Err } from '../common/response'
import { fmt, genNo, TIER_NAMES } from '../common/util'
import { WorkflowService } from './workflow.service'

const ORDER: Record<string, number> = { C: 0, B: 1, A: 2 }

/** 连续天数：从今天（或昨天）往回数连续命中的日期，与 /app/checkins 的 streak 口径一致 */
function streakOf(dates: string[]) {
  const set = new Set(dates)
  let d = set.has(dayjs().format('YYYY-MM-DD')) ? dayjs() : dayjs().subtract(1, 'day')
  let n = 0
  while (set.has(d.format('YYYY-MM-DD'))) { n++; d = d.subtract(1, 'day') }
  return n
}

/** 徽章组（D2：坚持 8 / 探索 8 / 分享 8） */
export const BADGE_GROUP_NAMES: Record<string, string> = { keep: '坚持', explore: '探索', share: '分享' }

export interface BadgeDef {
  code: string
  group: 'keep' | 'explore' | 'share'
  name: string
  /** 已解锁态彩色图形名（前端 xj/graphics.ts，XBadge 的 icon） */
  icon: string
  /** 未解锁态 Tabler 线稿图标名（XBadge 的 outline，XJ-403 需登记 safelist） */
  outline: string
  /** 解锁条件文案（徽章详情展示） */
  desc: string
  target: number
  /** badgeStats() 返回的统计键 */
  stat: string
}

/**
 * D2 定稿 24 枚徽章目录（XJ-303 集中配置，供前端 XJ-403 XBadge 消费）。
 * 解锁条件全部由既有数据推导：签到 / 积分流水 / 测评 / 档案 / 家人绑定 / 接力 / 集章。
 * XJ-301 seed 的 5 个演示 code（keep_checkin_7 / keep_checkin_30 / explore_first_assessment /
 * explore_checkup_return / share_family_bind）已原样收编，演示数据无缝过渡。
 */
export const BADGES: BadgeDef[] = [
  // ── 坚持：习惯与陪伴 ──
  { code: 'keep_checkin_7', group: 'keep', name: '初见成效', icon: 'badge-fire', outline: 'flame', desc: '连续签到 7 天', target: 7, stat: 'checkinStreak' },
  { code: 'keep_checkin_30', group: 'keep', name: '持之以恒', icon: 'badge-medal-gold', outline: 'calendar', desc: '连续签到 30 天', target: 30, stat: 'checkinStreak' },
  { code: 'keep_checkin_total_50', group: 'keep', name: '五十而立', icon: 'badge-trophy', outline: 'trophy', desc: '累计签到 50 天', target: 50, stat: 'checkinDays' },
  { code: 'keep_water_30', group: 'keep', name: '细水长流', icon: 'care-salad', outline: 'glass', desc: '累计 30 天完成喝水打卡', target: 30, stat: 'waterDays' },
  { code: 'keep_exercise_30', group: 'keep', name: '动则生阳', icon: 'care-up', outline: 'run', desc: '累计 30 天完成运动打卡', target: 30, stat: 'exerciseDays' },
  { code: 'keep_plan_daily_20', group: 'keep', name: '知行合一', icon: 'care-done', outline: 'checklist', desc: '累计 20 天完成方案日常小事', target: 20, stat: 'planDays' },
  { code: 'keep_mirror_30', group: 'keep', name: '日日相伴', icon: 'talk-bubble', outline: 'message-circle', desc: '累计 30 天与小镜聊天', target: 30, stat: 'mirrorDays' },
  { code: 'keep_quiz_100', group: 'keep', name: '学而不倦', icon: 'doc-memo', outline: 'book', desc: '每日问答累计答对 100 题', target: 100, stat: 'quizCorrect' },
  // ── 探索：测评 / 体检 / 档案 / 玩法 ──
  { code: 'explore_first_assessment', group: 'explore', name: '初识六维', icon: 'care-chart', outline: 'chart-dots', desc: '完成首次六维测评', target: 1, stat: 'assessments' },
  { code: 'explore_assessment_5', group: 'explore', name: '常测常新', icon: 'badge-star', outline: 'star', desc: '完成 5 次六维测评', target: 5, stat: 'assessments' },
  { code: 'explore_checkup_return', group: 'explore', name: '健康回访', icon: 'care-stethoscope', outline: 'stethoscope', desc: '到店完成体检或服务', target: 1, stat: 'visits' },
  { code: 'explore_profile_full', group: 'explore', name: '档案齐全', icon: 'doc-scroll', outline: 'id', desc: '补全称呼、出生年份与性别', target: 3, stat: 'profile' },
  { code: 'explore_game_tree', group: 'explore', name: '健康园丁', icon: 'care-seed', outline: 'tree', desc: '健康树首次长成', target: 1, stat: 'trees' },
  { code: 'explore_match3_10', group: 'explore', name: '妙手连连', icon: 'play-ball', outline: 'ball', desc: '消消乐累计通过 10 关', target: 10, stat: 'match3' },
  { code: 'explore_redeem_first', group: 'explore', name: '果实兑换', icon: 'play-ticket', outline: 'ticket', desc: '首次用积分兑换好礼', target: 1, stat: 'redeems' },
  { code: 'explore_points_1000', group: 'explore', name: '千分之旅', icon: 'badge-crown', outline: 'crown', desc: '累计获得 1000 积分', target: 1000, stat: 'earnedPoints' },
  // ── 分享：家人接力与门店足迹 ──
  { code: 'share_family_bind', group: 'share', name: '家人相守', icon: 'mood-hug', outline: 'heart', desc: '绑定 1 位家人', target: 1, stat: 'family' },
  { code: 'share_family_3', group: 'share', name: '阖家安康', icon: 'mood-love', outline: 'users-group', desc: '绑定 3 位家人', target: 3, stat: 'family' },
  { code: 'share_relay_first', group: 'share', name: '接力首棒', icon: 'play-ring', outline: 'activity', desc: '完成首次健康接力', target: 1, stat: 'relays' },
  { code: 'share_relay_20', group: 'share', name: '薪火相传', icon: 'play-celebrate', outline: 'award', desc: '累计参与 20 天健康接力', target: 20, stat: 'relays' },
  { code: 'share_relay_streak_7', group: 'share', name: '七日同频', icon: 'play-sparkle', outline: 'sparkles', desc: '连续 7 天与家人接力', target: 7, stat: 'relayStreak' },
  { code: 'share_stamp_first', group: 'share', name: '足迹初启', icon: 'store-house', outline: 'building-store', desc: '集得首枚门店印章', target: 1, stat: 'stamps' },
  { code: 'share_stamp_3', group: 'share', name: '三店巡礼', icon: 'badge-clover', outline: 'clover', desc: '集得 3 家门店印章', target: 3, stat: 'stampStores' },
  { code: 'share_stamp_12', group: 'share', name: '岁岁集章', icon: 'badge-medal-honor', outline: 'medal', desc: '累计集得 12 枚门店印章', target: 12, stat: 'stamps' },
]

/** 客户分级（4.1、9.7） */
@Injectable()
export class TierService {
  constructor(private prisma: PrismaService, private wf: WorkflowService) {}

  async activeRule() {
    return this.prisma.tierRule.findFirst({ where: { status: 'active' }, orderBy: { version: 'desc' } })
  }

  /** 近 N 个月实付金额（按计入类别） */
  async spendMap(windowMonths = 12, categories: string[] = ['service', 'card', 'product']) {
    const since = dayjs().subtract(windowMonths, 'month').toDate()
    const rows = await this.prisma.consumption.groupBy({ by: ['customerId'], where: { paidAt: { gte: since }, category: { in: categories } }, _sum: { paidAmount: true } })
    const map = new Map<number, number>()
    rows.forEach(r => map.set(r.customerId, r._sum.paidAmount || 0))
    return map
  }

  /** 4.1.2 首批阈值：排名 10% 处为 T_A、40% 处为 T_B，取整到百元；并模拟各等级人数 */
  async simulate(input: { thresholdA?: number, thresholdB?: number, categories?: string[], windowMonths?: number }) {
    const categories = input.categories || ['service', 'card', 'product']
    const spend = await this.spendMap(input.windowMonths || 12, categories)
    const customers = await this.prisma.customer.findMany({ where: { status: 'active' } })
    const amounts = customers.map(c => spend.get(c.id) || 0).sort((x, y) => y - x)
    const at = (p: number) => amounts[Math.min(amounts.length - 1, Math.max(0, Math.floor(amounts.length * p) - 1))] || 0
    const suggestA = Math.round(at(0.1) / 100) * 100
    const suggestB = Math.round(at(0.4) / 100) * 100
    const tA = input.thresholdA ?? suggestA
    const tB = input.thresholdB ?? suggestB
    const dist = { A: 0, B: 0, C: 0 }
    customers.forEach((c) => {
      const amt = spend.get(c.id) || 0
      dist[amt >= tA ? 'A' : amt >= tB ? 'B' : 'C']++
    })
    const total = customers.length || 1
    return {
      total: customers.length, thresholdA: tA, thresholdB: tB, suggestA, suggestB,
      distribution: (['A', 'B', 'C'] as const).map(k => ({ tier: k, count: dist[k], ratio: Math.round((dist[k] / total) * 1000) / 10 })),
      histogram: this.histogram(amounts),
    }
  }

  private histogram(amounts: number[]) {
    const buckets = [0, 2000, 5000, 10000, 20000, 50000, 100000, Infinity]
    return buckets.slice(0, -1).map((lo, i) => ({ label: buckets[i + 1] === Infinity ? `${lo / 10000}万+` : `${lo >= 10000 ? `${lo / 10000}万` : lo}-${buckets[i + 1] >= 10000 ? `${buckets[i + 1] / 10000}万` : buckets[i + 1]}`, count: amounts.filter(a => a >= lo && a < buckets[i + 1]).length }))
  }

  async publish(body: { thresholdA: number, thresholdB: number, categories?: string[], keepMonths?: number }, operator: string) {
    if (!(body.thresholdA > body.thresholdB)) throw Err.bad('T_A 必须大于 T_B')
    const last = await this.prisma.tierRule.findFirst({ orderBy: { version: 'desc' } })
    await this.prisma.tierRule.updateMany({ where: { status: 'active' }, data: { status: 'retired' } })
    const sim = await this.simulate(body)
    const rule = await this.prisma.tierRule.create({
      data: { version: (last?.version || 0) + 1, categories: body.categories || ['service', 'card', 'product'], thresholdA: body.thresholdA, thresholdB: body.thresholdB, keepMonths: body.keepMonths || 3, simulateResult: sim, status: 'active', publishedBy: operator, publishedAt: new Date() },
    })
    const changed = await this.recalc({ monthly: true })
    return { rule, changed }
  }

  /** 每日升级检查 / 每月全量重算（降级先设 3 个月保级期） */
  async recalc(opts: { monthly?: boolean } = {}) {
    const rule = await this.activeRule()
    if (!rule) return { up: 0, down: 0, keep: 0 }
    const spend = await this.spendMap(rule.windowMonths, rule.categories as string[])
    const customers = await this.prisma.customer.findMany({ where: { status: 'active' } })
    let up = 0
    let down = 0
    let keep = 0
    for (const c of customers) {
      if (c.isDemo || c.demoOf) continue
      if (c.tierLockedUntil && c.tierLockedUntil > new Date()) continue
      const amt = spend.get(c.id) || 0
      const target = amt >= rule.thresholdA ? 'A' : amt >= rule.thresholdB ? 'B' : 'C'
      if (ORDER[target] > ORDER[c.tier]) {
        await this.prisma.customer.update({ where: { id: c.id }, data: { tier: target, tierKeepUntil: null } })
        await this.prisma.tierHistory.create({ data: { customerId: c.id, fromTier: c.tier, toTier: target, reason: 'auto_up', note: `近 12 个月实付 ¥${amt.toFixed(0)}` } })
        await this.wf.message(c.id, '会员等级升级', `恭喜您升级为${target === 'A' ? '臻享' : '尊享'}会员，可以在"我的 - 会员等级与权益"查看新权益。`, '/pkg-me/tier')
        up++
      }
      else if (ORDER[target] < ORDER[c.tier] && opts.monthly) {
        if (!c.tierKeepUntil) {
          await this.prisma.customer.update({ where: { id: c.id }, data: { tierKeepUntil: dayjs().add(rule.keepMonths, 'month').toDate() } })
          keep++
        }
        else if (c.tierKeepUntil < new Date()) {
          await this.prisma.customer.update({ where: { id: c.id }, data: { tier: target, tierKeepUntil: null } })
          await this.prisma.tierHistory.create({ data: { customerId: c.id, fromTier: c.tier, toTier: target, reason: 'auto_down' } })
          down++
        }
      }
    }
    return { up, down, keep }
  }

  async manualAdjust(customerId: number, tier: string, note: string, operator: string) {
    if (!note) throw Err.bad('人工调整必须填写原因')
    const c = await this.prisma.customer.findUnique({ where: { id: customerId } })
    if (!c) throw Err.notFound()
    await this.prisma.customer.update({ where: { id: customerId }, data: { tier, tierLockedUntil: dayjs().add(6, 'month').toDate(), tierKeepUntil: null } })
    await this.prisma.tierHistory.create({ data: { customerId, fromTier: c.tier, toTier: tier, reason: 'manual', note, operator } })
    return { ok: true }
  }

  /** 6.2.20 消费流水导入：预检 → 导入 → 触发等级重算 */
  async importConsumption(rows: any[], operator: string, dryRun = false) {
    const stores = await this.prisma.store.findMany()
    const report = { total: rows.length, ok: 0, duplicate: 0, invalid: 0, newCustomers: 0, errors: [] as string[] }
    const batch = dryRun ? null : await this.prisma.importBatch.create({ data: { kind: 'consumption', total: rows.length, createdBy: operator } })
    for (const [i, r] of rows.entries()) {
      const phone = `${r.phone || ''}`.trim()
      const amount = Number(r.paid_amount)
      if (!r.ext_order_no || !/^1\d{10}$/.test(phone) || Number.isNaN(amount) || !r.paid_at) {
        report.invalid++
        report.errors.push(`第 ${i + 2} 行：字段不完整或格式错误`)
        continue
      }
      const dup = await this.prisma.consumption.findUnique({ where: { extOrderNo: `${r.ext_order_no}` } })
      if (dup) { report.duplicate++; continue }
      if (dryRun) { report.ok++; continue }
      const store = stores.find(s => s.code === r.store_code) || stores[0]
      let customer = await this.prisma.customer.findUnique({ where: { phone } })
      if (!customer) {
        let advisorId: number | undefined
        if (r.advisor_name) advisorId = (await this.prisma.staff.findFirst({ where: { name: r.advisor_name } }))?.id
        customer = await this.prisma.customer.create({ data: { customerNo: genNo('C'), phone, extCustomerId: r.customer_ext_id ? `${r.customer_ext_id}` : null, name: r.name || null, salutation: r.name ? `${`${r.name}`.slice(0, 1)}女士` : '尊敬的客户', storeId: store.id, advisorId, source: 'import' } })
        report.newCustomers++
      }
      await this.prisma.consumption.create({ data: { extOrderNo: `${r.ext_order_no}`, customerId: customer.id, storeId: store.id, category: r.category || 'service', paidAmount: amount, paidAt: new Date(r.paid_at), batchId: batch!.id } })
      report.ok++
    }
    let tier: any = null
    if (!dryRun) {
      tier = await this.recalc()
      await this.prisma.importBatch.update({ where: { id: batch!.id }, data: { success: report.ok, failed: report.invalid, report: { ...report, tier } } })
    }
    return { ...report, tier, batchId: batch?.id }
  }

  // ───────────── 成就徽章（XJ-303，docs/07 §3.3 / §8） ─────────────

  /** 徽章解锁条件的全部数据源，一次并行取齐 */
  private async badgeStats(customerId: number) {
    const [customer, checkins, mirrorMsgs, quizCorrect, visits, trees, match3, redeems, earnSum, assessments, family, relays, stamps] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: customerId }, select: { salutation: true, birthYear: true, gender: true } }),
      this.prisma.checkin.findMany({ where: { customerId }, select: { type: true, date: true } }),
      this.prisma.mirrorMessage.findMany({ where: { customerId, role: 'user' }, select: { createdAt: true } }),
      this.prisma.pointsLedger.count({ where: { customerId, reasonCode: 'quiz' } }),
      this.prisma.pointsLedger.count({ where: { customerId, reasonCode: 'visit' } }),
      this.prisma.pointsLedger.count({ where: { customerId, reasonCode: 'game_tree' } }),
      this.prisma.pointsLedger.count({ where: { customerId, reasonCode: 'match3' } }),
      this.prisma.pointsLedger.count({ where: { customerId, reasonCode: 'redeem' } }),
      this.prisma.pointsLedger.aggregate({ _sum: { change: true }, where: { customerId, change: { gt: 0 } } }),
      this.prisma.assessment.count({ where: { customerId, status: 'completed' } }),
      this.prisma.familyLink.count({ where: { OR: [{ elderId: customerId }, { familyId: customerId }], status: 'active' } }),
      this.prisma.familyRelay.findMany({ where: { OR: [{ customerId }, { peerId: customerId }] }, select: { date: true } }),
      this.prisma.storeStamp.findMany({ where: { customerId }, select: { storeId: true } }),
    ])
    // 签到 / 接力按「天」计：同一天多类型打卡只算一个签到日
    const signedDays = [...new Set(checkins.map(c => c.date))]
    const relayDays = [...new Set(relays.map(r => r.date))]
    return {
      checkinStreak: streakOf(signedDays),
      checkinDays: signedDays.length,
      waterDays: checkins.filter(c => c.type === 'water').length,
      exerciseDays: checkins.filter(c => c.type === 'exercise').length,
      planDays: checkins.filter(c => c.type === 'plan').length,
      mirrorDays: new Set(mirrorMsgs.map(m => dayjs(m.createdAt).format('YYYY-MM-DD'))).size,
      quizCorrect, visits, trees, match3, redeems,
      earnedPoints: earnSum._sum.change || 0,
      assessments,
      profile: ['salutation', 'birthYear', 'gender'].filter(k => (customer as any)?.[k]).length,
      family,
      relays: relayDays.length,
      relayStreak: streakOf(relayDays),
      stamps: stamps.length,
      stampStores: new Set(stamps.map(s => s.storeId)).size,
    }
  }

  /** 幂等推导并落库：progress 永远写当前值，unlockedAt 只在首次达标时写入，重复调用不产生重复记录 */
  async syncBadges(customerId: number) {
    const stats = await this.badgeStats(customerId)
    const rows = await this.prisma.userBadge.findMany({ where: { customerId } })
    const map = new Map(rows.map(r => [r.badgeCode, r]))
    return Promise.all(BADGES.map(async (def) => {
      const progress = Math.min(def.target, Math.max(0, (stats as any)[def.stat] || 0))
      const unlocked = progress >= def.target
      const exist = map.get(def.code)
      let unlockedAt = exist?.unlockedAt || null
      if (unlocked && !unlockedAt) unlockedAt = new Date()
      if (!exist) await this.prisma.userBadge.create({ data: { customerId, badgeCode: def.code, progress, unlockedAt } })
      else if (exist.progress !== progress || !!exist.unlockedAt !== !!unlockedAt) await this.prisma.userBadge.update({ where: { id: exist.id }, data: { progress, unlockedAt } })
      return { def, progress, unlocked, unlockedAt }
    }))
  }

  /** GET /app/achievements：{ unlocked, total, groups[] }，前端可直接渲染 3 组 × 3 列网格 */
  async achievements(customerId: number) {
    const badges = await this.syncBadges(customerId)
    const groups = (Object.keys(BADGE_GROUP_NAMES) as ('keep' | 'explore' | 'share')[]).map(key => ({
      key, name: BADGE_GROUP_NAMES[key],
      badges: badges.filter(b => b.def.group === key).map(b => ({
        code: b.def.code, name: b.def.name, icon: b.def.icon, outline: b.def.outline, desc: b.def.desc,
        target: b.def.target, progress: b.progress, unlocked: b.unlocked, unlockedAt: b.unlockedAt ? fmt(b.unlockedAt, 'YYYY-MM-DD') : null,
      })),
    }))
    return { unlocked: badges.filter(b => b.unlocked).length, total: BADGES.length, groups }
  }

  /** XJ-303：我的页成长体系数据 —— 下一级差距 + 成长值（近 N 月实付）+ 徽章摘要 */
  async meGrowth(customer: { id: number, tier: string }) {
    const rule = await this.activeRule()
    const categories = (rule?.categories as string[]) || ['service', 'card', 'product']
    const agg = await this.prisma.consumption.aggregate({ _sum: { paidAmount: true }, where: { customerId: customer.id, paidAt: { gte: dayjs().subtract(rule?.windowMonths || 12, 'month').toDate() }, category: { in: categories } } })
    const spend = Math.round(agg._sum.paidAmount || 0)
    let nextTier: { tier: string, tierName: string, threshold: number, gap: number } | null = null
    if (customer.tier !== 'A' && rule) {
      const t = customer.tier === 'C' ? 'B' : 'A'
      const threshold = t === 'B' ? rule.thresholdB : rule.thresholdA
      nextTier = { tier: t, tierName: TIER_NAMES[t], threshold, gap: Math.max(0, threshold - spend) }
    }
    const badges = await this.syncBadges(customer.id)
    const unlocked = badges.filter(b => b.unlocked && b.unlockedAt)
    return {
      nextTier, growthValue: spend,
      badges: {
        unlocked: badges.filter(b => b.unlocked).length, total: BADGES.length,
        recent: unlocked.sort((a, b) => b.unlockedAt!.getTime() - a.unlockedAt!.getTime()).slice(0, 3)
          .map(b => ({ code: b.def.code, name: b.def.name, icon: b.def.icon, unlockedAt: fmt(b.unlockedAt!, 'YYYY-MM-DD') })),
      },
    }
  }
}
