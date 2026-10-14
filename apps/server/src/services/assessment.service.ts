import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { Err } from '../common/response'
import { addDays, fmt } from '../common/util'
import {
  ageOf, buildFacts, DIM_NAMES, DIMENSIONS, dimGrade, evalLogic, evaluateRedFlags, evaluateRiskSignals,
  riskLevelOf, scoreDimensions, tagName, visibleQuestions,
} from '../engine'
import { chairStandRef, LEVELS, type QDef } from '../engine/question-bank'
import { EngineService } from './engine.service'
import { PlanService } from './plan.service'
import { WorkflowService } from './workflow.service'

const SCORED_LEVELS = ['safety', ...DIMENSIONS]

/** 六维测评（5.3 P-08 ~ P-14、9.2 测评与风险判定） */
@Injectable()
export class AssessmentService {
  constructor(
    private prisma: PrismaService,
    private engine: EngineService,
    private wf: WorkflowService,
    private plans: PlanService,
  ) {}

  async start(customerId: number, mode = 'self') {
    if (!(await this.wf.hasConsent(customerId, 'C2'))) throw Err.needConsent('C2')
    // 无出生年份时引擎按 45 岁兜底，分支题、OSTA、SARC-F、体检券类型都会算错，测评前必须补齐
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { birthYear: true } })
    if (!customer?.birthYear) throw Err.bad('请先选择出生年份，年龄会影响测评题目')
    const exist = await this.prisma.assessment.findFirst({ where: { customerId, status: 'in_progress' }, orderBy: { id: 'desc' } })
    if (exist) {
      if (mode !== exist.mode) await this.prisma.assessment.update({ where: { id: exist.id }, data: { mode, assistCode: mode === 'staff_assisted' ? exist.assistCode || this.code6() : exist.assistCode } })
      return this.current(customerId)
    }
    const tpl = await this.engine.template()
    const a = await this.prisma.assessment.create({
      data: { customerId, templateId: tpl!.id, mode, assistCode: mode === 'staff_assisted' ? this.code6() : null, progress: {} },
    })
    await this.wf.event(customerId, 'assessment_start', { mode })
    return this.current(customerId, a.id)
  }

  private code6() {
    return String(Math.floor(100000 + Math.random() * 900000))
  }

  /** 进行中的测评 + 关卡地图 */
  async current(customerId: number, id?: number) {
    const a = id
      ? await this.prisma.assessment.findUnique({ where: { id } })
      : await this.prisma.assessment.findFirst({ where: { customerId, status: 'in_progress' }, orderBy: { id: 'desc' } })
    if (!a) return null
    const { facts, questions } = await this.engine.factsFor(a.id)
    const answered = new Set((await this.prisma.assessmentAnswer.findMany({ where: { assessmentId: a.id } })).map(x => x.questionCode))
    const progress: any = a.progress || {}
    const levels = LEVELS.filter(l => l.code !== 'women' || facts.gender === 'female').map((l) => {
      const qs = visibleQuestions(questions, facts, l.code)
      const done = qs.filter(q => answered.has(q.code)).length
      return { ...l, total: qs.length, answered: done, done: progress[l.code] === 'done', minutes: Math.max(1, Math.round(qs.length * 0.3)) }
    })
    // 必答关 = 健康安全关 + 六个维度（共 7 关）；女性健康进阶关可选，不计入进度和剩余时间
    const required = levels.filter(l => SCORED_LEVELS.includes(l.code))
    const doneCount = required.filter(l => l.done).length
    const { scores } = scoreDimensions(questions, facts)
    return {
      id: a.id, mode: a.mode, assistCode: a.assistCode, status: a.status, startedAt: a.startedAt,
      levels, doneCount, totalLevels: required.length, totalDims: 6, safetyDone: progress.safety === 'done', dims: scores,
      earnedPoints: levels.filter(l => l.done).length * 10,
      remainingMinutes: required.filter(l => !l.done).reduce((s, l) => s + l.minutes, 0),
    }
  }

  async levelQuestions(customerId: number, id: number, level: string) {
    const a = await this.own(customerId, id)
    const { facts, questions } = await this.engine.factsFor(a.id)
    const all = await this.prisma.assessmentAnswer.findMany({ where: { assessmentId: a.id } })
    const amap: Record<string, any> = {}
    all.filter(x => x.level === level).forEach(x => { amap[x.questionCode] = x.answer })
    const qs = visibleQuestions(questions, facts, level).map(q => this.publicQ(q, facts))
    // 全局进度：答题页同时显示"第几关"和全部必答关的题量，不必回关卡地图才知道还剩多少
    let overall = null
    if (SCORED_LEVELS.includes(level)) {
      const answered = new Set(all.map(x => x.questionCode))
      const others = SCORED_LEVELS.filter(c => c !== level).flatMap(c => visibleQuestions(questions, facts, c))
      overall = { levelNo: SCORED_LEVELS.indexOf(level) + 1, levelCount: SCORED_LEVELS.length, otherTotal: others.length, otherAnswered: others.filter(q => answered.has(q.code)).length }
    }
    return { level: LEVELS.find(l => l.code === level), questions: qs, answers: amap, overall }
  }

  private publicQ(q: QDef, facts: any) {
    const config = { ...(q.config || {}) }
    if (q.config?.scoring === 'chairStand') config.ref = chairStandRef(facts.age)
    return {
      code: q.code, level: q.level, type: q.type, title: q.title, voiceText: q.voiceText || q.title, intro: q.intro,
      options: (q.options || []).map(o => ({ label: o.label, desc: o.desc, value: o.value, exclusive: !!o.exclusive })),
      config, required: !!q.required, skippable: !q.required,
    }
  }

  private async own(customerId: number, id: number) {
    const a = await this.prisma.assessment.findUnique({ where: { id } })
    if (!a || a.customerId !== customerId) throw Err.notFound('测评不存在')
    return a
  }

  /** 逐题保存；命中 L3 红旗立即返回 urgent（4.5） */
  async saveAnswer(customerId: number, id: number, body: { questionCode: string, answer: any, inputMethod?: string }) {
    const a = await this.own(customerId, id)
    if (a.status !== 'in_progress') throw Err.conflict('测评已完成')
    const questions = await this.engine.questions(a.templateId)
    const q = questions.find(x => x.code === body.questionCode)
    if (!q) throw Err.bad('题目不存在')
    await this.prisma.assessmentAnswer.upsert({
      where: { assessmentId_questionCode: { assessmentId: id, questionCode: q.code } },
      create: { assessmentId: id, questionCode: q.code, level: q.level, answer: body.answer ?? {}, inputMethod: body.inputMethod || 'tap' },
      update: { answer: body.answer ?? {}, inputMethod: body.inputMethod || 'tap', answeredAt: new Date() },
    })
    if (body.answer?.skipped) await this.wf.event(customerId, 'assessment_question_skip', { questionCode: q.code })

    const { facts } = await this.engine.factsFor(id)
    const visible = visibleQuestions(questions, facts, q.level).map(x => x.code)
    const l3 = evaluateRedFlags(await this.engine.rules('red_flag'), facts).filter(r => r.level === 'L3')
    if (l3.length) {
      const rule = l3[0]
      await this.wf.createAlert({ customerId, source: 'assessment', sourceRefId: id, level: 'L3', ruleCodes: l3.map(r => r.code), title: rule.conditionText || '测评触发紧急红旗' })
      await this.wf.event(customerId, 'assessment_urgent', { ruleCode: rule.code })
      return {
        saved: true, urgent: true, visibleCodes: visible,
        urgentPage: {
          title: '您提到的情况需要尽快就医',
          body: rule.customerText, // 顾问回电、门店暂停两条在页面下方单独列出，这里不再重复
          hotline: rule.code === 'RF09' || !!(rule.action as any)?.hotline,
          actions: ['call_120', 'contact_advisor'],
          ruleCode: rule.code,
        },
      }
    }
    return { saved: true, urgent: false, visibleCodes: visible }
  }

  async completeLevel(customerId: number, id: number, level: string) {
    const a = await this.own(customerId, id)
    const progress: any = { ...((a.progress as any) || {}) }
    const first = progress[level] !== 'done'
    progress[level] = 'done'
    await this.prisma.assessment.update({ where: { id }, data: { progress } })
    if (first) {
      await this.wf.addPoints(customerId, 10, 'assessment_level', `完成「${LEVELS.find(l => l.code === level)?.name}」`)
      await this.wf.event(customerId, 'assessment_level_complete', { level })
    }
    const { facts, questions } = await this.engine.factsFor(id)
    const { scores } = scoreDimensions(questions, facts)
    return { level, points: first ? 10 : 0, score: scores[level] ?? null, tip: LEVEL_TIPS[level] }
  }

  /** 演示助手：用示例答案填完剩余题目（黑客松演示用，正式版移除） */
  async demoFill(customerId: number, id: number) {
    const a = await this.own(customerId, id)
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })
    const age = ageOf(customer!.birthYear)
    const questions = await this.engine.questions(a.templateId)
    const profile = demoProfile(age, customer!.demoTitle || '')
    for (let round = 0; round < 4; round++) {
      const { facts } = await this.engine.factsFor(id)
      const answered = new Set((await this.prisma.assessmentAnswer.findMany({ where: { assessmentId: id } })).map(x => x.questionCode))
      const todo = visibleQuestions(questions, facts).filter(q => !answered.has(q.code))
      if (!todo.length) break
      for (const q of todo) {
        const ans = profile[q.code] !== undefined ? toAnswer(q, profile[q.code]) : defaultAnswer(q, age)
        await this.prisma.assessmentAnswer.create({ data: { assessmentId: id, questionCode: q.code, level: q.level, answer: ans } })
      }
    }
    const progress: any = {}
    LEVELS.forEach((l) => { progress[l.code] = 'done' })
    await this.prisma.assessment.update({ where: { id }, data: { progress } })
    return this.current(customerId, id)
  }

  /** 完成并计算：六维分数、风险等级、健康标签 → 预警、体检券、方案骨架、跟进任务 */
  async complete(customerId: number, id: number) {
    const a = await this.own(customerId, id)
    if (a.status === 'completed') return this.result(customerId, id)
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })
    let { facts, questions } = await this.engine.factsFor(id)
    const { scores, index } = scoreDimensions(questions, facts)
    ;({ facts } = await this.engine.factsFor(id, { dims: scores }))
    const rules = await this.engine.rules()
    const redHits = evaluateRedFlags(rules, facts)
    const riskHits = evaluateRiskSignals(rules, facts)
    const riskLevel = riskLevelOf(redHits, riskHits)
    const tags = new Set<string>(facts.tags)
    riskHits.forEach(r => (r.tags || []).forEach(t => tags.add(t)))
    redHits.forEach(r => ((r.action as any)?.tags || []).forEach((t: string) => tags.add(t)))

    // 健康标签：测评来源的旧标签失效，写入本次标签
    await this.prisma.healthTag.updateMany({ where: { customerId, source: 'assessment', status: 'active' }, data: { status: 'expired' } })
    for (const t of tags) {
      if (t.startsWith('skin_type') || t === 'skin_care_low') continue
      await this.prisma.healthTag.create({ data: { customerId, tagCode: t, source: 'assessment', sourceRefId: id } })
    }

    await this.prisma.assessment.update({
      where: { id },
      data: {
        status: 'completed', completedAt: new Date(), dimensionScores: scores, indexScore: index, riskLevel,
        hitRules: [...redHits.map(r => r.code), ...riskHits.map(r => r.code)], computed: facts.c, tags: [...tags],
      },
    })

    // L2 预警（L3 在答题时已即时生成）
    for (const r of redHits) {
      await this.wf.createAlert({ customerId, source: 'assessment', sourceRefId: id, level: r.level!, ruleCodes: [r.code], title: r.conditionText || r.code })
    }

    // 档案条目
    await this.wf.addRecord({ customerId, recordType: 'assessment', sourceLabel: 'SELF', title: '六维年轻化测评', summary: `六维指数 ${index ?? '-'}，${riskLevel === 'L0' ? '状态平稳' : riskLevel === 'L1' ? '有需要关注的方面' : '建议优先就医'}`, refTable: 'assessment', refId: id, storeId: customer!.storeId })

    // 体检券（4.9）
    const progress: any = a.progress || {}
    const allDone = SCORED_LEVELS.every(l => progress[l] === 'done')
    const coupon = await this.issueCoupon(customerId, id, ageOf(customer!.birthYear), allDone, ['L2', 'L3'].includes(riskLevel))

    // 方案骨架 + 文案 → 待审核
    await this.plans.generate(customerId, 'assessment', id)

    // 跟进任务（4.12）
    const hours = riskLevel === 'L0' ? 72 : 24
    if (!['L2', 'L3'].includes(riskLevel)) {
      await this.wf.createTask({ staffId: customer!.advisorId, customerId, type: 'assessment_followup', refTable: 'assessment', refId: id, title: `${customer!.salutation}完成六维测评（${riskLevel}），请 ${hours} 小时内跟进`, hours })
      await this.wf.notifyStaff({ staffIds: [customer!.advisorId] }, '新测评完成', `${customer!.salutation}完成六维测评（${riskLevel}），请 ${hours} 小时内跟进`, 'medium', '/customer/list')
    }
    await this.wf.addPoints(customerId, 50, 'assessment_complete', '完成全部六关')
    await this.wf.event(customerId, 'assessment_complete', { riskLevel, coupon: coupon?.couponNo })
    return this.result(customerId, id)
  }

  async issueCoupon(customerId: number, assessmentId: number, age: number, allDone: boolean, redFlag: boolean) {
    if (!allDone || redFlag) return null
    if (!(await this.wf.hasConsent(customerId, 'C2'))) return null
    const year = new Date().getFullYear()
    const exist = await this.prisma.coupon.findFirst({ where: { customerId, year, type: { in: ['BASIC', 'BASIC_ELDER'] }, status: { notIn: ['void'] } } })
    if (exist) return exist
    const hospital = await this.prisma.hospital.findFirst({ where: { status: 'active' }, orderBy: { id: 'asc' } })
    if (!hospital) return null
    const elder = age >= 50
    const c = await this.prisma.coupon.create({
      data: {
        couponNo: `TJ${Date.now().toString().slice(-8)}`, customerId, type: elder ? 'BASIC_ELDER' : 'BASIC',
        packageCode: elder ? 'CP02' : 'CP01', hospitalId: hospital.id, sourceAssessmentId: assessmentId, year,
      },
    })
    await this.wf.message(customerId, '免费体检券已发放', `您的${elder ? '乐龄' : ''}基础体检券已发放，请到店出示券码领取；不方便到店可以联系顾问帮您登记领取。体检由${hospital.name}执行。`, '/pkg-checkup/coupons')
    await this.wf.event(customerId, 'coupon_issue', { type: c.type })
    return c
  }

  /** 测评结果页（P-14） */
  async result(customerId: number, id: number) {
    const a = await this.own(customerId, id)
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })
    const scores: Record<string, number> = (a.dimensionScores as any) || {}
    const prev = await this.prisma.assessment.findFirst({ where: { customerId, status: 'completed', id: { lt: id } }, orderBy: { id: 'desc' } })
    const prevScores: Record<string, number> = (prev?.dimensionScores as any) || {}
    const rules = await this.prisma.rule.findMany({ where: { code: { in: (a.hitRules as string[]) || [] } } })
    const services = await this.prisma.medicalService.findMany()
    const svc = (c: string) => services.find(s => s.code === c)?.name || c
    const dims = DIMENSIONS.map(d => ({
      code: d, name: DIM_NAMES[d], score: scores[d] ?? null, prev: prevScores[d] ?? null,
      ...(scores[d] !== undefined ? dimGrade(scores[d]) : { grade: '未完成', tone: 'none' }),
      note: scores[d] !== undefined ? DIM_NOTES[d][scores[d] >= 80 ? 0 : scores[d] >= 60 ? 1 : 2] : '这一关还没完成',
    }))
    const good = dims.filter(d => (d.score ?? 0) >= 80).map(d => d.name)
    const attention = dims.filter(d => d.score !== null && d.score < 60).map(d => d.name)
    const red = rules.filter(r => r.kind === 'red_flag')
    const risk = rules.filter(r => r.kind === 'risk_signal' && !(r.action as any)?.interest)
    const coupon = await this.prisma.coupon.findFirst({ where: { customerId, sourceAssessmentId: id } })
    const plan = await this.prisma.plan.findFirst({ where: { customerId, assessmentId: id }, orderBy: { id: 'desc' } })
    const sk: any = plan?.skeleton || {}
    const level = a.riskLevel || 'L0'
    const next = ['L2', 'L3'].includes(level)
      ? '先去医院看一看，顾问会帮您预约'
      : coupon ? `到店领取免费体检券${risk.length ? `，做${svc((risk[0].action as any)?.services?.[0])}` : ''}` : '顾问会联系您确认养护方案'
    return {
      id: a.id,
      completedAt: fmt(a.completedAt, 'YYYY-MM-DD'),
      salutation: customer!.salutation,
      elderMode: customer!.elderMode,
      index: a.indexScore,
      prevIndex: prev?.indexScore ?? null,
      riskLevel: level,
      dims,
      three: {
        good: good.length ? `${good.join('、')}状态不错` : '每一项都在稳步变好',
        attention: red.length ? red.map(r => r.conditionText).join('；') : risk.length ? risk.slice(0, 2).map(r => (r.action as any)?.reason).join('；') : attention.length ? `${attention.join('、')}需要多关注` : '暂时没有需要特别注意的',
        next,
      },
      medical: [...red, ...risk].flatMap(r => ((r.action as any)?.services || []).map((s: string) => ({ code: s, name: svc(s), reason: (r.action as any)?.reason || r.conditionText, level: r.level || 'L1' })))
        .filter((m, i, arr) => arr.findIndex(x => x.code === m.code) === i),
      coupon: coupon ? { id: coupon.id, couponNo: coupon.couponNo, type: coupon.type, status: coupon.status } : null,
      plan: plan ? { packages: sk.packages || [], paused: !!sk.paused, reviewStatus: plan.reviewStatus } : null,
      tags: ((a.tags as string[]) || []).filter(t => !t.startsWith('skin_type') && t !== 'skin_care_low').map(t => ({ code: t, name: tagName(t) })),
      computed: a.computed,
    }
  }

  async history(customerId: number) {
    const list = await this.prisma.assessment.findMany({ where: { customerId, status: 'completed' }, orderBy: { id: 'desc' } })
    return list.map(a => ({ id: a.id, completedAt: fmt(a.completedAt, 'YYYY-MM-DD'), index: a.indexScore, riskLevel: a.riskLevel, dims: a.dimensionScores }))
  }

  /** 后台"题库模拟"：输入年龄、性别、答案，返回计分和规则命中 */
  async simulate(input: { age: number, gender: string, answers: Record<string, any>, personalization?: boolean }) {
    const questions = await this.engine.questions()
    let facts = buildFacts({ age: input.age, gender: input.gender, answers: input.answers, questions, personalization: input.personalization })
    const { scores, index } = scoreDimensions(questions, facts)
    facts = { ...facts, d: scores }
    const rules = await this.engine.rules()
    const redHits = evaluateRedFlags(rules, facts)
    const riskHits = evaluateRiskSignals(rules, facts)
    const visible = visibleQuestions(questions, facts).map(q => q.code)
    return { scores, index, riskLevel: riskLevelOf(redHits, riskHits), redHits: redHits.map(r => r.code), riskHits: riskHits.map(r => ({ code: r.code, tags: r.tags })), computed: facts.c, tags: facts.tags, visible }
  }

  async assist(staffId: number, code: string) {
    const a = await this.prisma.assessment.findFirst({ where: { assistCode: code, status: 'in_progress' } })
    if (!a) throw Err.notFound('陪填码无效或测评已完成')
    await this.prisma.assessment.update({ where: { id: a.id }, data: { assistedBy: staffId, mode: 'staff_assisted' } })
    const c = await this.prisma.customer.findUnique({ where: { id: a.customerId } })
    return { assessmentId: a.id, customer: { id: c!.id, salutation: c!.salutation } }
  }
}

const LEVEL_TIPS: Record<string, string> = {
  safety: '谢谢您如实填写，这能让门店项目更安全。',
  skin: '小知识：阴天紫外线也不少，出门记得防晒。',
  shape: '小知识：腰围比体重更能反映腹部脂肪。',
  contour: '小知识：睡眠充足，面部轮廓也更精神。',
  fitness: '小知识：每天坐站练习 10 次，腿劲慢慢就上来了。',
  posture: '小知识：浴室放防滑垫，能有效预防跌倒。',
  mind: '小知识：每天和人聊聊天，心情会更好。',
  women: '谢谢您的信任，这些信息只用于判断是否需要就医。',
}

const DIM_NOTES: Record<string, [string, string, string]> = {
  skin: ['皮肤状态和护理习惯都很好', '护理习惯不错，防晒还可以更勤', '皮肤需要多些呵护，从防晒和保湿开始'],
  shape: ['体型匀称，保持得很好', '体重略有变化，注意饮食和活动', '体重或腰围需要关注'],
  contour: ['面部轮廓保持得很好', '有些轻微松弛，属于正常变化', '面部变化比较明显，可以重点养护'],
  fitness: ['体能很好，继续保持运动', '体能不错，可以加强腿部力量', '腿劲和平衡需要练一练'],
  posture: ['体态挺拔，很少酸痛', '有些酸痛，注意坐姿和活动', '酸痛或跌倒风险需要关注'],
  mind: ['睡得好、心情好', '偶尔睡不好或有压力', '睡眠或情绪需要多关心'],
}

function toAnswer(q: QDef, v: any) {
  if (Array.isArray(v)) return { values: v }
  return { value: v }
}

function defaultAnswer(q: QDef, age: number) {
  switch (q.type) {
    case 'multi': {
      const none = q.options?.find(o => o.exclusive)
      return { values: [none ? none.value : q.options![0].value] }
    }
    case 'slider': return { value: q.config?.default ?? q.config?.min }
    case 'number': return { skipped: true }
    case 'counter': return { value: chairStandRef(age) }
    case 'timer': return { value: 22 }
    default: {
      const scored = (q.options || []).filter(o => typeof o.score === 'number')
      if (scored.length) return { value: scored.sort((x, y) => (y.score as number) - (x.score as number))[0].value }
      return { value: q.options![0].value }
    }
  }
}

/** 演示画像：乐龄客户命中骨骼、酸痛、睡眠信号（L1）；中年客户命中更年期与睡眠（L1） */
function demoProfile(age: number, title: string): Record<string, any> {
  if (age >= 55) {
    return {
      H01: ['htn'], H02: 'good', H03: ['none'], S02: ['wrinkle', 'spots'], S03: 'sometimes', B01: 155, B02: 52, B03: 82, B04: 'same',
      C01: ['eyes', 'nasolabial', 'neck'], C02: 'bit', C03: 'no', F01: '1_2', F02: 10, F03: 12, F05: 'some', F06: 'none', F07: 'some', F08: 'some', F09: 'none',
      P01: 'round', P02: ['waist', 'back'], P03: 'gt3', P05: 'yes', P06: 'yes', M01: '5_6', M02: '3plus', M03: 'gt3', M04: '1', M05: '1', M06: '1', M07: '0', M09: 'sometimes',
      W01: 'meno', W09: 'gt10', W10: 'sometimes', W11: 'no', W14: 'gt3', W15: 'lt3', W16: 'gt2', W17: 'no', W18: 'no', W22: ['none'],
    }
  }
  if (age >= 40) {
    return {
      H01: ['none'], H03: ['none'], S02: ['dull', 'pores'], S03: 'daily', B01: 163, B02: 60, B03: 78, B04: 'same', C01: ['eyes'], C02: 'bit', C03: 'curious',
      F01: '1_2', F02: 13, F03: 25, F04: 'tired', P01: 'forward_head', P02: ['neck'], P03: 'm1_3', M01: '5_6', M02: '3plus', M03: 'gt3', M04: '1', M05: '1', M06: '2', M07: '1', M09: 'rarely',
      W01: 'peri', W04: 'mild', W05: 'normal', W07: 'no', W10: 'sleep', W14: 'lt1', W15: 'lt3', W16: 'lt1', W17: 'no', W18: 'no', W22: ['none'],
    }
  }
  return {
    H01: ['none'], H03: ['none'], S02: ['acne', 'dull'], S03: 'daily', B01: 162, B02: 63, B03: 81, B04: 'gain', C01: ['none'], C02: 'same', C03: 'no',
    F01: '0', F02: 16, F03: 30, F04: 'easy', P01: 'round', P02: ['neck', 'waist'], P03: 'm1_3', M01: '6_7', M02: '1_2', M03: 'm1_3', M04: '1', M05: '0', M06: '1', M07: '1', M09: 'sometimes',
    W01: 'irregular', W02: 'chaotic', W03: 'gt6', W04: 'affect', W05: 'normal', W07: 'no', W08: 'no', W14: 'lt1', W15: 'lt3', W16: 'y1_2', W17: 'no', W18: 'no', W22: ['none'],
  }
}

export { addDays, evalLogic }
