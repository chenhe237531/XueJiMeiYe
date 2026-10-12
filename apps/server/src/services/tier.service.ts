import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { PrismaService } from '../common/prisma.service'
import { Err } from '../common/response'
import { genNo } from '../common/util'
import { WorkflowService } from './workflow.service'

const ORDER: Record<string, number> = { C: 0, B: 1, A: 2 }

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
      if (c.isDemo) continue
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
}
