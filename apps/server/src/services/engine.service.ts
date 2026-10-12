import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import type { QDef } from '../engine/question-bank'
import { ageOf, buildFacts, type Facts, type RuleLike } from '../engine'
import { WorkflowService } from './workflow.service'

/** 从数据库加载规则配置，供纯函数规则引擎使用（后台修改即时生效） */
@Injectable()
export class EngineService {
  constructor(private prisma: PrismaService, private wf: WorkflowService) {}

  async template() {
    return this.prisma.assessmentTemplate.findFirst({ where: { status: 'published' }, orderBy: { id: 'desc' } })
  }

  async questions(templateId?: number): Promise<QDef[]> {
    const tid = templateId || (await this.template())?.id
    const rows = await this.prisma.assessmentQuestion.findMany({ where: { templateId: tid }, orderBy: [{ seq: 'asc' }] })
    return rows.map(r => ({
      code: r.code, level: r.level, type: r.type as any, title: r.title, voiceText: r.voiceText || undefined,
      intro: r.intro || undefined, options: (r.options as any) || undefined, config: (r.config as any) || undefined,
      showIf: r.showIf ?? undefined, required: r.required, sensitive: r.sensitive,
    }))
  }

  async rules(kind?: string): Promise<RuleLike[]> {
    const rows = await this.prisma.rule.findMany({ where: { status: 'active', ...(kind ? { kind } : {}) } })
    return rows as any
  }

  async packages() {
    return (await this.prisma.planPackage.findMany({ where: { status: 'active' } })) as any[]
  }

  async projects() {
    // 已上架 + 筹备中的项目参与方案引擎；合规未通过（blocked）的项目不参与
    return (await this.prisma.project.findMany({ where: { status: { in: ['active', 'planned'] } } })).map(p => ({ ...p, attributes: (p.attributes as string[]) || [] }))
  }

  async lifestyle() {
    return (await this.prisma.lifestyleTip.findMany()).map(t => ({ ...t, tags: (t.tags as string[]) || [] }))
  }

  async medicalServices() {
    return this.prisma.medicalService.findMany()
  }

  async latestBp(customerId: number) {
    const ms = await this.prisma.measurement.findMany({ where: { customerId }, orderBy: { measuredAt: 'desc' }, take: 10 })
    for (const m of ms) {
      const metrics = (m.metrics as any[]) || []
      const sbp = metrics.find(x => x.code === 'SBP')?.value
      const dbp = metrics.find(x => x.code === 'DBP')?.value
      if (sbp || dbp) return { sbp, dbp }
    }
    return null
  }

  /** 构造某次测评的事实对象（答案 + 员工 / 医院产生的健康标签 + 门店血压） */
  async factsFor(assessmentId: number, opts: { dims?: Record<string, number>, includeAllTags?: boolean } = {}): Promise<{ facts: Facts, questions: QDef[], customer: any, assessment: any }> {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } })
    const customer = await this.prisma.customer.findUnique({ where: { id: assessment!.customerId } })
    const questions = await this.questions(assessment!.templateId)
    const answers = await this.prisma.assessmentAnswer.findMany({ where: { assessmentId } })
    const amap: Record<string, any> = {}
    answers.forEach(a => { amap[a.questionCode] = a.answer })
    const tagRows = await this.prisma.healthTag.findMany({ where: { customerId: customer!.id, status: 'active', source: { in: opts.includeAllTags ? ['hospital', 'staff', 'measurement', 'assessment'] : ['hospital', 'staff', 'measurement'] } } })
    const extraTags = tagRows.map(t => t.tagCode).filter(t => t !== 'red_flag_active')
    const facts = buildFacts({
      age: ageOf(customer!.birthYear),
      gender: customer!.gender,
      answers: amap,
      questions,
      measurement: await this.latestBp(customer!.id),
      extraTags,
      personalization: customer!.personalization,
      dims: opts.dims || (assessment!.dimensionScores as any) || {},
    })
    return { facts, questions, customer, assessment }
  }

  async activeTags(customerId: number) {
    return this.wf.activeTags(customerId)
  }
}
