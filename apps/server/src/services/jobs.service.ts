import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { WorkflowService } from './workflow.service'

/**
 * 定时任务（13.5 BullMQ 任务的 MVP 版：进程内定时器）
 * - alert.escalate 每 5 分钟：L3 超时 30 分钟通知店长和健康顾问，再超 30 分钟通知超管
 * - coupon.expire：过期处理
 * - groupbuy：到期未成团自动关闭
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout
  constructor(private prisma: PrismaService, private wf: WorkflowService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tick().catch(e => console.error('[jobs]', e)), 5 * 60 * 1000)
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  async tick() {
    const now = Date.now()
    const alerts = await this.prisma.riskAlert.findMany({ where: { status: 'open', level: { in: ['L3', 'high'] } } })
    for (const a of alerts) {
      const over = (now - a.slaDueAt.getTime()) / 60000
      const c = await this.prisma.customer.findUnique({ where: { id: a.customerId } })
      if (over > 30 && a.escalationLevel < 1) {
        await this.prisma.riskAlert.update({ where: { id: a.id }, data: { escalationLevel: 1 } })
        await this.wf.notifyStaff({ roles: ['store_manager', 'health_advisor'], storeId: c?.storeId }, '预警超时升级', `【升级】${c?.salutation}的紧急预警已超时 30 分钟未处理`, 'high', '/health/alerts')
      }
      else if (over > 60 && a.escalationLevel < 2) {
        await this.prisma.riskAlert.update({ where: { id: a.id }, data: { escalationLevel: 2 } })
        await this.wf.notifyStaff({ roles: ['super_admin'] }, '预警超时升级', `【升级】${c?.salutation}的紧急预警已超时 1 小时未处理`, 'high', '/health/alerts')
      }
    }
    await this.prisma.coupon.updateMany({ where: { status: 'claimed', expiresAt: { lt: new Date() } }, data: { status: 'expired' } })
    await this.prisma.groupbuyGroup.updateMany({ where: { status: 'open', expiresAt: { lt: new Date() } }, data: { status: 'closed' } })
  }
}
