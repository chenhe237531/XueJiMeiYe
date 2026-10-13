/**
 * 增量同步配置数据（不删除客户、测评、方案等业务数据）
 * 用于已上线的演示环境：门店资料、项目、规则、方案包、生活建议、题库选项、模块、首页布局、设备台账
 * 运行：npx ts-node --transpile-only prisma/sync-config.ts
 * 注意：会覆盖管理端对上述配置的手工修改
 */
import { PrismaClient } from '@prisma/client'
import { mapIntake } from '../src/engine/intake'
import { QUESTIONS } from '../src/engine/question-bank'
import { CONTRAINDICATIONS, LIFESTYLE_TIPS, PACKAGES, PROJECTS, RED_FLAGS, RISK_SIGNALS } from '../src/engine/rules-data'
import { LAYOUTS, MODULES } from './seed-config'

const prisma = new PrismaClient()
const log = (...a: any[]) => console.log('[sync]', ...a)
const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b)

async function main() {
  // 门店资料（来源：美团门店页）
  const store = await prisma.store.update({ where: { code: 'WYH' }, data: {
    district: '北京路商业区', address: '北京路五月花商场九楼 902A / 902B 铺', mall: '五月花商业广场（中山五路店）', openHours: '10:00-22:00', category: '综合美容 SPA',
    facilities: ['高清电视', '充电宝', '沙发位', 'VIP 包房'], promises: ['无推销办卡', '无隐形消费', '不满意重做', '保证正品', '一对一服务', '一次性用品'], rating: 4.8, reviewCount: 191,
  } })
  log('store', store.name)

  for (const p of PROJECTS) {
    const data: any = { status: 'active', defaultFreq: '每周 1 次', ...p }
    await prisma.project.upsert({ where: { code: p.code }, update: data, create: data })
  }
  log('projects', PROJECTS.length)

  for (const p of PACKAGES) {
    const data: any = { code: p.code, name: p.name, target: p.target, trigger: p.trigger as any, triggerText: p.triggerText, priority: p.priority, items: p.items, medicalLinks: p.medicalLinks, weeks: p.weeks }
    await prisma.planPackage.upsert({ where: { code: p.code }, update: data, create: data })
  }
  log('packages', PACKAGES.length)

  const rules: any[] = [
    ...RED_FLAGS.map(r => ({ code: r.code, kind: 'red_flag', level: r.level, source: r.source, conditionText: r.conditionText, condition: r.condition as any, action: { services: r.services, tags: r.tags || [], hotline: !!(r as any).hotline }, customerText: r.customerText, staffAction: r.staffAction })),
    ...RISK_SIGNALS.map(r => ({ code: r.code, kind: 'risk_signal', level: 'L1', conditionText: r.conditionText, condition: r.condition as any, action: { services: r.services, tags: r.tags || [], tagsIf: (r as any).tagsIf || [], reason: r.reason, factKeys: (r as any).factKeys || [], interest: !!(r as any).interest } })),
    ...CONTRAINDICATIONS.map(r => ({ code: r.code, kind: 'contraindication', conditionText: `${r.tags.join(' / ')} × ${r.attributes.join(' / ')}`, action: { tags: r.tags, attributes: r.attributes, effect: r.effect, text: r.text }, customerText: r.text })),
  ]
  for (const r of rules) await prisma.rule.upsert({ where: { code: r.code }, update: r, create: r })
  log('rules', rules.length)

  for (const t of LIFESTYLE_TIPS) await prisma.lifestyleTip.upsert({ where: { code: t.code }, update: t as any, create: t as any })
  log('lifestyle', LIFESTYLE_TIPS.length)

  // 已发布题库：按题目编码同步选项与分支（不新增 / 删除题目，避免影响进行中的测评）
  const tpl = await prisma.assessmentTemplate.findFirst({ where: { status: 'published' }, orderBy: { id: 'desc' } })
  let qn = 0
  if (tpl) {
    for (const q of QUESTIONS) {
      const r = await prisma.assessmentQuestion.updateMany({ where: { templateId: tpl.id, code: q.code }, data: { title: q.title, voiceText: q.voiceText, intro: q.intro, options: (q.options as any) ?? undefined, config: (q.config as any) ?? undefined, showIf: q.showIf ?? undefined } })
      qn += r.count
    }
  }
  log('questions', qn)

  // 模块：只新增缺失的，已有模块保留管理端配置；cover 为空时补 seed 占位图（issue #16，不覆盖已配置的实拍图）
  const partners = await prisma.partner.findMany({ orderBy: { id: 'asc' } })
  for (const m of MODULES) {
    const exists = await prisma.module.findUnique({ where: { code: m.code } })
    if (exists) {
      if (!exists.cover && m.cover) {
        await prisma.module.update({ where: { code: m.code }, data: { cover: m.cover } })
        log('module cover +', m.code)
      }
      continue
    }
    await prisma.module.create({ data: {
      code: m.code, name: m.name, category: m.category, entryType: m.entryType, icon: m.icon, cover: m.cover || null, summary: m.summary, visibleTiers: m.tiers, sort: m.sort, version: m.version || 'V1.0',
      detail: m.detail || {}, entryConfig: m.entryConfig || undefined, healthRules: m.healthRules || [], leadConfig: m.lead ? { ...m.lead, assign: 'advisor' } : undefined,
      partnerId: m.partner !== undefined ? partners[m.partner]?.id : undefined, elderOk: true, complianceStatus: 'approved', status: 'online',
    } })
    log('module +', m.code)
  }

  // 首页布局：内容有变化时发布新版本，旧版本归档（可在管理端回滚）
  for (const l of LAYOUTS) {
    const cur = await prisma.homeLayout.findFirst({ where: { tier: l.tier, elderMode: l.elderMode, status: 'published' }, orderBy: { version: 'desc' } })
    if (cur && same(cur.components, l.components)) continue
    const last = await prisma.homeLayout.findFirst({ where: { tier: l.tier, elderMode: l.elderMode }, orderBy: { version: 'desc' } })
    if (cur) await prisma.homeLayout.update({ where: { id: cur.id }, data: { status: 'archived' } })
    await prisma.homeLayout.create({ data: { ...l, version: (last?.version || 0) + 1, status: 'published', publishedAt: new Date(), publishedBy: '系统同步' } })
    log('layout', l.tier, l.elderMode ? 'elder' : 'standard', 'v' + ((last?.version || 0) + 1))
  }

  // 已有方案：按项目编码刷新门店项目的名称、团购价与"筹备中"标记（方案内容和状态不变）
  const projMap = new Map((await prisma.project.findMany()).map(p => [p.code, p]))
  const patchItems = (items: any[] | undefined, elder: boolean) => (items || []).map((s: any) => {
    const p = projMap.get(s.project)
    if (!p) return s
    const planned = p.status === 'planned'
    const next: any = { ...s, name: p.name, planned, groupPrice: p.groupPrice ?? null }
    if ('flags' in s) next.priceRef = p.priceRef ?? null
    if (typeof s.why === 'string' && planned && !s.why.includes('筹备中')) next.why = `${s.why}${elder ? '（门店筹备中，顾问会告诉您时间）' : '（门店筹备中，开放后顾问会通知您）'}`
    return next
  })
  let pn = 0
  for (const plan of await prisma.plan.findMany({ where: { status: { not: 'void' } } })) {
    const sk: any = plan.skeleton
    const cc: any = plan.contentCustomer
    if (!sk?.storeItems?.length || sk.storeItems.every((s: any) => 'planned' in s)) continue
    const elder = !!sk.customer?.elderMode
    await prisma.plan.update({ where: { id: plan.id }, data: {
      skeleton: { ...sk, storeItems: patchItems(sk.storeItems, elder) },
      contentCustomer: cc?.storeItems ? { ...cc, storeItems: patchItems(cc.storeItems, elder) } : cc ?? undefined,
    } })
    pn++
  }
  log('plans refreshed', pn)

  // 鹰眼设备：保持待审核，写入合规意见
  const eagle = {
    storeId: store.id, name: '德国鹰眼（全身健康评估系统）', model: '[待核实]', manufacturer: '[待核实]', isMedicalDevice: false,
    approvedUse: '[待核实] 报告自述：本设备系统不是医疗器械，不作为医疗诊断证明和处方使用，属于移动健康电子软件产品，用于健康管理健康评估筛查',
    principle: '[待核实检测原理]',
    reviewNote: '暂不准入（4.10）：报告包含脏器疾病风险、器官功能、药物禁忌与草药治疗等内容，超出生活美容范围；数据不进入客户端、不参与方案引擎与就医推荐。美团团购标题"全身 558 项健康评估"与报告措辞需法务审核（附录 I 禁用"全身扫描""器官功能检测"）。',
  }
  const dev = await prisma.device.findFirst({ where: { name: { contains: '鹰眼' } } })
  if (dev) await prisma.device.update({ where: { id: dev.id }, data: dev.admissionStatus === 'approved' ? { reviewNote: eagle.reviewNote } : { ...eagle, admissionStatus: 'pending' } })
  else await prisma.device.create({ data: { ...eagle, admissionStatus: 'pending' } })
  log('device 鹰眼')

  // 演示客户王阿姨的门店健康档案表示例（虚构数据；已有则跳过）
  const wang = await prisma.customer.findFirst({ where: { phone: '13800000001' } })
  if (wang && !(await prisma.healthIntake.count({ where: { customerId: wang.id } }))) {
    const data = { height: 155, weight: 53, births: '2 胎及以上', bp: '偏高', bpValue: '138/86', lipid: '不清楚', glucose: '正常', allergy: ['无'], skin: ['干燥', '色斑'], hair: ['白发多'], nails: ['正常'], eyes: ['干涩'], stoolDaily: '能', stoolSticky: '否', constipation: '偶尔', dryMouth: '是', urineYellow: '否', urineOdor: '否', urineFoam: '否', urineCloudy: '否', thyroid: '正常', leucorrhea: '不便填写', fibroid: '否', hyperplasia: '是', menstruation: ['已绝经'], sleep: ['易醒', '早醒'], discomfort: '腰背酸，久坐后明显', surgery: '无', chronic: ['高血压'], chronicNote: '服用降压药，自述控制尚可' }
    const { tags } = mapIntake(data)
    const at = new Date('2026-06-14T10:00:00+08:00')
    const intake = await prisma.healthIntake.create({ data: { customerId: wang.id, data, tags, staffName: '阿敏', consultant: '阿敏', consentChannel: 'self', createdAt: at } })
    for (const t of tags) {
      if (!(await prisma.healthTag.findFirst({ where: { customerId: wang.id, tagCode: t, status: 'active' } }))) await prisma.healthTag.create({ data: { customerId: wang.id, tagCode: t, source: 'staff', sourceRefId: intake.id, createdAt: at } })
    }
    await prisma.record.create({ data: { customerId: wang.id, recordType: 'service', sourceLabel: 'SELF', title: '门店健康档案表', summary: `本人自述，阿敏协助填写；生成 ${tags.length} 个健康标签`, refTable: 'health_intake', refId: intake.id, storeId: store.id, occurredAt: at } })
    log('intake 王阿姨', tags.length, 'tags')
  }
  log('done')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
