import { Body, Controller, Get, Post } from '@nestjs/common'
import dayjs from 'dayjs'
import { MATCH3_LEVELS, WHEEL_PRIZES } from '../../prisma/seed-config'
import { Aud, CurrentUser, type CustomerUser } from '../common/auth'
import { PrismaService } from '../common/prisma.service'
import { Err } from '../common/response'
import { addHours, genNo } from '../common/util'
import { WorkflowService } from '../services/workflow.service'

/**
 * 互动小游戏（issue #7）：种健康树 / 积分转盘 / 消消乐
 * 防刷：积分奖励统一走 PointsLedger reasonCode 当日计数上限（与 quiz/checkin 同模式），
 * 树的每日水滴领取按 GameProgress state 日期重置，消消乐按 reasonCode 'match3' 当日求和封顶 15 分。
 */
const TREE_STAGE_DROPS = 20
const TREE_REDEEM_POINTS = 50
const WHEEL_FREE_DAILY = 1
const WHEEL_PAID_DAILY = 3
const WHEEL_PAID_COST = 20
const MATCH3_DAILY_CAP = 15

const today = () => dayjs().format('YYYY-MM-DD')
const dayStart = () => dayjs().startOf('day').toDate()

type TreeState = { drops: number, stage: number, watered: number, date: string, checkinClaimed: boolean, quizClaimed: number }
type WheelState = { freeDate: string, freeUsed: number, paidDate: string, paidUsed: number }
type Match3State = { maxLevel: number }

@Controller('app/games')
@Aud('app')
export class GameController {
  constructor(private prisma: PrismaService, private wf: WorkflowService) {}

  private async state<T>(customerId: number, game: string, init: T): Promise<T> {
    const row = await this.prisma.gameProgress.findUnique({ where: { customerId_game: { customerId, game } } })
    return ((row?.state as T) || init)
  }

  private async saveState(customerId: number, game: string, state: any) {
    await this.prisma.gameProgress.upsert({ where: { customerId_game: { customerId, game } }, create: { customerId, game, state }, update: { state } })
  }

  // ───────── 种健康树 ─────────

  @Get('tree')
  async tree(@CurrentUser() u: CustomerUser) {
    let s = await this.state<TreeState>(u.id, 'tree', { drops: 0, stage: 0, watered: 0, date: today(), checkinClaimed: false, quizClaimed: 0 })
    if (s.date !== today()) s = { ...s, date: today(), checkinClaimed: false, quizClaimed: 0 }
    const checkedToday = await this.prisma.checkin.count({ where: { customerId: u.id, date: today() } })
    const quizDone = await this.prisma.pointsLedger.count({ where: { customerId: u.id, reasonCode: 'quiz', createdAt: { gte: dayStart() } } })
    return {
      drops: s.drops, stage: s.stage, watered: s.watered,
      stageDrops: TREE_STAGE_DROPS, redeemPoints: TREE_REDEEM_POINTS,
      stageNames: ['种子', '发芽', '幼苗', '小树', '长成'],
      canClaim: { checkin: !!checkedToday && !s.checkinClaimed, quizCount: Math.max(0, Math.min(quizDone, 3) - s.quizClaimed) },
    }
  }

  /** 领水滴：当日打卡 +2 滴；答题每题 +1 滴，每日上限 3（按已答题数防重） */
  @Post('tree/claim')
  async treeClaim(@CurrentUser() u: CustomerUser, @Body() body: { source: 'checkin' | 'quiz' }) {
    let s = await this.state<TreeState>(u.id, 'tree', { drops: 0, stage: 0, watered: 0, date: today(), checkinClaimed: false, quizClaimed: 0 })
    if (s.date !== today()) s = { ...s, date: today(), checkinClaimed: false, quizClaimed: 0 }
    if (body.source === 'checkin') {
      if (s.checkinClaimed) throw Err.bad('今天的打卡水滴已经领过啦')
      const checked = await this.prisma.checkin.count({ where: { customerId: u.id, date: today() } })
      if (!checked) throw Err.bad('先去完成今天的打卡，再来领水滴')
      s.checkinClaimed = true
      s.drops += 2
    }
    else {
      const quizDone = await this.prisma.pointsLedger.count({ where: { customerId: u.id, reasonCode: 'quiz', createdAt: { gte: dayStart() } } })
      if (s.quizClaimed >= Math.min(quizDone, 3)) throw Err.bad(quizDone ? '今天的答题水滴已经领完啦' : '先去答今天的健康问答，再来领水滴')
      s.quizClaimed += 1
      s.drops += 1
    }
    await this.saveState(u.id, 'tree', s)
    await this.wf.event(u.id, 'game_play', { game: 'tree', action: 'claim', source: body.source })
    return { drops: s.drops }
  }

  /** 浇水：每 20 滴升一档（0-4），长成后需先兑换再重种 */
  @Post('tree/water')
  async treeWater(@CurrentUser() u: CustomerUser, @Body() body: { drops?: number }) {
    const n = Math.max(1, Math.min(Number(body.drops) || 1, 10))
    const s = await this.state<TreeState>(u.id, 'tree', { drops: 0, stage: 0, watered: 0, date: today(), checkinClaimed: false, quizClaimed: 0 })
    if (s.stage >= 4) throw Err.bad('健康树已经长成，先去兑换奖励吧')
    if (s.drops < n) throw Err.bad('水滴不够啦，去打卡答题攒水滴吧')
    s.drops -= n
    s.watered += n
    s.stage = Math.min(4, Math.floor(s.watered / TREE_STAGE_DROPS))
    await this.saveState(u.id, 'tree', s)
    await this.wf.event(u.id, 'game_play', { game: 'tree', action: 'water', drops: n })
    return { drops: s.drops, stage: s.stage, watered: s.watered }
  }

  /** 兑换：长成 +50 积分，重新种一棵（水滴余额与今日领取状态保留） */
  @Post('tree/redeem')
  async treeRedeem(@CurrentUser() u: CustomerUser) {
    const s = await this.state<TreeState>(u.id, 'tree', { drops: 0, stage: 0, watered: 0, date: today(), checkinClaimed: false, quizClaimed: 0 })
    if (s.stage < 4) throw Err.bad('健康树还没长成哦，继续浇水吧')
    await this.wf.addPoints(u.id, TREE_REDEEM_POINTS, 'game_tree', '健康树长成奖励')
    await this.saveState(u.id, 'tree', { drops: s.drops, stage: 0, watered: 0, date: s.date, checkinClaimed: s.checkinClaimed, quizClaimed: s.quizClaimed })
    await this.wf.event(u.id, 'game_play', { game: 'tree', action: 'redeem' })
    return { ok: true, points: TREE_REDEEM_POINTS, drops: s.drops }
  }

  // ───────── 积分转盘 ─────────

  private async wheelState(customerId: number): Promise<WheelState> {
    let s = await this.state<WheelState>(customerId, 'wheel', { freeDate: today(), freeUsed: 0, paidDate: today(), paidUsed: 0 })
    if (s.freeDate !== today()) s = { ...s, freeDate: today(), freeUsed: 0 }
    if (s.paidDate !== today()) s = { ...s, paidDate: today(), paidUsed: 0 }
    return s
  }

  @Get('wheel')
  async wheel(@CurrentUser() u: CustomerUser) {
    const s = await this.wheelState(u.id)
    return {
      prizes: WHEEL_PRIZES.map(p => ({ ...p, pct: p.weight })),
      freeLeft: Math.max(0, WHEEL_FREE_DAILY - s.freeUsed),
      paidLeft: Math.max(0, WHEEL_PAID_DAILY - s.paidUsed),
      paidCost: WHEEL_PAID_COST,
      balance: await this.wf.balance(u.id),
    }
  }

  /** 抽奖：每日免费 1 次；积分抽奖每次 20 分、每日 3 次。服务端加权随机，概率向客户端公示 */
  @Post('wheel/spin')
  async wheelSpin(@CurrentUser() u: CustomerUser, @Body() body: { usePoints?: boolean }) {
    const s = await this.wheelState(u.id)
    let mode: 'free' | 'paid'
    if (s.freeUsed < WHEEL_FREE_DAILY) mode = 'free'
    else if (body.usePoints && s.paidUsed < WHEEL_PAID_DAILY) {
      if (await this.wf.balance(u.id) < WHEEL_PAID_COST) throw Err.bad('积分不够啦，去打卡答题攒积分吧')
      mode = 'paid'
    }
    else throw Err.bad('今天的抽奖次数已用完，明天再来')
    if (mode === 'paid') await this.wf.addPoints(u.id, -WHEEL_PAID_COST, 'wheel_paid', '转盘抽奖消耗')
    await this.saveState(u.id, 'wheel', mode === 'free' ? { ...s, freeUsed: s.freeUsed + 1 } : { ...s, paidUsed: s.paidUsed + 1 })

    const total = WHEEL_PRIZES.reduce((sum, p) => sum + p.weight, 0)
    let r = Math.random() * total
    let idx = 0
    for (let i = 0; i < WHEEL_PRIZES.length; i++) {
      r -= WHEEL_PRIZES[i].weight
      if (r <= 0) { idx = i; break }
    }
    const prize = WHEEL_PRIZES[idx]
    if (prize.type === 'points') await this.wf.addPoints(u.id, (prize as any).value, 'wheel_win', `转盘中奖：${prize.label}`)
    else if (prize.type === 'lead') await this.awardLead(u.id, prize)

    await this.wf.event(u.id, 'game_play', { game: 'wheel', action: 'spin', prize: prize.label, mode })
    return {
      index: idx, prize: { ...prize, pct: prize.weight }, mode,
      freeLeft: mode === 'free' ? Math.max(0, WHEEL_FREE_DAILY - s.freeUsed - 1) : Math.max(0, WHEEL_FREE_DAILY - s.freeUsed),
      paidLeft: mode === 'paid' ? Math.max(0, WHEEL_PAID_DAILY - s.paidUsed - 1) : Math.max(0, WHEEL_PAID_DAILY - s.paidUsed),
    }
  }

  /** 实物类奖品（讲座名额 / 门店小样）：走线索 + 通知顾问跟进 */
  private async awardLead(customerId: number, prize: { label: string }) {
    const c = await this.prisma.customer.findUnique({ where: { id: customerId } })
    await this.prisma.lead.create({ data: { leadNo: genNo('LD'), customerId, moduleCode: 'game_wheel', moduleName: '积分转盘奖品', type: 'other', formData: { prize: prize.label }, assigneeId: c?.advisorId, slaDueAt: addHours(48) } })
    await this.wf.notifyStaff({ staffIds: [c?.advisorId], roles: ['ops'] }, '转盘奖品待跟进', `${c?.salutation || '客户'}抽中「${prize.label}」，请安排发放`, 'normal', '/marketing/leads')
  }

  // ───────── 消消乐 ─────────

  private async match3EarnedToday(customerId: number) {
    const r = await this.prisma.pointsLedger.aggregate({ _sum: { change: true }, where: { customerId, reasonCode: 'match3', createdAt: { gte: dayStart() } } })
    return r._sum.change || 0
  }

  @Get('match3/levels')
  async match3(@CurrentUser() u: CustomerUser) {
    const s = await this.state<Match3State>(u.id, 'match3', { maxLevel: 0 })
    return { levels: MATCH3_LEVELS, maxLevel: s.maxLevel, dailyCap: MATCH3_DAILY_CAP, pointsLeftToday: Math.max(0, MATCH3_DAILY_CAP - await this.match3EarnedToday(u.id)) }
  }

  /** 通关：校验关卡顺序与单步均分合理性；积分当日封顶 15 分（每次通关 +5，上限内发完为止） */
  @Post('match3/complete')
  async match3Complete(@CurrentUser() u: CustomerUser, @Body() body: { level: number, moves: number, score?: number, seconds?: number }) {
    const s = await this.state<Match3State>(u.id, 'match3', { maxLevel: 0 })
    const lv = Number(body.level)
    const cfg = MATCH3_LEVELS.find(l => l.level === lv)
    if (!cfg) throw Err.bad('关卡不存在')
    if (lv > s.maxLevel + 1) throw Err.bad('请先通过前面的关卡')
    const moves = Number(body.moves) || 0
    const score = Number(body.score) || 0
    // 评审修复：不再按下界步数校验（连锁消除下正常玩家步数普遍更少，会误伤）；
    // 改为宽松的"单步均分"上限——每步超过 200 分（单步连锁消 20 块以上）才视为异常。
    // 防刷兜底仍是每日 15 分封顶。
    if (moves < 1 || score < cfg.targetScore || score > moves * 200) throw Err.bad('本局数据异常，请正常游玩')
    let points = 0
    const earned = await this.match3EarnedToday(u.id)
    if (earned < MATCH3_DAILY_CAP) {
      points = Math.min(5, MATCH3_DAILY_CAP - earned)
      await this.wf.addPoints(u.id, points, 'match3', `消消乐第 ${lv} 关`)
    }
    const maxLevel = Math.max(s.maxLevel, lv)
    if (maxLevel !== s.maxLevel) await this.saveState(u.id, 'match3', { maxLevel })
    await this.wf.event(u.id, 'game_play', { game: 'match3', action: 'complete', level: lv, moves: body.moves, score: body.score, seconds: body.seconds, points })
    return { points, maxLevel, capped: points === 0 }
  }
}
