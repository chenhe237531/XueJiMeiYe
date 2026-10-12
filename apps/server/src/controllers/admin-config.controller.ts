import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common'
import dayjs from 'dayjs'
import { Aud, CurrentUser, requireRole, ROLE_NAMES, type StaffUser } from '../common/auth'
import { PrismaService } from '../common/prisma.service'
import { Err } from '../common/response'
import { fmt, TIER_NAMES } from '../common/util'
import { evaluateRedFlags, evaluateRiskSignals, buildFacts, riskLevelOf } from '../engine'
import { LEVELS } from '../engine/question-bank'
import { findBannedWords, PROJECT_ATTRS, TAG_NAMES } from '../engine/rules-data'
import { AiService } from '../services/ai.service'
import { EngineService } from '../services/engine.service'
import { HomeService } from '../services/home.service'
import { TierService } from '../services/tier.service'
import { WorkflowService } from '../services/workflow.service'

/** 规则测试集（17.3 规则回归测试集的演示版） */
const RULE_TESTS = [
  { name: '62 岁，OSTA 偏低，腰背酸痛 > 3 个月', age: 62, answers: { B01: { value: 155 }, B02: { value: 50 }, P02: { values: ['waist'] }, P03: { value: 'gt3' } }, expect: 'L1' },
  { name: '胸痛胸闷', age: 55, answers: { H04: { value: 'yes' } }, expect: 'L3' },
  { name: '经量多伴头晕', age: 42, answers: { W01: { value: 'regular' }, W05: { value: 'heavy' }, W06: { value: 'yes' } }, expect: 'L3' },
  { name: '绝经后出血', age: 58, answers: { W01: { value: 'meno' }, W11: { value: 'yes' } }, expect: 'L2' },
  { name: '情绪筛查阳性', age: 45, answers: { M04: { value: '2' }, M05: { value: '2' }, M08: { value: 'no' } }, expect: 'L1' },
  { name: '自伤念头', age: 45, answers: { M04: { value: '3' }, M05: { value: '3' }, M08: { value: 'yes' } }, expect: 'L3' },
  { name: '健康年轻客户', age: 32, answers: { B01: { value: 165 }, B02: { value: 55 }, M02: { value: 'rare' } }, expect: 'L0' },
]

@Controller('admin')
@Aud('admin')
export class AdminConfigController {
  constructor(
    private prisma: PrismaService,
    private wf: WorkflowService,
    private home: HomeService,
    private tier: TierService,
    private engine: EngineService,
    private ai: AiService,
  ) {}

  // ───────── 分级 ─────────

  @Get('tier-rules')
  async tierRules() {
    const rules = await this.prisma.tierRule.findMany({ orderBy: { version: 'desc' } })
    const dist = await this.prisma.customer.groupBy({ by: ['tier'], _count: true })
    const total = dist.reduce((s, d) => s + d._count, 0) || 1
    return { rules: rules.map(r => ({ ...r, publishedAt: fmt(r.publishedAt) })), distribution: ['A', 'B', 'C'].map(t => ({ tier: t, name: TIER_NAMES[t], count: dist.find(d => d.tier === t)?._count || 0, ratio: Math.round(((dist.find(d => d.tier === t)?._count || 0) / total) * 1000) / 10 })) }
  }

  @Post('tier-rules/simulate')
  simulate(@Body() body: any) {
    return this.tier.simulate(body)
  }

  @Post('tier-rules/publish')
  publish(@CurrentUser() u: StaffUser, @Body() body: any) {
    requireRole(u, ['ops'])
    return this.tier.publish(body, u.name)
  }

  @Post('tier/recalc')
  recalc() {
    return this.tier.recalc({ monthly: true })
  }

  @Get('tier-history')
  async tierHistory() {
    const list = await this.prisma.tierHistory.findMany({ orderBy: { id: 'desc' }, take: 100 })
    const cs = await this.prisma.customer.findMany({ where: { id: { in: list.map(l => l.customerId) } } })
    const R: Record<string, string> = { auto_up: '自动升级', auto_down: '自动降级', manual: '人工调整', new: '新客' }
    return list.map(l => ({ ...l, customer: cs.find(c => c.id === l.customerId)?.salutation, reasonName: R[l.reason], createdAt: fmt(l.createdAt) }))
  }

  // ───────── 模块 ─────────

  @Get('modules')
  async modules() {
    const list = await this.prisma.module.findMany({ orderBy: [{ sort: 'asc' }] })
    const partners = await this.prisma.partner.findMany()
    const leads = await this.prisma.lead.groupBy({ by: ['moduleCode'], _count: true })
    const views = await this.prisma.eventLog.findMany({ where: { event: 'module_view' } })
    return list.map(m => ({ ...m, partner: partners.find(p => p.id === m.partnerId)?.name, leads: leads.find(l => l.moduleCode === m.code)?._count || 0, views: views.filter(v => (v.props as any)?.moduleCode === m.code).length, startAt: fmt(m.startAt), endAt: fmt(m.endAt) }))
  }

  @Post('modules')
  async createModule(@CurrentUser() u: StaffUser, @Body() body: any) {
    requireRole(u, ['ops'])
    const banned = findBannedWords(`${body.name}${body.summary}${JSON.stringify(body.detail || {})}`)
    const m = await this.prisma.module.create({ data: { ...this.moduleData(body), complianceStatus: 'draft', status: 'offline' } })
    return { id: m.id, banned }
  }

  @Put('modules/:id')
  async updateModule(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    requireRole(u, ['ops'])
    const banned = findBannedWords(`${body.name}${body.summary}${JSON.stringify(body.detail || {})}`)
    await this.prisma.module.update({ where: { id }, data: this.moduleData(body) })
    await this.wf.audit({ type: 'staff', id: u.id, name: u.name }, 'module.update', { type: 'module', id })
    return { ok: true, banned }
  }

  private moduleData(b: any) {
    const d: any = {}
    for (const k of ['code', 'name', 'category', 'entryType', 'entryConfig', 'icon', 'cover', 'summary', 'detail', 'visibleTiers', 'visibleStoreIds', 'elderOk', 'healthRules', 'partnerId', 'showPartnerLicense', 'leadConfig', 'sort', 'version']) if (b[k] !== undefined) d[k] = b[k]
    if (b.startAt !== undefined) d.startAt = b.startAt ? new Date(b.startAt) : null
    if (b.endAt !== undefined) d.endAt = b.endAt ? new Date(b.endAt) : null
    return d
  }

  /** 合规状态流转：draft → pending_review → approved → online */
  @Post('modules/:id/:action')
  async moduleAction(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Param('action') action: string, @Body() body: any) {
    const m = await this.prisma.module.findUnique({ where: { id } })
    if (!m) throw Err.notFound()
    const data: any = {}
    if (action === 'submit-review') data.complianceStatus = 'pending_review'
    else if (action === 'review') { requireRole(u, ['health_advisor', 'ops']); data.complianceStatus = body.approve ? 'approved' : 'rejected' }
    else if (action === 'online') {
      if (m.complianceStatus !== 'approved') throw Err.conflict('模块需先通过合规审核才能上线')
      data.status = 'online'
    }
    else if (action === 'offline') data.status = 'offline'
    else throw Err.bad()
    await this.prisma.module.update({ where: { id }, data })
    await this.wf.audit({ type: 'staff', id: u.id, name: u.name }, `module.${action}`, { type: 'module', id }, body)
    return { ok: true }
  }

  // ───────── 首页配置 ─────────

  @Get('home-layouts')
  async layouts() {
    const list = await this.prisma.homeLayout.findMany({ orderBy: [{ tier: 'asc' }, { elderMode: 'asc' }, { version: 'desc' }] })
    const combos = ['A', 'B', 'C'].flatMap(t => [false, true].map(e => ({ tier: t, elderMode: e })))
    return combos.map(c => {
      const versions = list.filter(l => l.tier === c.tier && l.elderMode === c.elderMode)
      return { ...c, name: `${TIER_NAMES[c.tier]} · ${c.elderMode ? '乐龄模式' : '标准模式'}`, published: versions.find(v => v.status === 'published') || null, versions: versions.map(v => ({ id: v.id, version: v.version, status: v.status, publishedAt: fmt(v.publishedAt), publishedBy: v.publishedBy, createdAt: fmt(v.createdAt) })) }
    })
  }

  @Get('home-layouts/:id')
  async layout(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.homeLayout.findUnique({ where: { id } })
  }

  private async validateLayout(tier: string, elderMode: boolean, components: any[]) {
    const errors: string[] = []
    if (!components.some(c => c.type === 'healthCard')) errors.push('每套布局必须包含健康卡 healthCard')
    const modules = await this.prisma.module.findMany()
    for (const c of components) {
      const codes: string[] = [...(c.props?.modules || []), ...(c.props?.module ? [c.props.module] : [])]
      for (const code of codes) {
        const m = modules.find(x => x.code === code)
        if (!m) errors.push(`模块 ${code} 不存在`)
        else if (!((m.visibleTiers as string[]) || []).includes(tier)) errors.push(`模块「${m.name}」对 ${TIER_NAMES[tier]} 不可见`)
      }
      if (elderMode && c.type === 'entryGrid' && (c.props?.modules || []).length > 6) errors.push('乐龄布局的入口宫格不能超过 6 个')
    }
    return errors
  }

  @Post('home-layouts')
  async saveLayout(@CurrentUser() u: StaffUser, @Body() body: { tier: string, elderMode: boolean, components: any[] }) {
    requireRole(u, ['ops'])
    const last = await this.prisma.homeLayout.findFirst({ where: { tier: body.tier, elderMode: body.elderMode }, orderBy: { version: 'desc' } })
    const l = await this.prisma.homeLayout.create({ data: { tier: body.tier, elderMode: body.elderMode, components: body.components, version: (last?.version || 0) + 1, status: 'draft' } })
    return { id: l.id, version: l.version, warnings: await this.validateLayout(body.tier, body.elderMode, body.components) }
  }

  @Post('home-layouts/:id/publish')
  async publishLayout(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number) {
    requireRole(u, ['ops'])
    const l = await this.prisma.homeLayout.findUnique({ where: { id } })
    if (!l) throw Err.notFound()
    const errors = await this.validateLayout(l.tier, l.elderMode, l.components as any[])
    if (errors.length) throw Err.bad(`发布前校验未通过：${errors.join('；')}`)
    await this.prisma.homeLayout.updateMany({ where: { tier: l.tier, elderMode: l.elderMode, status: 'published' }, data: { status: 'archived' } })
    await this.prisma.homeLayout.update({ where: { id }, data: { status: 'published', publishedAt: new Date(), publishedBy: u.name } })
    await this.wf.audit({ type: 'staff', id: u.id, name: u.name }, 'home_layout.publish', { type: 'home_layout', id })
    return { ok: true }
  }

  @Post('home-layouts/preview')
  preview(@Body() body: { tier: string, elderMode: boolean, components?: any[] }) {
    return this.home.resolve(null, body)
  }

  // ───────── 测评题库 ─────────

  @Get('assessment-templates')
  async templates() {
    const tpls = await this.prisma.assessmentTemplate.findMany({ orderBy: { id: 'desc' } })
    const counts = await this.prisma.assessmentQuestion.groupBy({ by: ['templateId', 'level'], _count: true })
    return { templates: tpls.map(t => ({ ...t, publishedAt: fmt(t.publishedAt) })), levels: LEVELS.map(l => ({ ...l, count: counts.filter(c => c.level === l.code && c.templateId === tpls[0]?.id).reduce((s, c) => s + c._count, 0) })) }
  }

  @Get('assessment-templates/:id/questions')
  async questions(@Param('id', ParseIntPipe) id: number, @Query('level') level?: string) {
    return this.prisma.assessmentQuestion.findMany({ where: { templateId: id, ...(level ? { level } : {}) }, orderBy: { seq: 'asc' } })
  }

  @Put('assessment-questions/:id')
  async updateQuestion(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    requireRole(u, ['health_advisor'])
    const d: any = {}
    for (const k of ['title', 'voiceText', 'intro', 'options', 'config', 'showIf', 'required']) if (body[k] !== undefined) d[k] = body[k]
    await this.prisma.assessmentQuestion.update({ where: { id }, data: d })
    await this.wf.audit({ type: 'staff', id: u.id, name: u.name }, 'question.update', { type: 'question', id })
    return { ok: true }
  }

  // ───────── 方案引擎 ─────────

  @Get('engine/meta')
  meta() {
    return { attributes: PROJECT_ATTRS, tags: TAG_NAMES }
  }

  @Get('projects')
  projects() {
    return this.prisma.project.findMany({ orderBy: { code: 'asc' } })
  }

  @Put('projects/:id')
  async updateProject(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    requireRole(u, ['health_advisor', 'ops'])
    const d: any = {}
    for (const k of ['name', 'dimension', 'attributes', 'defaultFreq', 'durationMin', 'priceRef', 'status']) if (body[k] !== undefined) d[k] = body[k]
    await this.prisma.project.update({ where: { id }, data: d })
    return { ok: true }
  }

  @Get('plan-packages')
  async packages() {
    return this.prisma.planPackage.findMany({ orderBy: { priority: 'asc' } })
  }

  @Get('rules')
  async rules(@Query('kind') kind?: string) {
    return (await this.prisma.rule.findMany({ where: kind ? { kind } : {}, orderBy: { code: 'asc' } })).map(r => ({ ...r, updatedAt: fmt(r.updatedAt) }))
  }

  @Put('rules/:id')
  async updateRule(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    requireRole(u, ['health_advisor'])
    const r = await this.prisma.rule.findUnique({ where: { id } })
    const d: any = { version: (r?.version || 1) + 1 }
    for (const k of ['conditionText', 'condition', 'action', 'customerText', 'staffAction', 'status', 'level', 'doctorConfirmed']) if (body[k] !== undefined) d[k] = body[k]
    await this.prisma.rule.update({ where: { id }, data: d })
    await this.wf.audit({ type: 'staff', id: u.id, name: u.name }, 'rule.update', { type: 'rule', id }, { code: r?.code })
    return { ok: true }
  }

  /** 用测试集跑一遍，显示命中情况（6.2.7 规则发布流程第 3 步） */
  @Post('rules/test')
  async testRules() {
    const questions = await this.engine.questions()
    const rules = await this.engine.rules()
    return RULE_TESTS.map((t) => {
      const facts = buildFacts({ age: t.age, gender: 'female', answers: t.answers, questions })
      const red = evaluateRedFlags(rules, facts)
      const risk = evaluateRiskSignals(rules, facts)
      const level = riskLevelOf(red, risk)
      return { name: t.name, expect: t.expect, actual: level, pass: level === t.expect, hits: [...red, ...risk].map(r => r.code), computed: facts.c }
    })
  }

  @Get('lifestyle-tips')
  lifestyle() {
    return this.prisma.lifestyleTip.findMany()
  }

  @Get('scripts')
  scripts() {
    return this.prisma.script.findMany()
  }

  @Get('medical-services')
  medical() {
    return this.prisma.medicalService.findMany()
  }

  // ───────── 设备 ─────────

  @Get('devices')
  async devices() {
    const list = await this.prisma.device.findMany({ orderBy: { id: 'asc' } })
    const metrics = await this.prisma.deviceMetric.findMany()
    const stores = await this.prisma.store.findMany()
    return list.map(d => ({ ...d, store: stores.find(s => s.id === d.storeId)?.name, metrics: metrics.filter(m => m.deviceId === d.id), reviewedAt: fmt(d.reviewedAt) }))
  }

  @Post('devices')
  async createDevice(@CurrentUser() u: StaffUser, @Body() body: any) {
    const d = await this.prisma.device.create({ data: { storeId: body.storeId, name: body.name, model: body.model, manufacturer: body.manufacturer, isMedicalDevice: !!body.isMedicalDevice, registrationNo: body.registrationNo, approvedUse: body.approvedUse, principle: body.principle, admissionStatus: 'pending' } })
    return { id: d.id }
  }

  @Post('devices/:id/review')
  async reviewDevice(@CurrentUser() u: StaffUser, @Param('id', ParseIntPipe) id: number, @Body() body: { status: string, note?: string }) {
    requireRole(u, ['health_advisor'])
    await this.prisma.device.update({ where: { id }, data: { admissionStatus: body.status, reviewNote: body.note, reviewedAt: new Date() } })
    await this.wf.audit({ type: 'staff', id: u.id, name: u.name }, 'device.review', { type: 'device', id }, body)
    return { ok: true }
  }

  // ───────── 合作方 ─────────

  @Get('hospitals')
  async hospitals() {
    const list = await this.prisma.hospital.findMany()
    const users = await this.prisma.hospitalUser.findMany()
    const pkgs = await this.prisma.checkupPackage.findMany()
    return list.map(h => ({ ...h, users: users.filter(x => x.hospitalId === h.id).map(x => ({ id: x.id, name: x.name, username: x.username, role: ROLE_NAMES[x.role] })), packages: pkgs.filter(p => p.hospitalId === h.id) }))
  }

  @Get('partners')
  async partners() {
    const list = await this.prisma.partner.findMany()
    const modules = await this.prisma.module.findMany()
    return list.map(p => ({ ...p, contractStart: fmt(p.contractStart, 'YYYY-MM-DD'), contractEnd: fmt(p.contractEnd, 'YYYY-MM-DD'), expiring: !!p.contractEnd && dayjs(p.contractEnd).diff(dayjs(), 'day') < 30, modules: modules.filter(m => m.partnerId === p.id).map(m => m.name) }))
  }

  @Post('partners')
  async createPartner(@Body() body: any) {
    const p = await this.prisma.partner.create({ data: { name: body.name, type: body.type, region: body.region, licenses: body.licenses || [], contact: body.contact || {}, contractStart: body.contractStart ? new Date(body.contractStart) : null, contractEnd: body.contractEnd ? new Date(body.contractEnd) : null } })
    return { id: p.id }
  }

  // ───────── 营销 ─────────

  @Get('activities')
  async activities() {
    return (await this.prisma.activity.findMany({ orderBy: { startAt: 'asc' } })).map(a => ({ ...a, startAt: fmt(a.startAt) }))
  }

  @Post('activities')
  async createActivity(@Body() body: any) {
    const a = await this.prisma.activity.create({ data: { code: `ACT${Date.now()}`, type: body.type, title: body.title, startAt: new Date(body.startAt), quota: Number(body.quota) || 30, visibleTiers: body.visibleTiers || ['A', 'B', 'C'] } })
    return { id: a.id }
  }

  @Get('groupbuy-activities')
  async groupbuys() {
    const acts = await this.prisma.groupbuyActivity.findMany()
    const groups = await this.prisma.groupbuyGroup.findMany()
    return acts.map(a => ({ ...a, groups: groups.filter(g => g.activityId === a.id).length, success: groups.filter(g => g.activityId === a.id && g.status === 'success').length }))
  }

  @Get('quiz-questions')
  quiz() {
    return this.prisma.quizQuestion.findMany()
  }

  @Post('quiz-questions')
  async createQuiz(@Body() body: any) {
    await this.prisma.quizQuestion.create({ data: { title: body.title, options: body.options, answer: Number(body.answer), knowledge: body.knowledge } })
    return { ok: true }
  }

  // ───────── 魔镜 ─────────

  @Get('mirror/persona')
  persona() {
    return this.prisma.mirrorPersona.findFirst()
  }

  @Put('mirror/persona')
  async savePersona(@CurrentUser() u: StaffUser, @Body() body: any) {
    requireRole(u, ['ops'])
    const p = await this.prisma.mirrorPersona.findFirst()
    const d: any = {}
    for (const k of ['name', 'tone', 'opening', 'quickTopics', 'forbiddenTopics', 'dailyLimit']) if (body[k] !== undefined) d[k] = body[k]
    await this.prisma.mirrorPersona.update({ where: { id: p!.id }, data: d })
    return { ok: true }
  }

  /** 抽检：已匿名化的对话片段（去掉称呼、人名、电话），写审计日志 */
  @Get('mirror/samples')
  async samples(@CurrentUser() u: StaffUser) {
    requireRole(u, ['health_advisor'])
    await this.wf.audit({ type: 'staff', id: u.id, name: u.name }, 'mirror.sample')
    const customers = await this.prisma.customer.findMany({ select: { salutation: true } })
    const names = customers.map(c => c.salutation).filter(Boolean) as string[]
    const msgs = await this.prisma.mirrorMessage.findMany({ orderBy: { id: 'desc' }, take: 60 })
    const anon = (t: string) => names.reduce((s, n) => s.split(n).join('[称呼]'), t).replace(/1[3-9]\d{9}/g, '[电话]')
    const bySession = new Map<number, any[]>()
    msgs.reverse().forEach(m => { if (!bySession.has(m.sessionId)) bySession.set(m.sessionId, []); bySession.get(m.sessionId)!.push({ role: m.role, content: anon(m.content), risk: m.riskCategory }) })
    return [...bySession.entries()].slice(-8).map(([id, list]) => ({ sample: `S${id}`, messages: list.slice(-6) }))
  }

  // ───────── 合规文本 ─────────

  @Get('consent-texts')
  async consentTexts() {
    const texts = await this.prisma.consentText.findMany({ orderBy: { type: 'asc' } })
    const recs = await this.prisma.consentRecord.groupBy({ by: ['type', 'granted'], _count: true })
    return texts.map(t => ({ ...t, granted: recs.find(r => r.type === t.type && r.granted)?._count || 0, rejected: recs.find(r => r.type === t.type && !r.granted)?._count || 0 }))
  }

  // ───────── 数据看板（15.3）─────────

  @Get('stats/overview')
  async statsOverview() {
    const monthStart = dayjs().startOf('month').toDate()
    const ev = async (event: string) => this.prisma.eventLog.count({ where: { event } })
    const customers = await this.prisma.customer.count()
    const registered = await this.prisma.customer.count({ where: { phone: { not: null } } })
    const assessStarted = await this.prisma.assessment.count()
    const assessDone = await this.prisma.assessment.count({ where: { status: 'completed' } })
    const couponIssued = await this.prisma.coupon.count()
    const couponClaimed = await this.prisma.coupon.count({ where: { status: { in: ['claimed', 'booked', 'used'] } } })
    const arrived = await this.prisma.referral.count({ where: { arrivedAt: { not: null } } })
    const plansSent = await this.prisma.plan.count({ where: { sentAt: { not: null } } })
    const returned = await this.prisma.referralReturn.count()
    // 北极星：当月有新增档案记录且到店 / 到院的客户数
    const recs = await this.prisma.record.findMany({ where: { occurredAt: { gte: monthStart } }, select: { customerId: true } })
    const visited = await this.prisma.customer.findMany({ where: { lastVisitAt: { gte: monthStart } }, select: { id: true } })
    const vset = new Set(visited.map(v => v.id))
    const northStar = new Set(recs.map(r => r.customerId).filter(id => vset.has(id))).size
    const leads = await this.prisma.lead.groupBy({ by: ['moduleName', 'status'], _count: true, _sum: { wonAmount: true } })
    const alerts = await this.prisma.riskAlert.findMany()
    const l3 = alerts.filter(a => a.level === 'L3')
    const l3InTime = l3.filter(a => ((a.contactLogs as any[]) || []).some(c => dayjs(c.at).toDate() <= a.slaDueAt) || (a.closedAt && a.closedAt <= a.slaDueAt)).length
    const plans = await this.prisma.plan.findMany({ where: { status: { not: 'void' } } })
    const reviewed = plans.filter(p => ['approved', 'rejected'].includes(p.reviewStatus))
    const ai = await this.prisma.aiCallLog.groupBy({ by: ['scene', 'status'], _count: true, _avg: { latencyMs: true }, _sum: { inputTokens: true, outputTokens: true } })
    const stores = await this.prisma.store.findMany()
    const allCustomers = await this.prisma.customer.findMany({ select: { id: true, storeId: true, tier: true } })
    const completed = await this.prisma.assessment.findMany({ where: { status: 'completed' }, select: { customerId: true, riskLevel: true } })
    const modules = await this.prisma.module.findMany()
    const moduleViews = await this.prisma.eventLog.findMany({ where: { event: { in: ['module_view', 'home_component_click'] } } })
    return {
      northStar,
      funnel: [
        { stage: '扫码 / 打开', value: Math.max(await ev('app_open'), registered) },
        { stage: '注册', value: registered },
        { stage: '开始测评', value: assessStarted },
        { stage: '完成测评', value: assessDone },
        { stage: '领券', value: couponClaimed },
        { stage: '到院', value: arrived },
        { stage: '方案发送', value: plansSent },
      ],
      cards: { customers, registered, assessDone, completionRate: assessStarted ? Math.round((assessDone / assessStarted) * 100) : 0, couponIssued, couponClaimed, arrived, returned, plansSent, familyBound: await this.prisma.familyLink.count({ where: { status: 'active' } }), mirrorUsers: (await this.prisma.mirrorSession.groupBy({ by: ['customerId'] })).length },
      tiers: ['A', 'B', 'C'].map(t => ({ tier: t, name: TIER_NAMES[t], count: allCustomers.filter(c => c.tier === t).length })),
      risk: ['L0', 'L1', 'L2', 'L3'].map(l => ({ level: l, count: completed.filter(c => c.riskLevel === l).length })),
      stores: stores.map(s => {
        const ids = new Set(allCustomers.filter(c => c.storeId === s.id).map(c => c.id))
        return { name: s.name, customers: ids.size, assessments: completed.filter(c => ids.has(c.customerId)).length }
      }),
      modules: modules.filter(m => m.category !== 'builtin').map(m => ({ name: m.name, views: moduleViews.filter(v => (v.props as any)?.moduleCode === m.code).length, leads: leads.filter(l => l.moduleName === m.name).reduce((s, l) => s + l._count, 0), won: leads.filter(l => l.moduleName === m.name && l.status === 'won').reduce((s, l) => s + l._count, 0), amount: leads.filter(l => l.moduleName === m.name).reduce((s, l) => s + (l._sum.wonAmount || 0), 0) })).filter(m => m.views || m.leads),
      safety: { alerts: alerts.length, l3: l3.length, l3InTime, l3Rate: l3.length ? Math.round((l3InTime / l3.length) * 100) : 100, open: alerts.filter(a => a.status !== 'closed').length, mirror: alerts.filter(a => a.source === 'mirror').length },
      aiQuality: { plans: plans.length, aiPlans: plans.filter(p => p.engine === 'ai').length, templatePlans: plans.filter(p => p.engine === 'template').length, approveRate: reviewed.length ? Math.round((reviewed.filter(p => p.reviewStatus === 'approved').length / reviewed.length) * 100) : 0, calls: ai.map(a => ({ scene: a.scene, status: a.status, count: a._count, avgMs: Math.round(a._avg.latencyMs || 0), tokens: (a._sum.inputTokens || 0) + (a._sum.outputTokens || 0) })) },
    }
  }

  // ───────── 系统 ─────────

  @Get('stores')
  stores() {
    return this.prisma.store.findMany()
  }

  @Get('staff')
  async staff() {
    const list = await this.prisma.staff.findMany()
    const stores = await this.prisma.store.findMany()
    const counts = await this.prisma.customer.groupBy({ by: ['advisorId'], _count: true })
    return list.map(s => ({ id: s.id, staffNo: s.staffNo, name: s.name, username: s.username, role: s.role, roleName: ROLE_NAMES[s.role], store: stores.find(x => x.id === s.storeId)?.name || '总部', dataScope: s.dataScope, status: s.status, customers: counts.find(c => c.advisorId === s.id)?._count || 0, lastLoginAt: fmt(s.lastLoginAt) }))
  }

  @Get('audit-logs')
  async auditLogs(@CurrentUser() u: StaffUser, @Query('action') action?: string) {
    requireRole(u, ['health_advisor'])
    const list = await this.prisma.auditLog.findMany({ where: action ? { action: { startsWith: action } } : {}, orderBy: { id: 'desc' }, take: 300 })
    const cs = await this.prisma.customer.findMany({ where: { id: { in: list.map(l => l.customerId || 0) } } })
    return list.map(l => ({ ...l, customer: cs.find(c => c.id === l.customerId)?.salutation, createdAt: fmt(l.createdAt, 'YYYY-MM-DD HH:mm:ss') }))
  }

  @Get('settings')
  async settings(@CurrentUser() u: StaffUser) {
    requireRole(u, [])
    const ai = await this.ai.config()
    return { ai: { baseUrl: ai.baseUrl, model: ai.model, enabled: ai.enabled, hasKey: !!ai.apiKey } }
  }

  @Put('settings/ai')
  async saveAi(@CurrentUser() u: StaffUser, @Body() body: { baseUrl: string, apiKey?: string, model: string, enabled?: boolean }) {
    requireRole(u, [])
    const old: any = (await this.prisma.setting.findUnique({ where: { key: 'ai' } }))?.value || {}
    const value = { baseUrl: body.baseUrl, model: body.model, apiKey: body.apiKey || old.apiKey || '', enabled: body.enabled !== false }
    await this.prisma.setting.upsert({ where: { key: 'ai' }, create: { key: 'ai', value }, update: { value } })
    await this.wf.audit({ type: 'staff', id: u.id, name: u.name }, 'settings.ai')
    return { ok: true }
  }

  @Post('settings/ai/test')
  async testAi() {
    const t = Date.now()
    const out = await this.ai.chat([{ role: 'user', content: '用一句话向王阿姨问好，不超过 20 字。' }], { scene: 'test', timeoutMs: 15000, maxTokens: 60 })
    return { ok: !!out, reply: out, ms: Date.now() - t }
  }

  @Post('imports/consumption')
  async importConsumption(@CurrentUser() u: StaffUser, @Body() body: { rows: any[], dryRun?: boolean }) {
    requireRole(u, ['finance', 'ops'])
    return this.tier.importConsumption(body.rows || [], u.name, !!body.dryRun)
  }

  @Get('imports')
  async imports() {
    return (await this.prisma.importBatch.findMany({ orderBy: { id: 'desc' } })).map(b => ({ ...b, createdAt: fmt(b.createdAt) }))
  }

  @Get('qrcodes')
  async qrcodes() {
    const list = await this.prisma.qrcode.findMany()
    const stores = await this.prisma.store.findMany()
    const staff = await this.prisma.staff.findMany()
    return list.map(q => ({ ...q, store: stores.find(s => s.id === q.storeId)?.name, staff: staff.find(s => s.id === q.staffId)?.name }))
  }
}
