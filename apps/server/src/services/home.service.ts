import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { PrismaService } from '../common/prisma.service'
import { fmt, greetingWord, today, TIER_NAMES } from '../common/util'
import { DIM_NAMES } from '../engine'
import { WorkflowService } from './workflow.service'

/** 内置模块对应的小程序页面 */
export const BUILTIN_LINKS: Record<string, string> = {
  assessment: '/pkg-assess/intro',
  checkup_coupon: '/pkg-checkup/coupons',
  my_plan: '/pkg-plan/detail',
  mirror: '/pages/mirror/index',
  family: '/pkg-family/list',
  passbook: '/pkg-points/passbook',
  checkin: '/pkg-points/checkin',
  daily_quiz: '/pkg-game/quiz',
  memory_cards: '/pkg-game/cards',
  buddy_group: '/pkg-group/detail',
  vip_advisor: '/pkg-me/advisor',
  vip_overseas: '/pkg-module/vip',
  vip_transport: '/pkg-module/transport',
  annual_report: '/pages/archive/index',
  store_services: '/pkg-module/store',
  game_tree: '/pkg-game/tree',
  game_wheel: '/pkg-game/wheel',
  game_match3: '/pkg-game/match3',
}

/** 会员权益（issue #4 图标化）：icon 为 tabler 图标名 */
export const TIER_BENEFITS: Record<string, { icon: string, text: string }[]> = {
  A: [
    { icon: 'headset', text: '专属顾问 4 小时内响应' },
    { icon: 'plane', text: '海外 VIP 通道' },
    { icon: 'car', text: '接送车' },
    { icon: 'heart-rate-monitor', text: '高端体检与优先号源' },
    { icon: 'gift', text: '私享活动与礼盒' },
    { icon: 'report-medical', text: '年度个人健康报告' },
  ],
  B: [
    { icon: 'clipboard-heart', text: '方案包与医生讲座名额' },
    { icon: 'mountain', text: '康养文旅精选' },
    { icon: 'beach', text: '清远温泉精品小团' },
    { icon: 'leaf', text: '有机商城' },
    { icon: 'users-group', text: '结伴拼团' },
  ],
  C: [
    { icon: 'hexagon', text: '六维测评与免费基础体检' },
    { icon: 'notebook', text: '健康档案与魔镜陪伴' },
    { icon: 'beach', text: '清远温泉特惠结伴团' },
    { icon: 'leaf', text: '有机商城' },
    { icon: 'users-group', text: '结伴拼团与小游戏' },
  ],
}

/** 健康服务类模块统一养生绿，保持克制（issue #4 模块色彩识别） */
const CARE_CODES = ['assessment', 'checkup_coupon', 'my_plan', 'mirror', 'annual_report']
const CATEGORY_TONES: Record<string, string> = { travel: 'terra', mall: 'green', activity: 'rose', interactive: 'sky', benefit: 'plum', medical: 'care' }

/**
 * 今日 3 件事：六维短板对应的日常动作（XJ-305，D1）。
 * action 同时是「今日完成」判定键：water / exercise = 当日有对应类型打卡，mirror = 当天和小镜聊过。
 * 轮廓维度没有可日常执行的自然动作，不映射（短板轮到它时顺延下一弱维度）。
 */
const DIM_ACTIONS: Record<string, { action: 'water' | 'exercise' | 'mirror', icon: string, title: string, sub: string }> = {
  skin: { action: 'water', icon: 'skin', title: '今天喝够 6 杯水', sub: '补水是养肤第一步' },
  shape: { action: 'exercise', icon: 'body', title: '活动身体 20 分钟', sub: '体型管理贵在日常' },
  fitness: { action: 'exercise', icon: 'body', title: '出门走走 20 分钟', sub: '体能从每天一点点开始' },
  posture: { action: 'exercise', icon: 'body', title: '做一组颈肩拉伸', sub: '体态放松随时可做' },
  mind: { action: 'mirror', icon: 'mind', title: '和小镜聊聊今天', sub: '说出来，心里会轻一些' },
}

/** 4.3 模块可见性 */
export function moduleVisible(m: any, c: { tier: string, storeId?: number | null, elderMode: boolean }, nowT = Date.now()) {
  if (m.status !== 'online') return false
  if (m.complianceStatus !== 'approved') return false
  if (m.startAt && new Date(m.startAt).getTime() > nowT) return false
  if (m.endAt && new Date(m.endAt).getTime() < nowT) return false
  if (!((m.visibleTiers as string[]) || []).includes(c.tier)) return false
  const stores = (m.visibleStoreIds as number[]) || []
  if (stores.length && (!c.storeId || !stores.includes(c.storeId))) return false
  if (c.elderMode && !m.elderOk) return false
  return true
}

export function moduleLink(m: any) {
  if (m.entryType === 'builtin') return BUILTIN_LINKS[m.code] || `/pkg-module/detail?code=${m.code}`
  if (m.code === 'vip_overseas') return BUILTIN_LINKS.vip_overseas
  return `/pkg-module/detail?code=${m.code}`
}

export function moduleCard(m: any) {
  const d: any = m.detail || {}
  const tone = CARE_CODES.includes(m.code) ? 'care' : (CATEGORY_TONES[m.category] || '')
  return {
    code: m.code, name: m.name, icon: m.icon || 'circle', cover: m.cover || null, summary: m.summary,
    priceText: d.priceText || null, days: d.days || null, link: moduleLink(m), category: m.category, entryType: m.entryType, tone,
    /** issue #5：商城类模块下发跳转配置（appId/path/h5Url/tip），供首页一步直达；表单配置不下发 */
    entryConfig: m.entryType === 'miniprogram' ? m.entryConfig : undefined,
  }
}

@Injectable()
export class HomeService {
  constructor(private prisma: PrismaService, private wf: WorkflowService) {}

  async layoutFor(tier: string, elderMode: boolean) {
    return this.prisma.homeLayout.findFirst({ where: { tier, elderMode, status: 'published' }, orderBy: { version: 'desc' } })
  }

  async resolve(customerId: number | null, preview?: { tier: string, elderMode: boolean, components?: any[] }) {
    const customer = customerId ? await this.prisma.customer.findUnique({ where: { id: customerId } }) : null
    const tier = preview?.tier || customer?.tier || 'C'
    const elderMode = preview ? preview.elderMode : !!customer?.elderMode
    const layout = preview?.components ? { version: 0, components: preview.components } : await this.layoutFor(tier, elderMode)
    const modules = await this.prisma.module.findMany({ orderBy: { sort: 'asc' } })
    const ctx = { tier, storeId: customer?.storeId, elderMode }
    const visible = new Map(modules.filter(m => moduleVisible(m, ctx)).map(m => [m.code, m]))
    const pick = (codes: string[] = []) => codes.map(c => visible.get(c)).filter(Boolean).map(moduleCard)

    const out: any[] = []
    for (const comp of ((layout?.components as any[]) || [])) {
      const p = comp.props || {}
      switch (comp.type) {
        case 'greeting':
          out.push({ type: 'greeting', props: { text: `${greetingWord()}，${customer?.salutation || '欢迎您'}`, showElderToggle: p.showElderToggle !== false, tierName: TIER_NAMES[tier], tier, isGuest: !customer } })
          break
        case 'tierCard':
          out.push({ type: 'tierCard', props: { tier, tierName: TIER_NAMES[tier], benefits: TIER_BENEFITS[tier].slice(0, 3), keepUntil: customer?.tierKeepUntil ? fmt(customer.tierKeepUntil, 'YYYY-MM-DD') : null } })
          break
        case 'healthCard':
          out.push({ type: 'healthCard', props: await this.healthCard(customer, p.maxTodos || 3) })
          break
        /** XJ-305（D1）：今日 3 件事任务卡，任务由后端按六维短板 + 待办动态生成 */
        case 'taskList':
          out.push({ type: 'taskList', props: { title: p.title || '今日 3 件事', ...(await this.todayTasks(customer)) } })
          break
        /** issue #8：乐龄首页"今日健康"——问候 + 健康概览 + 家人入口，替代乐龄布局的 greeting + healthCard */
        case 'elderToday': {
          const health = await this.healthCard(customer, p.maxTodos || 2)
          out.push({ type: 'elderToday', props: { text: `${greetingWord()}，${customer?.salutation || '您好'}`, showElderToggle: p.showElderToggle !== false, tier, tierName: TIER_NAMES[tier], isGuest: !customer, health } })
          break
        }
        case 'entryGrid': {
          const max = elderMode ? 6 : 8
          const items = pick(p.modules).slice(0, max)
          if (items.length) out.push({ type: 'entryGrid', props: { columns: p.columns || (elderMode ? 3 : 4), items, featured: p.featured || (elderMode ? 'assessment' : null) } })
          break
        }
        case 'banner': {
          const items = pick(p.modules)
          if (items.length) out.push({ type: 'banner', props: { items, autoplay: !elderMode && p.autoplay !== false } })
          break
        }
        case 'moduleList': {
          let items = pick(p.modules)
          if (customer?.personalization && items.length > 1) items = await this.personalize(customer.id, items)
          if (items.length) out.push({ type: 'moduleList', props: { title: p.title, style: p.style || 'card', items } })
          break
        }
        case 'activityCard': {
          const items = pick([p.module])
          if (items.length) out.push({ type: 'activityCard', props: items[0] })
          break
        }
        case 'divider':
        case 'notice':
        case 'mirrorFab':
          out.push({ type: comp.type, props: p })
          break
        default:
          break
      }
    }
    // XJ-305（D1）：登录用户布局未显式配置任务卡时自动补「今日 3 件事」，插在健康卡 / 问候栏之后；访客不下发
    if (customer && !out.some(c => c.type === 'taskList')) {
      const comp = { type: 'taskList', props: { title: '今日 3 件事', ...(await this.todayTasks(customer)) } }
      const at = Math.max(out.findIndex(c => c.type === 'healthCard' || c.type === 'elderToday'), out.findIndex(c => c.type === 'greeting' || c.type === 'tierCard'))
      out.splice(at + 1, 0, comp)
    }
    // 分组标题后面没有内容时去掉
    const cleaned = out.filter((c, i) => c.type !== 'divider' || (out[i + 1] && !['divider', 'mirrorFab'].includes(out[i + 1].type)))
    return { tier, tierName: TIER_NAMES[tier], elderMode, layoutVersion: (layout as any)?.version ?? 0, components: cleaned }
  }

  /** 个性化排序（C7）：健康标签相关的模块靠前 */
  private async personalize(customerId: number, items: any[]) {
    const tags = await this.wf.activeTags(customerId)
    const boost = (code: string) => {
      if (tags.includes('lonely') && /trip|group|lecture/.test(code)) return -1
      if (tags.some(t => t.startsWith('dx_')) && /hainan/.test(code)) return 1
      return 0
    }
    return [...items].sort((x, y) => boost(x.code) - boost(y.code))
  }

  /**
   * 今日 3 件事（XJ-305，D1）：优先六维短板动作（弱 → 强，同一动作只出一项），
   * 其次待办（体检券 → 未完成测评 → 方案日常小事），不足时补打卡 / 小镜引导；
   * 今日已完成的动作剔除出清单、计入 doneToday 供前端做进度计数；访客返回空数组。
   * icon 为 D15 语义枚举（skin/body/mind/assess/checkup/plan/checkin），前端维护枚举 → 图形映射。
   */
  async todayTasks(customer: any) {
    if (!customer) return { tasks: [], doneToday: [] as string[] }
    const [last, inProgress, coupon, plan, checkins, mirrorTurns] = await Promise.all([
      this.prisma.assessment.findFirst({ where: { customerId: customer.id, status: 'completed' }, orderBy: { id: 'desc' } }),
      this.prisma.assessment.findFirst({ where: { customerId: customer.id, status: 'in_progress' } }),
      this.prisma.coupon.findFirst({ where: { customerId: customer.id, status: 'issued' }, orderBy: { id: 'desc' } }),
      this.prisma.plan.findFirst({ where: { customerId: customer.id, status: 'sent' }, orderBy: { id: 'desc' } }),
      this.prisma.checkin.findMany({ where: { customerId: customer.id, date: today() } }),
      this.prisma.mirrorMessage.count({ where: { customerId: customer.id, role: 'user', createdAt: { gte: dayjs().startOf('day').toDate() } } }),
    ])
    const doneTypes = new Set(checkins.map(c => c.type))
    const tasks: any[] = []
    const doneToday: string[] = []
    const seen = new Set<string>()

    // ① 六维短板（低于 60 分需关注的维度，弱 → 强；动作今日已完成的剔除并计入 doneToday）
    if (last) {
      const scores = (last.dimensionScores as any) || {}
      const weak = Object.keys(DIM_ACTIONS).filter(d => typeof scores[d] === 'number' && scores[d] < 60).sort((a, b) => scores[a] - scores[b])
      for (const dim of weak) {
        const def = DIM_ACTIONS[dim]
        if (seen.has(def.action)) continue
        seen.add(def.action)
        const done = def.action === 'mirror' ? mirrorTurns > 0 : doneTypes.has(def.action)
        if (done) {
          doneToday.push(`dim_${dim}`)
          continue
        }
        tasks.push({ code: `dim_${dim}`, icon: def.icon, title: def.title, sub: `${DIM_NAMES[dim]}维度 ${scores[dim]} 分 · ${def.sub}`, target: 60, current: scores[dim], link: def.action === 'mirror' ? BUILTIN_LINKS.mirror : BUILTIN_LINKS.checkin, points: def.action === 'mirror' ? null : 2 })
      }
    }

    // ② 待办（按 D1 括号顺序：体检券 → 测评 → 方案日常小事；无档案的新用户兜底「完成首次六维测评」）
    if (coupon) tasks.push({ code: 'checkup_coupon', icon: 'checkup', title: '领取免费体检券', sub: '到店出示券码即可', target: 1, current: 0, link: BUILTIN_LINKS.checkup_coupon, points: null })
    if (!last && !inProgress) tasks.push({ code: 'assess_first', icon: 'assess', title: '完成首次六维测评', sub: '约 8 分钟，先建立健康基线', target: 1, current: 0, link: BUILTIN_LINKS.assessment, points: null })
    if (inProgress) tasks.push({ code: 'assess_continue', icon: 'assess', title: '继续完成六维测评', sub: '上次答到一半，已自动保存', target: 1, current: 0, link: '/pkg-assess/map', points: null })
    const lifestyle = ((plan?.contentCustomer as any)?.lifestyle as string[]) || []
    if (lifestyle.length) {
      const done = ((((checkins.find(c => c.type === 'plan')?.data as any)?.done) as string[]) || []).filter(l => lifestyle.includes(l)).length
      if (done >= lifestyle.length) doneToday.push('plan_daily')
      else tasks.push({ code: 'plan_daily', icon: 'plan', title: '完成方案里的日常小事', sub: `今天 ${done}/${lifestyle.length} 项 · 做到了就点一下`, target: lifestyle.length, current: done, link: BUILTIN_LINKS.my_plan, points: 2 })
    }

    // ③ 补位（仍与当日状态相关：当日无任何打卡 / 还没和小镜聊过才出现）
    if (!checkins.length) tasks.push({ code: 'checkin_today', icon: 'checkin', title: '做一次今日打卡', sub: '睡眠 / 运动 / 喝水，任选一项', target: 1, current: 0, link: BUILTIN_LINKS.checkin, points: 2 })
    if (mirrorTurns === 0 && !seen.has('mirror')) tasks.push({ code: 'mirror_chat', icon: 'mind', title: '和小镜聊聊近况', sub: '健康疑问都可以问她', target: 1, current: 0, link: BUILTIN_LINKS.mirror, points: null })

    return { tasks: tasks.slice(0, 3), doneToday }
  }

  async healthCard(customer: any, maxTodos: number) {
    if (!customer) return { hasAssessment: false, todos: [], index: null, cta: '开始六维测评，约 8 分钟' }
    const last = await this.prisma.assessment.findFirst({ where: { customerId: customer.id, status: 'completed' }, orderBy: { id: 'desc' } })
    const prev = last ? await this.prisma.assessment.findFirst({ where: { customerId: customer.id, status: 'completed', id: { lt: last.id } }, orderBy: { id: 'desc' } }) : null
    const inProgress = await this.prisma.assessment.findFirst({ where: { customerId: customer.id, status: 'in_progress' } })
    const todos: any[] = []
    const alert = await this.prisma.riskAlert.findFirst({ where: { customerId: customer.id, status: { not: 'closed' }, level: { in: ['L3', 'L2'] } } })
    if (alert) todos.push({ kind: 'alert', icon: 'phone-call', text: '顾问会尽快联系您', sub: '门店项目先暂停，身体最要紧', link: '/pkg-plan/detail', tone: 'care' })
    if (inProgress) todos.push({ kind: 'assessment', icon: 'hexagon', text: '继续完成六维测评', sub: '上次答到一半，已自动保存', link: '/pkg-assess/map', tone: 'brand' })
    const coupon = await this.prisma.coupon.findFirst({ where: { customerId: customer.id, status: { in: ['issued', 'claimed', 'booked'] } }, orderBy: { id: 'desc' } })
    if (coupon?.status === 'issued') todos.push({ kind: 'checkup', icon: 'ticket', text: '体检券待到店领取', sub: '到店出示券码即可', link: '/pkg-checkup/coupons', tone: 'care' })
    if (coupon?.status === 'claimed') todos.push({ kind: 'checkup', icon: 'calendar-event', text: '体检券可以预约了', sub: '选个方便的日子', link: '/pkg-checkup/coupons', tone: 'care' })
    if (coupon?.status === 'booked') {
      const ref = await this.prisma.referral.findFirst({ where: { couponId: coupon.id }, orderBy: { id: 'desc' } })
      todos.push({ kind: 'checkup', icon: 'calendar-event', text: ref?.appointmentAt ? `体检 ${fmt(ref.appointmentAt, 'M月D日')}` : '体检已预约，等待医院确认', sub: '记得空腹', link: '/pkg-checkup/coupons', tone: 'care' })
    }
    const plan = await this.prisma.plan.findFirst({ where: { customerId: customer.id, status: 'sent' }, orderBy: { id: 'desc' } })
    if (plan) todos.push({ kind: 'plan', icon: 'clipboard-heart', text: '查看我的养护方案', sub: (plan.contentCustomer as any)?.title || '', link: '/pkg-plan/detail', tone: 'brand' })
    const dims = (last?.dimensionScores as any) || {}
    return {
      hasAssessment: !!last,
      index: last?.indexScore ?? null,
      delta: last && prev && last.indexScore !== null && prev.indexScore !== null ? (last.indexScore! - prev.indexScore!) : null,
      lastAssessedAt: last ? fmt(last.completedAt, 'M月D日') : null,
      dims,
      todos: todos.slice(0, maxTodos),
      cta: last ? null : '开始六维测评，约 8 分钟',
    }
  }
}
