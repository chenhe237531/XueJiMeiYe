import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common'
import dayjs from 'dayjs'
import { Aud, CurrentUser, type HospitalUserT, ROLE_NAMES } from '../common/auth'
import { PrismaService } from '../common/prisma.service'
import { Err } from '../common/response'
import { fmt } from '../common/util'
import { CheckupService } from '../services/checkup.service'
import { WorkflowService } from '../services/workflow.service'

/** 医院端（第 7 章）：所有查询强制加 hospital_id = 当前医院 */
@Controller('hospital')
@Aud('hospital')
export class HospitalController {
  constructor(private prisma: PrismaService, private checkup: CheckupService, private wf: WorkflowService) {}

  @Get('auth/me')
  async me(@CurrentUser() u: HospitalUserT) {
    const h = await this.prisma.hospital.findUnique({ where: { id: u.hospitalId } })
    return { id: u.id, name: u.name, role: u.role, roleName: ROLE_NAMES[u.role], hospitalName: h?.name }
  }

  @Get('dashboard')
  async dashboard(@CurrentUser() u: HospitalUserT) {
    const groups = await this.prisma.referral.groupBy({ by: ['status'], where: { hospitalId: u.hospitalId }, _count: true })
    const c = (ss: string[]) => groups.filter(g => ss.includes(g.status)).reduce((s, g) => s + g._count, 0)
    return { pending: c(['sent', 'created']), toBook: c(['accepted']), toArrive: c(['booked']), toReturn: c(['arrived']), done: c(['returned', 'closed']) }
  }

  @Get('referrals')
  list(@CurrentUser() u: HospitalUserT, @Query('status') status?: string) {
    return this.checkup.hospitalReferrals(u.hospitalId, status)
  }

  /** 详情：共享快照（客户 C3 授权范围内），写审计 */
  @Get('referrals/:id')
  async detail(@CurrentUser() u: HospitalUserT, @Param('id', ParseIntPipe) id: number) {
    const d = await this.checkup.referralDetail(id, { hospitalId: u.hospitalId })
    await this.wf.audit({ type: 'hospital_user', id: u.id, name: u.name }, 'referral.view', { type: 'referral', id, customerId: d.customerId })
    const { customerId, ...rest } = d as any
    void customerId
    return rest
  }

  @Post('referrals/:id/:action')
  action(@CurrentUser() u: HospitalUserT, @Param('id', ParseIntPipe) id: number, @Param('action') action: string, @Body() body: any) {
    if (action === 'return' && !['doctor', 'coordinator', 'admin'].includes(u.role)) throw Err.forbidden()
    return this.checkup.hospitalAction(id, u.hospitalId, action, body, u)
  }

  @Get('slots')
  async slots(@CurrentUser() u: HospitalUserT, @Query('packageCode') packageCode?: string) {
    const list = await this.prisma.checkupSlot.findMany({ where: { hospitalId: u.hospitalId, ...(packageCode ? { packageCode } : {}), date: { gte: dayjs().format('YYYY-MM-DD') } }, orderBy: [{ date: 'asc' }, { packageCode: 'asc' }], take: 120 })
    return list
  }

  @Put('slots')
  async saveSlot(@CurrentUser() u: HospitalUserT, @Body() body: { packageCode: string, date: string, capacity: number, status?: string }) {
    await this.prisma.checkupSlot.upsert({
      where: { hospitalId_packageCode_date: { hospitalId: u.hospitalId, packageCode: body.packageCode, date: body.date } },
      create: { hospitalId: u.hospitalId, packageCode: body.packageCode, date: body.date, capacity: Number(body.capacity), status: body.status || 'open' },
      update: { capacity: Number(body.capacity), status: body.status || 'open' },
    })
    return { ok: true }
  }

  @Get('services')
  async services(@CurrentUser() u: HospitalUserT) {
    return { services: await this.prisma.medicalService.findMany(), packages: await this.prisma.checkupPackage.findMany({ where: { hospitalId: u.hospitalId } }) }
  }

  @Post('services/change-requests')
  async changeRequest(@CurrentUser() u: HospitalUserT, @Body() body: any) {
    await this.wf.notifyStaff({ roles: ['ops'] }, '医院服务目录修改申请', `${u.name}提交了服务与套餐修改：${body.note || ''}`, 'normal')
    return { ok: true }
  }

  @Get('statements')
  async statements(@CurrentUser() u: HospitalUserT) {
    return (await this.checkup.statements(u.hospitalId)).map(s => ({ ...s, createdAt: fmt(s.createdAt) }))
  }

  @Post('statements/:id/:action')
  async statementAction(@CurrentUser() u: HospitalUserT, @Param('id', ParseIntPipe) id: number, @Param('action') action: string, @Body() body: { note?: string }) {
    const s = await this.prisma.statement.findUnique({ where: { id } })
    if (!s || s.hospitalId !== u.hospitalId) throw Err.notFound()
    await this.prisma.statement.update({ where: { id }, data: { status: action === 'confirm' ? 'confirmed' : 'disputed', note: body.note } })
    if (action === 'dispute') await this.wf.notifyStaff({ roles: ['finance'] }, '对账异议', `${u.name}对 ${s.month} 对账单提出异议：${body.note || ''}`, 'medium')
    return { ok: true }
  }

  @Get('users')
  async users(@CurrentUser() u: HospitalUserT) {
    return (await this.prisma.hospitalUser.findMany({ where: { hospitalId: u.hospitalId } })).map(x => ({ id: x.id, name: x.name, username: x.username, role: x.role, roleName: ROLE_NAMES[x.role], status: x.status }))
  }
}
