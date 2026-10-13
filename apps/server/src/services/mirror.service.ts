import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { Err } from '../common/response'
import { fmt } from '../common/util'
import { AiService } from './ai.service'
import { WorkflowService } from './workflow.service'

/** 10.7 关键词规则（完整词表由健康顾问维护） */
const KW: { cat: string, words: string[] }[] = [
  { cat: 'A', words: ['不想活', '活着没意思', '想死', '了结', '跳楼', '吃安眠药', '自杀', '轻生'] },
  { cat: 'B', words: ['胸口痛', '胸痛', '喘不上气', '半边没力', '嘴歪', '说话说不清', '流很多血', '晕倒'] },
  { cat: 'C', words: ['转账', '验证码', '保健品很贵', '他们说能治好', '包治', '银行卡密码'] },
  { cat: 'D', words: ['好孤单', '没人陪', '心里难受', '睡不着觉', '没意思', '很难过'] },
]
const LEVEL_OF: Record<string, string> = { A: 'high', B: 'high', C: 'watch', D: 'watch', E: 'none' }

const P5 = `你是风险分类器。结合最近 3 轮对话，判断客户最后一句话是否包含以下风险：
A 自伤或轻生念头
B 急症信号（胸痛、呼吸困难、一侧肢体无力、口角歪斜、言语不清、大量出血、晕倒）
C 可能被骗或财产风险（被要求转账、提供验证码、购买高价保健品或"包治"的产品）
D 持续低落或孤独（非急性）
E 无

只输出 JSON：{"category":"A|B|C|D|E","level":"high|watch|none","evidence":"触发判断的原话片段，不超过 30 字"}
A、B 为 high；C、D 为 watch；E 为 none。`

const P4 = `你是「{{persona_name}}」，雪姬美业的 AI 陪伴助手，住在客户手机里的"魔镜"。

你是谁：
- 你是 AI，不是真人。被问到时如实说明；不假装有身体，不假装见过客户。
- 你的性格：温柔、耐心、真诚。会发现对方的好并真诚地夸奖，不浮夸。

你可以做：
- 陪客户聊天：家常、回忆、兴趣爱好、天气节气、新闻趣事、讲故事。
- 帮客户记录回忆录：引导她讲自己的故事，一次只问一个问题。
- 读客户的报告和方案（系统会提供内容），用简单的话讲给她听。
- 提醒她今天的待办（系统会提供）。
- 鼓励她按方案和医生的建议去做。

你不能做：
- 不提供任何诊断、用药、治疗建议。遇到健康问题，就说："这个要问医生才稳妥，我帮您告诉顾问，好吗？"
- 不推荐、不介绍、不评价任何商品、项目、价格、优惠，不引导消费。客户问起时，就说："这个您可以问问您的顾问。"
- 不谈论政治、宗教，不提供投资理财建议。
- 不打听身份证、银行卡、密码、验证码、住址；客户主动说出这些时，提醒她不要在聊天里说。
- 不对客户的家人做负面评价。
- 如果客户说想伤害自己，或者身体突然很不舒服（胸痛、喘不上气、一侧手脚没力、说话不清），立刻说："这很重要，请马上拨打 120，我也会马上通知您的顾问。"涉及情绪时，同时提供 12356 心理援助热线。

说话方式：
- 每次回复不超过 80 个字，口语化，一次只问一个问题。
- {{language_instruction}}
- 称呼客户为「{{salutation}}」。

客户同意你记住的事：
{{memories}}

今天的待办：
{{todos}}

客户最近的报告与方案（读报告时使用）：
{{report}}`

/** 魔镜（5.3 P-03、9.8、10.6、10.7） */
@Injectable()
export class MirrorService {
  constructor(private prisma: PrismaService, private ai: AiService, private wf: WorkflowService) {}

  async persona() {
    return this.prisma.mirrorPersona.findFirst()
  }

  async start(customerId: number) {
    const persona = await this.persona()
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })
    const session = await this.prisma.mirrorSession.create({ data: { customerId, lang: customer?.lang || 'zh' } })
    const c9 = !!(await this.wf.hasConsent(customerId, 'C9'))
    const askedC9 = (await this.prisma.consentRecord.count({ where: { customerId, type: 'C9' } })) > 0
    const recent = await this.prisma.mirrorMessage.findMany({ where: { customerId }, orderBy: { id: 'desc' }, take: 20 })
    await this.wf.event(customerId, 'mirror_session_start', {})
    return {
      sessionId: session.id,
      persona: { name: persona?.name || '小镜', opening: (persona?.opening || '').replace('{{salutation}}', customer?.salutation || '您'), quickTopics: persona?.quickTopics || [] },
      memoryConsent: c9,
      askMemoryConsent: !askedC9,
      history: recent.reverse().map(m => ({ role: m.role, content: m.content, at: fmt(m.createdAt, 'HH:mm') })),
      aiEnabled: await this.ai.available(),
    }
  }

  private keywordRisk(text: string) {
    for (const k of KW) {
      const w = k.words.find(x => text.includes(x))
      if (w) return { category: k.cat, level: LEVEL_OF[k.cat], evidence: w }
    }
    return null
  }

  async send(customerId: number, sessionId: number, text: string, inputMethod = 'text') {
    if (!text?.trim()) throw Err.bad('说点什么吧')
    // 会话必须属于当前用户：换账号后旧页面可能还拿着上一位用户的会话 id
    const owned = await this.prisma.mirrorSession.findFirst({ where: { id: sessionId, customerId } })
    if (!owned) throw Err.notFound('会话已失效，请重新进入魔镜')
    const persona = await this.persona()
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const todayTurns = await this.prisma.mirrorMessage.count({ where: { customerId, role: 'user', createdAt: { gte: startOfDay } } })
    if (todayTurns >= (persona?.dailyLimit || 100)) {
      return { reply: '今天我们聊了很多啦，明天再来找我好吗？早点休息。', risk: null, limited: true }
    }
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })
    const history = await this.prisma.mirrorMessage.findMany({ where: { sessionId }, orderBy: { id: 'desc' }, take: 20 })
    const recent = history.reverse()

    // 1. 关键词规则 + 2. 模型分类，任一判定高风险即按高风险处理
    let risk: any = this.keywordRisk(text)
    if (!risk || risk.level !== 'high') {
      const ctx = recent.slice(-6).map(m => `${m.role === 'user' ? '客户' : '小镜'}：${m.content}`).join('\n')
      const cls: any = await this.ai.chatJson([{ role: 'system', content: P5 }, { role: 'user', content: `${ctx}\n客户：${text}` }], { scene: 'risk', timeoutMs: 8000, maxTokens: 120 })
      if (cls?.level && cls.level !== 'none' && (!risk || cls.level === 'high')) risk = cls
    }

    await this.prisma.mirrorMessage.create({ data: { sessionId, customerId, role: 'user', content: text, inputMethod, riskCategory: risk?.category } })
    await this.prisma.mirrorSession.update({ where: { id: sessionId }, data: { turns: { increment: 1 } } })
    await this.wf.event(customerId, 'mirror_message', { inputMethod })

    let reply = ''
    let safetyCard: any = null
    if (risk?.level === 'high') {
      // 不调用人设模型，回复固定安全话术
      reply = risk.category === 'A'
        ? `${customer?.salutation}，您的感受很重要。请拨打 12356 心理援助热线，紧急情况拨打 120。我也会马上通知您的顾问。`
        : '这很重要，请马上拨打 120，我也会马上通知您的顾问。'
      safetyCard = { hotline: risk.category === 'A', items: [{ label: '拨打 120', phone: '120' }, ...(risk.category === 'A' ? [{ label: '12356 心理援助热线', phone: '12356' }] : []), { label: '联系我的顾问', action: 'advisor' }] }
      await this.wf.createAlert({ customerId, source: 'mirror', sourceRefId: sessionId, level: 'high', ruleCodes: [`MIRROR_${risk.category}`], title: risk.category === 'A' ? '魔镜对话出现自伤相关表达' : '魔镜对话出现急症信号', excerpt: risk.evidence || text.slice(0, 30) })
      await this.wf.event(customerId, 'mirror_risk_alert', { category: risk.category })
    }
    else {
      if (risk?.level === 'watch') {
        await this.wf.createAlert({ customerId, source: 'mirror', sourceRefId: sessionId, level: 'watch', ruleCodes: [`MIRROR_${risk.category}_${new Date().toISOString().slice(0, 10)}`], title: risk.category === 'C' ? '魔镜对话提示可能被骗，请联系客户及家人' : '魔镜对话出现情绪低落或孤独表达', excerpt: risk.evidence || text.slice(0, 30) })
      }
      // 记忆：客户主动说"记下 / 记住"时直接记录（需 C9）
      const memMatch = text.match(/^(?:我想)?(?:帮我)?(?:记下|记住)(?:一件事)?[：:，,\s]*(.{2,60})$/)
      if (memMatch && (await this.wf.hasConsent(customerId, 'C9'))) {
        await this.prisma.mirrorMemory.create({ data: { customerId, category: '近期大事', text: memMatch[1].slice(0, 30) } })
      }
      reply = (await this.aiReply(customer, persona, recent, text)) || (await this.fallbackReply(customer, text))
    }
    await this.prisma.mirrorMessage.create({ data: { sessionId, customerId, role: 'assistant', content: reply } })

    const session = await this.prisma.mirrorSession.findUnique({ where: { id: sessionId } })
    const minutes = (Date.now() - session!.startedAt.getTime()) / 60000
    return { reply, risk: risk ? { level: risk.level, category: risk.category } : null, safetyCard, restHint: minutes > 30 ? '聊了好一会儿了，起来走走、喝口水吧' : null }
  }

  private async context(customer: any) {
    const memories = (await this.wf.hasConsent(customer.id, 'C9'))
      ? (await this.prisma.mirrorMemory.findMany({ where: { customerId: customer.id, status: 'active' }, take: 20 })).map(m => `- ${m.category}：${m.text}`).join('\n')
      : '（客户未开启记忆）'
    const todos: string[] = []
    const coupon = await this.prisma.coupon.findFirst({ where: { customerId: customer.id, status: { in: ['issued', 'claimed'] } } })
    if (coupon) todos.push(coupon.status === 'issued' ? '体检券待到店领取' : '体检券可以预约了')
    const plan = await this.prisma.plan.findFirst({ where: { customerId: customer.id, status: 'sent' }, orderBy: { id: 'desc' } })
    const pc: any = plan?.contentCustomer
    if (pc?.storeItems?.length) todos.push(`按方案安排：${pc.storeItems.map((s: any) => `${s.name}${s.freq}`).join('；')}`)
    const last = await this.prisma.assessment.findFirst({ where: { customerId: customer.id, status: 'completed' }, orderBy: { id: 'desc' } })
    const report = [
      last ? `最近一次六维测评（${fmt(last.completedAt, 'M月D日')}）：六维年轻化指数 ${last.indexScore}` : '还没有完成六维测评',
      pc ? `当前方案「${pc.title}」：${pc.summary}；${(pc.lifestyle || []).join('；')}` : '',
    ].filter(Boolean).join('\n')
    return { memories, todos: todos.join('\n') || '今天没有特别的待办', report, last, pc }
  }

  private async aiReply(customer: any, persona: any, recent: any[], text: string) {
    if (!(await this.ai.available())) return null
    const ctx = await this.context(customer)
    const sys = P4.replace('{{persona_name}}', persona?.name || '小镜')
      .replace('{{language_instruction}}', customer.lang === 'yue' ? '用自然的粤语口语回复' : '用自然的普通话口语回复')
      .replace('{{salutation}}', customer.salutation || '您')
      .replace('{{memories}}', ctx.memories).replace('{{todos}}', ctx.todos).replace('{{report}}', ctx.report)
    const msgs: any[] = [{ role: 'system', content: sys }]
    recent.slice(-20).forEach(m => msgs.push({ role: m.role, content: m.content }))
    msgs.push({ role: 'user', content: text })
    const out = await this.ai.chat(msgs, { scene: 'mirror', timeoutMs: 15000, maxTokens: 200, temperature: 0.8 })
    return out?.trim() || null
  }

  /** 模板兜底：AI 不可用时，魔镜仍能完成读报告、待办、陪聊等基础对话 */
  private async fallbackReply(customer: any, text: string) {
    const name = customer.salutation || '您'
    const ctx = await this.context(customer)
    if (/报告|测评|结果/.test(text)) {
      if (!ctx.last) return `${name}，您还没做六维测评呢。测完我就能给您读报告啦，要不要试试？`
      return `${name}，您最近一次测评的六维指数是 ${ctx.last.indexScore} 分。${ctx.pc ? `顾问给您安排了「${ctx.pc.title}」，${ctx.pc.summary}` : '顾问会联系您确认方案。'}`
    }
    if (/今天|待办|要做什么/.test(text)) return `${name}，今天的事：${ctx.todos}。慢慢来，不着急。`
    if (/故事/.test(text)) return '从前有位老奶奶，每天早上都给院子里的花浇水。邻居问她累不累，她笑着说：花开了，我的心也就开了。您喜欢养花吗？'
    if (/记下|记住|回忆/.test(text)) return `好的，${name}，您慢慢说，我听着呢。这件事是什么时候发生的呀？`
    if (/药|病|疼|痛|医生|血压|吃什么/.test(text)) return '这个要问医生才稳妥，我帮您告诉顾问，好吗？'
    if (/多少钱|价格|买|优惠|项目|卡/.test(text)) return '这个您可以问问您的顾问，她会给您说清楚的。'
    if (/你是谁|真人|机器人|AI/i.test(text)) return `我是 AI 助手小镜，不是真人哦。我可以陪您聊天、帮您读报告，${name}今天想聊点什么？`
    if (/孙|女儿|儿子|家人|老伴/.test(text)) return `一家人在一起真好。${name}，他们最近都忙些什么呀？`
    const pool = [
      `${name}，听您这么说我很开心。今天天气怎么样，有出去走走吗？`,
      `原来是这样呀。${name}，您平时最喜欢做什么呢？`,
      `谢谢您跟我分享，${name}。最近睡得好吗？`,
      `${name}说得真好。要不要我给您讲个小故事？`,
    ]
    return pool[Math.floor(Math.random() * pool.length)]
  }

  async memories(customerId: number) {
    return (await this.prisma.mirrorMemory.findMany({ where: { customerId, status: 'active' }, orderBy: { id: 'desc' } }))
      .map(m => ({ id: m.id, category: m.category, text: m.text, at: fmt(m.createdAt, 'YYYY-MM-DD') }))
  }
}
