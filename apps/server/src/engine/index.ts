/**
 * 规则引擎（设计文档 4.4–4.8、13.5）
 * 纯函数、无 I/O：输入"事实对象"，输出命中规则、风险等级、健康标签、方案骨架。
 * 服务端测评计算与后台"模拟"共用同一份代码。
 */
import jsonLogic from 'json-logic-js'
import { chairStandRef, DIMENSIONS, DIM_NAMES, type QDef } from './question-bank'
import { TAG_NAMES } from './rules-data'

export type AnswerMap = Record<string, any> // code -> { value } | { values } | { skipped }

export interface Facts {
  age: number
  gender: string
  a: Record<string, any>
  c: Record<string, any>
  tags: string[]
  m: Record<string, any>
  d: Record<string, number>
  personalization: boolean
  redFlagActive?: boolean
}

export function ageOf(birthYear?: number | null, now = new Date()) {
  if (!birthYear) return 45
  return now.getFullYear() - birthYear
}

export function ageBand(age: number) {
  const lo = Math.floor(age / 10) * 10
  return `${lo}-${lo + 9}`
}

export function answerValue(ans: any) {
  if (!ans || ans.skipped) return undefined
  if (Array.isArray(ans.values)) return ans.values
  return ans.value
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** 由答案构造事实对象（含 OSTA、SARC-F、PHQ-2、GAD-2、BMI 等计算值） */
export function buildFacts(opts: {
  age: number
  gender: string
  answers: AnswerMap
  questions: QDef[]
  measurement?: { sbp?: number, dbp?: number } | null
  extraTags?: string[]
  personalization?: boolean
  dims?: Record<string, number>
}): Facts {
  const { age, gender, answers, questions } = opts
  const a: Record<string, any> = {}
  for (const [code, ans] of Object.entries(answers || {})) a[code] = answerValue(ans)

  const qmap = new Map(questions.map(q => [q.code, q]))
  const opt = (code: string) => {
    const q = qmap.get(code)
    const v = a[code]
    if (!q || v === undefined) return []
    const vals = Array.isArray(v) ? v : [v]
    return (q.options || []).filter(o => vals.includes(o.value))
  }
  const sumOf = (codes: string[], key: 'sarc' | 'phq' | 'gad') =>
    codes.reduce((s, c) => s + (opt(c)[0]?.[key] ?? 0), 0)

  const c: Record<string, any> = {}
  const h = Number(a.B01)
  const w = Number(a.B02)
  if (h && w) c.bmi = round1(w / ((h / 100) ** 2))
  if (w) c.osta = round1((w - age) * 0.2)
  if (a.B03 !== undefined && a.B03 !== null && a.B03 !== '') c.waist = Number(a.B03)
  if (age >= 50) c.sarcf = sumOf(['F05', 'F06', 'F07', 'F08', 'F09'], 'sarc')
  c.phq2 = sumOf(['M04', 'M05'], 'phq')
  c.gad2 = sumOf(['M06', 'M07'], 'gad')
  if (a.F02 !== undefined) {
    c.chairCount = Number(a.F02)
    c.chairRef = chairStandRef(age)
    c.chairLow = c.chairCount < c.chairRef - 2
  }
  if (a.F03 !== undefined) {
    c.balanceSec = Number(a.F03)
    c.balanceLow = c.balanceSec < 10
  }
  c.fall3 = ['few', 'many'].includes(a.F09) || a.P04 === 'yes' || a.P05 === 'yes' || a.P06 === 'yes'

  const tags = new Set<string>(opts.extraTags || [])
  for (const code of Object.keys(a)) for (const o of opt(code)) (o.tags || []).forEach(t => tags.add(t))
  if (c.chairLow) tags.add('chair_stand_low')
  if (c.balanceLow) tags.add('balance_low')
  if (a.S03 && a.S03 !== 'daily') tags.add('skin_care_low')

  return {
    age,
    gender,
    a,
    c,
    tags: [...tags],
    m: opts.measurement || {},
    d: opts.dims || {},
    personalization: opts.personalization !== false,
  }
}

export function evalLogic(rule: any, facts: any): boolean {
  if (rule === true || rule === undefined || rule === null) return true
  try {
    return !!jsonLogic.apply(rule, facts)
  }
  catch {
    return false
  }
}

/** 按显示条件过滤题目；女性健康进阶关只对女性显示 */
export function visibleQuestions(questions: QDef[], facts: Facts, level?: string) {
  return questions
    .filter(q => !level || q.level === level)
    .filter(q => q.level !== 'women' || facts.gender === 'female')
    .filter(q => !q.showIf || evalLogic(q.showIf, facts))
}

/** 单题得分；null 表示不计分 */
export function questionScore(q: QDef, facts: Facts): number | null {
  const v = facts.a[q.code]
  if (v === undefined || v === null || v === '') return null
  const scoring = q.config?.scoring
  if (scoring === 'multiCount') {
    const vals: string[] = Array.isArray(v) ? v : [v]
    const n = vals.includes('none') ? 0 : vals.length
    const map = q.config!.map || {}
    return map[n] ?? map[Math.max(...Object.keys(map).map(Number))] ?? null
  }
  if (scoring === 'bmi') {
    const bmi = facts.c.bmi
    if (!bmi) return null
    if (bmi < 18.5) return 2
    if (bmi < 24) return 4
    if (bmi < 28) return 2
    return 0
  }
  if (scoring === 'waist') {
    const wv = Number(v)
    if (wv < 80) return 4
    if (wv < 85) return 2
    return 0
  }
  if (scoring === 'chairStand') {
    const ref = facts.c.chairRef
    const n = Number(v)
    if (n >= ref) return 4
    if (n >= ref - 2) return 2
    return 0
  }
  if (scoring === 'balance') {
    const s = Number(v)
    if (s >= 20) return 4
    if (s >= 10) return 2
    return 0
  }
  const o = (q.options || []).find(x => x.value === v)
  if (!o || o.score === undefined || o.score === null) return null
  return o.score
}

/** 维度分 = 已答题得分之和 ÷ 已答题满分之和 × 100；指数 = 已完成维度平均 */
export function scoreDimensions(questions: QDef[], facts: Facts) {
  const scores: Record<string, number> = {}
  for (const dim of DIMENSIONS) {
    let got = 0
    let full = 0
    for (const q of visibleQuestions(questions, facts, dim)) {
      const s = questionScore(q, facts)
      if (s === null) continue
      got += s
      full += 4
    }
    if (full > 0) scores[dim] = Math.round((got / full) * 100)
  }
  const done = Object.values(scores)
  const index = done.length ? Math.round(done.reduce((x, y) => x + y, 0) / done.length) : null
  return { scores, index, completedDims: Object.keys(scores) }
}

export function dimGrade(score: number) {
  if (score >= 80) return { grade: '优', tone: 'good' }
  if (score >= 60) return { grade: '良', tone: 'ok' }
  return { grade: '需关注', tone: 'attention' }
}

export interface RuleLike {
  code: string
  kind: string
  level?: string | null
  condition?: any
  action?: any
  customerText?: string | null
  staffAction?: string | null
  conditionText?: string | null
}

export function evaluateRedFlags(rules: RuleLike[], facts: Facts) {
  return rules.filter(r => r.kind === 'red_flag' && evalLogic(r.condition, facts))
}

export function evaluateRiskSignals(rules: RuleLike[], facts: Facts) {
  return rules
    .filter(r => r.kind === 'risk_signal' && evalLogic(r.condition, facts))
    .map((r) => {
      const tags = [...(r.action?.tags || [])]
      for (const ti of r.action?.tagsIf || []) if (evalLogic(ti.if, facts)) tags.push(ti.tag)
      return { ...r, tags }
    })
}

export function riskLevelOf(redHits: RuleLike[], riskHits: RuleLike[]) {
  if (redHits.some(r => r.level === 'L3')) return 'L3'
  if (redHits.some(r => r.level === 'L2')) return 'L2'
  if (riskHits.some(r => !r.action?.interest)) return 'L1'
  return 'L0'
}

const LEVEL_ORDER = ['L0', 'L1', 'L2', 'L3']
export const maxLevel = (x: string, y: string) => (LEVEL_ORDER.indexOf(x) >= LEVEL_ORDER.indexOf(y) ? x : y)

/** 禁忌筛查：健康标签 × 项目属性 → block / warn */
export function screenProject(project: { code: string, attributes: string[] }, ciRules: RuleLike[], tags: string[]) {
  const blocks: { code: string, text: string, tag: string }[] = []
  const warns: { code: string, text: string, tag: string }[] = []
  for (const r of ciRules) {
    if (r.kind !== 'contraindication') continue
    const act = r.action || {}
    const hitTag = (act.tags || []).find((t: string) => tags.includes(t))
    if (!hitTag) continue
    const attrs: string[] = act.attributes || []
    const hitAttr = attrs.includes('*') || attrs.some(x => project.attributes.includes(x))
    if (!hitAttr) continue
    const item = { code: r.code, text: r.customerText || act.text || '', tag: hitTag }
    if (act.effect === 'block') blocks.push(item)
    else warns.push(item)
  }
  return { blocks, warns }
}

export interface PackageLike {
  code: string
  name: string
  priority: number
  trigger?: any
  items: { project: string, freq: string }[]
  medicalLinks?: string[]
  weeks?: number | null
}

export function selectPackages(packages: PackageLike[], facts: Facts) {
  const hits = [...packages].sort((x, y) => x.priority - y.priority).filter(p => evalLogic(p.trigger, facts))
  const primary = hits[0]
  let secondary: PackageLike | undefined
  if (primary && primary.code !== 'PK10') {
    const pset = primary.items.map(i => i.project).sort().join(',')
    secondary = hits.slice(1).find(p => p.code !== 'PK10' && p.items.length && p.items.map(i => i.project).sort().join(',') !== pset)
  }
  return { primary, secondary, hits: hits.map(h => h.code) }
}

export interface SkeletonInput {
  salutation: string
  age: number
  elderMode: boolean
  facts: Facts
  riskLevel: string
  redHits: RuleLike[]
  riskHits: (RuleLike & { tags?: string[] })[]
  packages: PackageLike[]
  projects: { code: string, name: string, attributes: string[] }[]
  ciRules: RuleLike[]
  lifestyleTips: { code: string, tags?: string[] | null }[]
  medicalServices: { code: string, name: string }[]
  couponEligible: boolean
  couponType?: string
  hasActiveRedFlag: boolean
  doctorAdvice?: { recheckDate?: string, restrictions?: string[] } | null
  rulesVersion?: string
}

/** 4.7.2 骨架生成步骤 */
export function buildSkeleton(input: SkeletonInput) {
  const { facts } = input
  const svcName = (code: string) => input.medicalServices.find(s => s.code === code)?.name || code
  const skeleton: any = {
    planVersion: input.rulesVersion || 'rules-1.0',
    customer: { salutation: input.salutation, ageBand: ageBand(input.age), elderMode: input.elderMode },
    riskLevel: input.riskLevel,
    packages: [],
    medical: [],
    coupon: { type: input.couponType || (input.age >= 50 ? 'BASIC_ELDER' : 'BASIC'), eligible: input.couponEligible },
    storeItems: [],
    removedItems: [],
    lifestyleCodes: [],
    followUps: [],
  }

  // 1. 红旗优先
  if (input.hasActiveRedFlag || ['L2', 'L3'].includes(input.riskLevel)) {
    const pk10 = input.packages.find(p => p.code === 'PK10')
    skeleton.packages.push({ code: 'PK10', name: pk10?.name || '就医优先计划', role: 'primary' })
    const seen = new Set<string>()
    for (const r of input.redHits) {
      for (const s of r.action?.services || []) {
        if (seen.has(s)) continue
        seen.add(s)
        skeleton.medical.push({ service: s, name: svcName(s), reasonCode: r.code, facts: {} })
      }
    }
    skeleton.coupon.eligible = false
    skeleton.followUps = [
      { when: input.riskLevel === 'L3' ? 'H1' : 'D1', action: input.riskLevel === 'L3' ? '1 小时内电话联系，协助就医' : '24 小时内协助预约合作医院' },
      { when: 'after_return', action: '医生确认后再安排门店项目' },
    ]
    skeleton.paused = true
    return skeleton
  }

  // 2. 选方案包
  const { primary, secondary } = selectPackages(input.packages.filter(p => p.code !== 'PK10'), facts)
  const chosen = [primary, secondary].filter(Boolean) as PackageLike[]
  chosen.forEach((p, i) => skeleton.packages.push({ code: p.code, name: p.name, role: i === 0 ? 'primary' : 'secondary', weeks: p.weeks ?? null }))

  // 3. 取项目 + 禁忌筛查；4. 医生建议限制标签同样走禁忌规则
  const tags = [...facts.tags, ...(input.doctorAdvice?.restrictions || [])]
  const seenP = new Set<string>()
  for (const p of chosen) {
    for (const item of p.items) {
      if (seenP.has(item.project)) continue
      seenP.add(item.project)
      const proj = input.projects.find(x => x.code === item.project)
      if (!proj) continue
      const { blocks, warns } = screenProject(proj, input.ciRules, tags)
      if (blocks.length) {
        skeleton.removedItems.push({ project: proj.code, name: proj.name, reason: blocks.map(b => `${b.tag} → ${b.code}`).join('; '), text: blocks[0].text })
        continue
      }
      if (skeleton.storeItems.length >= 4) continue
      skeleton.storeItems.push({ project: proj.code, name: proj.name, freq: item.freq, flags: warns.map(w => `warn:${w.tag}`), warnTexts: warns.map(w => w.text) })
    }
  }

  // 5. 就医建议：L1 风险信号对应的医疗服务（兴趣推荐只在开启个性化推荐时出现）
  const seen = new Set<string>()
  for (const r of input.riskHits) {
    if (r.action?.interest && !facts.personalization) continue
    for (const s of r.action?.services || []) {
      if (seen.has(s)) continue
      seen.add(s)
      const f: Record<string, any> = {}
      for (const k of r.action?.factKeys || []) if (facts.c[k] !== undefined) f[k] = facts.c[k]
      skeleton.medical.push({ service: s, name: svcName(s), reasonCode: r.code, reason: r.action?.reason, facts: f, interest: !!r.action?.interest })
    }
  }

  // 生活建议
  for (const tip of input.lifestyleTips) {
    if ((tip.tags || []).some(t => tags.includes(t)) && skeleton.lifestyleCodes.length < 4) skeleton.lifestyleCodes.push(tip.code)
  }
  if (!skeleton.lifestyleCodes.length) skeleton.lifestyleCodes.push('L_WALK', 'L_SLEEP_ROUTINE')

  // 跟进计划
  if (skeleton.medical.length) skeleton.followUps.push({ when: 'D1', action: `协助预约${skeleton.medical.map((m: any) => m.name.split(/[（/ ]/)[0]).slice(0, 2).join('与')}` })
  if (input.doctorAdvice?.recheckDate) skeleton.followUps.push({ when: input.doctorAdvice.recheckDate, action: '按医生意见复查' })
  else if (skeleton.medical.length) skeleton.followUps.push({ when: 'after_return', action: '按医生意见调整门店方案' })
  skeleton.followUps.push({ when: `W${primary?.weeks || 12}`, action: '复测六维与门店测量' })
  return skeleton
}

export function tagName(t: string) {
  return TAG_NAMES[t] || t
}

export { DIM_NAMES, DIMENSIONS }
