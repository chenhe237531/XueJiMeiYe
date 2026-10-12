import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { Err } from '../common/response'
import { genNo } from '../common/util'
import { ageOf, buildSkeleton, evaluateRedFlags, evaluateRiskSignals, riskLevelOf, maxLevel } from '../engine'
import { lifestyleText, templateCopy } from '../engine/copy'
import { BANNED_WORDS, findBannedWords } from '../engine/rules-data'
import { AiService } from './ai.service'
import { EngineService } from './engine.service'
import { WorkflowService } from './workflow.service'

const P1_SYSTEM = `你是雪姬美业的方案撰写助手。雪姬美业是一家生活美容与健康管理连锁机构，不是医疗机构。

你的任务：根据给定的【方案骨架】，写出客户版、顾问版和医生版文字。

硬性规则（违反任何一条，输出作废）：
1. 方案骨架里的方案包、门店项目、频次、就医建议、风险等级都已由规则确定。你不能增加、删除、替换它们，也不能改变顺序，只能写解释和表达。
2. 不做诊断，不解释病因，不推测疾病，不推荐药物、保健品或任何商品，不承诺效果和时间。
3. 不得使用以下词语：{{banned_words}}。
4. 就医建议放在最前面，说明"为什么建议去"，用客户听得懂的话，不要吓唬客户。
5. 门店项目只能使用骨架里的名称；可以说明"为什么适合您"，不能说它能治好什么。
6. 生活建议只能改写骨架给出的条目，不能新增。
7. 客户版称呼客户为「{{salutation}}」，用"您"。
8. 如果 elderMode 为 true：每句不超过 25 个字，少用专业词，多用日常说法。
9. 顾问版话术不催单，体现"先把情况弄清楚，再安排"。
10. 医生版只做客观转述：年龄段、客户自述、测评要点、转介原因，不加推测。

只输出一个 JSON 对象，不要输出任何其他文字。`

const P1_FORMAT = `{
  "customer": { "title": "方案标题，不超过 16 字", "summary": "一句话说明，不超过 40 字", "medicalIntro": "就医建议的说明，不超过 80 字；没有就医建议时为空字符串",
    "medicalItems": [{ "service": "M3", "why": "不超过 40 字" }], "storeItems": [{ "project": "P06", "why": "不超过 40 字" }],
    "lifestyle": ["逐条改写，条数与输入一致"], "closing": "结尾一句，不超过 30 字", "wecomMessage": "顾问发送的企业微信消息，不超过 180 字" },
  "advisor": { "talkingPoints": ["当面沟通要点，最多 4 条"], "script": "开场话术，不超过 100 字", "cautions": ["操作提醒，对应骨架中带 warn 标记的项目"] },
  "doctor": "转介摘要，不超过 150 字；没有就医建议时为空字符串"
}`

/** 方案生成、审核、发送（4.7、9.5、10.3、10.9） */
@Injectable()
export class PlanService {
  constructor(
    private prisma: PrismaService,
    private engine: EngineService,
    private wf: WorkflowService,
    private ai: AiService,
  ) {}

  async generate(customerId: number, trigger: string, assessmentId?: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer) throw Err.notFound('客户不存在')
    const aid = assessmentId || (await this.prisma.assessment.findFirst({ where: { customerId, status: 'completed' }, orderBy: { id: 'desc' } }))?.id
    if (!aid) throw Err.bad('客户还没有完成测评')
    const { facts } = await this.engine.factsFor(aid)
    const rules = await this.engine.rules()
    const redHits = evaluateRedFlags(rules, facts)
    const riskHits = evaluateRiskSignals(rules, facts)
    riskHits.forEach(r => (r.tags || []).forEach(t => { if (!facts.tags.includes(t)) facts.tags.push(t) }))
    const hasActiveRedFlag = await this.wf.hasActiveRedFlag(customerId)
    let riskLevel = riskLevelOf(redHits, riskHits)
    if (hasActiveRedFlag) riskLevel = maxLevel(riskLevel, 'L2')
    if (!hasActiveRedFlag && ['L2', 'L3'].includes(riskLevel) && trigger === 'alert_closed') riskLevel = 'L1'

    // 医生建议优先：最近一次医院回传的限制标签与复查时间
    const ret = await this.latestReturn(customerId)
    const restrictions: string[] = (ret?.storeRestrictions as string[]) || []
    restrictions.forEach(t => facts.tags.push(t))

    const coupon = await this.prisma.coupon.findFirst({ where: { customerId, year: new Date().getFullYear() }, orderBy: { id: 'desc' } })
    const skeleton = buildSkeleton({
      salutation: customer.salutation || '您',
      age: ageOf(customer.birthYear),
      elderMode: customer.elderMode,
      facts,
      riskLevel,
      redHits: trigger === 'alert_closed' && !hasActiveRedFlag ? [] : redHits,
      riskHits,
      packages: await this.engine.packages(),
      projects: await this.engine.projects(),
      ciRules: await this.engine.rules('contraindication'),
      lifestyleTips: await this.engine.lifestyle(),
      medicalServices: await this.engine.medicalServices(),
      couponEligible: !!coupon && ['issued', 'claimed'].includes(coupon.status),
      couponType: coupon?.type,
      hasActiveRedFlag: hasActiveRedFlag && trigger !== 'alert_closed',
      doctorAdvice: ret ? { recheckDate: ret.recheckDate || undefined, restrictions } : null,
      rulesVersion: 'rules-1.0',
    })
    if (ret) skeleton.doctorAdvice = { doctor: ret.doctorName, advice: ret.advice, recheckDate: ret.recheckDate }

    const { content, engine, validation, model } = await this.writeCopy(skeleton)

    // 旧的未发送方案作废
    await this.prisma.plan.updateMany({ where: { customerId, status: { in: ['draft', 'ready'] } }, data: { status: 'void' } })
    const plan = await this.prisma.plan.create({
      data: {
        planNo: genNo('PL'), customerId, trigger, assessmentId: aid, riskLevel: skeleton.riskLevel, skeleton,
        contentCustomer: content.customer, contentAdvisor: content.advisor, contentDoctor: content.doctor,
        engine, model, validation, reviewStatus: 'pending', status: 'draft',
      },
    })
    const reviewer = await this.prisma.staff.findFirst({ where: { role: 'health_advisor', status: 'active' } })
    await this.wf.createTask({ staffId: reviewer?.id, customerId, type: 'plan_review', refTable: 'plan', refId: plan.id, title: `审核${customer.salutation}的方案（${skeleton.packages.map((p: any) => p.name).join(' + ')}）`, hours: 24 })
    await this.wf.notifyStaff({ roles: ['health_advisor'] }, '方案待审核', `${customer.salutation}的方案已生成（${engine === 'ai' ? 'AI 文案' : '模板文案'}），请 24 小时内审核`, 'medium', '/health/plans')
    await this.wf.event(customerId, 'plan_generated', { planId: plan.id, engine })
    return plan
  }

  async latestReturn(customerId: number) {
    const refs = await this.prisma.referral.findMany({ where: { customerId, status: { in: ['returned', 'closed'] } }, orderBy: { id: 'desc' } })
    for (const r of refs) {
      const ret = await this.prisma.referralReturn.findUnique({ where: { referralId: r.id } })
      if (ret) return ret
    }
    return null
  }

  /** AI 写文案 → 校验（结构、骨架一致、禁用词、长度）→ 不通过重试 1 次 → 仍不通过用模板 */
  async writeCopy(skeleton: any) {
    const tpl = templateCopy(skeleton)
    const validation: any = { attempts: [], fallbackReason: null }
    if (skeleton.paused) {
      validation.fallbackReason = 'L2/L3 就医方案固定使用模板（4.4）'
      return { content: tpl, engine: 'template', validation, model: null }
    }
    if (!(await this.ai.available())) {
      validation.fallbackReason = 'AI 未配置，使用模板文案'
      return { content: tpl, engine: 'template', validation, model: null }
    }
    const cfg = await this.ai.config()
    const lifestyleTexts = (skeleton.lifestyleCodes || []).map((c: string) => lifestyleText(c, skeleton.customer.elderMode))
    const sys = P1_SYSTEM.replace('{{banned_words}}', BANNED_WORDS.join('、')).replace('{{salutation}}', skeleton.customer.salutation)
    const slim = { ...skeleton, storeItems: skeleton.storeItems.map((s: any) => ({ project: s.project, name: s.name, freq: s.freq, flags: s.flags })) }
    let hint = ''
    for (let i = 0; i < 2; i++) {
      const user = `【方案骨架】\n${JSON.stringify(slim)}\n\n【客户自述（可能为空）】\n\n【生活建议原文】\n${lifestyleTexts.join('\n')}\n\n【输出格式】\n${P1_FORMAT}${hint}`
      const out: any = await this.ai.chatJson([{ role: 'system', content: sys }, { role: 'user', content: user }], { scene: 'plan', timeoutMs: 30000, maxTokens: 1500 })
      const check = this.validate(out, skeleton)
      validation.attempts.push(check)
      if (check.ok) {
        // 用骨架里的名称和频次回填，保证展示一致
        out.customer.medicalItems = out.customer.medicalItems.map((m: any, idx: number) => ({ ...m, name: skeleton.medical[idx].name }))
        out.customer.storeItems = out.customer.storeItems.map((s: any, idx: number) => ({ ...s, name: skeleton.storeItems[idx].name, freq: skeleton.storeItems[idx].freq }))
        return { content: out, engine: 'ai', validation, model: cfg.model }
      }
      hint = `\n\n上一次输出不合格：${check.errors.join('；')}。请严格按规则重写。`
    }
    validation.fallbackReason = '两次 AI 输出未通过校验，使用模板文案'
    return { content: tpl, engine: 'template', validation, model: cfg.model }
  }

  validate(out: any, skeleton: any) {
    const errors: string[] = []
    if (!out?.customer || !out?.advisor) return { ok: false, errors: ['JSON 结构不完整'] }
    const c = out.customer
    const med = (c.medicalItems || []).map((m: any) => m.service).join(',')
    if (med !== (skeleton.medical || []).map((m: any) => m.service).join(',')) errors.push('就医建议与骨架不一致')
    const st = (c.storeItems || []).map((s: any) => s.project).join(',')
    if (st !== (skeleton.storeItems || []).map((s: any) => s.project).join(',')) errors.push('门店项目与骨架不一致')
    if ((c.lifestyle || []).length !== (skeleton.lifestyleCodes || []).length) errors.push('生活建议条数不一致')
    const text = JSON.stringify({ customer: c, advisor: out.advisor })
    const banned = findBannedWords(text)
    if (banned.length) errors.push(`命中禁用词：${banned.join('、')}`)
    return { ok: errors.length === 0, errors, banned }
  }

  async review(planId: number, actor: { id: number, name: string }, approve: boolean, note?: string, edits?: { contentCustomer?: any }) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } })
    if (!plan) throw Err.notFound()
    const editLog = [...((plan.edits as any[]) || [])]
    const data: any = { reviewStatus: approve ? 'approved' : 'rejected', reviewer: actor.name, reviewedAt: new Date(), reviewNote: note }
    if (edits?.contentCustomer) {
      const banned = findBannedWords(JSON.stringify(edits.contentCustomer))
      if (banned.length) throw Err.bad(`文案含禁用词：${banned.join('、')}`)
      data.contentCustomer = edits.contentCustomer
      editLog.push({ by: actor.name, at: new Date(), field: 'contentCustomer' })
      data.edits = editLog
    }
    if (approve) data.status = 'ready'
    await this.prisma.plan.update({ where: { id: planId }, data })
    await this.prisma.task.updateMany({ where: { refTable: 'plan', refId: planId, type: 'plan_review', status: 'todo' }, data: { status: 'done', doneAt: new Date() } })
    await this.wf.audit({ type: 'staff', id: actor.id, name: actor.name }, 'plan.review', { type: 'plan', id: planId, customerId: plan.customerId }, { approve, note })
    if (approve) {
      const customer = await this.prisma.customer.findUnique({ where: { id: plan.customerId } })
      await this.wf.createTask({ staffId: customer?.advisorId, customerId: plan.customerId, type: 'plan_send', refTable: 'plan', refId: planId, title: `${customer?.salutation}的方案已审核通过，请发送`, hours: 48 })
      await this.wf.notifyStaff({ staffIds: [customer?.advisorId] }, '方案待发送', `${customer?.salutation}的方案已审核通过，请发送`, 'medium', '/health/plans')
    }
    return { ok: true }
  }

  async markSent(planId: number, actor: { id: number, name: string }) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } })
    if (!plan) throw Err.notFound()
    if (plan.reviewStatus !== 'approved' && plan.reviewStatus !== 'auto') throw Err.conflict('方案需先通过健康顾问审核')
    await this.prisma.plan.updateMany({ where: { customerId: plan.customerId, status: 'sent', id: { not: planId } }, data: { status: 'completed' } })
    await this.prisma.plan.update({ where: { id: planId }, data: { status: 'sent', sentAt: new Date(), sentBy: actor.name } })
    await this.prisma.task.updateMany({ where: { refTable: 'plan', refId: planId, type: { in: ['plan_send', 'plan_adjust'] }, status: 'todo' }, data: { status: 'done', doneAt: new Date() } })
    const content: any = plan.contentCustomer || {}
    await this.wf.message(plan.customerId, '您的养护方案已送达', content.summary || '顾问为您整理了新的养护方案', '/pkg-plan/detail')
    await this.wf.addRecord({ customerId: plan.customerId, recordType: 'plan', sourceLabel: 'STORE', title: content.title || '养护方案', summary: '顾问已发送', refTable: 'plan', refId: planId })
    await this.wf.audit({ type: 'staff', id: actor.id, name: actor.name }, 'plan.send', { type: 'plan', id: planId, customerId: plan.customerId })
    await this.wf.event(plan.customerId, 'plan_sent', { planId })
    return { ok: true }
  }
}
