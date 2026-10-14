import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common'
import dayjs from 'dayjs'
import { Aud, CurrentUser, requireRole, ROLE_NAMES, signToken, type StaffUser } from '../common/auth'
import { PrismaService } from '../common/prisma.service'
import { Err } from '../common/response'
import { fmt, maskPhone, TIER_NAMES } from '../common/util'
import { ageOf, DIM_NAMES, tagName } from '../engine'
import { ArchiveService } from '../services/archive.service'
import { AssessmentService } from '../services/assessment.service'
import { CheckupService, COUPON_STATUS, REFERRAL_STATUS } from '../services/checkup.service'
import { EngineService } from '../services/engine.service'
import { PlanService } from '../services/plan.service'
import { TierService } from '../services/tier.service'
import { WorkflowService } from '../services/workflow.service'
import { screenProject } from '../engine'
import { INTAKE_FORM, mapIntake } from '../engine/intake'

const LEAD_STATUS: Record<string, string> = { new: '新线索', contacted: '已联系', negotiating: '洽谈中', won: '已成交', lost: '已丢单' }
const LEAD_TYPE: Record<string, string> = { travel: '文旅', overseas_vip: '海外 VIP', transport: '接送', gift: '礼盒', checkup: '高端体检', visit: '到店预约', other: '其他' }
const ALERT_LEVEL: Record<string, string> = { L3: 'L3 紧急就医', L2: 'L2 优先就医', high: '魔镜高风险', watch: '关注' }
const ALERT_SOURCE: Record<string, string> = { assessment: '测评', measurement: '门店测量', mirror: '魔镜', staff: '员工上报' }

/** 数据范围（13.5）：all 不限；store 限本店；self 限本人客户 */
export function scopeWhere(u: StaffUser) {
  if (u.role === 'super_admin' || u.role === 'ops' || u.role === 'finance' || u.dataScope === 'all') return {}
  if (u.role === 'advisor' || u.dataScope === 'self') return { advisorId: u.id }
  return u.storeId ? { storeId: u.storeId } : {}
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private prisma: PrismaService, private wf: WorkflowService) {}

  /** 管理端与医院端共用登录页：先查员工，再查医院账号；签发不同 aud 的令牌 */
  @Post('login')
  async login(@Body() body: { username: string, password: string }) {
    const staff = await this.prisma.staff.findUnique({ where: { username: body.username } })
    if (staff && staff.password === body.password && staff.status === 'active') {
      await this.prisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } })
      await this.wf.audit({ type: 'staff', id: staff.id, name: staff.name }, 'auth.login')
      const store = staff.storeId ? await this.prisma.store.findUnique({ where: { id: staff.storeId } }) : null
      return {
        portal: 'admin',
        accessToken: signToken({ id: staff.id, role: staff.role, name: staff.name, storeId: staff.storeId, dataScope: staff.dataScope }, 'admin'),
        user: { id: staff.id, name: staff.name, username: staff.username, staffNo: staff.staffNo, role: staff.role, roleName: ROLE_NAMES[staff.role], storeName: store?.name || '总部' },
      }
    }
    const hu = await this.prisma.hospitalUser.findUnique({ where: { username: body.username } })
    if (hu && hu.password === body.password && hu.status === 'active') {
      const h = await this.prisma.hospital.findUnique({ where: { id: hu.hospitalId } })
      await this.wf.audit({ type: 'hospital_user', id: hu.id, name: hu.name }, 'auth.login')
      return {
        portal: 'hospital',
        accessToken: signToken({ id: hu.id, role: hu.role, name: hu.name, hospitalId: hu.hospitalId }, 'hospital'),
        user: { id: hu.id, name: hu.name, username: hu.username, role: hu.role, roleName: ROLE_NAMES[hu.role], hospitalName: h?.name },
      }
    }
    throw Err.bad('账号或密码错误')
  }

  @Get('demo-accounts')
  async demo() {
    const staff = await this.prisma.staff.findMany({ where: { status: 'active' }, orderBy: { id: 'asc' } })
    const hus = await this.prisma.hospitalUser.findMany({ orderBy: { id: 'asc' } })
    return [
      ...staff.map(s => ({ username: s.username, password: s.password, name: s.name, role: ROLE_NAMES[s.role], portal: 'admin' })),
      ...hus.map(h => ({ username: h.username, password: h.password, name: h.name, role: ROLE_NAMES[h.role], portal: 'hospital' })),
    ]
  }
}

@Controller('admin')
@Aud('admin')
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private wf: WorkflowService,
    private plans: PlanService,
    private assess: AssessmentService,
    private checkup: CheckupService,
    private archive: ArchiveService,
    private tier: TierService,
    private engine: EngineService,
  ) {}

  private actor(u: StaffUser) {
    return { type: 'staff', id: u.id, name: u.name }
  }

  private async customerMap(ids: number[]) {
    const list = await this.prisma.customer.findMany({ where: { id: { in: [...new Set(ids)] } } })
    return new Map(list.map(c => [c.id, c]))
  }

  private async staffMap() {
    return new Map((await this.prisma.staff.findMany()).map(s => [s.id, s]))
  }

  private async scopedCustomerIds(u: StaffUser) {
    const w = scopeWhere(u)
    if (!Object.keys(w).length) return null
    return (await this.prisma.customer.findMany({ where: w, select: { id: true } })).map(c => c.id)
  }

  @Get('auth/me')
  async me(@CurrentUser() u: StaffUser) {
    const s = await this.prisma.staff.findUnique({ where: { id: u.id } })
    const store = s?.storeId ? await this.prisma.store.findUnique({ where: { id: s.storeId } }) : null
    return { id: s!.id, name: s!.name, username: s!.username, staffNo: s!.staffNo, role: s!.role, roleName: ROLE_NAMES[s!.role], storeName: store?.name || '总部' }
  }

  // ───────── 工作台 ─────────

  @Get('dashboard')
  async dashboard(@CurrentUser() u: StaffUser) {
    const ids = await this.scopedCustomerIds(u)
    const cw: any = ids ? { customerId: { in: ids } } : {}
    const monthStart = dayjs().startOf('month').toDate()
    const tasksWhere: any = u.role === 'super_admin' || u.role === 'ops' ? { status: 'todo' } : { status: 'todo', OR: [{ staffId: u.id }, ...(ids ? [{ customerId: { in: ids } }] : [])] }
    const tasks = await this.prisma.task.findMany({ where: tasksWhere, orderBy: { dueAt: 'asc' }, take: 30 })
    const alerts = await this.prisma.riskAlert.findMany({ where: { ...cw, status: { not: 'closed' } }, orderBy: { slaDueAt: 'asc' }, take: 20 })
    const cmap = await this.customerMap([...tasks.map(t => t.customerId || 0), ...alerts.map(a => a.customerId)])
    const days = [...Array(14)].map((_, i) => dayjs().subtract(13 - i, 'day'))
    const assessments = await this.prisma.assessment.findMany({ where: { ...cw, status: 'completed', completedAt: { gte: days[0].startOf('day').toDate() } } })
    const riskDist = await this.prisma.assessment.groupBy({ by: ['riskLevel'], where: { ...cw, status: 'completed' }, _count: true })
    const tierDist = await this.prisma.customer.groupBy({ by: ['tier'], where: ids ? { id: { in: ids } } : {}, _count: true })
    const todayStart = dayjs().startOf('day').toDate()
    return {
      cards: {
        assessments: await this.prisma.assessment.count({ where: { ...cw, status: 'completed', completedAt: { gte: monthStart } } }),
        arrived: await this.prisma.referral.count({ where: { ...cw, arrivedAt: { gte: monthStart } } }),
        plansSent: await this.prisma.plan.count({ where: { ...cw, sentAt: { gte: monthStart } } }),
        leadsWon: await this.prisma.lead.count({ where: { ...cw, status: 'won' } }),
        customers: await this.prisma.customer.count({ where: ids ? { id: { in: ids } } : {} }),
        openAlerts: alerts.length,
        pendingPlans: await this.prisma.plan.count({ where: { ...cw, reviewStatus: 'pending', status: 'draft' } }),
        newLeads: await this.prisma.lead.count({ where: { ...cw, status: 'new' } }),
      },
      today: {
        assessments: await this.prisma.assessment.count({ where: { ...cw, completedAt: { gte: todayStart } } }),
        checkups: await this.prisma.referral.count({ where: { ...cw, appointmentAt: { gte: todayStart, lt: dayjs().endOf('day').toDate() } } }),
        visits: await this.prisma.customer.count({ where: { ...(ids ? { id: { in: ids } } : {}), lastVisitAt: { gte: todayStart } } }),
        leads: await this.prisma.lead.count({ where: { ...cw, createdAt: { gte: todayStart } } }),
      },
      tasks: tasks.map(t => ({ id: t.id, type: t.type, title: t.title, dueAt: fmt(t.dueAt), overdue: t.dueAt < new Date(), minutesLeft: Math.round((t.dueAt.getTime() - Date.now()) / 60000), customer: cmap.get(t.customerId || 0)?.salutation, customerId: t.customerId, refTable: t.refTable, refId: t.refId })),
      alerts: alerts.map(a => ({ id: a.id, level: a.level, levelName: ALERT_LEVEL[a.level], title: a.title, source: ALERT_SOURCE[a.source], customer: cmap.get(a.customerId)?.salutation, customerId: a.customerId, slaDueAt: fmt(a.slaDueAt), minutesLeft: Math.round((a.slaDueAt.getTime() - Date.now()) / 60000), status: a.status })),
      trend: days.map(d => ({ date: d.format('MM-DD'), count: assessments.filter(a => dayjs(a.completedAt).isSame(d, 'day')).length })),
      riskDist: riskDist.map(r => ({ level: r.riskLevel, count: r._count })),
      tierDist: tierDist.map(t => ({ tier: t.tier, name: TIER_NAMES[t.tier], count: t._count })),
    }
  }

  @Get('tasks')
  async tasks(@CurrentUser() u: StaffUser, @Query('status') status = 'todo') {
    const list = await this.prisma.task.findMany({ where: { status, ...(u.role === 'super_admin' ? {} : { staffId: u.id }) }, orderBy: { dueAt: 'asc' }, take: 100 })
    const cmap = await this.customerMap(list.map(t => t.customerId || 0))
    return list.map(t => ({ ...t, dueAt: fmt(t.dueAt), overdue: t.dueAt < new Date() && t.status === 'todo', minutesLeft: Math.round((t.dueAt.getTime() - Date.now()) / 60000), customer: cmap.get(t.customerId || 0)?.salutation, phone: cmap.get(t.customerId || 0)?.phone }))
  }

  @Post('tasks/:id/done')
  async taskDone(@Param('id', ParseIntPipe) id: number) {
    await this.prisma.task.update({ where: { id }, data: { status: 'done', doneAt: new Date() } })
    return { ok: true }
  }

  @Get('notices')
  async notices(@CurrentUser() u: StaffUser) {
    const list = await this.prisma.staffNotice.findMany({ where: { staffId: u.id }, orderBy: { id: 'desc' }, take: 30 })
    return { unread: list.filter(n => !n.read).length, list: list.map(n => ({ ...n, at: fmt(n.createdAt) })) }
  }

  @Post('notices/read')
  async readNotices(@CurrentUser() u: StaffUser) {
    await this.prisma.staffNotice.updateMany({ where: { staffId: u.id, read: false }, data: { read: true } })
    return { ok: true }
  }

  // ───────── 客户 ─────────

  @Get('customers')
  async customers(@CurrentUser() u: StaffUser, @Query() q: any) {
    const where: any = { ...scopeWhere(u) }
    if (q.keyword) where.OR = [{ salutation: { contains: q.keyword } }, { name: { contains: q.keyword } }, { phone: { endsWith: q.keyword } }, { customerNo: { contains: q.keyword } }]
    if (q.tier) where.tier = q.tier
    if (q.storeId) where.storeId = Number(q.storeId)
    if (q.advisorId) where.advisorId = Number(q.advisorId)
    if (q.elder === '1') where.elderMode = true
    const page = Number(q.page || 1)
    const pageSize = Number(q.pageSize || 20)
    let list = await this.prisma.customer.findMany({ where, orderBy: [{ isDemo: 'desc' }, { id: 'desc' }] })
    const lastA = await this.prisma.assessment.findMany({ where: { customerId: { in: list.map(c => c.id) } }, orderBy: { id: 'desc' } })
    const amap = new Map<number, any>()
    lastA.forEach(a => { if (!amap.has(a.customerId)) amap.set(a.customerId, a) })
    if (q.risk) list = list.filter(c => amap.get(c.id)?.riskLevel === q.risk)
    if (q.assessed === '1') list = list.filter(c => amap.get(c.id)?.status === 'completed')
    if (q.assessed === '0') list = list.filter(c => !amap.get(c.id))
    const total = list.length
    const pageList = list.slice((page - 1) * pageSize, page * pageSize)
    const spend = await this.tier.spendMap()
    const stores = await this.prisma.store.findMany()
    const smap = await this.staffMap()
    const labels = await this.prisma.customerLabel.findMany({ where: { customerId: { in: pageList.map(c => c.id) } } })
    const families = await this.prisma.familyLink.findMany({ where: { elderId: { in: pageList.map(c => c.id) }, status: 'active' } })
    const canSeeSpend = ['super_admin', 'ops', 'store_manager', 'advisor', 'finance'].includes(u.role)
    return {
      total,
      list: pageList.map((c) => {
        const a = amap.get(c.id)
        return {
          id: c.id, customerNo: c.customerNo, salutation: c.salutation, name: c.name, phone: maskPhone(c.phone), age: c.birthYear ? ageOf(c.birthYear) : null,
          tier: c.tier, tierName: TIER_NAMES[c.tier], elderMode: c.elderMode, store: stores.find(s => s.id === c.storeId)?.name, advisor: smap.get(c.advisorId || 0)?.name,
          lastVisitAt: fmt(c.lastVisitAt, 'YYYY-MM-DD'), amount12m: canSeeSpend ? Math.round(spend.get(c.id) || 0) : null,
          assessStatus: a ? (a.status === 'completed' ? '已完成' : '进行中') : '未测评', riskLevel: a?.riskLevel || null,
          labels: labels.filter(l => l.customerId === c.id).map(l => l.labelCode), family: families.some(f => f.elderId === c.id), isDemo: c.isDemo || !!c.demoOf, source: c.source,
        }
      }),
    }
  }

  @Get('customers/:id')
  async customer(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number) {
    const c = await this.prisma.customer.findUnique({ where: { id } })
    if (!c) throw Err.notFound()
    const scope = scopeWhere(u) as any
    if ((scope.advisorId && c.advisorId !== scope.advisorId) || (scope.storeId && c.storeId !== scope.storeId)) throw Err.forbidden('不在您的数据范围内')
    const store = c.storeId ? await this.prisma.store.findUnique({ where: { id: c.storeId } }) : null
    const advisor = c.advisorId ? await this.prisma.staff.findUnique({ where: { id: c.advisorId } }) : null
    const lastA = await this.prisma.assessment.findFirst({ where: { customerId: id, status: 'completed' }, orderBy: { id: 'desc' } })
    const plan = await this.prisma.plan.findFirst({ where: { customerId: id, status: { not: 'void' } }, orderBy: { id: 'desc' } })
    const family = await this.prisma.familyLink.findMany({ where: { elderId: id, status: 'active' } })
    const fpeople = await this.customerMap(family.map(f => f.familyId || 0))
    const labels = await this.prisma.customerLabel.findMany({ where: { customerId: id } })
    const tierHistory = await this.prisma.tierHistory.findMany({ where: { customerId: id }, orderBy: { id: 'desc' } })
    const consumption = await this.prisma.consumption.findMany({ where: { customerId: id }, orderBy: { paidAt: 'desc' }, take: 50 })
    const spend = (await this.tier.spendMap()).get(id) || 0
    const plans = await this.prisma.plan.findMany({ where: { customerId: id }, orderBy: { id: 'desc' } })
    const referrals = await this.prisma.referral.findMany({ where: { customerId: id }, orderBy: { id: 'desc' } })
    const leads = await this.prisma.lead.findMany({ where: { customerId: id }, orderBy: { id: 'desc' } })
    const alerts = await this.prisma.riskAlert.findMany({ where: { customerId: id }, orderBy: { id: 'desc' } })
    const consents = await this.prisma.consentRecord.findMany({ where: { customerId: id }, orderBy: { id: 'desc' } })
    const followups = await this.prisma.followup.findMany({ where: { customerId: id }, orderBy: { id: 'desc' } })
    const coupons = await this.prisma.coupon.findMany({ where: { customerId: id }, orderBy: { id: 'desc' } })
    const canHealth = ['health_advisor', 'super_admin'].includes(u.role)
    return {
      base: {
        id: c.id, customerNo: c.customerNo, salutation: c.salutation, name: c.name, phone: maskPhone(c.phone), gender: c.gender === 'female' ? '女' : '男', age: c.birthYear ? ageOf(c.birthYear) : null,
        tier: c.tier, tierName: TIER_NAMES[c.tier], tierKeepUntil: fmt(c.tierKeepUntil, 'YYYY-MM-DD'), tierLockedUntil: fmt(c.tierLockedUntil, 'YYYY-MM-DD'), elderMode: c.elderMode,
        store: store?.name, advisor: advisor?.name, advisorId: c.advisorId, lastVisitAt: fmt(c.lastVisitAt, 'YYYY-MM-DD'), createdAt: fmt(c.createdAt, 'YYYY-MM-DD'), source: c.source,
        labels: labels.map(l => l.labelCode), amount12m: Math.round(spend), personalization: c.personalization,
      },
      healthSummary: { riskLevel: lastA?.riskLevel || null, index: lastA?.indexScore ?? null, packages: ((plan?.skeleton as any)?.packages || []).map((p: any) => p.name), lastAssessedAt: fmt(lastA?.completedAt, 'YYYY-MM-DD') },
      canViewHealth: canHealth,
      family: family.map(f => ({ id: f.id, relation: f.relation, name: fpeople.get(f.familyId || 0)?.salutation, permissions: f.permissions })),
      tierHistory: tierHistory.map(t => ({ ...t, createdAt: fmt(t.createdAt) })),
      consumption: ['super_admin', 'ops', 'store_manager', 'advisor', 'finance'].includes(u.role) ? consumption.map(x => ({ ...x, paidAt: fmt(x.paidAt) })) : [],
      plans: plans.map(p => ({ id: p.id, planNo: p.planNo, packages: ((p.skeleton as any)?.packages || []).map((x: any) => x.name).join(' + '), riskLevel: p.riskLevel, engine: p.engine, reviewStatus: p.reviewStatus, status: p.status, createdAt: fmt(p.createdAt), sentAt: fmt(p.sentAt) })),
      referrals: referrals.map(r => ({ id: r.id, referralNo: r.referralNo, status: REFERRAL_STATUS[r.status], services: r.services, appointmentAt: fmt(r.appointmentAt), createdAt: fmt(r.createdAt) })),
      leads: leads.map(l => ({ id: l.id, leadNo: l.leadNo, module: l.moduleName, type: LEAD_TYPE[l.type], status: LEAD_STATUS[l.status], createdAt: fmt(l.createdAt) })),
      alerts: alerts.map(a => ({ id: a.id, level: ALERT_LEVEL[a.level], title: a.title, source: ALERT_SOURCE[a.source], status: a.status, createdAt: fmt(a.createdAt), conclusion: a.conclusion })),
      consents: consents.map(r => ({ type: r.type, version: r.textVersion, granted: r.granted, channel: r.channel, scope: r.scope, grantedAt: fmt(r.grantedAt), revokedAt: fmt(r.revokedAt) })),
      followups: followups.map(f => ({ ...f, createdAt: fmt(f.createdAt) })),
      coupons: coupons.map(x => ({ id: x.id, couponNo: x.couponNo, type: x.type, status: COUPON_STATUS[x.status], issuedAt: fmt(x.issuedAt, 'YYYY-MM-DD') })),
    }
  }

  /** 健康数据（完整）：仅健康顾问 / 超管审计调阅，写审计日志（2.2、6.2.3） */
  @Get('customers/:id/health')
  async health(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number) {
    requireRole(u, ['health_advisor'])
    await this.wf.audit(this.actor(u), 'health.view', { type: 'customer', id, customerId: id })
    const assessments = await this.prisma.assessment.findMany({ where: { customerId: id }, orderBy: { id: 'desc' } })
    const tags = await this.prisma.healthTag.findMany({ where: { customerId: id, status: 'active' } })
    const records = await this.archive.records(id)
    const reports = await this.prisma.report.findMany({ where: { customerId: id }, orderBy: { id: 'desc' } })
    const answers = assessments[0] ? await this.prisma.assessmentAnswer.findMany({ where: { assessmentId: assessments[0].id } }) : []
    const questions = await this.engine.questions()
    return {
      assessments: assessments.map(a => ({ id: a.id, status: a.status, mode: a.mode, riskLevel: a.riskLevel, index: a.indexScore, dims: Object.entries((a.dimensionScores as any) || {}).map(([k, v]) => ({ name: DIM_NAMES[k], score: v })), hitRules: a.hitRules, computed: a.computed, completedAt: fmt(a.completedAt) })),
      tags: tags.map(t => ({ code: t.tagCode, name: tagName(t.tagCode), source: t.source, createdAt: fmt(t.createdAt, 'YYYY-MM-DD') })),
      records, reports: reports.map(r => ({ id: r.id, type: r.type, title: r.title, source: r.sourceLabel, reviewStatus: r.reviewStatus, createdAt: fmt(r.createdAt) })),
      answers: answers.map((a) => {
        const q = questions.find(x => x.code === a.questionCode)
        const v: any = a.answer
        const vals = v?.skipped ? ['（跳过）'] : (v?.values || [v?.value]).map((x: any) => q?.options?.find(o => o.value === x)?.label ?? x)
        return { code: a.questionCode, level: a.level, title: q?.title, answer: vals.join('、') }
      }),
    }
  }

  @Patch('customers/:id')
  async patchCustomer(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: { advisorId?: number, labels?: string[], tags?: string[] }) {
    if (body.advisorId) {
      requireRole(u, ['store_manager', 'ops'])
      await this.prisma.customer.update({ where: { id }, data: { advisorId: body.advisorId } })
    }
    if (body.labels) {
      await this.prisma.customerLabel.deleteMany({ where: { customerId: id } })
      for (const l of body.labels) await this.prisma.customerLabel.create({ data: { customerId: id, labelCode: l, source: 'staff' } })
    }
    await this.wf.audit(this.actor(u), 'customer.update', { type: 'customer', id, customerId: id }, body)
    return { ok: true }
  }

  @Post('customers/:id/tier')
  async adjustTier(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: { tier: string, note: string }) {
    requireRole(u, ['store_manager'])
    await this.wf.audit(this.actor(u), 'customer.tier', { type: 'customer', id, customerId: id }, body)
    return this.tier.manualAdjust(id, body.tier, body.note, u.name)
  }

  @Post('customers/:id/followups')
  async followup(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: { method: string, content: string }) {
    await this.prisma.followup.create({ data: { customerId: id, staffName: u.name, method: body.method || 'phone', content: body.content } })
    await this.prisma.task.updateMany({ where: { customerId: id, type: 'assessment_followup', status: 'todo' }, data: { status: 'done', doneAt: new Date() } })
    return { ok: true }
  }

  @Post('customers/:id/health-tags')
  async staffTag(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: { tag: string }) {
    requireRole(u, ['health_advisor'])
    await this.wf.setTag(id, body.tag, 'staff')
    await this.wf.audit(this.actor(u), 'health.tag', { type: 'customer', id, customerId: id }, body)
    return { ok: true }
  }

  @Get('customers/:id/audit')
  async customerAudit(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number) {
    requireRole(u, ['health_advisor'])
    const list = await this.prisma.auditLog.findMany({ where: { customerId: id }, orderBy: { id: 'desc' }, take: 100 })
    return list.map(l => ({ ...l, createdAt: fmt(l.createdAt) }))
  }

  // ───────── 测评、方案 ─────────

  @Get('assessments')
  async assessments(@CurrentUser() u: StaffUser, @Query() q: any) {
    const ids = await this.scopedCustomerIds(u)
    const list = await this.prisma.assessment.findMany({ where: { ...(ids ? { customerId: { in: ids } } : {}), ...(q.riskLevel ? { riskLevel: q.riskLevel } : {}), ...(q.status ? { status: q.status } : {}) }, orderBy: { id: 'desc' }, take: 200 })
    const cmap = await this.customerMap(list.map(a => a.customerId))
    const smap = await this.staffMap()
    return list.map(a => ({ id: a.id, customerId: a.customerId, customer: cmap.get(a.customerId)?.salutation, mode: a.mode, assistedBy: smap.get(a.assistedBy || 0)?.name, status: a.status, riskLevel: a.riskLevel, index: a.indexScore, startedAt: fmt(a.startedAt), completedAt: fmt(a.completedAt) }))
  }

  @Post('assessments/assist')
  assist(@CurrentUser() u: StaffUser, @Body() body: { assistCode: string }) {
    return this.assess.assist(u.id, body.assistCode)
  }

  @Post('assessments/simulate')
  simulate(@Body() body: any) {
    return this.assess.simulate(body)
  }

  @Get('plans')
  async planList(@CurrentUser() u: StaffUser, @Query() q: any) {
    const ids = await this.scopedCustomerIds(u)
    const where: any = { status: { not: 'void' }, ...(ids ? { customerId: { in: ids } } : {}) }
    if (q.reviewStatus) where.reviewStatus = q.reviewStatus
    if (q.status) where.status = q.status
    const list = await this.prisma.plan.findMany({ where, orderBy: { id: 'desc' }, take: 200 })
    const cmap = await this.customerMap(list.map(p => p.customerId))
    const smap = await this.staffMap()
    return list.map(p => ({
      id: p.id, planNo: p.planNo, customerId: p.customerId, customer: cmap.get(p.customerId)?.salutation, advisor: smap.get(cmap.get(p.customerId)?.advisorId || 0)?.name,
      packages: ((p.skeleton as any)?.packages || []).map((x: any) => x.name).join(' + '), riskLevel: p.riskLevel, engine: p.engine, trigger: p.trigger,
      reviewStatus: p.reviewStatus, status: p.status, createdAt: fmt(p.createdAt), sentAt: fmt(p.sentAt),
    }))
  }

  @Get('plans/:id')
  async planDetail(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number) {
    const p = await this.prisma.plan.findUnique({ where: { id } })
    if (!p) throw Err.notFound()
    const c = await this.prisma.customer.findUnique({ where: { id: p.customerId } })
    const showDoctor = ['health_advisor', 'super_admin'].includes(u.role)
    return { ...p, customer: { id: c?.id, salutation: c?.salutation, tier: c?.tier, elderMode: c?.elderMode }, contentDoctor: showDoctor ? p.contentDoctor : '（仅健康顾问可见）', createdAt: fmt(p.createdAt), sentAt: fmt(p.sentAt), reviewedAt: fmt(p.reviewedAt) }
  }

  @Post('plans/regenerate')
  async regenerate(@CurrentUser() u: StaffUser, @Body() body: { customerId: number }) {
    const p = await this.plans.generate(Number(body.customerId), 'manual')
    await this.wf.audit(this.actor(u), 'plan.regenerate', { type: 'plan', id: p.id, customerId: p.customerId })
    return { id: p.id }
  }

  @Post('plans/:id/review')
  review(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: { approve: boolean, note?: string, contentCustomer?: any }) {
    requireRole(u, ['health_advisor'])
    return this.plans.review(id, u, body.approve, body.note, { contentCustomer: body.contentCustomer })
  }

  @Post('plans/:id/mark-sent')
  markSent(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number) {
    requireRole(u, ['advisor', 'store_manager', 'health_advisor'])
    return this.plans.markSent(id, u)
  }

  // ───────── 预警 ─────────

  @Get('alerts')
  async alerts(@CurrentUser() u: StaffUser, @Query() q: any) {
    const ids = await this.scopedCustomerIds(u)
    const where: any = { ...(ids ? { customerId: { in: ids } } : {}) }
    if (q.status === 'open') where.status = { not: 'closed' }
    else if (q.status) where.status = q.status
    if (q.source) where.source = q.source
    const list = await this.prisma.riskAlert.findMany({ where, orderBy: [{ status: 'asc' }, { slaDueAt: 'asc' }], take: 200 })
    const cmap = await this.customerMap(list.map(a => a.customerId))
    const smap = await this.staffMap()
    const stores = await this.prisma.store.findMany()
    return list.map(a => {
      const c = cmap.get(a.customerId)
      return {
        id: a.id, level: a.level, levelName: ALERT_LEVEL[a.level], source: a.source, sourceName: ALERT_SOURCE[a.source], title: a.title, excerpt: a.source === 'mirror' ? a.excerpt : undefined,
        customerId: a.customerId, customer: c?.salutation, phone: c?.phone, store: stores.find(s => s.id === c?.storeId)?.name, advisor: smap.get(c?.advisorId || 0)?.name,
        status: a.status, createdAt: fmt(a.createdAt), slaDueAt: fmt(a.slaDueAt), minutesLeft: Math.round((a.slaDueAt.getTime() - Date.now()) / 60000),
        contactLogs: a.contactLogs, conclusion: a.conclusion, closedBy: a.closedBy, closedAt: fmt(a.closedAt), escalationLevel: a.escalationLevel,
      }
    })
  }

  @Post('alerts/:id/contacts')
  async alertContact(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: { result: string, note?: string }) {
    const a = await this.prisma.riskAlert.findUnique({ where: { id } })
    if (!a) throw Err.notFound()
    const logs = [...((a.contactLogs as any[]) || []), { at: fmt(new Date()), by: u.name, result: body.result, note: body.note }]
    const missed = logs.filter(l => l.result === '未接通').length
    await this.prisma.riskAlert.update({ where: { id }, data: { contactLogs: logs, status: 'contacting' } })
    await this.prisma.task.updateMany({ where: { refTable: 'risk_alert', refId: id, status: 'todo' }, data: { status: 'done', doneAt: new Date() } })
    await this.wf.audit(this.actor(u), 'alert.contact', { type: 'risk_alert', id, customerId: a.customerId }, body)
    if (body.result === '未接通') {
      const c = await this.prisma.customer.findUnique({ where: { id: a.customerId } })
      await this.wf.createTask({ staffId: c?.advisorId, customerId: a.customerId, type: 'alert_call', refTable: 'risk_alert', refId: id, title: `再次拨打${c?.salutation}（第 ${missed + 1} 次）${missed >= 3 ? '，请联系紧急联系人或已绑定的家人' : ''}`, hours: 0.5 })
    }
    return { ok: true, hint: missed >= 3 ? '已连续 3 次未接通，请联系紧急联系人或已绑定的家人（需 C6 包含"接收提醒"）' : null }
  }

  @Post('alerts/:id/close')
  async closeAlert(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: { conclusion: string }) {
    const a = await this.prisma.riskAlert.findUnique({ where: { id } })
    if (!a) throw Err.notFound()
    if (!body.conclusion) throw Err.bad('关闭预警必须填写处理结论')
    if (a.level === 'L3') requireRole(u, ['store_manager', 'health_advisor'])
    await this.prisma.riskAlert.update({ where: { id }, data: { status: 'closed', conclusion: body.conclusion, closedBy: u.name, closedAt: new Date() } })
    await this.prisma.task.updateMany({ where: { refTable: 'risk_alert', refId: id, status: 'todo' }, data: { status: 'done', doneAt: new Date() } })
    await this.wf.audit(this.actor(u), 'alert.close', { type: 'risk_alert', id, customerId: a.customerId }, body)
    // 没有其它未关闭的 L2/L3 时解除门店项目暂停，并重新生成方案
    if (!(await this.wf.hasActiveRedFlag(a.customerId))) {
      await this.prisma.healthTag.updateMany({ where: { customerId: a.customerId, tagCode: 'red_flag_active', status: 'active' }, data: { status: 'revoked' } })
      if (['L2', 'L3'].includes(a.level)) {
        try { await this.plans.generate(a.customerId, 'alert_closed') }
        catch {}
      }
    }
    return { ok: true }
  }

  // ───────── 报告审核、门店测量 ─────────

  @Get('reports')
  async reports(@Query('reviewStatus') reviewStatus?: string) {
    const list = await this.prisma.report.findMany({ where: reviewStatus ? { reviewStatus } : {}, orderBy: { id: 'desc' }, take: 200 })
    const cmap = await this.customerMap(list.map(r => r.customerId))
    return list.map(r => ({ id: r.id, type: r.type, title: r.title, customer: cmap.get(r.customerId)?.salutation, customerId: r.customerId, source: r.sourceLabel, reviewStatus: r.reviewStatus, aiGenerated: r.aiGenerated, createdAt: fmt(r.createdAt) }))
  }

  @Get('reports/:id')
  report(@Param('id', ParseIntPipe) id: number) {
    return this.archive.report(null, id)
  }

  @Post('reports/:id/review')
  async reviewReport(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: { approve: boolean }) {
    requireRole(u, ['health_advisor'])
    await this.prisma.report.update({ where: { id }, data: { reviewStatus: body.approve ? 'approved' : 'rejected', reviewer: u.name, reviewedAt: new Date(), publishedAt: body.approve ? new Date() : null } })
    await this.wf.audit(this.actor(u), 'report.review', { type: 'report', id }, body)
    return { ok: true }
  }

  @Post('measurements')
  measurement(@CurrentUser() u: StaffUser, @Body() body: any) {
    return this.archive.createMeasurement(body, u)
  }

  // ───────── 体检券、转介、线索 ─────────

  @Get('coupons')
  async coupons(@CurrentUser() u: StaffUser, @Query('status') status?: string) {
    const ids = await this.scopedCustomerIds(u)
    const list = await this.prisma.coupon.findMany({ where: { ...(ids ? { customerId: { in: ids } } : {}), ...(status ? { status } : {}) }, orderBy: { id: 'desc' }, take: 300 })
    const cmap = await this.customerMap(list.map(c => c.customerId))
    const hospitals = await this.prisma.hospital.findMany()
    const all = await this.prisma.coupon.groupBy({ by: ['status'], where: ids ? { customerId: { in: ids } } : {}, _count: true })
    return {
      stats: Object.keys(COUPON_STATUS).map(k => ({ status: k, name: COUPON_STATUS[k], count: all.find(a => a.status === k)?._count || 0 })),
      list: list.map(c => ({ id: c.id, couponNo: c.couponNo, customer: cmap.get(c.customerId)?.salutation, phoneTail: cmap.get(c.customerId)?.phone?.slice(-4), customerId: c.customerId, type: c.type, status: c.status, statusName: COUPON_STATUS[c.status], hospital: hospitals.find(h => h.id === c.hospitalId)?.name, issuedAt: fmt(c.issuedAt, 'YYYY-MM-DD'), claimedAt: fmt(c.claimedAt, 'YYYY-MM-DD'), expiresAt: fmt(c.expiresAt, 'YYYY-MM-DD'), voidReason: c.voidReason })),
    }
  }

  @Post('coupons/claim')
  claim(@CurrentUser() u: StaffUser, @Body() body: { couponNo: string }) {
    return this.checkup.claim(`${body.couponNo}`.trim(), u)
  }

  @Post('coupons/:id/void')
  async voidCoupon(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: { reason: string }) {
    if (!body.reason) throw Err.bad('请填写作废原因')
    await this.prisma.coupon.update({ where: { id }, data: { status: 'void', voidReason: body.reason } })
    await this.wf.audit(this.actor(u), 'coupon.void', { type: 'coupon', id }, body)
    return { ok: true }
  }

  @Get('referrals')
  async referrals(@CurrentUser() u: StaffUser, @Query('status') status?: string) {
    const ids = await this.scopedCustomerIds(u)
    const list = await this.prisma.referral.findMany({ where: { ...(ids ? { customerId: { in: ids } } : {}), ...(status ? { status } : {}) }, orderBy: { id: 'desc' }, take: 200 })
    const cmap = await this.customerMap(list.map(r => r.customerId))
    const hospitals = await this.prisma.hospital.findMany()
    const services = await this.prisma.medicalService.findMany()
    return list.map(r => ({ id: r.id, referralNo: r.referralNo, customer: cmap.get(r.customerId)?.salutation, customerId: r.customerId, hospital: hospitals.find(h => h.id === r.hospitalId)?.name, services: (r.services as string[]).map(s => services.find(x => x.code === s)?.name || s).join('、'), level: r.level, status: r.status, statusName: REFERRAL_STATUS[r.status], c4Granted: r.c4Granted, appointmentAt: fmt(r.appointmentAt), createdAt: fmt(r.createdAt) }))
  }

  @Get('referrals/:id')
  referral(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number) {
    return this.checkup.referralDetail(id, {})
  }

  @Post('referrals/:id/cancel')
  async cancelReferral(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: { reason: string }) {
    await this.prisma.referral.update({ where: { id }, data: { status: 'cancelled', cancelReason: body.reason || '门店取消' } })
    return { ok: true }
  }

  @Post('referrals/:id/urge')
  async urge(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number) {
    const r = await this.prisma.referral.findUnique({ where: { id } })
    const timeline = [...((r?.timeline as any[]) || []), { at: fmt(new Date()), text: `${u.name}催办` }]
    await this.prisma.referral.update({ where: { id }, data: { timeline } })
    return { ok: true }
  }

  @Get('leads')
  async leads(@CurrentUser() u: StaffUser, @Query() q: any) {
    const ids = await this.scopedCustomerIds(u)
    const where: any = { ...(ids ? { customerId: { in: ids } } : {}) }
    if (q.status) where.status = q.status
    if (q.type) where.type = q.type
    const list = await this.prisma.lead.findMany({ where, orderBy: { id: 'desc' }, take: 300 })
    const cmap = await this.customerMap(list.map(l => l.customerId))
    const smap = await this.staffMap()
    return list.map(l => ({ id: l.id, leadNo: l.leadNo, type: l.type, typeName: LEAD_TYPE[l.type], module: l.moduleName, customer: cmap.get(l.customerId)?.salutation, customerId: l.customerId, tier: TIER_NAMES[cmap.get(l.customerId)?.tier || 'C'], status: l.status, statusName: LEAD_STATUS[l.status], assignee: smap.get(l.assigneeId || 0)?.name, slaDueAt: fmt(l.slaDueAt), overdue: l.status === 'new' && !!l.slaDueAt && l.slaDueAt < new Date(), createdAt: fmt(l.createdAt), wonAmount: l.wonAmount }))
  }

  @Get('leads/:id')
  async lead(@Param('id', ParseIntPipe) id: number) {
    const l = await this.prisma.lead.findUnique({ where: { id } })
    if (!l) throw Err.notFound()
    const c = await this.prisma.customer.findUnique({ where: { id: l.customerId } })
    const followups = await this.prisma.leadFollowup.findMany({ where: { leadId: id }, orderBy: { id: 'desc' } })
    const partner = l.partnerId ? await this.prisma.partner.findUnique({ where: { id: l.partnerId } }) : null
    return { ...l, typeName: LEAD_TYPE[l.type], statusName: LEAD_STATUS[l.status], customer: { salutation: c?.salutation, phone: c?.phone, tier: TIER_NAMES[c?.tier || 'C'] }, partner: partner?.name, followups: followups.map(f => ({ ...f, createdAt: fmt(f.createdAt) })), createdAt: fmt(l.createdAt), slaDueAt: fmt(l.slaDueAt), handedOverAt: fmt(l.handedOverAt) }
  }

  @Post('leads/:id/followups')
  async leadFollow(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: { method: string, content: string, status?: string }) {
    await this.prisma.leadFollowup.create({ data: { leadId: id, staffName: u.name, method: body.method || 'phone', content: body.content } })
    const l = await this.prisma.lead.findUnique({ where: { id } })
    await this.prisma.lead.update({ where: { id }, data: { status: body.status || (l?.status === 'new' ? 'contacted' : l?.status) } })
    await this.prisma.task.updateMany({ where: { refTable: 'lead', refId: id, status: 'todo' }, data: { status: 'done', doneAt: new Date() } })
    return { ok: true }
  }

  @Post('leads/:id/handover')
  async handover(@Param('id', ParseIntPipe) id: number) {
    await this.prisma.lead.update({ where: { id }, data: { handedOverAt: new Date(), status: 'negotiating' } })
    return { ok: true }
  }

  @Post('leads/:id/won')
  async won(@Param('id', ParseIntPipe) id: number, @Body() body: { amount: number }) {
    await this.prisma.lead.update({ where: { id }, data: { status: 'won', wonAmount: Number(body.amount) || 0 } })
    return { ok: true }
  }

  @Post('leads/:id/lost')
  async lost(@Param('id', ParseIntPipe) id: number, @Body() body: { reason: string }) {
    if (!body.reason) throw Err.bad('请选择丢单原因')
    await this.prisma.lead.update({ where: { id }, data: { status: 'lost', lostReason: body.reason } })
    return { ok: true }
  }

  // ───────── 移动工作台：服务前确认 ─────────

  @Post('service-checks/preview')
  async serviceCheckPreview(@Body() body: { customerId: number, projectCode: string }) {
    const project = (await this.engine.projects()).find(p => p.code === body.projectCode)
    if (!project) throw Err.notFound('项目不存在')
    const tags = await this.wf.activeTags(Number(body.customerId))
    const r = screenProject(project, await this.engine.rules('contraindication'), tags)
    return { project: project.name, ...r, tags: tags.map(t => ({ code: t, name: tagName(t) })) }
  }

  @Post('service-checks')
  async serviceCheck(@CurrentUser() u: StaffUser, @Body() body: { customerId: number, projectCode: string, result?: any }) {
    await this.prisma.serviceCheck.create({ data: { customerId: Number(body.customerId), projectCode: body.projectCode, staffName: u.name, result: body.result } })
    await this.wf.audit(this.actor(u), 'service.check', { type: 'customer', id: Number(body.customerId), customerId: Number(body.customerId) }, body)
    return { ok: true }
  }

  // ───────── 门店《健康档案表（女）》数字化 ─────────

  @Get('intake/form')
  intakeForm() {
    return INTAKE_FORM
  }

  /** 录入：顾问 / 店长 / 健康顾问；客户未在线授权 C2 时，须确认已签署纸质授权（渠道 paper） */
  @Post('customers/:id/intakes')
  async createIntake(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: { data: any, paperConsent?: boolean, consultant?: string }) {
    requireRole(u, ['advisor', 'store_manager', 'health_advisor'])
    const c = await this.prisma.customer.findUnique({ where: { id } })
    if (!c) throw Err.notFound()
    let channel = 'self'
    if (!(await this.wf.hasConsent(id, 'C2'))) {
      if (!body.paperConsent) throw Err.bad('客户尚未授权健康信息处理（C2），请先请客户签署纸质授权并勾选确认')
      await this.wf.grantConsent(id, 'C2', true, { source: 'health_intake_form' }, 'paper')
      channel = 'paper'
    }
    const { tags, notes, urgent } = mapIntake(body.data || {})
    const intake = await this.prisma.healthIntake.create({ data: { customerId: id, data: body.data || {}, tags, staffName: u.name, consultant: body.consultant, consentChannel: channel } })
    for (const t of tags) await this.wf.setTag(id, t, 'staff', intake.id)
    await this.wf.addRecord({ customerId: id, recordType: 'service', sourceLabel: 'SELF', title: '门店健康档案表', summary: `本人自述，${u.name}协助填写${tags.length ? `；生成 ${tags.length} 个健康标签` : ''}`, refTable: 'health_intake', refId: intake.id, storeId: c.storeId })
    if (urgent.length) {
      await this.wf.createAlert({ customerId: id, source: 'staff', sourceRefId: intake.id, level: 'L2', ruleCodes: [`INTAKE_${intake.id}`], title: `健康档案表登记近 1 周不适：${urgent.join('、')}，需健康顾问评估` })
    }
    await this.wf.audit(this.actor(u), 'health.intake.create', { type: 'health_intake', id: intake.id, customerId: id }, { tags })
    return { id: intake.id, tags, notes, alert: urgent.length > 0 }
  }

  /** 查看完整档案表：仅健康顾问 / 超管，写审计 */
  @Get('customers/:id/intakes')
  async intakes(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number) {
    requireRole(u, ['health_advisor'])
    await this.wf.audit(this.actor(u), 'health.view', { type: 'health_intake', customerId: id })
    const list = await this.prisma.healthIntake.findMany({ where: { customerId: id }, orderBy: { id: 'desc' } })
    return list.map(i => ({ ...i, createdAt: fmt(i.createdAt), tagNames: ((i.tags as string[]) || []).map(t => tagName(t)) }))
  }

  @Get('customers-search')
  async search(@CurrentUser() u: StaffUser, @Query('q') q: string) {
    const list = await this.prisma.customer.findMany({ where: { ...scopeWhere(u), OR: [{ salutation: { contains: q || '' } }, { phone: { endsWith: q || '' } }] }, take: 20 })
    const lastA = await this.prisma.assessment.findMany({ where: { customerId: { in: list.map(c => c.id) }, status: 'completed' }, orderBy: { id: 'desc' } })
    const plans = await this.prisma.plan.findMany({ where: { customerId: { in: list.map(c => c.id) }, status: { not: 'void' } }, orderBy: { id: 'desc' } })
    return list.map(c => ({
      id: c.id, salutation: c.salutation, phoneTail: c.phone?.slice(-4), tier: TIER_NAMES[c.tier], age: c.birthYear ? ageOf(c.birthYear) : null, lastVisitAt: fmt(c.lastVisitAt, 'YYYY-MM-DD'),
      riskLevel: lastA.find(a => a.customerId === c.id)?.riskLevel || '未测评', packages: ((plans.find(p => p.customerId === c.id)?.skeleton as any)?.packages || []).map((p: any) => p.name).join(' + '),
    }))
  }
}
