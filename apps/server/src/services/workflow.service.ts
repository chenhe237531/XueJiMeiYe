import { Injectable } from '@nestjs/common'
import { DEMO_SHOW_EVENTS, invalidateHiddenDemo } from '../common/demo-scope'
import { PrismaService } from '../common/prisma.service'
import { addHours } from '../common/util'

/** 预警、任务、通知、审计、档案、积分等通用副作用（4.12 跟进时效、8.2 企微消息模板） */
@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  async audit(actor: { type: string, id?: number, name?: string } | null, action: string, resource?: { type?: string, id?: number, customerId?: number }, detail?: any) {
    await this.prisma.auditLog.create({
      data: {
        actorType: actor?.type || 'system',
        actorId: actor?.id,
        actorName: actor?.name,
        action,
        resourceType: resource?.type,
        resourceId: resource?.id,
        customerId: resource?.customerId,
        detail,
      },
    })
  }

  async event(customerId: number | null, event: string, props?: any) {
    await this.prisma.eventLog.create({ data: { customerId: customerId || undefined, event, props } }).catch(() => {})
    // 演示副本：访客做了需要员工跟进的事，副本才出现在后台
    if (customerId && DEMO_SHOW_EVENTS.has(event)) {
      const r = await this.prisma.customer.updateMany({ where: { id: customerId, demoOf: { not: null }, demoShown: false }, data: { demoShown: true } })
      if (r.count) invalidateHiddenDemo()
    }
  }

  async message(customerId: number, title: string, content: string, link?: string) {
    await this.prisma.message.create({ data: { customerId, title, content, link } })
  }

  /** 企微应用消息（MVP：写入员工站内通知，后台右上角铃铛查看） */
  async notifyStaff(target: { staffIds?: (number | null | undefined)[], roles?: string[], storeId?: number | null }, title: string, content: string, level = 'normal', link?: string) {
    const ids = new Set<number>((target.staffIds || []).filter(Boolean) as number[])
    if (target.roles?.length) {
      const staff = await this.prisma.staff.findMany({ where: { role: { in: target.roles }, status: 'active' } })
      staff.filter(s => !target.storeId || !s.storeId || s.storeId === target.storeId || s.role === 'health_advisor').forEach(s => ids.add(s.id))
    }
    for (const staffId of ids) {
      await this.prisma.staffNotice.create({ data: { staffId, level, title, content, link } })
    }
  }

  async createTask(t: { staffId?: number | null, customerId?: number, type: string, refTable?: string, refId?: number, title: string, hours: number }) {
    return this.prisma.task.create({
      data: { staffId: t.staffId || undefined, customerId: t.customerId, type: t.type, refTable: t.refTable, refId: t.refId, title: t.title, dueAt: addHours(t.hours) },
    })
  }

  /** 生成风险预警 + 顾问任务 + 通知（L3 / 魔镜高风险 1 小时，L2 / 关注 24 小时） */
  async createAlert(a: { customerId: number, source: string, sourceRefId?: number, level: string, ruleCodes?: string[], title: string, excerpt?: string }) {
    const customer = await this.prisma.customer.findUnique({ where: { id: a.customerId } })
    const slaHours = ['L3', 'high'].includes(a.level) ? 1 : 24
    // 同一客户同一规则未关闭的预警不重复创建
    if (a.ruleCodes?.length) {
      const open = await this.prisma.riskAlert.findMany({ where: { customerId: a.customerId, status: { not: 'closed' } } })
      const dup = open.find(o => ((o.ruleCodes as string[]) || []).some(c => a.ruleCodes!.includes(c)))
      if (dup) return dup
    }
    const alert = await this.prisma.riskAlert.create({
      data: { customerId: a.customerId, source: a.source, sourceRefId: a.sourceRefId, level: a.level, ruleCodes: a.ruleCodes || [], title: a.title, excerpt: a.excerpt, slaDueAt: addHours(slaHours), contactLogs: [] },
    })
    const name = customer?.salutation || '客户'
    const urgent = ['L3', 'high'].includes(a.level)
    await this.createTask({ staffId: customer?.advisorId, customerId: a.customerId, type: 'alert_call', refTable: 'risk_alert', refId: alert.id, title: `${urgent ? '【紧急】' : '【优先】'}${name}：${a.title}`, hours: slaHours })
    const content = urgent
      ? `【紧急】${name}${a.source === 'mirror' ? '在与魔镜对话中出现高风险表达' : '测评提示需尽快就医'}，请 1 小时内电话联系`
      : `【${a.level === 'watch' ? '关注' : '优先'}】${name}：${a.title}，请 24 小时内跟进`
    await this.notifyStaff(
      { staffIds: [customer?.advisorId], roles: urgent ? ['store_manager', 'health_advisor'] : [], storeId: customer?.storeId },
      urgent ? '紧急预警' : '风险预警', content, urgent ? 'high' : 'medium', `/health/alerts`,
    )
    if (['L3', 'L2'].includes(a.level)) await this.setTag(a.customerId, 'red_flag_active', 'staff', alert.id)
    return alert
  }

  async activeTags(customerId: number) {
    const tags = await this.prisma.healthTag.findMany({ where: { customerId, status: 'active' } })
    const nowT = Date.now()
    return [...new Set(tags.filter(t => !t.validUntil || t.validUntil.getTime() > nowT).map(t => t.tagCode))]
  }

  async setTag(customerId: number, tagCode: string, source: string, sourceRefId?: number, validUntil?: Date) {
    const exist = await this.prisma.healthTag.findFirst({ where: { customerId, tagCode, status: 'active' } })
    if (exist) return exist
    return this.prisma.healthTag.create({ data: { customerId, tagCode, source, sourceRefId, validUntil } })
  }

  async hasActiveRedFlag(customerId: number) {
    const n = await this.prisma.riskAlert.count({ where: { customerId, level: { in: ['L3', 'L2'] }, status: { not: 'closed' } } })
    return n > 0
  }

  async addRecord(r: { customerId: number, recordType: string, sourceLabel: string, title: string, summary?: string, refTable?: string, refId?: number, storeId?: number | null, occurredAt?: Date }) {
    return this.prisma.record.create({ data: { ...r, storeId: r.storeId || undefined } })
  }

  /** 当前有效授权（最新一条记录为同意且未撤回） */
  async hasConsent(customerId: number, type: string, scopeKey?: string, scopeVal?: any) {
    const recs = await this.prisma.consentRecord.findMany({ where: { customerId, type }, orderBy: { id: 'desc' } })
    const rec = recs.find(r => !scopeKey || (r.scope as any)?.[scopeKey] === scopeVal)
    return !!rec && rec.granted && !rec.revokedAt ? rec : null
  }

  async grantConsent(customerId: number, type: string, granted = true, scope?: any, channel = 'self') {
    const text = await this.prisma.consentText.findFirst({ where: { type, status: 'published' }, orderBy: { id: 'desc' } })
    const rec = await this.prisma.consentRecord.create({ data: { customerId, type, textVersion: text?.version || '2026.10.1', scope, granted, channel } })
    await this.event(customerId, granted ? 'consent_grant' : 'consent_reject', { type, version: rec.textVersion })
    return rec
  }

  async balance(customerId: number) {
    const last = await this.prisma.pointsLedger.findFirst({ where: { customerId }, orderBy: { id: 'desc' } })
    return last?.balanceAfter || 0
  }

  async addPoints(customerId: number, change: number, reasonCode: string, note?: string) {
    const bal = await this.balance(customerId)
    return this.prisma.pointsLedger.create({ data: { customerId, change, reasonCode, note, balanceAfter: bal + change } })
  }
}
