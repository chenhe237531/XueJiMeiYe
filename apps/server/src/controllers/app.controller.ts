import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import dayjs from 'dayjs'
import { Aud, CurrentUser, type CustomerUser, OptionalAuth, signToken } from '../common/auth'
import { PrismaService } from '../common/prisma.service'
import { Err } from '../common/response'
import { addHours, fmt, genNo, maskPhone, TIER_NAMES, today } from '../common/util'
import { ageOf, evalLogic } from '../engine'
import { TAG_NAMES } from '../engine/rules-data'
import { ArchiveService } from '../services/archive.service'
import { AssessmentService } from '../services/assessment.service'
import { CheckupService } from '../services/checkup.service'
import { DemoSandboxService } from '../services/demo-sandbox.service'
import { HomeService, moduleCard, moduleVisible, TIER_BENEFITS } from '../services/home.service'
import { MirrorService } from '../services/mirror.service'
import { TierService } from '../services/tier.service'
import { WorkflowService } from '../services/workflow.service'

const BENEFIT_TABLE = [
  { name: '专属顾问直连（优先响应）', A: '4 小时内响应', B: '—', C: '—' },
  { name: '海外 VIP 通道', A: '✓', B: '—', C: '—' },
  { name: '接送车', A: '✓', B: '—', C: '70 岁以上可申请陪同' },
  { name: '高端体检 / 优先号源', A: '✓', B: '—', C: '—' },
  { name: '私享活动、私享礼盒', A: '✓', B: '—', C: '—' },
  { name: '年度个人健康报告', A: '✓', B: '—', C: '—' },
  { name: '方案包、医生讲座名额', A: '✓', B: '✓', C: '按活动' },
  { name: '康养文旅精选', A: '私享 / 定制', B: '✓', C: '—' },
  { name: '清远温泉', A: '✓', B: '精品小团', C: '特惠结伴团' },
  { name: '有机商城', A: '私享礼盒', B: '✓', C: '✓' },
  { name: '结伴拼团、小游戏', A: '—', B: '拼团', C: '✓' },
  { name: '六维测评、免费基础体检、健康档案、魔镜', A: '✓', B: '✓', C: '✓' },
]

const REDEEM_ITEMS = [
  { code: 'R_LECTURE', name: '医生健康讲座名额', points: 100 },
  { code: 'R_MALL20', name: '有机商城 20 元券', points: 200 },
  { code: 'R_NECK30', name: '肩颈舒缓体验 30 分钟', points: 300 },
  { code: 'R_BMD', name: '体检加项：骨密度', points: 500 },
]

/** 打卡类型；plan = 养护方案里的"日常小事"勾选（M3：方案从只读变成每日清单） */
const CHECKIN_NAMES: Record<string, string> = { sleep: '睡眠', exercise: '运动', water: '喝水', period: '经期日记', plan: '方案日常小事' }

const validDevice = (d?: string) => /^[\w-]{8,64}$/.test(d || '')

@Controller('app/auth')
export class AppAuthController {
  constructor(private prisma: PrismaService, private wf: WorkflowService, private sandbox: DemoSandboxService) {}

  /** 演示：wx.login code → openid（正式版调用 code2Session） */
  @Post('wx-login')
  async wxLogin(@Body() body: { code?: string, q?: string }) {
    const openid = `demo_${createHash('sha256').update(body.code || `${Date.now()}`).digest('hex').slice(0, 24)}`
    if (body.q) await this.prisma.qrcode.updateMany({ where: { code: body.q }, data: { scanCount: { increment: 1 } } })
    const c = await this.prisma.customer.findUnique({ where: { openid } })
    await this.wf.event(c?.id || null, 'app_open', { q: body.q })
    if (c) return { token: signToken({ id: c.id }, 'app'), isGuest: false }
    return { token: null, isGuest: true, openid }
  }

  @Get('demo-personas')
  async personas() {
    const list = await this.prisma.customer.findMany({ where: { isDemo: true }, orderBy: { id: 'asc' } })
    return list.map(c => ({ id: c.id, salutation: c.salutation, age: ageOf(c.birthYear), tier: c.tier, tierName: TIER_NAMES[c.tier], elderMode: c.elderMode, title: c.demoTitle }))
  }

  /** 演示账号只当模板：每台设备进入自己的副本，测评等数据不和别人共用 */
  @Post('demo-login')
  async demoLogin(@Body() body: { customerId: number, deviceId?: string }) {
    const persona = await this.prisma.customer.findFirst({ where: { id: Number(body.customerId), isDemo: true } })
    if (!persona) throw Err.notFound('演示账号不存在')
    return this.enterDemo(persona.id, body.deviceId)
  }

  /** 本机演示数据重新开始（如现场再演示一遍完整测评） */
  @Post('demo-reset')
  async demoReset(@Body() body: { deviceId?: string }) {
    if (!validDevice(body.deviceId)) throw Err.bad('缺少设备标识')
    await this.sandbox.reset(body.deviceId!)
    return { ok: true }
  }

  private async enterDemo(personaId: number, deviceId?: string) {
    // 老版本前端不带设备标识：每次登录给一份全新副本，也不会和别人共用
    const did = validDevice(deviceId) ? deviceId! : `anon-${randomUUID()}`
    const id = await this.sandbox.customerFor(personaId, did)
    await this.wf.event(id, 'login_success', { isNew: false, demo: true })
    return { token: signToken({ id }, 'app'), isNew: false, needConsent: (await this.wf.hasConsent(id, 'C1')) ? [] : ['C1'] }
  }

  /** 手机号快速验证（演示：直接输入手机号）。匹配老客户则继承等级、门店、顾问；否则按码归属为新客 */
  @Post('phone')
  async phone(@Body() body: { phone: string, q?: string, openid?: string, salutation?: string, deviceId?: string }) {
    const phone = `${body.phone || ''}`.trim()
    if (!/^1\d{10}$/.test(phone)) throw Err.bad('请输入正确的手机号')
    let c = await this.prisma.customer.findUnique({ where: { phone } })
    // 输入演示账号的手机号，同样进入本设备的演示副本
    if (c?.isDemo) return { ...(await this.enterDemo(c.id, body.deviceId)), needProfile: false }
    let isNew = false
    if (!c) {
      const qr = body.q ? await this.prisma.qrcode.findUnique({ where: { code: body.q } }) : null
      const store = qr?.storeId ? { id: qr.storeId } : await this.prisma.store.findFirst({ orderBy: { id: 'asc' } })
      const advisorId = qr?.staffId || (await this.prisma.staff.findFirst({ where: { role: 'advisor', storeId: store?.id } }))?.id
      c = await this.prisma.customer.create({ data: { customerNo: genNo('C'), phone, openid: body.openid || null, storeId: store?.id, advisorId, tier: 'C', source: qr ? 'store_qr' : 'share', salutation: body.salutation || null } })
      await this.prisma.tierHistory.create({ data: { customerId: c.id, toTier: 'C', reason: 'new' } })
      isNew = true
    }
    else if (body.openid && !c.openid) {
      c = await this.prisma.customer.update({ where: { id: c.id }, data: { openid: body.openid } })
    }
    if (c.status === 'deleted') throw Err.bad('该账号已注销，如需恢复请联系门店')
    await this.wf.event(c.id, 'phone_bind', {})
    await this.wf.event(c.id, 'login_success', { isNew })
    return { token: signToken({ id: c.id }, 'app'), isNew, needProfile: !c.salutation || !c.birthYear, needConsent: (await this.wf.hasConsent(c.id, 'C1')) ? [] : ['C1'] }
  }
}

@Controller('app')
export class AppController {
  constructor(
    private prisma: PrismaService,
    private wf: WorkflowService,
    private home: HomeService,
    private mirror: MirrorService,
    private tierSvc: TierService,
  ) {}

  @Get('me')
  @Aud('app')
  async me(@CurrentUser() u: CustomerUser) {
    const c = await this.prisma.customer.findUnique({ where: { id: u.id } })
    if (!c) throw Err.unauth()
    const store = c.storeId ? await this.prisma.store.findUnique({ where: { id: c.storeId } }) : null
    const advisor = c.advisorId ? await this.prisma.staff.findUnique({ where: { id: c.advisorId } }) : null
    const unread = await this.prisma.message.count({ where: { customerId: c.id, read: false } })
    const family = await this.prisma.familyLink.count({ where: { OR: [{ elderId: c.id }, { familyId: c.id }], status: 'active' } })
    const pending = await this.prisma.familyLink.count({ where: { elderId: c.id, status: 'applied' } })
    const coupons = await this.prisma.coupon.count({ where: { customerId: c.id, status: { in: ['issued', 'claimed', 'booked'] } } })
    return {
      id: c.id, customerNo: c.customerNo, salutation: c.salutation, gender: c.gender, birthYear: c.birthYear, age: c.birthYear ? ageOf(c.birthYear) : null,
      tier: c.tier, tierName: TIER_NAMES[c.tier], elderMode: c.elderMode, lang: c.lang, personalization: c.personalization, autoRead: c.autoRead,
      phone: maskPhone(c.phone), store: store ? { id: store.id, name: store.name, phone: store.phone, address: store.address } : null,
      advisor: advisor ? { id: advisor.id, name: advisor.name, phone: advisor.phone } : null,
      points: await this.wf.balance(c.id), unreadMessages: unread, familyCount: family, familyPending: pending, coupons,
      needProfile: !c.salutation || !c.birthYear, tierKeepUntil: c.tierKeepUntil ? fmt(c.tierKeepUntil, 'YYYY-MM-DD') : null,
      // XJ-303：我的页成长体系扩字段（旧字段全部保留）
      ...(await this.tierSvc.meGrowth({ id: c.id, tier: c.tier })),
    }
  }

  /** 成就徽章墙（XJ-303，docs/07 §3.3）：{ unlocked, total, groups[] } */
  @Get('achievements')
  @Aud('app')
  async achievements(@CurrentUser() u: CustomerUser) {
    return this.tierSvc.achievements(u.id)
  }

  @Patch('me')
  @Aud('app')
  async updateMe(@CurrentUser() u: CustomerUser, @Body() body: { salutation?: string, birthYear?: number, gender?: string }) {
    const data: any = {}
    if (body.salutation) data.salutation = body.salutation.slice(0, 16)
    if (body.gender) data.gender = body.gender
    if (body.birthYear) {
      const y = Number(body.birthYear)
      if (y > new Date().getFullYear() - 18) throw Err.bad('本平台面向 18 岁以上用户')
      data.birthYear = y
      const c = await this.prisma.customer.findUnique({ where: { id: u.id } })
      // issue #8：首次填写出生年份、年龄 > 55 岁自动开启乐龄模式；≤ 55 岁保持默认风格（可在设置手动切换）
      if (!c?.birthYear && ageOf(y) > 55) data.elderMode = true
    }
    const c = await this.prisma.customer.update({ where: { id: u.id }, data })
    return { ok: true, elderMode: c.elderMode, elderAuto: !!data.elderMode }
  }

  @Patch('me/settings')
  @Aud('app')
  async settings(@CurrentUser() u: CustomerUser, @Body() body: { elderMode?: boolean, lang?: string, personalization?: boolean, autoRead?: boolean }) {
    const data: any = {}
    for (const k of ['elderMode', 'lang', 'personalization', 'autoRead'] as const) if (body[k] !== undefined) data[k] = body[k]
    await this.prisma.customer.update({ where: { id: u.id }, data })
    if (body.elderMode !== undefined) await this.wf.event(u.id, 'elder_mode_toggle', { on: body.elderMode })
    if (body.personalization !== undefined) {
      await this.wf.grantConsent(u.id, 'C7', body.personalization)
      await this.wf.event(u.id, 'personalization_toggle', { on: body.personalization })
    }
    return { ok: true }
  }

  @Get('home')
  @Aud('app')
  @OptionalAuth()
  async getHome(@CurrentUser() u?: CustomerUser) {
    const data = await this.home.resolve(u?.id || null)
    await this.wf.event(u?.id || null, 'home_view', { tier: data.tier, elder: data.elderMode, layoutVersion: data.layoutVersion })
    return data
  }

  @Get('modules')
  @Aud('app')
  @OptionalAuth()
  async modules(@CurrentUser() u: CustomerUser | undefined, @Query('category') category?: string) {
    const c = u ? await this.prisma.customer.findUnique({ where: { id: u.id } }) : null
    const list = await this.prisma.module.findMany({ where: category ? { category } : {}, orderBy: { sort: 'asc' } })
    return list.filter(m => moduleVisible(m, { tier: c?.tier || 'C', storeId: c?.storeId, elderMode: !!c?.elderMode })).map(moduleCard)
  }

  @Get('modules/:code')
  @Aud('app')
  @OptionalAuth()
  async moduleDetail(@CurrentUser() u: CustomerUser | undefined, @Param('code') code: string) {
    const m = await this.prisma.module.findUnique({ where: { code } })
    if (!m) throw Err.notFound('模块不存在')
    const c = u ? await this.prisma.customer.findUnique({ where: { id: u.id } }) : null
    const visible = moduleVisible(m, { tier: c?.tier || 'C', storeId: c?.storeId, elderMode: false })
    const tags = c ? await this.wf.activeTags(c.id) : []
    const age = c ? ageOf(c.birthYear) : 0
    // 健康提示：按客户健康标签（或 JSON Logic 条件）命中 health_rules
    const notices = ((m.healthRules as any[]) || []).filter((r) => {
      if (r.always) return true
      if (r.tags?.some((t: string) => tags.includes(t))) return true
      if (r.logic && evalLogic(r.logic, { age, tags })) return true
      return false
    }).map((r, i) => ({ id: `${m.code}_${i}`, text: r.text, requireAck: !!r.require_ack, tags: (r.tags || []).filter((t: string) => tags.includes(t)).map((t: string) => TAG_NAMES[t] || t) }))
    const partner = m.partnerId ? await this.prisma.partner.findUnique({ where: { id: m.partnerId } }) : null
    if (u) {
      await this.wf.event(u.id, 'module_view', { moduleCode: code })
      for (const n of notices) await this.wf.event(u.id, 'health_notice_shown', { moduleCode: code, notice: n.id })
    }
    return {
      ...moduleCard(m), detail: m.detail, entryConfig: m.entryConfig, visible, healthNotices: notices, leadConfig: m.leadConfig,
      partner: partner && m.showPartnerLicense ? { name: partner.name, licenses: partner.licenses } : null,
    }
  }

  @Post('leads')
  @Aud('app')
  async submitLead(@CurrentUser() u: CustomerUser, @Body() body: { moduleCode: string, form: any, ackNotices?: string[] }) {
    const m = await this.prisma.module.findUnique({ where: { code: body.moduleCode } })
    if (!m) throw Err.notFound('模块不存在')
    const c = await this.prisma.customer.findUnique({ where: { id: u.id } })
    const lc: any = m.leadConfig || {}
    const sla = lc.sla_hours || 24
    // 手机号类字段留空时用账号绑定手机，顾问回访不用再查
    const form = { ...(body.form || {}) }
    for (const f of ((m.entryConfig as any)?.fields || [])) {
      if (f.type === 'phone' && !form[f.key] && c?.phone) form[f.key] = c.phone
    }
    const lead = await this.prisma.lead.create({
      data: {
        leadNo: genNo('LD'), customerId: u.id, moduleId: m.id, moduleCode: m.code, moduleName: m.name, type: lc.type || 'other', formData: form,
        healthNotices: (body.ackNotices || []).map(id => ({ id, ackAt: new Date().toISOString() })), assigneeId: c?.advisorId, partnerId: m.partnerId, slaDueAt: addHours(sla),
      },
    })
    await this.wf.createTask({ staffId: c?.advisorId, customerId: u.id, type: 'lead_followup', refTable: 'lead', refId: lead.id, title: `${c?.salutation}提交「${m.name}」意向，请 ${sla} 小时内联系`, hours: sla })
    await this.wf.notifyStaff({ staffIds: [c?.advisorId], roles: sla <= 4 ? ['ops'] : [] }, '新线索', `${c?.salutation}提交「${m.name}」意向${body.form?.people ? `（${body.form.people} 人）` : ''}，请 ${sla} 小时内联系`, sla <= 4 ? 'high' : 'medium', '/marketing/leads')
    await this.wf.event(u.id, 'lead_submit', { moduleCode: m.code, type: lc.type })
    return { leadNo: lead.leadNo, slaHours: sla }
  }

  /** 我提交的意向 / 接送 / VIP 申请：只给进度，不含顾问跟进内容、成交金额等内部信息 */
  @Get('leads')
  @Aud('app')
  async myLeads(@CurrentUser() u: CustomerUser) {
    const list = await this.prisma.lead.findMany({ where: { customerId: u.id }, orderBy: { id: 'desc' }, take: 50 })
    const firstFollow = list.length
      ? await this.prisma.leadFollowup.groupBy({ by: ['leadId'], where: { leadId: { in: list.map(l => l.id) } }, _min: { createdAt: true } })
      : []
    const contactedAt = new Map(firstFollow.map(f => [f.leadId, f._min.createdAt]))
    const STATUS: Record<string, string> = { new: '已提交，等待顾问联系', contacted: '顾问已联系', negotiating: '顾问沟通中', won: '已完成', lost: '已结束' }
    return list.map(l => {
      const project = (l.formData as any)?.project
      return {
        id: l.id, leadNo: l.leadNo, name: `${l.moduleName || '意向咨询'}${project ? ` · ${project}` : ''}`, type: l.type, status: l.status, statusName: STATUS[l.status] || l.status,
        createdAt: fmt(l.createdAt, 'YYYY-MM-DD HH:mm'), slaDueAt: l.status === 'new' && l.slaDueAt ? fmt(l.slaDueAt, 'M月D日 HH:mm') : null,
        contactedAt: contactedAt.get(l.id) ? fmt(contactedAt.get(l.id)!, 'M月D日 HH:mm') : null,
      }
    })
  }

  @Get('tier')
  @Aud('app')
  async tier(@CurrentUser() u: CustomerUser) {
    const c = await this.prisma.customer.findUnique({ where: { id: u.id } })
    const rule = await this.prisma.tierRule.findFirst({ where: { status: 'active' } })
    return {
      tier: c!.tier, tierName: TIER_NAMES[c!.tier], benefits: TIER_BENEFITS[c!.tier], table: BENEFIT_TABLE,
      keepUntil: c!.tierKeepUntil ? fmt(c!.tierKeepUntil, 'YYYY-MM-DD') : null,
      rules: rule ? [
        `近 12 个月实付金额 ≥ ${rule.thresholdA.toLocaleString()} 元为臻享会员`,
        `近 12 个月实付金额 ≥ ${rule.thresholdB.toLocaleString()} 元为尊享会员`,
        '达到条件立即升级；低于条件时有 3 个月保级期',
        '会员价按公开规则计算，同一项目对同等条件的客户价格一致',
      ] : [],
    }
  }

  // ───────── 授权 ─────────

  @Get('consents')
  @Aud('app')
  async consents(@CurrentUser() u: CustomerUser) {
    const texts = await this.prisma.consentText.findMany({ where: { status: 'published' }, orderBy: { type: 'asc' } })
    const recs = await this.prisma.consentRecord.findMany({ where: { customerId: u.id }, orderBy: { id: 'desc' } })
    return texts.map((t) => {
      const r = recs.find(x => x.type === t.type)
      return { type: t.type, title: t.title, version: t.version, summary: t.summary, required: t.required, granted: !!r && r.granted && !r.revokedAt, recordId: r?.id, at: r ? fmt(r.revokedAt || r.grantedAt) : null, revoked: !!r?.revokedAt, channel: r?.channel }
    })
  }

  @Get('consents/texts/:type')
  @Aud('app')
  @OptionalAuth()
  async consentText(@CurrentUser() u: CustomerUser | undefined, @Param('type') type: string) {
    const t = await this.prisma.consentText.findFirst({ where: { type, status: 'published' }, orderBy: { id: 'desc' } })
    if (!t) throw Err.notFound()
    if (u) await this.wf.event(u.id, 'consent_view', { type, version: t.version })
    return t
  }

  @Post('consents')
  @Aud('app')
  async grant(@CurrentUser() u: CustomerUser, @Body() body: { type: string, granted: boolean, scope?: any }) {
    const r = await this.wf.grantConsent(u.id, body.type, body.granted !== false, body.scope)
    if (body.type === 'C7') await this.prisma.customer.update({ where: { id: u.id }, data: { personalization: body.granted !== false } })
    return { id: r.id }
  }

  /** 撤回授权及系统动作（9.10） */
  @Post('consents/:type/revoke')
  @Aud('app')
  async revoke(@CurrentUser() u: CustomerUser, @Param('type') type: string, @Body() body: { keepData?: boolean }) {
    const recs = await this.prisma.consentRecord.findMany({ where: { customerId: u.id, type, granted: true, revokedAt: null } })
    if (!recs.length) throw Err.conflict('当前没有可撤回的授权')
    await this.prisma.consentRecord.updateMany({ where: { id: { in: recs.map(r => r.id) } }, data: { revokedAt: new Date() } })
    const effects: string[] = []
    if (type === 'C2') {
      await this.prisma.plan.updateMany({ where: { customerId: u.id, status: { in: ['draft', 'ready'] } }, data: { status: 'void' } })
      await this.prisma.assessment.updateMany({ where: { customerId: u.id, status: 'in_progress' }, data: { status: 'abandoned' } })
      effects.push('已停止新的健康数据收集，未发送的方案已作废')
      if (body.keepData === false) effects.push('已登记删除健康数据的申请，15 个工作日内处理')
    }
    if (type === 'C3') {
      const refs = await this.prisma.referral.findMany({ where: { customerId: u.id, status: { in: ['created', 'sent', 'accepted', 'booked'] } } })
      for (const r of refs) {
        await this.prisma.referral.update({ where: { id: r.id }, data: { status: 'cancelled', cancelReason: '客户撤回 C3 授权' } })
        if (r.couponId) await this.prisma.coupon.update({ where: { id: r.couponId }, data: { status: 'void', voidReason: '客户撤回 C3 授权' } })
      }
      effects.push(`已取消 ${refs.length} 个未完成的转介，并通知医院`)
    }
    if (type === 'C4') {
      await this.prisma.referral.updateMany({ where: { customerId: u.id }, data: { c4Granted: false } })
      effects.push('医院将不再回传结果')
    }
    if (type === 'C6') {
      await this.prisma.familyLink.updateMany({ where: { elderId: u.id, status: 'active' }, data: { status: 'revoked' } })
      effects.push('已解除家人绑定')
    }
    if (type === 'C7') {
      await this.prisma.customer.update({ where: { id: u.id }, data: { personalization: false } })
      effects.push('首页恢复默认顺序')
    }
    if (type === 'C9') {
      await this.prisma.mirrorMemory.updateMany({ where: { customerId: u.id }, data: { status: 'deleted' } })
      effects.push('已清空小镜的记忆')
    }
    await this.wf.message(u.id, '授权撤回已处理', effects.join('；') || '已处理', '/pkg-me/consents')
    await this.wf.event(u.id, 'consent_revoke', { type })
    return { ok: true, effects }
  }

  // ───────── 家人 ─────────

  @Post('family/invites')
  @Aud('app')
  async invite(@CurrentUser() u: CustomerUser, @Body() body: { relation: string, permissions?: string[] }) {
    const token = createHash('md5').update(`${u.id}-${Date.now()}-${Math.random()}`).digest('hex').slice(0, 12)
    const link = await this.prisma.familyLink.create({ data: { elderId: u.id, relation: body.relation || 'daughter', permissions: body.permissions || ['view_report', 'receive_reminder'], token, invitedBy: 'elder', expiresAt: addHours(72) } })
    await this.wf.event(u.id, 'family_invite', { relation: body.relation })
    return { token, id: link.id, expiresAt: fmt(link.expiresAt), path: `/pkg-family/accept?token=${token}` }
  }

  @Get('family/invites/:token')
  @Aud('app')
  @OptionalAuth()
  async inviteInfo(@Param('token') token: string) {
    const l = await this.prisma.familyLink.findUnique({ where: { token } })
    if (!l) throw Err.notFound('邀请不存在')
    const elder = await this.prisma.customer.findUnique({ where: { id: l.elderId } })
    return { relation: l.relation, status: l.status, expired: !!l.expiresAt && l.expiresAt < new Date(), elder: { salutation: elder?.salutation } }
  }

  @Post('family/invites/:token/accept')
  @Aud('app')
  async accept(@CurrentUser() u: CustomerUser, @Param('token') token: string) {
    const l = await this.prisma.familyLink.findUnique({ where: { token } })
    if (!l || l.status !== 'pending') throw Err.conflict('邀请已失效')
    if (l.expiresAt && l.expiresAt < new Date()) throw Err.conflict('邀请已过期（72 小时有效）')
    if (l.elderId === u.id) throw Err.bad('不能绑定自己')
    await this.prisma.familyLink.update({ where: { id: l.id }, data: { familyId: u.id, status: 'applied' } })
    const me = await this.prisma.customer.findUnique({ where: { id: u.id } })
    await this.wf.message(l.elderId, '家人申请绑定', `${me?.salutation || '您的家人'}申请绑定，请确认并选择可以查看的内容`, '/pkg-family/list')
    return { ok: true }
  }

  /** 客户确认并勾选可见范围（C6，按家人、按范围） */
  @Post('family/links/:id/confirm')
  @Aud('app')
  async confirmLink(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number, @Body() body: { permissions: string[] }) {
    const l = await this.prisma.familyLink.findUnique({ where: { id } })
    if (!l || l.elderId !== u.id) throw Err.notFound()
    await this.wf.grantConsent(u.id, 'C6', true, { family_id: l.familyId, permissions: body.permissions })
    await this.prisma.familyLink.update({ where: { id }, data: { status: 'active', permissions: body.permissions } })
    if (l.familyId) await this.wf.message(l.familyId, '绑定成功', '家人已确认绑定，您可以查看授权范围内的内容了', `/pkg-family/view?elderId=${u.id}`)
    await this.wf.event(u.id, 'family_bind', { relation: l.relation })
    return { ok: true }
  }

  @Get('family/links')
  @Aud('app')
  async links(@CurrentUser() u: CustomerUser) {
    const list = await this.prisma.familyLink.findMany({ where: { OR: [{ elderId: u.id }, { familyId: u.id }], status: { in: ['pending', 'applied', 'active'] } }, orderBy: { id: 'desc' } })
    const ids = [...new Set(list.flatMap(l => [l.elderId, l.familyId]).filter(Boolean) as number[])]
    const people = await this.prisma.customer.findMany({ where: { id: { in: ids } } })
    const name = (id?: number | null) => people.find(p => p.id === id)?.salutation || '待接受'
    return {
      myFamily: list.filter(l => l.elderId === u.id).map(l => ({ id: l.id, relation: l.relation, status: l.status, permissions: l.permissions, name: name(l.familyId), token: l.token, expiresAt: fmt(l.expiresAt) })),
      iCareFor: list.filter(l => l.familyId === u.id && l.status === 'active').map(l => ({ id: l.id, elderId: l.elderId, relation: l.relation, name: name(l.elderId), permissions: l.permissions })),
    }
  }

  @Patch('family/links/:id')
  @Aud('app')
  async patchLink(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number, @Body() body: { permissions: string[] }) {
    const l = await this.prisma.familyLink.findUnique({ where: { id } })
    if (!l || l.elderId !== u.id) throw Err.notFound()
    await this.prisma.familyLink.update({ where: { id }, data: { permissions: body.permissions } })
    await this.wf.grantConsent(u.id, 'C6', true, { family_id: l.familyId, permissions: body.permissions })
    return { ok: true }
  }

  @Delete('family/links/:id')
  @Aud('app')
  async unlink(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number) {
    const l = await this.prisma.familyLink.findUnique({ where: { id } })
    if (!l || (l.elderId !== u.id && l.familyId !== u.id)) throw Err.notFound()
    await this.prisma.familyLink.update({ where: { id }, data: { status: 'revoked' } })
    await this.wf.event(u.id, 'family_unbind', { relation: l.relation })
    return { ok: true }
  }

  /** 家人视角（P-35）：只展示授权范围内的内容 */
  @Get('family/elders/:elderId/overview')
  @Aud('app')
  async elderOverview(@CurrentUser() u: CustomerUser, @Param('elderId', ParseIntPipe) elderId: number) {
    const l = await this.prisma.familyLink.findFirst({ where: { elderId, familyId: u.id, status: 'active' } })
    if (!l) throw Err.forbidden('没有查看权限')
    const perms = (l.permissions as string[]) || []
    const elder = await this.prisma.customer.findUnique({ where: { id: elderId } })
    const out: any = { elder: { salutation: elder?.salutation, relation: l.relation }, permissions: perms }
    if (perms.includes('view_report')) {
      const last = await this.prisma.assessment.findFirst({ where: { customerId: elderId, status: 'completed' }, orderBy: { id: 'desc' } })
      const plan = await this.prisma.plan.findFirst({ where: { customerId: elderId, status: 'sent' }, orderBy: { id: 'desc' } })
      const report = await this.prisma.report.findFirst({ where: { customerId: elderId, type: 'hospital' }, orderBy: { id: 'desc' } })
      const pc: any = plan?.contentCustomer
      const rc: any = report?.content
      out.summary = {
        situation: last ? `最近一次六维测评（${fmt(last.completedAt, 'M月D日')}）指数 ${last.indexScore}，风险等级 ${last.riskLevel === 'L0' ? '平稳' : last.riskLevel === 'L1' ? '建议体检' : '建议就医'}` : '还没有完成六维测评',
        doctor: rc ? `${rc.hospital}${rc.doctor}：${rc.advice}` : '暂无医生建议',
        store: pc ? `${pc.title}：${(pc.storeItems || []).map((s: any) => `${s.name}${s.freq}`).join('；')}` : '暂无门店安排',
        dims: last?.dimensionScores || null,
        index: last?.indexScore ?? null,
      }
    }
    if (perms.includes('receive_reminder')) {
      const card = await this.home.healthCard(elder, 5)
      // 待办原文是写给本人的（"查看我的养护方案"），家人视角改成第三人称
      const name = elder?.salutation || '家人'
      const famText: Record<string, (t: any) => string> = {
        alert: () => `顾问会尽快联系${name}`,
        assessment: () => `${name}的六维测评还没做完`,
        plan: () => `${name}的养护方案`,
        checkup: t => t.text.startsWith('体检券') ? `${name}的${t.text}` : t.text,
      }
      out.reminders = card.todos.map((t: any) => ({ ...t, text: famText[t.kind]?.(t) ?? t.text, sub: t.kind === 'alert' ? '门店项目先暂停，身体最要紧' : t.sub }))
    }
    return out
  }

  // ───────── 健康接力棒（docs/07 §3.2，XJ-304） ─────────

  /** 我的接力对象：最近一条已绑定家人的另一端（D3：仅限已绑定家人，未绑定返回 null 走空状态） */
  private async relayPeer(customerId: number) {
    const l = await this.prisma.familyLink.findFirst({ where: { OR: [{ elderId: customerId }, { familyId: customerId }], status: 'active' }, orderBy: { id: 'desc' } })
    if (!l) return null
    const peerId = l.elderId === customerId ? l.familyId : l.elderId
    if (!peerId) return null
    const peer = await this.prisma.customer.findUnique({ where: { id: peerId }, select: { id: true, salutation: true } })
    return peer ? { peer, relation: l.relation, myRole: l.elderId === customerId ? 'elder' : 'family' } : null
  }

  /** 接力状态：连续天数、双方记录、本周 7 格（周一起）。中断不惩罚，过去未接的格子显示「休」 */
  @Get('family/relay')
  @Aud('app')
  async relay(@CurrentUser() u: CustomerUser) {
    const ctx = await this.relayPeer(u.id)
    if (!ctx) return { bound: false } // D3：未绑定家人 → 前端展示引导绑定的空状态，不展示接力内容
    const { peer, relation, myRole } = ctx
    const relays = await this.prisma.familyRelay.findMany({ where: { OR: [{ customerId: u.id, peerId: peer.id }, { customerId: peer.id, peerId: u.id }] }, orderBy: { date: 'desc' }, take: 90 })
    const days = [...new Set(relays.map(r => r.date))]
    // 连续天数：今天没接从昨天起算（与 /app/checkins 的 streak 口径一致，白天不清零）
    let streak = 0
    let d = days.includes(today()) ? dayjs() : dayjs().subtract(1, 'day')
    while (days.includes(d.format('YYYY-MM-DD'))) { streak++; d = d.subtract(1, 'day') }
    // 本周 7 格：已接 = passed；今日 = today；过去未接 = rest（休息日，不惩罚）；未来 = future
    const monday = dayjs().subtract((dayjs().day() + 6) % 7, 'day')
    const week = Array.from({ length: 7 }, (_, i) => {
      const cur = monday.add(i, 'day')
      const date = cur.format('YYYY-MM-DD')
      return { date, label: cur.format('M/D'), state: days.includes(date) ? 'passed' : date === today() ? 'today' : date < today() ? 'rest' : 'future' }
    })
    const myPassedToday = relays.some(r => r.date === today() && r.customerId === u.id)
    return {
      bound: true,
      peer: { id: peer.id, name: peer.salutation || '家人', relation, myRole },
      streak, totalDays: days.length,
      todayPassed: days.includes(today()), myPassedToday,
      week,
      rule: '接棒后双方各得 5 积分；一天一次，0 点重置；中断不清空成就',
    }
  }

  /** 接棒：双方各 +5 积分（写 PointsLedger）。事务内先查后写，同一对家人当天任一方向重复接棒都被拒 */
  @Post('family/relay/pass')
  @Aud('app')
  async relayPass(@CurrentUser() u: CustomerUser) {
    const ctx = await this.relayPeer(u.id)
    if (!ctx) throw Err.bad('先绑定家人，再一起接力吧')
    const { peer } = ctx
    await this.prisma.$transaction(async (tx) => {
      const n = await tx.familyRelay.count({ where: { OR: [{ customerId: u.id, peerId: peer.id, date: today() }, { customerId: peer.id, peerId: u.id, date: today() }] } })
      if (n) throw Err.conflict('今天已经接过棒啦，明天再来')
      await tx.familyRelay.create({ data: { customerId: u.id, peerId: peer.id, date: today() } })
    })
    const me = await this.prisma.customer.findUnique({ where: { id: u.id }, select: { salutation: true } })
    await this.wf.addPoints(u.id, 5, 'relay', `健康接力：与${peer.salutation || '家人'}互接`)
    await this.wf.addPoints(peer.id, 5, 'relay', `健康接力：与${me?.salutation || '家人'}互接`)
    await this.wf.message(peer.id, '接力成功', `${me?.salutation || '家人'}接过了你的健康接力棒，你们各得 5 积分`, '/pkg-family/relay')
    await this.wf.event(u.id, 'relay_pass', { peerId: peer.id })
    return { ok: true, points: 5 }
  }

  // ───────── 魔镜 ─────────

  @Post('mirror/sessions')
  @Aud('app')
  startMirror(@CurrentUser() u: CustomerUser) {
    return this.mirror.start(u.id)
  }

  @Post('mirror/sessions/:id/messages')
  @Aud('app')
  sendMirror(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number, @Body() body: { text: string, inputMethod?: string, quickTopic?: string }) {
    if (body.quickTopic) this.wf.event(u.id, 'mirror_quick_topic', { topic: body.quickTopic })
    return this.mirror.send(u.id, id, body.text, body.inputMethod)
  }

  @Get('mirror/memories')
  @Aud('app')
  memories(@CurrentUser() u: CustomerUser) {
    return this.mirror.memories(u.id)
  }

  @Delete('mirror/memories/:id')
  @Aud('app')
  async delMemory(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number) {
    await this.prisma.mirrorMemory.updateMany({ where: { id, customerId: u.id }, data: { status: 'deleted' } })
    return { ok: true }
  }

  // ───────── 消息、积分、打卡、问答、拼团 ─────────

  @Get('messages')
  @Aud('app')
  async messages(@CurrentUser() u: CustomerUser) {
    const list = await this.prisma.message.findMany({ where: { customerId: u.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50 })
    await this.prisma.message.updateMany({ where: { customerId: u.id, read: false }, data: { read: true } })
    return list.map(m => ({ ...m, at: fmt(m.createdAt) }))
  }

  @Get('points')
  @Aud('app')
  async points(@CurrentUser() u: CustomerUser) {
    const list = await this.prisma.pointsLedger.findMany({ where: { customerId: u.id }, orderBy: { id: 'desc' }, take: 50 })
    return { balance: await this.wf.balance(u.id), ledger: list.map(l => ({ ...l, at: fmt(l.createdAt, 'YYYY-MM-DD'), expiresAt: dayjs(l.createdAt).add(12, 'month').format('YYYY-MM-DD') })), items: REDEEM_ITEMS }
  }

  @Post('points/redeem')
  @Aud('app')
  async redeem(@CurrentUser() u: CustomerUser, @Body() body: { code: string }) {
    const item = REDEEM_ITEMS.find(i => i.code === body.code)
    if (!item) throw Err.notFound()
    const bal = await this.wf.balance(u.id)
    if (bal < item.points) throw Err.conflict('积分不够哦')
    await this.wf.addPoints(u.id, -item.points, 'redeem', item.name)
    await this.wf.message(u.id, '兑换成功', `您已兑换「${item.name}」，顾问会联系您安排。`)
    await this.wf.event(u.id, 'points_redeem', { item: item.code })
    return { ok: true, balance: bal - item.points }
  }

  @Get('checkins')
  @Aud('app')
  async checkins(@CurrentUser() u: CustomerUser) {
    const list = await this.prisma.checkin.findMany({ where: { customerId: u.id }, orderBy: { date: 'desc' }, take: 60 })
    const days = [...new Set(list.map(c => c.date))]
    let streak = 0
    // 今天还没打卡时从昨天往前数，连续天数不会在白天被清零
    let d = days.includes(today()) ? dayjs() : dayjs().subtract(1, 'day')
    while (days.includes(d.format('YYYY-MM-DD'))) { streak++; d = d.subtract(1, 'day') }
    // XJ-302：签到日历月历网格需要的两个字段（streak 保留，前端旧用法不受影响）
    const monthRows = await this.prisma.checkin.findMany({ where: { customerId: u.id, date: { startsWith: dayjs().format('YYYY-MM') } }, select: { date: true } })
    const monthSignedDates = [...new Set(monthRows.map(r => r.date))].sort()
    return { today: list.filter(c => c.date === today()).map(c => c.type), streak, streakDays: streak, monthSignedDates, recent: list.slice(0, 20).map(c => ({ type: c.type, date: c.date, data: c.data })) }
  }

  @Post('checkins')
  @Aud('app')
  async checkin(@CurrentUser() u: CustomerUser, @Body() body: { type: string, data?: any }) {
    if (body.type === 'period' && !(await this.wf.hasConsent(u.id, 'C2'))) throw Err.needConsent('C2')
    const exist = await this.prisma.checkin.findUnique({ where: { customerId_type_date: { customerId: u.id, type: body.type, date: today() } } })
    if (exist) {
      await this.prisma.checkin.update({ where: { id: exist.id }, data: { data: body.data } })
      return { ok: true, points: 0 }
    }
    await this.prisma.checkin.create({ data: { customerId: u.id, type: body.type, date: today(), data: body.data } })
    const todayPoints = await this.prisma.pointsLedger.aggregate({ where: { customerId: u.id, reasonCode: 'checkin', createdAt: { gte: dayjs().startOf('day').toDate() } }, _sum: { change: true } })
    let pts = 0
    if ((todayPoints._sum.change || 0) < 6) { pts = 2; await this.wf.addPoints(u.id, 2, 'checkin', `打卡：${CHECKIN_NAMES[body.type] || body.type}`) }
    if (body.type === 'period' && body.data?.start) await this.wf.setTag(u.id, 'menstruation_now', 'assessment', undefined, dayjs().add(5, 'day').toDate())
    await this.wf.addRecord({ customerId: u.id, recordType: 'checkin', sourceLabel: 'SELF', title: `${CHECKIN_NAMES[body.type] || ''}打卡`, summary: body.data?.summary || '' })
    await this.wf.event(u.id, 'checkin_submit', { type: body.type })
    return { ok: true, points: pts }
  }

  /** 今天已答过的问答题：题目 id → 当时的作答结果（每题每天只算一次，答错不能重答刷分） */
  private async quizAnsweredToday(customerId: number) {
    const evs = await this.prisma.eventLog.findMany({ where: { customerId, event: 'quiz_answer', createdAt: { gte: dayjs().startOf('day').toDate() } } })
    const map: Record<number, { answer: number, correct: boolean }> = {}
    evs.forEach((e) => {
      const p: any = e.props || {}
      if (p.id && !map[p.id]) map[p.id] = { answer: p.answer, correct: !!p.correct }
    })
    return map
  }

  @Get('quiz/today')
  @Aud('app')
  async quiz(@CurrentUser() u: CustomerUser) {
    const all = await this.prisma.quizQuestion.findMany({ where: { status: 'active' }, orderBy: { id: 'asc' } })
    const seed = Number(dayjs().format('YYYYMMDD'))
    const qs = [0, 1, 2].map(i => all[(seed + i * 7) % all.length]).filter((q, i, arr) => arr.findIndex(x => x.id === q.id) === i)
    const answered = await this.quizAnsweredToday(u.id)
    const pts = await this.prisma.pointsLedger.aggregate({ _sum: { change: true }, where: { customerId: u.id, reasonCode: 'quiz', createdAt: { gte: dayjs().startOf('day').toDate() } } })
    return {
      questions: qs.map(q => ({ id: q.id, title: q.title, options: q.options, answered: answered[q.id] ? { ...answered[q.id], rightAnswer: q.answer, knowledge: q.knowledge } : null })),
      answeredToday: qs.filter(q => answered[q.id]).length,
      pointsToday: pts._sum.change || 0,
    }
  }

  @Post('quiz/answers')
  @Aud('app')
  async quizAnswer(@CurrentUser() u: CustomerUser, @Body() body: { id: number, answer: number }) {
    const q = await this.prisma.quizQuestion.findUnique({ where: { id: body.id } })
    if (!q) throw Err.notFound()
    const prev = (await this.quizAnsweredToday(u.id))[q.id]
    if (prev) return { correct: prev.correct, answer: q.answer, knowledge: q.knowledge, points: 0, repeat: true }
    const correct = q.answer === Number(body.answer)
    let points = 0
    const done = await this.prisma.pointsLedger.count({ where: { customerId: u.id, reasonCode: 'quiz', createdAt: { gte: dayjs().startOf('day').toDate() } } })
    if (correct && done < 3) { points = 5; await this.wf.addPoints(u.id, 5, 'quiz', '每日健康问答') }
    await this.wf.event(u.id, 'quiz_answer', { id: q.id, answer: Number(body.answer), correct })
    return { correct, answer: q.answer, knowledge: q.knowledge, points }
  }

  @Get('groupbuys')
  @Aud('app')
  async groupbuys(@CurrentUser() u: CustomerUser) {
    const acts = await this.prisma.groupbuyActivity.findMany({ where: { status: 'online' } })
    const groups = await this.prisma.groupbuyGroup.findMany({ orderBy: { id: 'desc' } })
    const mine = groups.filter(g => (g.members as number[]).includes(u.id))
    const people = await this.prisma.customer.findMany({ where: { id: { in: [...new Set(groups.flatMap(g => g.members as number[]))] } } })
    const view = (g: any) => ({ id: g.id, activityId: g.activityId, status: g.status, expiresAt: fmt(g.expiresAt), members: (g.members as number[]).map(id => people.find(p => p.id === id)?.salutation || '团友'), leaderIsMe: g.leaderId === u.id })
    // 活动封面沿用关联模块的封面图（后台模块配置里换图即可）
    const mods = await this.prisma.module.findMany({ where: { code: { in: acts.map(a => a.moduleCode).filter((c): c is string => !!c) } } })
    return {
      activities: acts.map(a => ({ ...a, cover: mods.find(m => m.code === a.moduleCode)?.cover || null, openGroups: groups.filter(g => g.activityId === a.id && g.status === 'open' && !(g.members as number[]).includes(u.id) && g.expiresAt > new Date()).slice(0, 3).map(view) })),
      mine: mine.map(view),
    }
  }

  @Post('groupbuys/:activityId/groups')
  @Aud('app')
  async openGroup(@CurrentUser() u: CustomerUser, @Param('activityId', ParseIntPipe) activityId: number) {
    const a = await this.prisma.groupbuyActivity.findUnique({ where: { id: activityId } })
    if (!a) throw Err.notFound()
    const g = await this.prisma.groupbuyGroup.create({ data: { activityId, leaderId: u.id, members: [u.id], expiresAt: addHours(a.hours) } })
    await this.wf.event(u.id, 'groupbuy_open', { activityId })
    return { id: g.id }
  }

  @Post('groupbuys/groups/:id/join')
  @Aud('app')
  async joinGroup(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number) {
    const g = await this.prisma.groupbuyGroup.findUnique({ where: { id } })
    if (!g || g.status !== 'open' || g.expiresAt < new Date()) throw Err.conflict('这个团已经结束了')
    const a = await this.prisma.groupbuyActivity.findUnique({ where: { id: g.activityId } })
    const members = [...new Set([...(g.members as number[]), u.id])]
    const success = members.length >= (a?.groupSize || 2)
    await this.prisma.groupbuyGroup.update({ where: { id }, data: { members, status: success ? 'success' : 'open' } })
    if (success) {
      for (const m of members) {
        await this.wf.message(m, '拼团成功', `「${a?.title}」已成团，拼团价 ¥${a?.price}，顾问会联系您确认时间。`, '/pkg-group/detail')
        const c = await this.prisma.customer.findUnique({ where: { id: m } })
        await this.wf.createTask({ staffId: c?.advisorId, customerId: m, type: 'lead_followup', title: `${c?.salutation}「${a?.title}」已成团，请联系确认时间`, hours: 24 })
      }
      await this.wf.event(u.id, 'groupbuy_success', { activityId: g.activityId })
    }
    await this.wf.event(u.id, 'groupbuy_join', { activityId: g.activityId })
    return { ok: true, success }
  }

  @Post('transport/requests')
  @Aud('app')
  async transport(@CurrentUser() u: CustomerUser, @Body() body: any) {
    const c = await this.prisma.customer.findUnique({ where: { id: u.id } })
    const lead = await this.prisma.lead.create({ data: { leadNo: genNo('LD'), customerId: u.id, moduleCode: 'vip_transport', moduleName: '接送车', type: 'transport', formData: body, assigneeId: c?.advisorId, slaDueAt: addHours(24) } })
    await this.wf.createTask({ staffId: c?.advisorId, customerId: u.id, type: 'transport', refTable: 'lead', refId: lead.id, title: `${c?.salutation}预约接送（${body.date || ''} ${body.time || ''}），请确认车辆和司机`, hours: 24 })
    await this.wf.notifyStaff({ staffIds: [c?.advisorId], roles: ['store_manager'], storeId: c?.storeId }, '接送预约', `${c?.salutation}预约接送：${body.date || ''} ${body.time || ''}，${body.from || ''} → ${body.to || ''}`, 'medium')
    return { leadNo: lead.leadNo }
  }

  @Post('data-requests')
  @Aud('app')
  async dataRequest(@CurrentUser() u: CustomerUser, @Body() body: { type: 'export' | 'delete' | 'deactivate' }) {
    await this.wf.audit({ type: 'customer', id: u.id }, `data_request.${body.type}`, { type: 'customer', id: u.id, customerId: u.id })
    await this.wf.message(u.id, '申请已收到', body.type === 'export' ? '数据导出文件生成后会通过站内消息发给您，链接 24 小时有效。' : '我们会在 15 个工作日内处理，处理结果会通知您。')
    return { ok: true }
  }

  @Get('advisor')
  @Aud('app')
  async advisor(@CurrentUser() u: CustomerUser) {
    const c = await this.prisma.customer.findUnique({ where: { id: u.id } })
    const a = c?.advisorId ? await this.prisma.staff.findUnique({ where: { id: c.advisorId } }) : null
    const store = c?.storeId ? await this.prisma.store.findUnique({ where: { id: c.storeId } }) : null
    return { advisor: a ? { name: a.name, phone: a.phone } : null, store, vip: c?.tier === 'A', responseHours: c?.tier === 'A' ? 4 : 24 }
  }

  /** 门店与项目（价格为公开团购价，对所有客户一致，4.15） */
  @Get('store')
  @Aud('app')
  @OptionalAuth()
  async store(@CurrentUser() u?: CustomerUser) {
    const c = u ? await this.prisma.customer.findUnique({ where: { id: u.id } }) : null
    const store = (c?.storeId ? await this.prisma.store.findUnique({ where: { id: c.storeId } }) : null) || (await this.prisma.store.findFirst({ orderBy: { id: 'asc' } }))
    const projects = await this.prisma.project.findMany({ where: { onMeituan: true, status: 'active' }, orderBy: { code: 'asc' } })
    const view = (p: any) => ({ code: p.code, name: p.name, shortName: p.shortName, category: p.category, durationMin: p.durationMin, priceRef: p.priceRef, groupPrice: p.groupPrice, priceNote: p.priceNote, audience: p.audience, salesNote: p.salesNote })
    if (u) await this.wf.event(u.id, 'module_view', { moduleCode: 'store_services' })
    // 门店头图沿用后台「门店项目」模块的封面，运营在模块配置里换图即可
    const mod = await this.prisma.module.findUnique({ where: { code: 'store_services' } })
    return {
      cover: mod?.cover || null,
      store: store && { id: store.id, name: store.name, address: store.address, mall: store.mall, district: store.district, phone: store.phone, openHours: store.openHours, category: store.category, facilities: store.facilities, promises: store.promises, rating: store.rating, reviewCount: store.reviewCount },
      groups: [
        { title: '面部护理', items: projects.filter(p => p.category === 'face').map(view) },
        { title: '身体 SPA', items: projects.filter(p => p.category === 'body').map(view) },
      ],
      priceNote: '价格为美团团购公开价，同一项目对所有客户一致；以门店最终报价为准。',
    }
  }

  /** 门店项目订单状态（先买后约，参考美团团购券）：unpaid → paid → booked → used；未核销前可取消 */
  private orderView(o: any) {
    const STATUS: Record<string, string> = { unpaid: '待支付', paid: '已购买，待预约', booked: '已预约', used: '已完成', cancelled: '已取消' }
    return {
      id: o.id, orderNo: o.orderNo, projectName: o.projectName, projectCode: o.projectCode, amount: o.amount, origPrice: o.origPrice,
      status: o.status, statusName: STATUS[o.status] || o.status, refunded: o.refunded,
      paidAt: fmt(o.paidAt, 'M月D日 HH:mm'), bookDate: o.bookDate, bookNote: o.bookNote, usedAt: fmt(o.usedAt, 'YYYY-MM-DD'), createdAt: fmt(o.createdAt, 'M月D日 HH:mm'),
    }
  }

  /** 我的项目订单（券） */
  @Get('store/orders')
  @Aud('app')
  async myOrders(@CurrentUser() u: CustomerUser) {
    const list = await this.prisma.projectOrder.findMany({ where: { customerId: u.id }, orderBy: { id: 'desc' }, take: 50 })
    return list.map(o => this.orderView(o))
  }

  /** 下单：选择项目 → 生成待支付订单（价格为公开团购价，对所有客户一致） */
  @Post('store/orders')
  @Aud('app')
  async createOrder(@CurrentUser() u: CustomerUser, @Body() body: { projectCode: string }) {
    const p = await this.prisma.project.findUnique({ where: { code: body.projectCode } })
    if (!p || p.status !== 'active' || !p.onMeituan) throw Err.notFound('项目不存在或已下架')
    if (p.groupPrice == null) throw Err.conflict('该项目暂不支持在线购买')
    const c = await this.prisma.customer.findUnique({ where: { id: u.id } })
    const o = await this.prisma.projectOrder.create({
      data: { orderNo: genNo('PO'), customerId: u.id, storeId: c?.storeId, projectId: p.id, projectCode: p.code, projectName: p.shortName || p.name, amount: p.groupPrice, origPrice: p.priceRef },
    })
    await this.wf.event(u.id, 'project_order_create', { projectCode: p.code, orderNo: o.orderNo })
    return { id: o.id, orderNo: o.orderNo, amount: o.amount, projectName: o.projectName }
  }

  /** 支付（MVP 模拟微信支付：真实接入时在此调起微信支付下单，支付回调里改状态） */
  @Post('store/orders/:id/pay')
  @Aud('app')
  async payOrder(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number) {
    const o = await this.prisma.projectOrder.findUnique({ where: { id } })
    if (!o || o.customerId !== u.id) throw Err.notFound('订单不存在')
    if (o.status !== 'unpaid') throw Err.conflict('订单当前不需要支付')
    const c = await this.prisma.customer.findUnique({ where: { id: u.id } })
    await this.prisma.projectOrder.update({ where: { id }, data: { status: 'paid', payMethod: 'mock', paidAt: new Date() } })
    await this.wf.event(u.id, 'project_order_paid', { projectCode: o.projectCode, orderNo: o.orderNo, amount: o.amount })
    await this.wf.message(u.id, '购买成功', `「${o.projectName}」已购买，¥${o.amount}。接下来挑个方便的日子预约到店即可。`, '/pkg-module/orders')
    await this.wf.createTask({ staffId: c?.advisorId, customerId: u.id, type: 'project_order', refTable: 'project_order', refId: o.id, title: `${c?.salutation}在线购买了「${o.projectName}」（¥${o.amount}），可跟进协助预约`, hours: 24 })
    return { ok: true }
  }

  /** 预约到店日期（paid 可约，booked 可改期） */
  @Post('store/orders/:id/book')
  @Aud('app')
  async bookOrder(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number, @Body() body: { date: string, note?: string }) {
    const o = await this.prisma.projectOrder.findUnique({ where: { id } })
    if (!o || o.customerId !== u.id) throw Err.notFound('订单不存在')
    if (!['paid', 'booked'].includes(o.status)) throw Err.conflict(o.status === 'unpaid' ? '请先完成支付' : '当前状态不能预约')
    const date = String(body.date || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today()) throw Err.bad('请选择今天或之后的日期')
    const rebook = o.status === 'booked'
    await this.prisma.projectOrder.update({ where: { id }, data: { status: 'booked', bookDate: date, bookNote: body.note || null, bookAt: new Date() } })
    const c = await this.prisma.customer.findUnique({ where: { id: u.id } })
    await this.wf.event(u.id, 'project_order_book', { projectCode: o.projectCode, date, rebook })
    await this.wf.message(u.id, rebook ? '预约已改期' : '预约成功', `「${o.projectName}」已预约 ${date} 到店，出示订单号 ${o.orderNo} 即可。`, '/pkg-module/orders')
    await this.wf.createTask({ staffId: c?.advisorId, customerId: u.id, type: 'project_order', refTable: 'project_order', refId: o.id, title: `${c?.salutation}预约了 ${date} 到店做「${o.projectName}」，请安排接待`, hours: 24 })
    return { ok: true, rebooked: rebook }
  }

  /** 取消订单：未支付直接取消；已支付未核销取消即全额退款（MVP 模拟原路退回） */
  @Post('store/orders/:id/cancel')
  @Aud('app')
  async cancelOrder(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number) {
    const o = await this.prisma.projectOrder.findUnique({ where: { id } })
    if (!o || o.customerId !== u.id) throw Err.notFound('订单不存在')
    if (!['unpaid', 'paid', 'booked'].includes(o.status)) throw Err.conflict('当前状态不能取消')
    const refunded = o.status !== 'unpaid'
    await this.prisma.projectOrder.update({ where: { id }, data: { status: 'cancelled', refunded, cancelAt: new Date() } })
    await this.wf.event(u.id, 'project_order_cancel', { orderNo: o.orderNo, refunded })
    await this.wf.message(u.id, '订单已取消', refunded ? `「${o.projectName}」订单已取消，¥${o.amount} 将按原支付方式退回。` : `「${o.projectName}」订单已取消。`, '/pkg-module/orders')
    return { ok: true, refunded }
  }

  // ───────── 门店集章册（docs/07 §3.6，XJ-304；D7：按 N 家门店设计，不做单店硬编码） ─────────

  /** 集章册：门店列表 + 盖章状态。距离不引入地图 SDK，用商圈/商场文案替代 */
  @Get('stores/stamps')
  @Aud('app')
  async storeStamps(@CurrentUser() u: CustomerUser) {
    const month = dayjs().format('YYYY-MM')
    const [stores, stamps, orders] = await Promise.all([
      this.prisma.store.findMany({ where: { status: 'active' }, orderBy: { id: 'asc' } }),
      this.prisma.storeStamp.findMany({ where: { customerId: u.id }, orderBy: { stampedAt: 'desc' } }),
      this.prisma.projectOrder.findMany({ where: { customerId: u.id, status: { in: ['paid', 'booked', 'used'] } }, select: { storeId: true } }),
    ])
    const visitsOf = (storeId: number) => orders.filter(o => o.storeId === storeId).length
    const list = stores
      .map((s) => {
        const mine = stamps.filter(x => x.storeId === s.id)
        const thisMonth = mine.find(x => x.month === month)
        const visits = visitsOf(s.id)
        return {
          id: s.id, name: s.name, district: s.district, address: s.address, phone: s.phone, mall: s.mall,
          visits, frequent: visits >= 2,
          stampedThisMonth: !!thisMonth, stampedAt: thisMonth ? fmt(thisMonth.stampedAt, 'YYYY-MM-DD') : null,
          totalStamps: mine.length,
        }
      })
      .sort((a, b) => (b.stampedThisMonth ? 1 : 0) - (a.stampedThisMonth ? 1 : 0) || b.visits - a.visits)
    return {
      month, storeCount: stores.length,
      stampedStores: new Set(stamps.filter(x => x.month === month).map(x => x.storeId)).size,
      totalStamps: stamps.length,
      rule: ['到店完成项目或体检后，出示集章册由顾问扫码盖章', '一月内每店限 1 枚'],
      rewardHint: '集满本月全部门店印章，解锁会员专属礼遇',
      stores: list,
    }
  }

  /** 盖章：一店一月一枚（唯一约束兜底）。顾问扫码记经办人；未传工号时记客户的健康顾问（演示/线下代录） */
  @Post('stores/stamps/:id')
  @Aud('app')
  async stampStore(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number, @Body() body: { staffNo?: string }) {
    const store = await this.prisma.store.findUnique({ where: { id } })
    if (!store || store.status !== 'active') throw Err.notFound('门店不存在')
    let operatorStaffId: number | null = null
    if (body.staffNo) {
      const staff = await this.prisma.staff.findUnique({ where: { staffNo: body.staffNo } })
      if (!staff) throw Err.bad('顾问工号不存在')
      operatorStaffId = staff.id
    }
    else {
      const me = await this.prisma.customer.findUnique({ where: { id: u.id }, select: { advisorId: true } })
      operatorStaffId = me?.advisorId ?? null
    }
    const month = dayjs().format('YYYY-MM')
    try {
      await this.prisma.storeStamp.create({ data: { customerId: u.id, storeId: id, month, operatorStaffId } })
    }
    catch (e: any) {
      if (e?.code === 'P2002') throw Err.conflict('本月这家店已经盖过章啦，下月再来')
      throw e
    }
    await this.wf.event(u.id, 'store_stamp', { storeId: id, storeName: store.name })
    const [stamps, storeCount] = await Promise.all([
      this.prisma.storeStamp.findMany({ where: { customerId: u.id } }),
      this.prisma.store.count({ where: { status: 'active' } }),
    ])
    return { ok: true, month, stampedAt: fmt(new Date(), 'YYYY-MM-DD'), stampedStores: new Set(stamps.filter(x => x.month === month).map(x => x.storeId)).size, storeCount }
  }

  @Get('about')
  async about() {
    const hospitals = await this.prisma.hospital.findMany({ where: { status: 'active' } })
    const partners = await this.prisma.partner.findMany({ where: { status: 'active' } })
    const stores = await this.prisma.store.findMany({ where: { status: 'active' } })
    return { hospitals: hospitals.map(h => ({ name: h.name, licenseNo: h.licenseNo, level: h.level })), partners: partners.map(p => ({ name: p.name, type: p.type, licenses: p.licenses })), stores }
  }

  @Post('events')
  @Aud('app')
  @OptionalAuth()
  async events(@CurrentUser() u: CustomerUser | undefined, @Body() body: { event: string, props?: any }) {
    await this.wf.event(u?.id || null, body.event, body.props)
    return { ok: true }
  }
}

@Controller('app')
@Aud('app')
export class AppHealthController {
  constructor(
    private prisma: PrismaService,
    private assess: AssessmentService,
    private archive: ArchiveService,
    private checkup: CheckupService,
  ) {}

  @Post('assessments')
  start(@CurrentUser() u: CustomerUser, @Body() body: { mode?: string }) {
    return this.assess.start(u.id, body.mode)
  }

  @Get('assessments/current')
  current(@CurrentUser() u: CustomerUser) {
    return this.assess.current(u.id)
  }

  @Get('assessments/latest-result')
  async latest(@CurrentUser() u: CustomerUser) {
    const a = await this.prisma.assessment.findFirst({ where: { customerId: u.id, status: 'completed' }, orderBy: { id: 'desc' } })
    return a ? this.assess.result(u.id, a.id) : null
  }

  @Get('assessments/history')
  history(@CurrentUser() u: CustomerUser) {
    return this.assess.history(u.id)
  }

  @Get('assessments/:id/levels/:level')
  level(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number, @Param('level') level: string) {
    return this.assess.levelQuestions(u.id, id, level)
  }

  @Put('assessments/:id/answers')
  answer(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.assess.saveAnswer(u.id, id, body)
  }

  @Post('assessments/:id/levels/:level/complete')
  completeLevel(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number, @Param('level') level: string) {
    return this.assess.completeLevel(u.id, id, level)
  }

  @Post('assessments/:id/demo-fill')
  demoFill(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number) {
    return this.assess.demoFill(u.id, id)
  }

  @Post('assessments/:id/complete')
  complete(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number) {
    return this.assess.complete(u.id, id)
  }

  @Get('assessments/:id/result')
  result(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number) {
    return this.assess.result(u.id, id)
  }

  @Get('archive/overview')
  overview(@CurrentUser() u: CustomerUser) {
    return this.archive.overview(u.id)
  }

  /** 六维周报（XJ-302）：week 传该周任意一天（YYYY-MM-DD），不传默认本周；上一期传上周边界日期即可 */
  @Get('archive/weekly')
  weekly(@CurrentUser() u: CustomerUser, @Query('week') week?: string) {
    return this.archive.weekly(u.id, week)
  }

  @Get('archive/records')
  records(@CurrentUser() u: CustomerUser, @Query('type') type?: string) {
    return this.archive.records(u.id, type)
  }

  @Get('archive/metrics')
  metrics(@CurrentUser() u: CustomerUser) {
    return this.archive.metricCodes(u.id)
  }

  @Get('archive/metrics/:code/trend')
  trend(@CurrentUser() u: CustomerUser, @Param('code') code: string, @Query('range') range?: string) {
    return this.archive.trend(u.id, code, range)
  }

  @Get('reports')
  reports(@CurrentUser() u: CustomerUser, @Query('type') type?: string) {
    return this.archive.reports(u.id, type)
  }

  @Get('reports/:id')
  report(@CurrentUser() u: CustomerUser, @Param('id', ParseIntPipe) id: number) {
    return this.archive.report(u.id, id)
  }

  @Get('plans/current')
  async currentPlan(@CurrentUser() u: CustomerUser) {
    const plan = await this.prisma.plan.findFirst({ where: { customerId: u.id, status: 'sent' }, orderBy: { id: 'desc' } })
    const pending = await this.prisma.plan.findFirst({ where: { customerId: u.id, status: { in: ['draft', 'ready'] } }, orderBy: { id: 'desc' } })
    const paused = await this.prisma.riskAlert.count({ where: { customerId: u.id, level: { in: ['L2', 'L3'] }, status: { not: 'closed' } } })
    const c = await this.prisma.customer.findUnique({ where: { id: u.id } })
    const advisor = c?.advisorId ? await this.prisma.staff.findUnique({ where: { id: c.advisorId } }) : null
    if (plan) await this.prisma.eventLog.create({ data: { customerId: u.id, event: 'plan_view', props: { packageCode: (plan.skeleton as any)?.packages?.[0]?.code } } })
    return {
      plan: plan ? { id: plan.id, planNo: plan.planNo, content: plan.contentCustomer, skeleton: { packages: (plan.skeleton as any).packages, followUps: (plan.skeleton as any).followUps, riskLevel: plan.riskLevel, doctorAdvice: (plan.skeleton as any).doctorAdvice }, engine: plan.engine, sentAt: fmt(plan.sentAt, 'YYYY-MM-DD'), sentBy: plan.sentBy } : null,
      preparing: !plan && !!pending,
      paused: paused > 0,
      advisor: advisor ? { name: advisor.name, phone: advisor.phone } : null,
    }
  }

  @Get('plans')
  async plans(@CurrentUser() u: CustomerUser) {
    const list = await this.prisma.plan.findMany({ where: { customerId: u.id, status: { in: ['sent', 'completed'] } }, orderBy: { id: 'desc' } })
    return list.map(p => ({ id: p.id, title: (p.contentCustomer as any)?.title, sentAt: fmt(p.sentAt, 'YYYY-MM-DD'), status: p.status }))
  }

  @Get('coupons')
  coupons(@CurrentUser() u: CustomerUser) {
    return this.checkup.myCoupons(u.id)
  }

  @Get('checkup/slots')
  slots(@Query('hospitalId') hospitalId: string, @Query('packageCode') packageCode: string) {
    return this.checkup.slots(Number(hospitalId), packageCode)
  }

  @Post('checkup/bookings')
  book(@CurrentUser() u: CustomerUser, @Body() body: any) {
    return this.checkup.book(u.id, body)
  }

  @Get('referrals')
  async myReferrals(@CurrentUser() u: CustomerUser) {
    const list = await this.prisma.referral.findMany({ where: { customerId: u.id }, orderBy: { id: 'desc' } })
    return Promise.all(list.map(r => this.checkup.referralDetail(r.id, {}).then(d => ({ id: d.id, referralNo: d.referralNo, status: d.status, statusName: d.statusName, hospitalName: d.hospitalName, services: d.serviceList, appointmentAt: d.appointmentAt, createdAt: d.createdAt, isCheckup: !!d.couponId }))))
  }
}
