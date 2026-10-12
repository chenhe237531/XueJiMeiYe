import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { PrismaService } from '../common/prisma.service'
import { Err } from '../common/response'
import { fmt } from '../common/util'
import { evaluateRedFlags, evaluateRiskSignals, buildFacts, ageOf } from '../engine'
import { AiService } from './ai.service'
import { EngineService } from './engine.service'
import { WorkflowService } from './workflow.service'

const SOURCE_NAMES: Record<string, string> = { HOSPITAL: '医院出具', STORE: '门店测量', SELF: '本人记录' }

/** 健康档案、门店测量与报告（4.10、5.3 P-02 ~ P-19、9.9） */
@Injectable()
export class ArchiveService {
  constructor(private prisma: PrismaService, private wf: WorkflowService, private engine: EngineService, private ai: AiService) {}

  private async metricDefs() {
    const defs = await this.prisma.deviceMetric.findMany()
    const map = new Map<string, any>()
    defs.forEach(d => { if (!map.has(d.code)) map.set(d.code, d) })
    return map
  }

  async overview(customerId: number) {
    const assessments = await this.prisma.assessment.findMany({ where: { customerId, status: 'completed' }, orderBy: { id: 'asc' } })
    const last = assessments[assessments.length - 1]
    const defs = await this.metricDefs()
    const ms = await this.prisma.measurement.findMany({ where: { customerId }, orderBy: { measuredAt: 'desc' } })
    const latest = new Map<string, any>()
    const prev = new Map<string, any>()
    for (const m of ms) {
      for (const x of (m.metrics as any[]) || []) {
        if (!latest.has(x.code)) latest.set(x.code, { ...x, at: m.measuredAt, method: m.method })
        else if (!prev.has(x.code)) prev.set(x.code, x)
      }
    }
    const PRIORITY = ['BMD_T_LUMBAR', 'SBP', 'BODY_FAT', 'MUSCLE', 'MOISTURE', 'DBP', 'VFAT', 'WEIGHT', 'ELASTIC', 'PULSE']
    const rank = (c: string) => (PRIORITY.includes(c) ? PRIORITY.indexOf(c) : 99)
    const metrics = [...latest.values()].sort((a, b) => rank(a.code) - rank(b.code)).slice(0, 6).map((x) => {
      const d = defs.get(x.code)
      const p = prev.get(x.code)
      const src = x.source || (x.method === 'hospital' ? 'HOSPITAL' : 'STORE')
      let arrow = 'flat'
      if (p && p.value !== x.value) arrow = x.value > p.value ? 'up' : 'down'
      const better = !p || p.value === x.value ? null : d?.direction === 'higher_better' ? x.value > p.value : d?.direction === 'lower_better' ? x.value < p.value : null
      return { code: x.code, name: d?.name || x.name || x.code, value: x.value, unit: d?.unit ?? x.unit ?? '', date: fmt(x.at, 'M月D日'), source: src, sourceName: SOURCE_NAMES[src], arrow, better }
    })
    const records = await this.prisma.record.findMany({ where: { customerId, visible: true }, orderBy: { occurredAt: 'desc' }, take: 5 })
    const hospitalReports = await this.prisma.report.count({ where: { customerId, type: 'hospital' } })
    return {
      index: last?.indexScore ?? null,
      indexTrend: assessments.map(a => ({ date: fmt(a.completedAt, 'M/D'), value: a.indexScore })),
      dims: last?.dimensionScores || null,
      lastAssessedAt: last ? fmt(last.completedAt, 'YYYY-MM-DD') : null,
      lastAssessmentId: last?.id || null,
      metrics,
      records: records.map(r => this.recordView(r)),
      hospitalReports,
    }
  }

  recordView(r: any) {
    return { id: r.id, type: r.recordType, title: r.title, summary: r.summary, source: r.sourceLabel, sourceName: SOURCE_NAMES[r.sourceLabel], date: fmt(r.occurredAt, 'YYYY-MM-DD'), refTable: r.refTable, refId: r.refId }
  }

  async records(customerId: number, type?: string) {
    const list = await this.prisma.record.findMany({ where: { customerId, visible: true, ...(type ? { recordType: type } : {}) }, orderBy: { occurredAt: 'desc' }, take: 100 })
    return list.map(r => this.recordView(r))
  }

  async trend(customerId: number, code: string, range = '12m') {
    const months = Number.parseInt(range) || 12
    const since = dayjs().subtract(months, 'month').toDate()
    const defs = await this.metricDefs()
    if (code === 'INDEX') {
      const list = await this.prisma.assessment.findMany({ where: { customerId, status: 'completed', completedAt: { gte: since } }, orderBy: { completedAt: 'asc' } })
      return { code, name: '六维年轻化指数', unit: '', points: list.map(a => ({ date: fmt(a.completedAt, 'M/D'), value: a.indexScore, source: 'SELF' })) }
    }
    const ms = await this.prisma.measurement.findMany({ where: { customerId, measuredAt: { gte: since } }, orderBy: { measuredAt: 'asc' } })
    const points: any[] = []
    for (const m of ms) {
      const x = ((m.metrics as any[]) || []).find(i => i.code === code)
      if (x) points.push({ date: fmt(m.measuredAt, 'M/D'), value: x.value, source: x.source || (m.method === 'hospital' ? 'HOSPITAL' : 'STORE') })
    }
    const d = defs.get(code)
    return { code, name: d?.name || code, unit: d?.unit || '', refLow: d?.refLow, refHigh: d?.refHigh, points }
  }

  async metricCodes(customerId: number) {
    const defs = await this.metricDefs()
    const ms = await this.prisma.measurement.findMany({ where: { customerId } })
    const codes = new Set<string>()
    ms.forEach(m => ((m.metrics as any[]) || []).forEach(x => codes.add(x.code)))
    return [{ code: 'INDEX', name: '六维指数' }, ...[...codes].map(c => ({ code: c, name: defs.get(c)?.name || c }))]
  }

  async reports(customerId: number, type?: string) {
    const list = await this.prisma.report.findMany({ where: { customerId, ...(type ? { type } : {}), reviewStatus: { in: ['auto_published', 'approved'] } }, orderBy: { id: 'desc' } })
    return list.map(r => ({ id: r.id, type: r.type, title: r.title, source: r.sourceLabel, sourceName: SOURCE_NAMES[r.sourceLabel], date: fmt(r.publishedAt || r.createdAt, 'YYYY-MM-DD') }))
  }

  async report(customerId: number | null, id: number) {
    const r = await this.prisma.report.findUnique({ where: { id } })
    if (!r || (customerId && r.customerId !== customerId)) throw Err.notFound('报告不存在')
    if (customerId && !['auto_published', 'approved'].includes(r.reviewStatus)) throw Err.forbidden('报告审核中')
    return { ...r, sourceName: SOURCE_NAMES[r.sourceLabel], date: fmt(r.publishedAt || r.createdAt, 'YYYY-MM-DD') }
  }

  /** 门店测量录入 → 档案（STORE）→ 按模板生成报告 → 命中就医规则进入审核 / 红旗生成预警（9.9） */
  async createMeasurement(body: { customerId: number, deviceId: number, metrics: { code: string, value: number }[], operator?: string, measuredAt?: string }, actor: { id: number, name: string }) {
    const device = await this.prisma.device.findUnique({ where: { id: body.deviceId } })
    if (!device) throw Err.notFound('设备不存在')
    if (device.admissionStatus !== 'approved') throw Err.forbidden('该设备未通过准入审核，数据不得进入客户档案')
    const customer = await this.prisma.customer.findUnique({ where: { id: body.customerId } })
    if (!customer) throw Err.notFound('客户不存在')
    const defs = await this.prisma.deviceMetric.findMany({ where: { deviceId: device.id } })
    const metrics = body.metrics.filter(m => m.value !== null && m.value !== undefined && `${m.value}` !== '').map((m) => {
      const d = defs.find(x => x.code === m.code)
      if (!d) throw Err.bad(`指标 ${m.code} 不在该设备白名单内`)
      return { code: d.code, name: d.name, value: Number(m.value), unit: d.unit, source: 'STORE' }
    })
    const store = customer.storeId ? await this.prisma.store.findUnique({ where: { id: customer.storeId } }) : null
    const prevM = await this.prisma.measurement.findFirst({ where: { customerId: customer.id, deviceId: device.id }, orderBy: { measuredAt: 'desc' } })
    const m = await this.prisma.measurement.create({ data: { customerId: customer.id, deviceId: device.id, storeId: customer.storeId, operator: body.operator || actor.name, metrics, measuredAt: body.measuredAt ? new Date(body.measuredAt) : new Date(), method: 'manual' } })

    // 红旗 / 风险信号（如血压）
    const bp = { sbp: metrics.find(x => x.code === 'SBP')?.value, dbp: metrics.find(x => x.code === 'DBP')?.value }
    const facts = buildFacts({ age: ageOf(customer.birthYear), gender: customer.gender, answers: {}, questions: [], measurement: bp })
    const rules = await this.engine.rules()
    const red = evaluateRedFlags(rules, facts).filter(r => r.code === 'RF12')
    const risk = evaluateRiskSignals(rules, facts).filter(r => r.code === 'R10')
    for (const r of red) await this.wf.createAlert({ customerId: customer.id, source: 'measurement', sourceRefId: m.id, level: 'L2', ruleCodes: [r.code], title: `门店血压 ${bp.sbp}/${bp.dbp} mmHg，${r.conditionText}` })
    for (const r of risk) for (const t of r.tags || []) await this.wf.setTag(customer.id, t, 'measurement', m.id)
    const needDoctor = red.length > 0 || risk.length > 0

    const prevMetrics: any[] = (prevM?.metrics as any[]) || []
    const results = metrics.map((x) => {
      const d = defs.find(y => y.code === x.code)!
      const status = d.refHigh !== null && x.value > d.refHigh! ? 'high' : d.refLow !== null && x.value < d.refLow! ? 'low' : 'normal'
      return { code: x.code, name: x.name, value: x.value, unit: x.unit, ref: d.refLow !== null || d.refHigh !== null ? `${d.refLow ?? ''}-${d.refHigh ?? ''}` : '', refSource: d.refSource, status, direction: d.direction }
    })
    const compare = results.map((x) => {
      const p = prevMetrics.find(y => y.code === x.code)
      if (!p) return { code: x.code, name: x.name, prev: null, value: x.value, trend: 'first' }
      const diff = x.value - p.value
      let trend = 'same'
      if (Math.abs(diff) > 0.0001) {
        if (x.direction === 'higher_better') trend = diff > 0 ? 'better' : 'attention'
        else if (x.direction === 'lower_better') trend = diff < 0 ? 'better' : 'attention'
        else trend = x.status === 'normal' ? 'better' : 'attention'
      }
      return { code: x.code, name: x.name, prev: p.value, value: x.value, trend }
    })
    const meaning = await this.interpret(results, compare, customer.elderMode)
    const content = {
      basic: { date: fmt(m.measuredAt, 'YYYY-MM-DD HH:mm'), store: store?.name, device: device.name, model: device.model, operator: m.operator, source: 'STORE', sourceName: '门店测量' },
      results, compare, meaning,
      storeAdvice: await this.storeAdvice(customer.id),
      seeDoctor: needDoctor
        ? { need: true, text: red.length ? (red[0].customerText || '') : '门店测的血压偏高，建议到医院复测确认。' }
        : { need: false, text: '本次测量没有需要看医生的情况。' },
      disclaimer: '门店测量数据只作为生活美容参考，不作为医学诊断。',
    }
    const report = await this.prisma.report.create({
      data: { customerId: customer.id, type: 'measurement', sourceLabel: 'STORE', title: `${device.name}测量报告`, content, aiGenerated: meaning.some((x: any) => x.ai), reviewStatus: needDoctor ? 'pending_review' : 'auto_published', publishedAt: needDoctor ? null : new Date() },
    })
    await this.wf.addRecord({ customerId: customer.id, recordType: 'measurement', sourceLabel: 'STORE', title: `${device.name}测量`, summary: results.map(r => `${r.name} ${r.value}${r.unit || ''}`).join('，'), refTable: 'report', refId: report.id, storeId: customer.storeId, occurredAt: m.measuredAt })
    await this.prisma.customer.update({ where: { id: customer.id }, data: { lastVisitAt: new Date() } })
    await this.wf.audit({ type: 'staff', id: actor.id, name: actor.name }, 'measurement.create', { type: 'measurement', id: m.id, customerId: customer.id })
    if (needDoctor) await this.wf.notifyStaff({ roles: ['health_advisor'] }, '报告待审核', `${customer.salutation}的门店测量报告命中就医规则，请审核`, 'medium', '/health/reports')
    return { measurementId: m.id, reportId: report.id, reviewStatus: report.reviewStatus, alerts: red.map(r => r.code) }
  }

  private async storeAdvice(customerId: number) {
    const plan = await this.prisma.plan.findFirst({ where: { customerId, status: { in: ['sent', 'ready', 'draft'] } }, orderBy: { id: 'desc' } })
    const sk: any = plan?.skeleton
    return sk ? [...(sk.packages || []).map((p: any) => p.name), ...(sk.storeItems || []).map((s: any) => s.name)] : ['完成六维测评后，顾问会为您推荐']
  }

  /** "这代表什么"：模板 + 指标区间（AI P2 可选，不出疾病结论） */
  private async interpret(results: any[], compare: any[], elder: boolean) {
    const base = results.map((r) => {
      const c = compare.find(x => x.code === r.code)
      let text = r.status === 'normal' ? `${r.name}在参考范围内` : `${r.name}${r.status === 'high' ? '高于' : '低于'}参考范围，建议关注`
      if (c?.trend === 'better') text += elder ? '，比上次好' : '，比上次有进步'
      else if (c?.trend === 'attention') text += '，比上次需要多留意'
      return { metric: r.code, text: `${text}。` }
    })
    if (!(await this.ai.available())) return base
    const out: any = await this.ai.chatJson([
      { role: 'system', content: `你是雪姬美业门店测量报告的解读助手。只根据给定的指标、数值、参考范围、上次数值，写"这代表什么"。规则：每个指标写一句，不超过 ${elder ? 25 : 40} 字；只描述数值的含义和变化，不推断任何疾病，不提器官功能，不提激素、毒素、能量等概念；超出参考范围时，只说"高于（或低于）参考范围，建议关注"；不要写就医建议。只输出 JSON：{"items":[{"metric":"指标编码","text":"..."}],"overall":"总体一句话"}` },
      { role: 'user', content: JSON.stringify({ results, compare }) },
    ], { scene: 'report', timeoutMs: 15000, maxTokens: 500 })
    if (!out?.items?.length) return base
    return base.map(b => ({ ...b, ...(out.items.find((i: any) => i.metric === b.metric)?.text ? { text: out.items.find((i: any) => i.metric === b.metric).text, ai: true } : {}) }))
  }
}
