/**
 * 演示数据种子：配置数据 + 通过真实业务服务（规则引擎、方案、体检券、转介、回传）生成的演示客户数据。
 * 运行：pnpm --filter xueji-server db:reset
 */
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import dayjs from 'dayjs'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/common/prisma.service'
import { genNo } from '../src/common/util'
import { ageOf, visibleQuestions } from '../src/engine'
import { chairStandRef, QUESTIONS, type QDef } from '../src/engine/question-bank'
import { CHECKUP_PACKAGES, CONTRAINDICATIONS, LIFESTYLE_TIPS, MEDICAL_SERVICES, PACKAGES, PROJECTS, RED_FLAGS, RISK_SIGNALS } from '../src/engine/rules-data'
import { ArchiveService } from '../src/services/archive.service'
import { AssessmentService } from '../src/services/assessment.service'
import { CheckupService } from '../src/services/checkup.service'
import { DemoSandboxService } from '../src/services/demo-sandbox.service'
import { EngineService } from '../src/services/engine.service'
import { MirrorService } from '../src/services/mirror.service'
import { PlanService } from '../src/services/plan.service'
import { TierService } from '../src/services/tier.service'
import { WorkflowService } from '../src/services/workflow.service'
import { CONSENT_TEXTS, LAYOUTS, MODULES, PERSONA, QUIZ, SCRIPTS } from './seed-config'

// 可复现的随机数
let _s = 20261012
const rand = () => { _s = (_s * 1103515245 + 12345) % 2147483648; return _s / 2147483648 }
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
const between = (a: number, b: number) => Math.round(a + rand() * (b - a))
const chance = (p: number) => rand() < p

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })
  const prisma = app.get(PrismaService)
  const wf = app.get(WorkflowService)
  const assess = app.get(AssessmentService)
  const plans = app.get(PlanService)
  const checkup = app.get(CheckupService)
  const archive = app.get(ArchiveService)
  const mirror = app.get(MirrorService)
  const tier = app.get(TierService)
  const engine = app.get(EngineService)
  const log = (...a: any[]) => console.log('[seed]', ...a)

  // ───────── 组织 ─────────
  const stores = [
    await prisma.store.create({ data: {
      code: 'WYH', name: '雪姬AI智能健康美容体验馆（五月花店）', district: '北京路商业区', address: '北京路五月花商场九楼 902A / 902B 铺', mall: '五月花商业广场（中山五路店）',
      phone: '[门店电话，待补充]', bedCount: 10, openHours: '10:00-22:00', idleSlots: '工作日 10:00-16:00', category: '综合美容 SPA',
      facilities: ['高清电视', '充电宝', '沙发位', 'VIP 包房'], promises: ['无推销办卡', '无隐形消费', '不满意重做', '保证正品', '一对一服务', '一次性用品'],
      rating: 4.8, reviewCount: 191,
    } }),
    await prisma.store.create({ data: { code: 'D02', name: '雪姬美业·演示二店', district: '[示例]', address: '[示例地址]', bedCount: 8 } }),
    await prisma.store.create({ data: { code: 'D03', name: '雪姬美业·演示三店', district: '[示例]', address: '[示例地址]', bedCount: 8 } }),
  ]
  const S = (data: any) => prisma.staff.create({ data: { password: '123456', ...data } })
  const admin = await S({ staffNo: 'HQ001', name: '系统管理员', username: 'admin', role: 'super_admin', dataScope: 'all' })
  const ops = await S({ staffNo: 'HQ002', name: '林运营', username: 'yunying', role: 'ops', dataScope: 'all' })
  const manager = await S({ staffNo: 'WYH01', name: '周店长', username: 'dianzhang', role: 'store_manager', storeId: stores[0].id, dataScope: 'store', phone: '13900000101' })
  const amin = await S({ staffNo: 'WYH02', name: '阿敏', username: 'guwen', role: 'advisor', storeId: stores[0].id, dataScope: 'self', phone: '13900000102' })
  const xiaoya = await S({ staffNo: 'WYH03', name: '小雅', username: 'guwen2', role: 'advisor', storeId: stores[0].id, dataScope: 'self', phone: '13900000103' })
  const health = await S({ staffNo: 'HQ003', name: '何健康顾问', username: 'jiankang', role: 'health_advisor', storeId: stores[0].id, dataScope: 'store', phone: '13900000104' })
  await S({ staffNo: 'HQ004', name: '黄财务', username: 'caiwu', role: 'finance', dataScope: 'all' })
  const adv2 = await S({ staffNo: 'D0201', name: '小慧', username: 'guwen3', role: 'advisor', storeId: stores[1].id, dataScope: 'self' })
  const adv3 = await S({ staffNo: 'D0301', name: '小琳', username: 'guwen4', role: 'advisor', storeId: stores[2].id, dataScope: 'self' })
  const advisorsByStore: Record<number, any[]> = { [stores[0].id]: [amin, xiaoya], [stores[1].id]: [adv2], [stores[2].id]: [adv3] }
  await prisma.qrcode.create({ data: { code: 'K7P2X9', purpose: 'staff', storeId: stores[0].id, staffId: amin.id } })
  await prisma.qrcode.create({ data: { code: 'WYH001', purpose: 'store', storeId: stores[0].id } })

  const hospital = await prisma.hospital.create({ data: { name: '合作医院·健康管理中心（演示）', level: '[医院等级]', licenseNo: '[医疗机构执业许可证号]', address: '[医院地址]', contact: { name: '刘协调员', phone: '[电话]' }, agreement: { from: '2026-10-01', to: '2027-09-30' } } })
  await prisma.hospitalUser.createMany({ data: [
    { hospitalId: hospital.id, name: '医院管理员', username: 'yyadmin', password: '123456', role: 'admin' },
    { hospitalId: hospital.id, name: '刘协调员', username: 'yiyuan', password: '123456', role: 'coordinator' },
    { hospitalId: hospital.id, name: '张医生', username: 'yisheng', password: '123456', role: 'doctor' },
  ] })
  const partnerRows = [
    { name: '清远温泉合作旅行社（演示）', type: 'travel_agency', region: '广东', licenses: [{ name: '旅行社业务经营许可证', no: '[许可证编号]', until: '2027-12-31' }] },
    { name: '茂名沉香文化馆（演示）', type: 'culture_venue', region: '广东', licenses: [{ name: '营业执照', no: '[统一社会信用代码]' }] },
    { name: '海南康养旅居（演示）', type: 'travel_agency', region: '海南', licenses: [{ name: '旅行社业务经营许可证', no: '[许可证编号]' }] },
    { name: '云南文化游旅行社（演示）', type: 'travel_agency', region: '云南', licenses: [{ name: '旅行社业务经营许可证', no: '[许可证编号]' }] },
    { name: '集团香港医疗机构（演示）', type: 'overseas_medical', region: '香港', licenses: [{ name: '医疗机构登记', no: '[登记编号]' }] },
  ]
  const partners = []
  for (const p of partnerRows) partners.push(await prisma.partner.create({ data: { ...p, contact: { name: '[联系人]' }, contractStart: dayjs('2026-09-01').toDate(), contractEnd: dayjs('2027-08-31').toDate() } }))

  // ───────── 规则、项目、题库、模块、首页 ─────────
  for (const m of MEDICAL_SERVICES) await prisma.medicalService.create({ data: { ...m, priceType: 'self_pay' } })
  for (const p of CHECKUP_PACKAGES) await prisma.checkupPackage.create({ data: { ...p, hospitalId: hospital.id, notice: '体检前一天晚上 10 点后禁食，当天早上空腹；带好身份证；穿宽松衣服。' } })
  for (let d = -40; d <= 30; d++) {
    const date = dayjs().add(d, 'day')
    if (date.day() === 0) continue
    for (const p of CHECKUP_PACKAGES) await prisma.checkupSlot.create({ data: { hospitalId: hospital.id, packageCode: p.code, date: date.format('YYYY-MM-DD'), capacity: p.code === 'CP01' ? 12 : 8, booked: d > 0 ? between(0, 4) : 0 } })
  }
  for (const p of PROJECTS) await prisma.project.create({ data: { status: 'active', ...p, defaultFreq: '每周 1 次' } })
  for (const p of PACKAGES) await prisma.planPackage.create({ data: { code: p.code, name: p.name, target: p.target, trigger: p.trigger as any, triggerText: p.triggerText, priority: p.priority, items: p.items, medicalLinks: p.medicalLinks, weeks: p.weeks } })
  for (const r of RED_FLAGS) await prisma.rule.create({ data: { code: r.code, kind: 'red_flag', level: r.level, source: r.source, conditionText: r.conditionText, condition: r.condition as any, action: { services: r.services, tags: r.tags || [], hotline: !!(r as any).hotline }, customerText: r.customerText, staffAction: r.staffAction, doctorConfirmed: false } })
  for (const r of RISK_SIGNALS) await prisma.rule.create({ data: { code: r.code, kind: 'risk_signal', level: 'L1', conditionText: r.conditionText, condition: r.condition as any, action: { services: r.services, tags: r.tags || [], tagsIf: (r as any).tagsIf || [], reason: r.reason, factKeys: (r as any).factKeys || [], interest: !!(r as any).interest } } })
  for (const r of CONTRAINDICATIONS) await prisma.rule.create({ data: { code: r.code, kind: 'contraindication', conditionText: `${r.tags.join(' / ')} × ${r.attributes.join(' / ')}`, action: { tags: r.tags, attributes: r.attributes, effect: r.effect, text: r.text }, customerText: r.text } })
  for (const t of LIFESTYLE_TIPS) await prisma.lifestyleTip.create({ data: t })
  for (const s of SCRIPTS) await prisma.script.create({ data: s })
  const tpl = await prisma.assessmentTemplate.create({ data: { version: 'v1.0', name: '六维年轻化测评 v1（初稿，待医生确认）', status: 'published', publishedAt: new Date() } })
  for (const [i, q] of QUESTIONS.entries()) {
    await prisma.assessmentQuestion.create({ data: { templateId: tpl.id, code: q.code, level: q.level, seq: i + 1, type: q.type, title: q.title, voiceText: q.voiceText, intro: q.intro, options: (q.options as any) ?? undefined, config: (q.config as any) ?? undefined, showIf: q.showIf ?? undefined, required: !!q.required, sensitive: !!q.sensitive } })
  }
  for (const t of CONSENT_TEXTS) await prisma.consentText.create({ data: { type: t.type, version: '2026.10.1', title: t.title, summary: t.summary, content: `${t.title}\n\n${t.summary.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n（全文由法务出具，待法务确认）`, required: t.required } })
  for (const m of MODULES) {
    await prisma.module.create({ data: {
      code: m.code, name: m.name, category: m.category, entryType: m.entryType, icon: m.icon, cover: m.cover || null, summary: m.summary, visibleTiers: m.tiers, sort: m.sort, version: m.version || 'V1.0',
      detail: m.detail || {}, entryConfig: m.entryConfig || undefined, healthRules: m.healthRules || [], leadConfig: m.lead ? { ...m.lead, assign: 'advisor' } : undefined,
      partnerId: m.partner !== undefined ? partners[m.partner].id : undefined, elderOk: true, complianceStatus: 'approved', status: 'online',
    } })
  }
  for (const l of LAYOUTS) await prisma.homeLayout.create({ data: { ...l, version: 1, status: 'published', publishedAt: new Date(), publishedBy: '林运营' } })
  await prisma.mirrorPersona.create({ data: PERSONA })
  for (const q of QUIZ) await prisma.quizQuestion.create({ data: q })
  await prisma.activity.createMany({ data: [
    { code: 'ACT_CY', type: 'health_day', title: '重阳健康日 · 骨骼健康与防跌倒讲座', storeIds: [stores[0].id], startAt: dayjs().add(5, 'day').hour(9).minute(30).toDate(), quota: 30, signups: 18, visibleTiers: ['A', 'B', 'C'] },
    { code: 'ACT_TEA', type: 'tea', title: '秋季私享茶会', storeIds: [stores[0].id], startAt: dayjs().add(14, 'day').hour(14).minute(30).toDate(), quota: 12, signups: 7, visibleTiers: ['A'] },
    { code: 'ACT_BD', type: 'birthday', title: '十月会员生日会', storeIds: [stores[0].id], startAt: dayjs().add(18, 'day').hour(15).toDate(), quota: 20, signups: 9, visibleTiers: ['A', 'B', 'C'] },
  ] })
  const gb1 = await prisma.groupbuyActivity.create({ data: { moduleCode: 'trip_qingyuan_value', title: '清远温泉老姐妹结伴团', desc: '2 人成团，锁定拼团价，到店或线下支付', price: 299, origPrice: 399, groupSize: 2, hours: 48 } })
  await prisma.groupbuyActivity.create({ data: { title: '肩颈舒缓双人体验', desc: '2 人成团，工作日白天可约', price: 198, origPrice: 398, groupSize: 2, hours: 48 } })

  // 设备与指标白名单（4.10）
  const dBody = await prisma.device.create({ data: { storeId: stores[0].id, name: '人体成分分析仪', model: '[型号]', manufacturer: '[厂家]', isMedicalDevice: false, approvedUse: '[按说明书填写]', principle: '生物电阻抗法', admissionStatus: 'approved', reviewNote: '指标限白名单，不出疾病结论', reviewedAt: new Date() } })
  const dBp = await prisma.device.create({ data: { storeId: stores[0].id, name: '电子血压计', model: '[型号]', manufacturer: '[厂家]', isMedicalDevice: true, registrationNo: '[注册证号]', approvedUse: '[注册证适用范围原文]', principle: '示波法', admissionStatus: 'approved', reviewedAt: new Date() } })
  const dSkin = await prisma.device.create({ data: { storeId: stores[0].id, name: '皮肤检测仪', model: '[型号]', manufacturer: '[厂家]', isMedicalDevice: false, principle: '电容法水分测试', admissionStatus: 'approved', reviewedAt: new Date() } })
  await prisma.device.create({ data: {
    storeId: stores[0].id, name: '德国鹰眼（全身健康评估系统）', model: '[待核实]', manufacturer: '[待核实]', isMedicalDevice: false,
    approvedUse: '[待核实] 报告自述：本设备系统不是医疗器械，不作为医疗诊断证明和处方使用，属于移动健康电子软件产品，用于健康管理健康评估筛查',
    principle: '[待核实检测原理]', admissionStatus: 'pending',
    reviewNote: '暂不准入（4.10）：报告包含脏器疾病风险、器官功能、药物禁忌与草药治疗等内容，超出生活美容范围；数据不进入客户端、不参与方案引擎与就医推荐。美团团购标题"全身 558 项健康评估"与报告措辞需法务审核（附录 I 禁用"全身扫描""器官功能检测"）。',
  } })
  const dHosp = await prisma.device.create({ data: { name: '医院回传指标（系统）', isMedicalDevice: true, principle: '合作医院回传的结构化指标', admissionStatus: 'approved' } })
  await prisma.deviceMetric.createMany({ data: [
    { deviceId: dBody.id, code: 'WEIGHT', name: '体重', unit: 'kg', direction: 'range', refSource: '厂家说明书' },
    { deviceId: dBody.id, code: 'BODY_FAT', name: '体脂率', unit: '%', refLow: 20, refHigh: 30, direction: 'range', refSource: '厂家说明书（女性）' },
    { deviceId: dBody.id, code: 'MUSCLE', name: '骨骼肌量', unit: 'kg', refLow: 19, direction: 'higher_better', refSource: '厂家说明书（女性）' },
    { deviceId: dBody.id, code: 'VFAT', name: '内脏脂肪等级', unit: '', refLow: 1, refHigh: 9, direction: 'lower_better', refSource: '厂家说明书' },
    { deviceId: dBp.id, code: 'SBP', name: '收缩压', unit: 'mmHg', refLow: 90, refHigh: 139, direction: 'range', refSource: '《中国高血压防治指南》' },
    { deviceId: dBp.id, code: 'DBP', name: '舒张压', unit: 'mmHg', refLow: 60, refHigh: 89, direction: 'range', refSource: '《中国高血压防治指南》' },
    { deviceId: dBp.id, code: 'PULSE', name: '心率', unit: '次/分', refLow: 60, refHigh: 100, direction: 'range', refSource: '厂家说明书' },
    { deviceId: dSkin.id, code: 'MOISTURE', name: '角质层水分', unit: '%', refLow: 35, direction: 'higher_better', refSource: '厂家说明书' },
    { deviceId: dSkin.id, code: 'ELASTIC', name: '皮肤弹性', unit: '分', refLow: 60, direction: 'higher_better', refSource: '厂家说明书' },
    { deviceId: dHosp.id, code: 'BMD_T_LUMBAR', name: '腰椎骨密度 T 值', unit: '', direction: 'higher_better', refSource: '合作医院' },
  ] })
  log('config done')

  // ───────── 客户 ─────────
  const C = (data: any) => prisma.customer.create({ data: { customerNo: genNo('C'), storeId: stores[0].id, source: 'import', ...data } })
  const wang = await C({ salutation: '王阿姨', name: '王秀芳', phone: '13800000001', birthYear: 1964, tier: 'C', elderMode: true, advisorId: amin.id, isDemo: true, demoTitle: '悦享 · 乐龄模式（62 岁，有完整档案）', createdAt: dayjs('2026-06-10').toDate() })
  const liu = await C({ salutation: '刘阿姨', name: '刘桂英', phone: '13800000004', birthYear: 1960, tier: 'C', elderMode: true, advisorId: amin.id, isDemo: true, demoTitle: '悦享 · 新客（66 岁，演示完整测评）', source: 'store_qr' })
  const chen = await C({ salutation: '陈总', name: '陈慧', phone: '13800000002', birthYear: 1978, tier: 'A', advisorId: xiaoya.id, isDemo: true, demoTitle: '臻享会员（48 岁）' })
  const li = await C({ salutation: '李女士', name: '李婷', phone: '13800000003', birthYear: 1991, tier: 'B', advisorId: amin.id, isDemo: true, demoTitle: '尊享会员（35 岁）' })
  const zhou = await C({ salutation: '小周', name: '周敏', phone: '13800000005', birthYear: 1992, tier: 'C', advisorId: amin.id, isDemo: true, demoTitle: '家人视角（王阿姨的女儿）', source: 'family_invite' })
  const huang = await C({ salutation: '黄阿姨', name: '黄丽', phone: '13800000006', birthYear: 1968, tier: 'B', elderMode: true, advisorId: amin.id, isDemo: true, demoTitle: '尊享 · 就医优先示例（L2）' })

  // 门店健康档案表（纸质表数字化）示例：虚构数据，仅用于演示
  {
    const { mapIntake } = await import('../src/engine/intake')
    const data = { height: 155, weight: 53, births: '2 胎及以上', bp: '偏高', bpValue: '138/86', lipid: '不清楚', glucose: '正常', allergy: ['无'], skin: ['干燥', '色斑'], hair: ['白发多'], nails: ['正常'], eyes: ['干涩'], stoolDaily: '能', stoolSticky: '否', constipation: '偶尔', dryMouth: '是', urineYellow: '否', urineOdor: '否', urineFoam: '否', urineCloudy: '否', thyroid: '正常', leucorrhea: '不便填写', fibroid: '否', hyperplasia: '是', menstruation: ['已绝经'], sleep: ['易醒', '早醒'], discomfort: '腰背酸，久坐后明显', surgery: '无', chronic: ['高血压'], chronicNote: '服用降压药，自述控制尚可' }
    const { tags } = mapIntake(data)
    const intake = await prisma.healthIntake.create({ data: { customerId: wang.id, data, tags, staffName: '阿敏', consultant: '阿敏', consentChannel: 'self', createdAt: dayjs('2026-06-14 10:00').toDate() } })
    for (const t of tags) await prisma.healthTag.create({ data: { customerId: wang.id, tagCode: t, source: 'staff', sourceRefId: intake.id, createdAt: dayjs('2026-06-14 10:00').toDate() } })
    await prisma.record.create({ data: { customerId: wang.id, recordType: 'service', sourceLabel: 'SELF', title: '门店健康档案表', summary: `本人自述，阿敏协助填写；生成 ${tags.length} 个健康标签`, refTable: 'health_intake', refId: intake.id, storeId: stores[0].id, occurredAt: dayjs('2026-06-14 10:00').toDate() } })
  }

  const surnames = ['张', '黄', '林', '梁', '吴', '何', '郑', '谢', '罗', '冯', '邓', '曾', '彭', '苏', '叶', '蔡', '许', '杜', '潘', '钟', '卢', '江', '郭', '马']
  const others: any[] = []
  for (let i = 0; i < 84; i++) {
    const age = chance(0.65) ? between(55, 78) : between(32, 54)
    const sn = pick(surnames)
    const store = chance(0.6) ? stores[0] : pick(stores.slice(1))
    others.push(await C({
      salutation: age >= 55 ? `${sn}阿姨` : chance(0.5) ? `${sn}姐` : `${sn}女士`, name: `${sn}某某`, phone: `1370000${String(1000 + i).padStart(4, '0')}`,
      birthYear: new Date().getFullYear() - age, elderMode: age >= 60, storeId: store.id, advisorId: pick(advisorsByStore[store.id]).id,
      createdAt: dayjs().subtract(between(20, 400), 'day').toDate(), lastVisitAt: chance(0.7) ? dayjs().subtract(between(0, 120), 'day').toDate() : null,
    }))
  }

  // 消费流水（近 12 个月）
  const spendPlan = new Map<number, number>([[wang.id, 4200], [chen.id, 68000], [li.id, 16800], [huang.id, 12500], [zhou.id, 0], [liu.id, 0]])
  others.forEach((c) => {
    const r = rand()
    spendPlan.set(c.id, r < 0.1 ? between(32000, 90000) : r < 0.4 ? between(9000, 28000) : r < 0.85 ? between(500, 8500) : 0)
  })
  let orderNo = 100000
  for (const [cid, total] of spendPlan) {
    if (!total) continue
    const n = between(2, 10)
    for (let k = 0; k < n; k++) {
      await prisma.consumption.create({ data: { extOrderNo: `POS${orderNo++}`, customerId: cid, storeId: stores[0].id, category: pick(['service', 'service', 'card', 'product']), paidAmount: Math.round(total / n), paidAt: dayjs().subtract(between(3, 350), 'day').toDate() } })
    }
  }
  const sim = await tier.simulate({})
  await tier.publish({ thresholdA: Math.max(30000, sim.suggestA), thresholdB: Math.max(8000, sim.suggestB) }, '林运营')
  log('tier', sim.suggestA, sim.suggestB)

  // ───────── 工具函数 ─────────
  const questions = await engine.questions()
  const actorH = { id: health.id, name: health.name }
  const marks = async () => {
    const t = ['assessment', 'record', 'plan', 'coupon', 'pointsLedger', 'message', 'task', 'riskAlert', 'referral', 'report', 'measurement', 'consentRecord', 'eventLog', 'healthTag']
    const m: Record<string, number> = {}
    for (const k of t) m[k] = ((await (prisma as any)[k].findFirst({ orderBy: { id: 'desc' } }))?.id || 0)
    return m
  }
  /** 把某一步产生的记录挪到历史日期，并把历史任务标记为已完成 */
  const backdate = async (m: Record<string, number>, date: Date, opts: { doneTasks?: boolean } = { doneTasks: true }) => {
    const gt = (k: string) => ({ id: { gt: m[k] } })
    await prisma.assessment.updateMany({ where: gt('assessment'), data: { startedAt: dayjs(date).subtract(20, 'minute').toDate(), completedAt: date } })
    await prisma.assessment.updateMany({ where: { ...gt('assessment'), status: 'in_progress' }, data: { completedAt: null } })
    await prisma.record.updateMany({ where: gt('record'), data: { occurredAt: date } })
    await prisma.plan.updateMany({ where: gt('plan'), data: { createdAt: date } })
    await prisma.plan.updateMany({ where: { ...gt('plan'), reviewedAt: { not: null } }, data: { reviewedAt: dayjs(date).add(3, 'hour').toDate() } })
    await prisma.plan.updateMany({ where: { ...gt('plan'), sentAt: { not: null } }, data: { sentAt: dayjs(date).add(5, 'hour').toDate() } })
    await prisma.coupon.updateMany({ where: gt('coupon'), data: { issuedAt: date } })
    await prisma.pointsLedger.updateMany({ where: gt('pointsLedger'), data: { createdAt: date } })
    await prisma.message.updateMany({ where: gt('message'), data: { createdAt: date, read: true } })
    await prisma.riskAlert.updateMany({ where: gt('riskAlert'), data: { createdAt: date, slaDueAt: dayjs(date).add(1, 'hour').toDate() } })
    await prisma.referral.updateMany({ where: gt('referral'), data: { createdAt: date } })
    await prisma.report.updateMany({ where: gt('report'), data: { createdAt: date, publishedAt: date } })
    await prisma.measurement.updateMany({ where: gt('measurement'), data: { measuredAt: date } })
    await prisma.consentRecord.updateMany({ where: gt('consentRecord'), data: { grantedAt: date } })
    await prisma.eventLog.updateMany({ where: gt('eventLog'), data: { createdAt: date } })
    await prisma.healthTag.updateMany({ where: gt('healthTag'), data: { createdAt: date } })
    if (opts.doneTasks) await prisma.task.updateMany({ where: gt('task'), data: { status: 'done', createdAt: date, dueAt: dayjs(date).add(24, 'hour').toDate(), doneAt: dayjs(date).add(2, 'hour').toDate() } })
  }
  const toAns = (v: any) => (Array.isArray(v) ? { values: v } : v === null ? { skipped: true } : { value: v })
  /** 随机但合理的答案（不触发红旗；指定的 overrides 优先） */
  const randomAnswer = (q: QDef, age: number, overrides: Record<string, any>) => {
    if (overrides[q.code] !== undefined) return toAns(overrides[q.code])
    const opts = q.options || []
    switch (q.code) {
      case 'H01': return toAns(chance(0.35) ? ['htn', ...(chance(0.3) ? ['lipid'] : [])] : chance(0.1) ? ['diabetes'] : ['none'])
      case 'H02': return toAns(pick(['good', 'good', 'unstable', 'unknown']))
      case 'H03': return toAns(chance(0.12) ? ['anticoagulant'] : chance(0.06) ? ['varicose'] : ['none'])
      case 'H04': case 'H05': case 'H06': case 'W06': case 'W07': case 'W11': case 'W17': case 'W18': case 'M08': return toAns('no')
      case 'B01': return toAns(between(150, 168))
      case 'B02': return toAns(between(44, 74))
      case 'B03': return toAns(chance(0.6) ? between(70, 92) : null)
      case 'B04': return toAns(pick(['same', 'same', 'same', 'gain', 'intentional']))
      case 'F02': return toAns(chance(0.25) ? null : chairStandRef(age) + between(-4, 3))
      case 'F03': return toAns(chance(0.25) ? null : between(6, 30))
      case 'W01': return toAns(age >= 55 ? 'meno' : age >= 45 ? pick(['peri', 'irregular', 'meno']) : pick(['regular', 'regular', 'irregular', 'postpartum']))
      case 'W05': return toAns(pick(['normal', 'normal', 'less']))
      case 'W08': return toAns(pick(['no', 'no', 'late_no']))
      default: break
    }
    if (q.type === 'multi') {
      const none = opts.find(o => o.exclusive)
      if (none && chance(0.35)) return toAns([none.value])
      const pool = opts.filter(o => !o.exclusive)
      const n = between(1, Math.min(3, pool.length))
      return toAns([...new Set([...Array(n)].map(() => pick(pool).value))])
    }
    if (q.type === 'slider') return toAns(q.config?.default)
    if (opts.length) {
      const scored = opts.filter(o => typeof o.score === 'number').sort((a, b) => (b.score as number) - (a.score as number))
      if (scored.length && chance(0.5)) return toAns(scored[0].value)
      return toAns(pick(opts).value)
    }
    return toAns(null)
  }
  /** 走完整测评流程（真实规则引擎）；返回测评 id */
  const runAssessment = async (c: any, overrides: Record<string, any> = {}, opts: { mode?: string, l3Code?: string } = {}) => {
    if (!(await wf.hasConsent(c.id, 'C2'))) await wf.grantConsent(c.id, 'C2', true)
    const cur: any = await assess.start(c.id, opts.mode || 'self')
    const age = ageOf(c.birthYear)
    for (let round = 0; round < 5; round++) {
      const { facts } = await engine.factsFor(cur.id)
      const answered = new Set((await prisma.assessmentAnswer.findMany({ where: { assessmentId: cur.id } })).map(a => a.questionCode))
      const todo = visibleQuestions(questions, facts).filter(q => !answered.has(q.code))
      if (!todo.length) break
      for (const q of todo) {
        if (opts.l3Code === q.code) {
          await assess.saveAnswer(c.id, cur.id, { questionCode: q.code, answer: toAns(overrides[q.code]) })
          continue
        }
        await prisma.assessmentAnswer.create({ data: { assessmentId: cur.id, questionCode: q.code, level: q.level, answer: randomAnswer(q, age, overrides) } })
      }
    }
    for (const l of ['safety', 'skin', 'shape', 'contour', 'fitness', 'posture', 'mind', 'women']) await assess.completeLevel(c.id, cur.id, l)
    await assess.complete(c.id, cur.id)
    return cur.id as number
  }
  const latestPlan = (cid: number) => prisma.plan.findFirst({ where: { customerId: cid, status: { not: 'void' } }, orderBy: { id: 'desc' } })
  const approveAndSend = async (cid: number, advisor: any) => {
    const p = await latestPlan(cid)
    if (!p) return
    await plans.review(p.id, actorH, true, '规则骨架与文案一致，同意发送')
    await plans.markSent(p.id, { id: advisor.id, name: advisor.name })
  }
  const measure = async (c: any, date: Date, values: { body?: [number, number, number, number], bp?: [number, number, number], skin?: [number, number] }) => {
    const m = await marks()
    if (values.body) await archive.createMeasurement({ customerId: c.id, deviceId: dBody.id, metrics: [{ code: 'WEIGHT', value: values.body[0] }, { code: 'BODY_FAT', value: values.body[1] }, { code: 'MUSCLE', value: values.body[2] }, { code: 'VFAT', value: values.body[3] }] }, { id: amin.id, name: amin.name })
    if (values.bp) await archive.createMeasurement({ customerId: c.id, deviceId: dBp.id, metrics: [{ code: 'SBP', value: values.bp[0] }, { code: 'DBP', value: values.bp[1] }, { code: 'PULSE', value: values.bp[2] }] }, { id: amin.id, name: amin.name })
    if (values.skin) await archive.createMeasurement({ customerId: c.id, deviceId: dSkin.id, metrics: [{ code: 'MOISTURE', value: values.skin[0] }, { code: 'ELASTIC', value: values.skin[1] }] }, { id: amin.id, name: amin.name })
    await backdate(m, date)
  }

  // ───────── 王阿姨：完整的健康闭环 ─────────
  for (const t of ['C1', 'C7', 'C9']) await wf.grantConsent(wang.id, t, true)
  const wangBase: Record<string, any> = {
    H01: ['htn'], H02: 'good', H03: ['none'], S01: 'dry', S02: ['wrinkle', 'spots'], S03: 'sometimes', S04: 'clean', B01: 155, B02: 53, B03: 83, B04: 'same',
    C01: ['eyes', 'nasolabial', 'neck'], C02: 'bit', C03: 'no', F01: '1_2', F02: 9, F03: 9, F05: 'some', F06: 'none', F07: 'some', F08: 'some', F09: 'none',
    P01: 'round', P02: ['waist', 'back'], P03: 'gt3', P05: 'yes', P06: 'yes', M01: '5_6', M02: '3plus', M03: 'gt3', M04: '1', M05: '1', M06: '1', M07: '0', M09: 'sometimes',
    W01: 'meno', W09: 'gt10', W10: 'sometimes', W14: 'gt3', W15: 'lt3', W16: 'gt2', W22: ['none'],
  }
  let m = await marks()
  await measure(wang, dayjs('2026-06-14 10:30').toDate(), { body: [54.2, 33.8, 18.6, 9], bp: [142, 88, 76], skin: [31, 58] })
  m = await marks()
  await runAssessment(wang, { ...wangBase, S03: 'never', F01: '0', M01: 'lt5', M09: 'often' })
  await approveAndSend(wang.id, amin)
  await backdate(m, dayjs('2026-06-15 15:20').toDate())
  await measure(wang, dayjs('2026-08-02 11:00').toDate(), { body: [53.6, 33.1, 18.8, 9], bp: [136, 85, 74], skin: [33, 60] })
  m = await marks()
  const wangA2 = await runAssessment(wang, { ...wangBase, S03: 'daily', S04: 'full', M01: '6_7', M02: '1_2', M03: 'gt3', P06: 'no', F01: '3_4', F02: 11, C01: ['eyes', 'nasolabial'], C02: 'bit', M09: 'rarely' })
  await approveAndSend(wang.id, amin)
  await backdate(m, dayjs('2026-09-20 10:40').toDate())
  // 体检：领券 → 预约 → 医院接收 → 到院 → 回传 → 方案按医生意见调整
  const wangCoupon = await prisma.coupon.findFirst({ where: { customerId: wang.id } })
  if (wangCoupon) {
    m = await marks()
    await checkup.claim(wangCoupon.couponNo, { id: amin.id, name: amin.name })
    await backdate(m, dayjs('2026-09-23 10:00').toDate())
    m = await marks()
    const bk = await checkup.book(wang.id, { couponId: wangCoupon.id, date: dayjs().subtract(7, 'day').day() === 0 ? dayjs().subtract(8, 'day').format('YYYY-MM-DD') : dayjs().subtract(7, 'day').format('YYYY-MM-DD'), c3: true, c4: true, transportNeeded: false, note: '腰背酸了半年多' })
    await backdate(m, dayjs('2026-09-24 09:20').toDate())
    const hu = { id: 2, name: '刘协调员' }
    await checkup.hospitalAction(bk.referralId, hospital.id, 'accept', {}, hu)
    await checkup.hospitalAction(bk.referralId, hospital.id, 'arrived', {}, hu)
    m = await marks()
    await checkup.hospitalAction(bk.referralId, hospital.id, 'return', {
      doctorName: '张医生', conclusion: '腰椎骨密度 T 值 -2.1，骨量减少。血压控制尚可。',
      advice: '补充钙和维生素 D，增加负重运动，避免跌倒。避免重手法按压腰背。6 个月后复查骨密度。',
      storeRestrictions: ['doctor_hold_heavy_manual'], recheckDate: '2027-04-15', metrics: [{ code: 'BMD_T_LUMBAR', value: -2.1, unit: '' }],
    }, { id: 3, name: '张医生' })
    await approveAndSend(wang.id, amin)
    await backdate(m, dayjs('2026-10-08 16:30').toDate())
  }
  await measure(wang, dayjs('2026-10-09 10:15').toDate(), { body: [53.1, 32.4, 19.1, 8], bp: [134, 84, 72], skin: [36, 63] })
  // 家人：小周（女儿）
  const fl = await prisma.familyLink.create({ data: { elderId: wang.id, familyId: zhou.id, relation: 'daughter', permissions: ['view_report', 'receive_reminder', 'book_for'], token: 'demo-family-wang', status: 'active', expiresAt: dayjs().add(3, 'day').toDate() } })
  await wf.grantConsent(wang.id, 'C6', true, { family_id: zhou.id, permissions: fl.permissions })
  await wf.grantConsent(zhou.id, 'C1', true)
  // 互动玩法演示数据（XJ-301）：部分解锁的徽章、一组接力记录、两枚印章，供前端联调
  await prisma.userBadge.createMany({ data: [
    { customerId: wang.id, badgeCode: 'keep_checkin_7', progress: 7, unlockedAt: dayjs().subtract(9, 'day').toDate() },
    { customerId: wang.id, badgeCode: 'keep_checkin_30', progress: 19 },
    { customerId: wang.id, badgeCode: 'explore_first_assessment', progress: 1, unlockedAt: dayjs('2026-06-15 16:00').toDate() },
    { customerId: wang.id, badgeCode: 'explore_checkup_return', progress: 1, unlockedAt: dayjs('2026-10-08 17:00').toDate() },
    { customerId: wang.id, badgeCode: 'share_family_bind', progress: 1, unlockedAt: dayjs().subtract(20, 'day').toDate() },
  ] })
  for (const d of [4, 3, 2, 1]) {
    await prisma.familyRelay.create({ data: { customerId: d % 2 ? zhou.id : wang.id, peerId: d % 2 ? wang.id : zhou.id, date: dayjs().subtract(d, 'day').format('YYYY-MM-DD'), passedAt: dayjs().subtract(d, 'day').hour(20).minute(15).toDate() } })
  }
  await prisma.storeStamp.createMany({ data: [
    { customerId: wang.id, storeId: stores[0].id, month: dayjs().format('YYYY-MM'), stampedAt: dayjs().subtract(5, 'day').toDate(), operatorStaffId: amin.id },
    { customerId: wang.id, storeId: stores[1].id, month: dayjs().subtract(1, 'month').format('YYYY-MM'), stampedAt: dayjs().subtract(28, 'day').toDate(), operatorStaffId: amin.id },
  ] })
  // 魔镜记忆与历史对话
  await prisma.mirrorMemory.createMany({ data: [
    { customerId: wang.id, category: '家人', text: '孙子小宝今年读三年级' },
    { customerId: wang.id, category: '爱好', text: '喜欢唱粤剧，周三去社区粤曲班' },
    { customerId: wang.id, category: '家人', text: '老伴老陈爱下象棋' },
    { customerId: wang.id, category: '近期大事', text: '女儿小周国庆回来住了三天' },
  ] })
  const ss = await mirror.start(wang.id)
  await mirror.send(wang.id, ss.sessionId, '小镜，今天粤曲班老师夸我唱得好')
  await mirror.send(wang.id, ss.sessionId, '读我的报告')
  for (let d = 1; d <= 6; d++) await prisma.checkin.create({ data: { customerId: wang.id, type: 'sleep', date: dayjs().subtract(d, 'day').format('YYYY-MM-DD'), data: { sleepAt: '22:30', wakeAt: '06:10', wakeTimes: between(1, 3) } } })
  for (let d = 6; d >= 1; d--) {
    await wf.addPoints(wang.id, 2, 'checkin', '打卡：睡眠')
    const last = await prisma.pointsLedger.findFirst({ where: { customerId: wang.id }, orderBy: { id: 'desc' } })
    await prisma.pointsLedger.update({ where: { id: last!.id }, data: { createdAt: dayjs().subtract(d, 'day').hour(7).minute(10).toDate() } })
  }
  await prisma.customer.update({ where: { id: wang.id }, data: { lastVisitAt: dayjs().subtract(3, 'day').toDate() } })
  log('wang done', wangA2)

  // ───────── 陈总（臻享）─────────
  await wf.grantConsent(chen.id, 'C1', true)
  m = await marks()
  await runAssessment(chen, { H01: ['none'], H03: ['none'], B01: 164, B02: 58, B03: 76, F02: 14, F03: 26, C03: 'curious', M01: '5_6', M02: '3plus', M03: 'gt3', M04: '1', M05: '1', M06: '2', M07: '1', W01: 'peri', W04: 'mild', W05: 'normal', W10: 'sleep', W14: 'lt1', W15: 'lt3', W16: 'lt1', W22: ['none'] })
  await approveAndSend(chen.id, xiaoya)
  await backdate(m, dayjs('2026-09-28 20:10').toDate())
  await measure(chen, dayjs('2026-09-30 19:00').toDate(), { body: [58.4, 27.5, 21.9, 5], bp: [118, 76, 70], skin: [38, 70] })
  await prisma.lead.create({ data: { leadNo: genNo('LD'), customerId: chen.id, moduleCode: 'vip_overseas', moduleName: '海外 VIP 通道', type: 'overseas_vip', formData: { destination: '香港', need: '高端体检', date: '2026-11-15', translator: '不需要' }, assigneeId: xiaoya.id, partnerId: partners[4].id, slaDueAt: dayjs().add(3, 'hour').toDate() } })
  await wf.createTask({ staffId: xiaoya.id, customerId: chen.id, type: 'lead_followup', title: '陈总提交「海外 VIP 通道」意向（香港 · 高端体检），请 4 小时内联系', hours: 3 })

  // ───────── 李女士（尊享）：方案待审核、体检券待领取 ─────────
  await wf.grantConsent(li.id, 'C1', true)
  m = await marks()
  await runAssessment(li, { H01: ['none'], H03: ['none'], B01: 162, B02: 63, B03: 81, B04: 'gain', F02: 16, F03: 30, F01: '0', M02: '1_2', M03: 'm1_3', W01: 'irregular', W02: 'chaotic', W03: 'gt6', W04: 'affect', W05: 'normal', W07: 'no', W08: 'no', W14: 'lt1', W15: 'lt3', W16: 'y1_2', W22: ['none'] })
  await backdate(m, dayjs().subtract(1, 'day').hour(21).toDate(), { doneTasks: false })

  // ───────── 黄阿姨：L2 就医优先 ─────────
  await wf.grantConsent(huang.id, 'C1', true)
  m = await marks()
  await runAssessment(huang, { H01: ['htn'], H02: 'unstable', W01: 'meno', W11: 'yes', B01: 158, B02: 60 })
  await backdate(m, dayjs().subtract(5, 'hour').toDate(), { doneTasks: false })

  // 刘阿姨（新客）只同意 C1，留给现场演示完整测评
  await wf.grantConsent(liu.id, 'C1', true)

  // ───────── 其他客户 ─────────
  const special: Record<number, { overrides: any, l3?: string }> = {
    3: { overrides: { H04: 'yes' }, l3: 'H04' },
    9: { overrides: { B04: 'unintended' } },
    15: { overrides: { M04: '3', M05: '2', M08: 'no', M09: 'often' } },
  }
  let idx = 0
  for (const c of others) {
    idx++
    if (!chance(0.62) && !special[idx]) continue
    await wf.grantConsent(c.id, 'C1', true)
    const when = dayjs().subtract(between(0, 26), 'day').hour(between(9, 20)).minute(between(0, 59)).toDate()
    m = await marks()
    try {
      await runAssessment(c, special[idx]?.overrides || {}, { l3Code: special[idx]?.l3, mode: chance(0.3) ? 'staff_assisted' : 'self' })
    }
    catch (e: any) { log('assess err', e.message); continue }
    const recent = dayjs().diff(when, 'day') < 2
    const p = await latestPlan(c.id)
    if (p && !recent && chance(0.75)) {
      await plans.review(p.id, actorH, true)
      if (chance(0.8)) await plans.markSent(p.id, { id: c.advisorId, name: '顾问' })
    }
    const coupon = await prisma.coupon.findFirst({ where: { customerId: c.id } })
    if (coupon && !recent && chance(0.55)) {
      await checkup.claim(coupon.couponNo, { id: c.advisorId, name: '顾问' })
      if (chance(0.55)) {
        const date = dayjs().add(between(1, 12), 'day')
        const bk = await checkup.book(c.id, { couponId: coupon.id, date: (date.day() === 0 ? date.add(1, 'day') : date).format('YYYY-MM-DD'), c3: true, c4: chance(0.8), transportNeeded: chance(0.15) }).catch(() => null)
        if (bk && chance(0.6)) await checkup.hospitalAction(bk.referralId, hospital.id, 'accept', {}, { id: 2, name: '刘协调员' })
      }
    }
    await backdate(m, when, { doneTasks: !recent })
  }
  // 门店血压红旗（RF12）
  const bpCase = others[20]
  await archive.createMeasurement({ customerId: bpCase.id, deviceId: dBp.id, metrics: [{ code: 'SBP', value: 186 }, { code: 'DBP', value: 112 }, { code: 'PULSE', value: 88 }] }, { id: amin.id, name: amin.name })
  for (const c of others.slice(30, 50)) {
    if (chance(0.5)) await measure(c, dayjs().subtract(between(1, 40), 'day').toDate(), { body: [between(48, 70), between(24, 36), between(17, 23), between(4, 12)], bp: [between(110, 150), between(70, 95), between(62, 88)] })
  }
  // 魔镜预警示例
  const lonely = others[11]
  const s2 = await mirror.start(lonely.id)
  await mirror.send(lonely.id, s2.sessionId, '最近老是一个人在家，好孤单，没人陪我说话')
  const scam = others[25]
  const s3 = await mirror.start(scam.id)
  await mirror.send(scam.id, s3.sessionId, '今天有人打电话说我中奖了，要我先转账交手续费，还要我报验证码')

  // 线索
  const tripMods = await prisma.module.findMany({ where: { category: 'travel' } })
  for (let i = 0; i < 16; i++) {
    const c = pick(others)
    const mod = pick(tripMods.filter(t => (t.visibleTiers as string[]).includes(c.tier)).concat(tripMods.slice(0, 1)))
    const status = pick(['new', 'new', 'contacted', 'negotiating', 'won', 'won', 'lost'])
    const lead = await prisma.lead.create({ data: { leadNo: genNo('LD'), customerId: c.id, moduleId: mod.id, moduleCode: mod.code, moduleName: mod.name, type: 'travel', formData: { people: between(1, 3), date: dayjs().add(between(7, 40), 'day').format('YYYY-MM-DD'), buddy: pick(['是', '否']) }, status, assigneeId: c.advisorId, partnerId: mod.partnerId, slaDueAt: dayjs().add(between(-10, 20), 'hour').toDate(), wonAmount: status === 'won' ? between(299, 4680) * between(1, 2) : null, lostReason: status === 'lost' ? pick(['价格', '时间', '家人不同意']) : null, createdAt: dayjs().subtract(between(0, 20), 'day').toDate() } })
    if (status !== 'new') await prisma.leadFollowup.create({ data: { leadId: lead.id, staffName: '阿敏', method: 'phone', content: '已电话联系，客户想和老姐妹一起去，确认人数中' } })
  }
  // 拼团：一个待成团的团，王阿姨可以参团
  await prisma.groupbuyGroup.create({ data: { activityId: gb1.id, leaderId: others[5].id, members: [others[5].id], expiresAt: dayjs().add(30, 'hour').toDate() } })

  // 演示：未关闭预警调整为"刚刚发生"，时限倒计时更真实；历史任务标记完成
  const openAlerts = await prisma.riskAlert.findMany({ where: { status: { not: 'closed' } } })
  for (const [i, a] of openAlerts.entries()) {
    const created = dayjs().subtract(8 + i * 11, 'minute').toDate()
    const hours = ['L3', 'high'].includes(a.level) ? 1 : 24
    await prisma.riskAlert.update({ where: { id: a.id }, data: { createdAt: created, slaDueAt: dayjs(created).add(hours, 'hour').toDate() } })
    await prisma.task.updateMany({ where: { refTable: 'risk_alert', refId: a.id, status: 'todo' }, data: { createdAt: created, dueAt: dayjs(created).add(hours, 'hour').toDate() } })
  }
  await prisma.staffNotice.deleteMany({ where: { title: '预警超时升级' } })
  await tier.recalc()
  // 记下演示账号的初始数据范围：各设备的演示副本只从这里复制
  await app.get(DemoSandboxService).snapshotBaseline()
  log('done', { customers: await prisma.customer.count(), assessments: await prisma.assessment.count(), plans: await prisma.plan.count(), alerts: await prisma.riskAlert.count(), referrals: await prisma.referral.count() })
  void ops; void admin; void manager
  await app.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
