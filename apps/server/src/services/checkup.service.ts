import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { PrismaService } from '../common/prisma.service'
import { Err } from '../common/response'
import { addDays, addHours, fmt, genNo } from '../common/util'
import { ageOf } from '../engine'
import { AiService } from './ai.service'
import { PlanService } from './plan.service'
import { WorkflowService } from './workflow.service'

export const COUPON_STATUS: Record<string, string> = { issued: '待领取', claimed: '已领取', booked: '已预约', used: '已使用', expired: '已过期', void: '已作废' }
export const REFERRAL_STATUS: Record<string, string> = { created: '已创建', sent: '待接收', accepted: '待预约', booked: '待到院', arrived: '待回传', returned: '已回传', closed: '已完成', cancelled: '已取消', rejected: '已拒绝' }
const RESTRICTION_NAMES: Record<string, string> = { doctor_hold_manual: '暂停手法类', doctor_hold_heavy_manual: '暂停重手法', doctor_hold_heat: '暂停热疗类', doctor_hold_device: '暂停仪器类', doctor_hold_all: '暂停全部门店项目' }

const P3 = `请把下面医生写的结论和建议，改写成老人容易听懂的话。

规则：
1. 不增加任何信息，不删减任何建议，不改变任何数字、日期、复查时间。
2. 专业词如果没有把握改写，就保留原词，在后面加"（医生的说法）"。
3. 每句不超过 25 个字。
4. 不加任何安慰性的推测，比如"问题不大""很快会好"。
5. 结尾固定加一句："以上根据医生原话整理，如有疑问请以医生解释为准。"

医生原文：
{{doctor_text}}`

/** 体检券、预约、转介、医院回传（4.9、7、9.4） */
@Injectable()
export class CheckupService {
  constructor(private prisma: PrismaService, private wf: WorkflowService, private plans: PlanService, private ai: AiService) {}

  async couponView(c: any) {
    const hospital = await this.prisma.hospital.findUnique({ where: { id: c.hospitalId } })
    const pkg = await this.prisma.checkupPackage.findUnique({ where: { code: c.packageCode } })
    const ref = await this.prisma.referral.findFirst({ where: { couponId: c.id }, orderBy: { id: 'desc' } })
    return {
      id: c.id, couponNo: c.couponNo, type: c.type, typeName: c.type === 'BASIC_ELDER' ? '乐龄基础体检券' : c.type === 'BASIC' ? '基础体检券' : '专项检查券',
      status: c.status, statusName: COUPON_STATUS[c.status], issuedAt: fmt(c.issuedAt, 'YYYY-MM-DD'), claimedAt: fmt(c.claimedAt, 'YYYY-MM-DD'), expiresAt: fmt(c.expiresAt, 'YYYY-MM-DD'),
      hospital: hospital ? { id: hospital.id, name: hospital.name, address: hospital.address } : null,
      package: pkg ? { code: pkg.code, name: pkg.name, items: pkg.items, fasting: pkg.fastingRequired, notice: pkg.notice } : null,
      promise: `体检由${hospital?.name || '合作医院'}执行。体检当天门店不推销任何产品。`,
      booking: ref ? { referralNo: ref.referralNo, status: ref.status, statusName: REFERRAL_STATUS[ref.status], appointmentAt: fmt(ref.appointmentAt), notice: ref.appointmentNotice } : null,
    }
  }

  async myCoupons(customerId: number) {
    const list = await this.prisma.coupon.findMany({ where: { customerId }, orderBy: { id: 'desc' } })
    return Promise.all(list.map(c => this.couponView(c)))
  }

  /** 到店领取（员工扫码核销） */
  async claim(couponNo: string, staff: { id: number, name: string }) {
    const c = await this.prisma.coupon.findUnique({ where: { couponNo } })
    if (!c) throw Err.notFound('券号不存在')
    if (c.status !== 'issued') throw Err.conflict(`该券当前状态：${COUPON_STATUS[c.status]}`)
    await this.prisma.coupon.update({ where: { id: c.id }, data: { status: 'claimed', claimedAt: new Date(), claimedBy: staff.name, expiresAt: addDays(60) } })
    await this.prisma.customer.update({ where: { id: c.customerId }, data: { lastVisitAt: new Date() } })
    await this.wf.addPoints(c.customerId, 20, 'visit', '到店')
    await this.wf.message(c.customerId, '体检券已领取', '您可以在"体检券"里预约体检日期了，有效期 60 天。', '/pkg-checkup/coupons')
    await this.wf.audit({ type: 'staff', id: staff.id, name: staff.name }, 'coupon.claim', { type: 'coupon', id: c.id, customerId: c.customerId })
    await this.wf.event(c.customerId, 'coupon_claim', { type: c.type })
    const customer = await this.prisma.customer.findUnique({ where: { id: c.customerId } })
    return { ok: true, customer: { salutation: customer?.salutation, phoneTail: customer?.phone?.slice(-4) } }
  }

  async slots(hospitalId: number, packageCode: string) {
    const start = dayjs().add(1, 'day')
    const list = await this.prisma.checkupSlot.findMany({ where: { hospitalId, packageCode, date: { gte: start.format('YYYY-MM-DD') } }, orderBy: { date: 'asc' }, take: 21 })
    return list.map(s => ({ date: s.date, week: '日一二三四五六'[dayjs(s.date).day()], capacity: s.capacity, remaining: Math.max(0, s.capacity - s.booked), status: s.status }))
  }

  /** 体检预约：必须授权 C3（按医院），C4 可选（独立开关） */
  async book(customerId: number, body: { couponId?: number, date?: string, transportNeeded?: boolean, c3: boolean, c4: boolean, services?: string[], level?: string, note?: string }) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer) throw Err.notFound()
    let coupon: any = null
    let hospitalId: number
    if (body.couponId) {
      coupon = await this.prisma.coupon.findUnique({ where: { id: body.couponId } })
      if (!coupon || coupon.customerId !== customerId) throw Err.notFound('体检券不存在')
      if (coupon.status !== 'claimed') throw Err.conflict(coupon.status === 'issued' ? '请先到店领取体检券' : `该券当前状态：${COUPON_STATUS[coupon.status]}`)
      hospitalId = coupon.hospitalId
    }
    else {
      hospitalId = (await this.prisma.hospital.findFirst({ where: { status: 'active' } }))!.id
    }
    if (!body.c3) throw Err.needConsent('C3')
    const c3 = await this.wf.grantConsent(customerId, 'C3', true, { hospital_id: hospitalId })
    const c4 = await this.wf.grantConsent(customerId, 'C4', !!body.c4, { hospital_id: hospitalId })

    if (coupon && body.date) {
      const slot = await this.prisma.checkupSlot.findUnique({ where: { hospitalId_packageCode_date: { hospitalId, packageCode: coupon.packageCode, date: body.date } } })
      if (!slot || slot.booked >= slot.capacity) throw Err.conflict('该日期已约满，请换一天')
      await this.prisma.checkupSlot.update({ where: { id: slot.id }, data: { booked: { increment: 1 } } })
    }

    // 共享字段快照（7.2）：只包含与推荐服务相关的信息，不含等级、消费、门店方案、魔镜内容
    const last = await this.prisma.assessment.findFirst({ where: { customerId, status: 'completed' }, orderBy: { id: 'desc' } })
    const hitRules = await this.prisma.rule.findMany({ where: { code: { in: ((last?.hitRules as string[]) || []) } } })
    const services = body.services?.length ? body.services : [...new Set(hitRules.flatMap(r => ((r.action as any)?.services || []) as string[]))].filter(s => s !== 'M9')
    const reason = hitRules.filter(r => r.kind !== 'contraindication' && !(r.action as any)?.interest).map(r => (r.action as any)?.reason || r.conditionText).filter(Boolean)
    const computed: any = last?.computed || {}
    if (computed.osta !== undefined && hitRules.some(r => r.code === 'R04')) reason.push(`OSTA 指数 ${computed.osta}`)
    const snapshot = {
      salutation: customer.salutation, gender: customer.gender === 'female' ? '女' : '男', age: ageOf(customer.birthYear), phone: customer.phone,
      services, riskLevel: last?.riskLevel || 'L0', reasonSummary: reason.join('；') || '年度基础体检',
      assessmentPoints: hitRules.filter(r => r.kind !== 'contraindication').map(r => ({ code: r.code, text: r.conditionText })),
      selfReport: body.note || '', storeNote: body.transportNeeded ? '需要接送 / 陪同' : '',
      priority: customer.tier === 'A', consent: { c3: { version: c3.textVersion, at: fmt(c3.grantedAt) }, c4: body.c4 ? { version: c4.textVersion, at: fmt(c4.grantedAt) } : null },
    }
    const referral = await this.prisma.referral.create({
      data: {
        referralNo: genNo('RF'), customerId, hospitalId, services, packageCode: coupon?.packageCode, couponId: coupon?.id, level: last?.riskLevel || 'L0',
        priority: customer.tier === 'A', reasonSummary: snapshot.reasonSummary, snapshot, consentC3Id: c3.id, consentC4Id: body.c4 ? c4.id : null, c4Granted: !!body.c4,
        status: 'sent', appointmentAt: body.date ? dayjs(`${body.date} 08:30`).toDate() : null, transportNeeded: !!body.transportNeeded,
        storeNote: snapshot.storeNote, slaDueAt: addHours(24), createdBy: 'customer', timeline: [{ at: fmt(new Date()), text: coupon ? `客户预约体检 ${body.date || ''}` : '客户发起转介' }],
      },
    })
    if (coupon) await this.prisma.coupon.update({ where: { id: coupon.id }, data: { status: 'booked' } })
    if (body.transportNeeded) {
      await this.prisma.lead.create({ data: { leadNo: genNo('LD'), customerId, type: 'transport', moduleCode: 'vip_transport', moduleName: '接送车', formData: { 目的地: '合作医院体检', 日期: body.date }, assigneeId: customer.advisorId, slaDueAt: addHours(24) } })
    }
    await this.wf.createTask({ staffId: customer.advisorId, customerId, type: 'referral_book', refTable: 'referral', refId: referral.id, title: `跟进${customer.salutation}的${coupon ? '体检预约' : '转介就诊'}`, hours: 24 })
    await this.wf.message(customerId, coupon ? '体检预约已提交' : '转介已提交', coupon ? `您预约了 ${body.date} 的体检，医院确认后会通知您。请空腹前往。` : '合作医院会尽快联系您安排就诊。', '/pkg-checkup/coupons')
    await this.wf.event(customerId, 'booking_submit', { hospitalId })
    return { referralId: referral.id, referralNo: referral.referralNo }
  }

  // ───────── 医院端 ─────────

  async hospitalReferrals(hospitalId: number, status?: string) {
    const map: Record<string, string[]> = {
      pending: ['sent', 'created'], to_book: ['accepted'], to_arrive: ['booked'], to_return: ['arrived'], done: ['returned', 'closed'], cancelled: ['cancelled', 'rejected'],
    }
    const where: any = { hospitalId }
    if (status && map[status]) where.status = { in: map[status] }
    const list = await this.prisma.referral.findMany({ where, orderBy: { id: 'desc' } })
    const services = await this.prisma.medicalService.findMany()
    return list.map((r) => {
      const s: any = r.snapshot
      return {
        id: r.id, referralNo: r.referralNo, salutation: s.salutation, age: s.age, gender: s.gender,
        services: (r.services as string[]).map(c => services.find(x => x.code === c)?.name || c), packageCode: r.packageCode,
        level: r.level, priority: r.priority, status: r.status, statusName: REFERRAL_STATUS[r.status], createdAt: fmt(r.createdAt),
        slaDueAt: fmt(r.slaDueAt), appointmentAt: fmt(r.appointmentAt), c4Granted: r.c4Granted,
      }
    })
  }

  async referralDetail(id: number, scope: { hospitalId?: number }) {
    const r = await this.prisma.referral.findUnique({ where: { id } })
    if (!r || (scope.hospitalId && r.hospitalId !== scope.hospitalId)) throw Err.notFound()
    const services = await this.prisma.medicalService.findMany()
    const ret = await this.prisma.referralReturn.findUnique({ where: { referralId: id } })
    const pkg = r.packageCode ? await this.prisma.checkupPackage.findUnique({ where: { code: r.packageCode } }) : null
    const hospital = await this.prisma.hospital.findUnique({ where: { id: r.hospitalId } })
    return {
      ...r, statusName: REFERRAL_STATUS[r.status], hospitalName: hospital?.name,
      serviceList: (r.services as string[]).map(c => ({ code: c, name: services.find(x => x.code === c)?.name || c })),
      package: pkg, appointmentAt: fmt(r.appointmentAt), arrivedAt: fmt(r.arrivedAt), createdAt: fmt(r.createdAt), slaDueAt: fmt(r.slaDueAt),
      return: ret ? { ...ret, restrictionNames: ((ret.storeRestrictions as string[]) || []).map(t => RESTRICTION_NAMES[t] || t), createdAt: fmt(ret.createdAt) } : null,
    }
  }

  private async pushTimeline(id: number, text: string, data: any = {}) {
    const r = await this.prisma.referral.findUnique({ where: { id } })
    const timeline = [...((r!.timeline as any[]) || []), { at: fmt(new Date()), text }]
    return this.prisma.referral.update({ where: { id }, data: { ...data, timeline } })
  }

  async hospitalAction(id: number, hospitalId: number, action: string, body: any, actor: { id: number, name: string }) {
    const r = await this.prisma.referral.findUnique({ where: { id } })
    if (!r || r.hospitalId !== hospitalId) throw Err.notFound()
    const customer = await this.prisma.customer.findUnique({ where: { id: r.customerId } })
    const hospital = await this.prisma.hospital.findUnique({ where: { id: hospitalId } })
    await this.wf.audit({ type: 'hospital_user', id: actor.id, name: actor.name }, `referral.${action}`, { type: 'referral', id, customerId: r.customerId })
    switch (action) {
      case 'accept':
        if (!['sent', 'created'].includes(r.status)) throw Err.conflict()
        await this.pushTimeline(id, `${hospital?.name}已接收`, { status: r.appointmentAt ? 'booked' : 'accepted' })
        if (r.appointmentAt) await this.wf.message(r.customerId, '预约成功', `${hospital?.name}已确认您 ${fmt(r.appointmentAt, 'M月D日 HH:mm')} 的体检。请空腹前往，带好身份证。`, '/pkg-checkup/coupons')
        break
      case 'reject':
        if (!body.reason) throw Err.bad('请填写拒绝原因')
        await this.pushTimeline(id, `医院拒绝：${body.reason}`, { status: 'rejected', rejectReason: body.reason })
        break
      case 'appointment': {
        if (!body.time) throw Err.bad('请选择时间')
        await this.pushTimeline(id, `已预约 ${body.time}`, { status: 'booked', appointmentAt: dayjs(body.time).toDate(), appointmentNotice: body.notice })
        await this.wf.message(r.customerId, '预约成功', `${hospital?.name}已为您预约 ${dayjs(body.time).format('M月D日 HH:mm')}。${body.notice || ''}`, '/pkg-checkup/coupons')
        await this.wf.notifyStaff({ staffIds: [customer?.advisorId] }, '医院已预约', `${customer?.salutation}已预约 ${dayjs(body.time).format('M月D日 HH:mm')}，请提醒客户`, 'normal')
        break
      }
      case 'arrived':
        await this.pushTimeline(id, '客户已到院', { status: 'arrived', arrivedAt: new Date() })
        if (r.couponId) await this.prisma.coupon.update({ where: { id: r.couponId }, data: { status: 'used', usedAt: new Date() } })
        await this.prisma.customer.update({ where: { id: r.customerId }, data: { lastVisitAt: new Date() } })
        break
      case 'cancel':
        await this.pushTimeline(id, `已取消：${body.reason || ''}`, { status: 'cancelled', cancelReason: body.reason })
        break
      case 'return':
        return this.processReturn(r, body, actor, hospital, customer)
      default:
        throw Err.bad('未知操作')
    }
    return { ok: true }
  }

  /** 回传（7.4）：写入档案（HOSPITAL）、健康标签、方案重算，通知顾问 48 小时内调整 */
  private async processReturn(r: any, body: any, actor: any, hospital: any, customer: any) {
    if (!r.c4Granted) throw Err.forbidden('客户未授权回传，请将报告直接交给客户')
    if (!body.doctorName || !body.conclusion || !body.advice) throw Err.bad('请填写接诊医生、结论摘要和医生建议')
    const doctorText = `结论：${body.conclusion}\n建议：${body.advice}${body.recheckDate ? `\n复查日期：${body.recheckDate}` : ''}`
    const plainText = await this.plainify(doctorText)
    const ret = await this.prisma.referralReturn.create({
      data: { referralId: r.id, doctorName: body.doctorName, conclusion: body.conclusion, advice: body.advice, storeRestrictions: body.storeRestrictions || [], recheckDate: body.recheckDate, metrics: body.metrics || [], plainText, createdBy: actor.name },
    })
    await this.pushTimeline(r.id, `${body.doctorName}已回传`, { status: 'returned' })
    if (r.couponId) await this.prisma.coupon.update({ where: { id: r.couponId }, data: { status: 'used', usedAt: new Date() } })
    for (const t of body.storeRestrictions || []) await this.wf.setTag(r.customerId, t, 'hospital', ret.id)
    const report = await this.prisma.report.create({
      data: {
        customerId: r.customerId, type: 'hospital', sourceLabel: 'HOSPITAL', title: `${hospital?.name} · ${r.packageCode ? '体检报告' : '就诊建议'}`,
        content: { hospital: hospital?.name, doctor: body.doctorName, conclusion: body.conclusion, advice: body.advice, plain: plainText, recheckDate: body.recheckDate, metrics: body.metrics || [], restrictions: (body.storeRestrictions || []).map((t: string) => RESTRICTION_NAMES[t] || t) },
        aiGenerated: !!plainText, reviewStatus: 'auto_published', publishedAt: new Date(),
      },
    })
    await this.wf.addRecord({ customerId: r.customerId, recordType: 'hospital_report', sourceLabel: 'HOSPITAL', title: `${hospital?.name}回传`, summary: body.conclusion.slice(0, 60), refTable: 'report', refId: report.id })
    for (const m of body.metrics || []) {
      if (m.code && m.value !== undefined) await this.prisma.measurement.create({ data: { customerId: r.customerId, metrics: [{ ...m, source: 'HOSPITAL' }], measuredAt: new Date(), method: 'hospital' } })
    }
    // 方案重算 + 顾问 48 小时内调整
    try {
      await this.plans.generate(r.customerId, 'hospital_return')
    }
    catch {}
    await this.wf.createTask({ staffId: customer?.advisorId, customerId: r.customerId, type: 'plan_adjust', refTable: 'referral', refId: r.id, title: `${hospital?.name}已回传${customer?.salutation}的体检建议，请 48 小时内调整方案`, hours: 48 })
    await this.wf.notifyStaff({ staffIds: [customer?.advisorId], roles: ['health_advisor'] }, '医院回传', `${hospital?.name}已回传${customer?.salutation}的体检建议，请 48 小时内调整方案`, 'medium', '/health/referrals')
    await this.wf.message(r.customerId, '医生建议已回传', '医院已把医生的建议发给您，可以在"档案 - 医院报告"里查看。', `/pkg-archive/report?id=${report.id}`)
    return { ok: true, plainText }
  }

  /** P3 医生原话通俗化 + 校验：数字和日期必须在原文出现，长度不超过原文 2 倍；不通过只展示原文 */
  async plainify(doctorText: string) {
    const out = await this.ai.chat([{ role: 'user', content: P3.replace('{{doctor_text}}', doctorText) }], { scene: 'hospital_rewrite', timeoutMs: 20000, temperature: 0.3, maxTokens: 600 })
    if (!out) return null
    const nums = out.match(/-?\d+(?:\.\d+)?/g) || []
    const ok = nums.every(n => doctorText.includes(n)) && out.length <= doctorText.length * 2 + 60
    return ok ? out.trim() : null
  }

  async statements(hospitalId: number) {
    const list = await this.prisma.statement.findMany({ where: { hospitalId }, orderBy: { month: 'desc' } })
    if (!list.length || list[0].month !== dayjs().format('YYYY-MM')) {
      // 按当月实际完成的体检套餐生成对账单（不按转介人头）
      const start = dayjs().startOf('month').toDate()
      const used = await this.prisma.coupon.findMany({ where: { hospitalId, status: 'used', usedAt: { gte: start } } })
      const pkgs = await this.prisma.checkupPackage.findMany()
      const items = used.map(u => ({ couponNo: u.couponNo, packageCode: u.packageCode, packageName: pkgs.find(p => p.code === u.packageCode)?.name, date: fmt(u.usedAt, 'YYYY-MM-DD'), price: pkgs.find(p => p.code === u.packageCode)?.agreementPrice || 0 }))
      const total = items.reduce((s, i) => s + (i.price || 0), 0)
      const month = dayjs().format('YYYY-MM')
      const exist = list.find(s => s.month === month)
      if (exist) await this.prisma.statement.update({ where: { id: exist.id }, data: { items, total } })
      else await this.prisma.statement.create({ data: { hospitalId, month, items, total } })
      return this.prisma.statement.findMany({ where: { hospitalId }, orderBy: { month: 'desc' } })
    }
    return list
  }
}
