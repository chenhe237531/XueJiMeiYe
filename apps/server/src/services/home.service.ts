import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { fmt, greetingWord, TIER_NAMES } from '../common/util'
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
