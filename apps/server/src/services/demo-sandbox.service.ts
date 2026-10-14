import { Injectable, type OnModuleInit } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { demoTemplateIds } from '../common/auth'
import { PrismaService } from '../common/prisma.service'
import { genNo } from '../common/util'

/** 演示副本要复制的客户数据表 → 记录产生时间字段；员工任务、员工通知、埋点、审计日志不复制 */
const TABLE_TIME = {
  customer: 'createdAt', consentRecord: 'grantedAt', assessment: 'startedAt', assessmentAnswer: 'answeredAt', healthIntake: 'createdAt', measurement: 'measuredAt',
  report: 'createdAt', plan: 'createdAt', coupon: 'issuedAt', referral: 'createdAt', referralReturn: 'createdAt', mirrorSession: 'startedAt', mirrorMessage: 'createdAt',
  mirrorMemory: 'createdAt', riskAlert: 'createdAt', healthTag: 'createdAt', lead: 'createdAt', leadFollowup: 'createdAt', record: 'occurredAt', pointsLedger: 'createdAt',
  checkin: 'createdAt', gameProgress: 'createdAt', message: 'createdAt', consumption: 'paidAt', tierHistory: 'createdAt', customerLabel: 'createdAt',
  serviceCheck: 'createdAt', followup: 'createdAt', familyLink: 'createdAt',
} as const
type Table = keyof typeof TABLE_TIME
const TABLES = Object.keys(TABLE_TIME) as Table[]
type Baseline = Record<Table, number>

const BASELINE_KEY = 'demo_baseline'
const suffix = () => randomBytes(3).toString('hex')
/** Json 可空字段不能直接写 null，去掉 null 让 Prisma 用默认值 */
const clean = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null))

/**
 * 演示账号数据隔离：演示账号（isDemo）只当模板，每台设备登录时复制一份独立副本。
 * 一台设备第一次进入任何演示账号时，复制全部演示账号（王阿姨与女儿小周的家人关系在副本内对应），
 * 之后同一设备再进入同一演示账号回到自己的副本；不同设备、不同人之间的测评、方案、积分等互不可见。
 */
@Injectable()
export class DemoSandboxService implements OnModuleInit {
  private locks = new Map<string, Promise<any>>()

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const list = await this.prisma.customer.findMany({ where: { isDemo: true }, select: { id: true } })
    list.forEach(c => demoTemplateIds.add(c.id))
  }

  /** 演示账号 → 本设备的副本客户 id（没有就复制一份） */
  customerFor(personaId: number, deviceId: string): Promise<number> {
    return this.serial(deviceId, async () => {
      const find = () => this.prisma.customer.findFirst({ where: { demoOf: personaId, demoDevice: deviceId, status: { not: 'deleted' } }, orderBy: { id: 'desc' } })
      const own = await find()
      if (own) return own.id
      await this.cloneAll(deviceId)
      const c = await find()
      if (!c) throw new Error(`演示账号 ${personaId} 复制失败`)
      return c.id
    })
  }

  /** 重新开始演示：本设备旧副本解除归属（数据留在后台），下次登录复制一份新的 */
  reset(deviceId: string) {
    return this.serial(deviceId, () => this.prisma.customer.updateMany({ where: { demoDevice: deviceId }, data: { demoDevice: null } }))
  }

  /** 同一设备的复制 / 重置串行执行，避免连点复制出两份 */
  private async serial<T>(deviceId: string, fn: () => Promise<T>): Promise<T> {
    const job = (this.locks.get(deviceId) || Promise.resolve()).catch(() => {}).then(fn)
    this.locks.set(deviceId, job)
    try {
      return await job
    }
    finally {
      if (this.locks.get(deviceId) === job) this.locks.delete(deviceId)
    }
  }

  /**
   * 演示账号的初始数据范围：各表在种子完成时的最大 id。
   * 之后产生的数据（包括改造前多人共用演示账号时留下的测评、预警等）不进入副本。
   */
  async baseline(): Promise<Baseline> {
    const s = await this.prisma.setting.findUnique({ where: { key: BASELINE_KEY } })
    if (s && TABLES.every(t => typeof (s.value as any)?.[t] === 'number')) return s.value as Baseline
    return this.save(await this.inferBaseline())
  }

  /** 种子结束时调用：此刻各表最大 id 即初始数据范围 */
  async snapshotBaseline() {
    const value: any = {}
    for (const t of TABLES) value[t] = (await (this.prisma as any)[t].findFirst({ orderBy: { id: 'desc' }, select: { id: true } }))?.id || 0
    return this.save(value)
  }

  /**
   * 老库（改造前种的数据）没有记录：以演示账号创建时间 + 10 分钟作为种子结束时间，
   * 每张表取这之后第一条记录之前的 id。种子里的历史记录时间都往前挪过，不会晚于这个时间。
   */
  private async inferBaseline() {
    const last = await this.prisma.customer.findFirst({ where: { isDemo: true }, orderBy: { createdAt: 'desc' } })
    const cutoff = new Date((last?.createdAt.getTime() || Date.now()) + 10 * 60_000)
    const value: any = {}
    for (const t of TABLES) {
      const db = (this.prisma as any)[t]
      const after = await db.findFirst({ where: { [TABLE_TIME[t]]: { gt: cutoff } }, orderBy: { id: 'asc' }, select: { id: true } })
      value[t] = after ? after.id - 1 : (await db.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }))?.id || 0
    }
    return value as Baseline
  }

  private async save(value: Baseline) {
    await this.prisma.setting.upsert({ where: { key: BASELINE_KEY }, update: { value }, create: { key: BASELINE_KEY, value } })
    return value
  }

  private async cloneAll(deviceId: string) {
    const base = await this.baseline()
    await this.prisma.$transaction(async (tx: any) => {
      /** 复制一张表：只取初始数据，map 返回 null 表示跳过；返回旧 id → 新 id */
      const copy = async (table: Table, where: any, map: (r: any) => any) => {
        const rows = await tx[table].findMany({ where: { ...where, id: { lte: base[table] } }, orderBy: { id: 'asc' } })
        const ids = new Map<number, number>()
        for (const { id, ...r } of rows) {
          const data = map(r)
          if (!data) continue
          ids.set(id, (await tx[table].create({ data: clean(data) })).id)
        }
        return ids
      }
      const ref = (m: Map<number, number>, id?: number | null) => (id != null ? m.get(id) ?? null : null)
      /** 关联的记录没进副本（如别人做了一半的测评触发的预警），这条也不复制 */
      const miss = (m: Map<number, number> | undefined, id?: number | null) => !!m && id != null && !m.has(id)

      const personas = await tx.customer.findMany({ where: { isDemo: true }, orderBy: { id: 'asc' } })
      const C = new Map<number, number>()
      for (const { id, customerNo, openid, phone, isDemo, updatedAt, ...p } of personas) {
        const c = await tx.customer.create({ data: clean({ ...p, customerNo: genNo('C'), isDemo: false, demoOf: id, demoDevice: deviceId }) })
        C.set(id, c.id)
      }
      for (const p of personas) {
        if (p.referrerId && C.has(p.referrerId)) await tx.customer.update({ where: { id: C.get(p.id) }, data: { referrerId: C.get(p.referrerId) } })
      }
      const own = { customerId: { in: [...C.keys()] } }
      const cust = (r: any) => ({ ...r, customerId: C.get(r.customerId) })

      const consent = await copy('consentRecord', own, r => ({
        ...cust(r),
        scope: r.scope?.family_id ? { ...r.scope, family_id: ref(C, r.scope.family_id) } : r.scope,
      }))
      // 进行中的测评不复制：那是改造前共用账号时别人答了一半的
      const A = await copy('assessment', { ...own, status: { not: 'in_progress' } }, cust)
      await copy('assessmentAnswer', { assessmentId: { in: [...A.keys()] } }, r => ({ ...r, assessmentId: A.get(r.assessmentId) }))
      const I = await copy('healthIntake', own, cust)
      const M = await copy('measurement', own, cust)
      const R = await copy('report', own, cust)
      const P = await copy('plan', own, r => (miss(A, r.assessmentId) ? null : { ...cust(r), planNo: genNo('PL'), assessmentId: ref(A, r.assessmentId) }))
      const CP = await copy('coupon', own, r => (miss(A, r.sourceAssessmentId)
        ? null
        : { ...cust(r), couponNo: `${r.couponNo}${suffix()}`.toUpperCase(), sourceAssessmentId: ref(A, r.sourceAssessmentId) }))
      const RF = await copy('referral', own, r => (miss(CP, r.couponId)
        ? null
        : { ...cust(r), referralNo: genNo('RF'), couponId: ref(CP, r.couponId), consentC3Id: ref(consent, r.consentC3Id), consentC4Id: ref(consent, r.consentC4Id) }))
      const RR = await copy('referralReturn', { referralId: { in: [...RF.keys()] } }, r => ({ ...r, referralId: RF.get(r.referralId) }))
      const S = await copy('mirrorSession', own, cust)
      await copy('mirrorMessage', { sessionId: { in: [...S.keys()] } }, r => ({ ...cust(r), sessionId: S.get(r.sessionId) }))
      await copy('mirrorMemory', own, cust)
      const alertRef: Record<string, Map<number, number>> = { assessment: A, measurement: M, staff: I, mirror: S }
      const AL = await copy('riskAlert', own, (r) => {
        const m = alertRef[r.source]
        return miss(m, r.sourceRefId) ? null : { ...cust(r), sourceRefId: m ? ref(m, r.sourceRefId) : r.sourceRefId }
      })
      const tagRef: Record<string, Map<number, number>> = { assessment: A, measurement: M, staff: I, hospital: RR }
      await copy('healthTag', own, (r) => {
        const m = r.tagCode === 'red_flag_active' ? AL : tagRef[r.source]
        return miss(m, r.sourceRefId) ? null : { ...cust(r), sourceRefId: m ? ref(m, r.sourceRefId) : r.sourceRefId }
      })
      const L = await copy('lead', own, r => ({ ...cust(r), leadNo: genNo('LD') }))
      await copy('leadFollowup', { leadId: { in: [...L.keys()] } }, r => ({ ...r, leadId: L.get(r.leadId) }))
      const recRef: Record<string, Map<number, number>> = { assessment: A, health_intake: I, plan: P, report: R, referral: RF, lead: L, risk_alert: AL }
      await copy('record', own, (r) => {
        const m = recRef[r.refTable]
        return miss(m, r.refId) ? null : { ...cust(r), refId: m ? ref(m, r.refId) : r.refId }
      })
      for (const t of ['pointsLedger', 'checkin', 'tierHistory', 'customerLabel', 'serviceCheck', 'followup'] as const) await copy(t, own, cust)
      await copy('gameProgress', own, ({ updatedAt, ...r }) => cust(r))
      await copy('message', own, r => ({ ...cust(r), link: r.link?.replace(/(report\?id=)(\d+)/, (s: string, k: string, id: string) => (R.has(+id) ? `${k}${R.get(+id)}` : s)) }))
      await copy('consumption', own, r => ({ ...cust(r), extOrderNo: `${r.extOrderNo}-${suffix()}` }))
      // 家人关系只在副本之间建立，不连到真实客户
      await copy('familyLink', { elderId: { in: [...C.keys()] } }, r => (r.familyId && !C.has(r.familyId)
        ? null
        : { ...r, elderId: C.get(r.elderId), familyId: ref(C, r.familyId), token: `${r.token}-${suffix()}` }))
    }, { timeout: 60_000, maxWait: 30_000 })
  }
}
