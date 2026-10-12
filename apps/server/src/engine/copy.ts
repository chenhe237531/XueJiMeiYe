/**
 * 方案模板文案（设计文档 10.3 "模板文案"）
 * 每个方案包、每类就医建议都有模板（标准版 / 乐龄版），AI 不可用或校验不通过时使用。
 */
import { LIFESTYLE_TIPS } from './rules-data'

const PROJECT_WHY: Record<string, [string, string]> = {
  P01: ['温和的面部护理，帮助肌肤保持水润和光泽。', '让脸上的皮肤更水润。'],
  P02: ['放松肩颈肌肉，缓解久坐和低头带来的紧绷。', '肩膀脖子松一松，舒服些。'],
  P03: ['腹部温养放松，经期前后让身体更舒适。', '肚子暖一暖，经期前后更舒服。'],
  P04: ['舒缓背部紧张，帮助放松。', '背部放松一下。'],
  P05: ['安静的环境加轻柔手法，帮助放松身心、准备入睡。', '帮您放松，晚上好入睡。'],
  P06: ['先评估体态，再用轻手法调理，帮助站得更舒展。', '先看看站姿，再轻轻调一调。'],
  P07: ['定期测体成分，看到身体的变化，配合运动管理体重。', '定期量一量，看看身体的变化。'],
  P08: ['小班课练负重与平衡，增强下肢力量，走路更稳。', '练练腿劲和平衡，走路更稳。'],
  P09: ['跟着老师练呼吸和放松，帮助缓解压力。', '跟老师练呼吸，心里更静。'],
  P10: ['产后形体护理，帮助身体逐步恢复。', '产后慢慢恢复身形。'],
  P11: ['温和汗蒸，帮助放松。', '暖暖身子，放松一下。'],
  P12: ['科技美肤护理，提升肌肤状态。', '让皮肤更有光泽。'],
  P13: ['腿部舒缓护理，缓解久站后的疲劳。', '腿脚松一松，不那么累。'],
}

const MEDICAL_WHY: Record<string, [string, string]> = {
  R01: ['周期不规律已超过 3 个月，请妇科医生看看原因更放心。', '月经不规律有段时间了，请医生看看。'],
  R02: ['痛经已经影响生活，请医生帮您找找原因。', '痛经比较明显，请医生看看。'],
  R03: ['潮热比较频繁，更年期门诊可以给您专业建议。', '潮热有点多，请医生给建议。'],
  R04: ['骨骼筛查指数偏低，做一次骨密度检查了解骨骼情况。', '查一查骨头结不结实。'],
  R05: ['跌倒风险或下肢力量偏弱，请康复科评估一下。', '请医生看看怎么走路更稳。'],
  R06: ['肌肉力量筛查提示需要关注，请医生评估。', '请医生看看肌肉力量。'],
  R07: ['睡眠困扰超过 3 个月，睡眠门诊可以帮您找原因。', '睡不好有一阵了，请医生看看。'],
  R08: ['最近情绪有些低落或紧张，和专业医生聊聊会有帮助。', '心情不太好，可以找医生聊聊。'],
  R09: ['酸痛已经超过 3 个月，请骨科或康复科医生看看。', '酸痛有段时间了，请医生看看。'],
  R10: ['门店测的血压偏高，建议到医院复测确认。', '血压有点高，去医院再量量。'],
  R11: ['体重或腰围偏高，做一次代谢检查了解身体情况。', '查一查血脂血糖。'],
  R12: ['乳腺或宫颈筛查已经到期，按时筛查更安心。', '该做乳腺和妇科检查了。'],
  R13: ['产后漏尿比较常见，产后康复门诊可以帮您评估。', '请产后康复医生看看。'],
  R14: ['您对医美感兴趣，可以预约集团医美面诊了解。', '想了解医美，可以先面诊。'],
  R15: ['血压不太稳定，请心血管医生帮您调整。', '血压不太稳，请医生看看。'],
}

const PKG_INTRO: Record<string, [string, string]> = {
  PK05: ['骨骼与防跌倒计划', '这 12 周，我们一起把腿劲练起来，走路更稳当。'],
  PK04: ['更年期管理计划', '这段时间身体在变化，我们陪您睡好、心情好。'],
  PK01: ['经期养护计划', '用 3 个月，帮您把经期前后照顾得更舒服。'],
  PK02: ['产后修复计划', '产后恢复要慢慢来，我们陪您一步一步走。'],
  PK03: ['睡眠与压力计划', '先把觉睡好，人就精神了。'],
  PK08: ['慢病生活管理计划', '按医生的方案用药，我们帮您把生活习惯养好。'],
  PK07: ['体重与代谢计划', '吃动平衡，慢慢调整，不着急。'],
  PK09: ['乐龄焕颜计划', '好气色是养出来的，我们定期帮您护理。'],
  PK06: ['六维年轻化计划', '按六维测评的结果，给您安排日常养护。'],
  PK10: ['就医优先计划', '身体最要紧，先去医院看一看，门店项目先暂停。'],
}

export function lifestyleText(code: string, elder: boolean) {
  const t = LIFESTYLE_TIPS.find(x => x.code === code)
  if (!t) return code
  return elder ? (t.textElder || t.text) : t.text
}

export function templateCopy(skeleton: any, opts: { selfReport?: string } = {}) {
  const elder = !!skeleton.customer?.elderMode
  const idx = elder ? 1 : 0
  const name = skeleton.customer?.salutation || '您'
  const primary = skeleton.packages?.[0]
  const intro = PKG_INTRO[primary?.code] || ['养护方案', '按测评结果为您安排。']
  const paused = !!skeleton.paused

  const medicalItems = (skeleton.medical || []).map((m: any) => ({
    service: m.service,
    name: m.name,
    why: paused
      ? (elder ? '先请医生看看，身体最要紧。' : '您在测评中提到的情况，需要先请医生评估。')
      : (MEDICAL_WHY[m.reasonCode]?.[idx] || '建议请医生评估一下。'),
  }))
  const storeItems = (skeleton.storeItems || []).map((s: any) => ({
    project: s.project,
    name: s.name,
    freq: s.freq,
    why: PROJECT_WHY[s.project]?.[idx] || '帮助您日常养护。',
  }))
  const lifestyle = (skeleton.lifestyleCodes || []).map((c: string) => lifestyleText(c, elder))

  const customer = {
    title: paused ? '先就医，再安排门店' : intro[0],
    summary: paused ? `${name}，您提到的情况需要先请医生看看，门店项目先暂停。` : `${name}，${intro[1]}`,
    medicalIntro: medicalItems.length
      ? (paused ? '为了您的安全，请先完成就医。顾问会协助您预约合作医院。' : '先做这些检查，医生的意见会帮我们把方案调得更合适。')
      : '',
    medicalItems,
    storeItems,
    lifestyle,
    closing: paused ? '顾问会尽快联系您，陪您一起安排。' : '有任何不舒服，随时告诉顾问。',
    wecomMessage: paused
      ? `${name}您好，看到您的测评里提到的情况，建议先到医院检查，我来帮您预约合作医院。门店项目我们先暂停，身体最要紧。`
      : `${name}您好，您的「${intro[0]}」已经整理好了：${medicalItems.length ? `建议先做${medicalItems.map((m: any) => m.name).join('、')}；` : ''}门店安排${storeItems.map((s: any) => s.name).join('、')}。您看哪天方便，我帮您约时间。`,
  }

  const advisor = {
    talkingPoints: paused
      ? ['先关心客户当前身体情况，确认是否需要立即就医', '说明门店项目暂停的原因：安全第一', '协助预约合作医院，确认陪同或接送需求', '就医后请客户告知结果，健康顾问会调整方案']
      : [
          `主方案：${primary?.name || ''}${skeleton.packages?.[1] ? `；辅助：${skeleton.packages[1].name}` : ''}`,
          medicalItems.length ? `就医建议放在最前：${medicalItems.map((m: any) => m.name).join('、')}` : '本次没有就医建议，可按方案安排',
          skeleton.coupon?.eligible ? '提醒客户到店领取免费体检券' : '体检券不适用或已领取',
          '先把情况弄清楚，再安排项目，不催促',
        ],
    script: paused
      ? `${name}您好，我是您的顾问。看到测评里您提到的情况，我很关心，想先了解一下您现在感觉怎么样？`
      : `${name}您好，您的六维测评结果出来了，我帮您整理了一份养护方案，想跟您简单说说，您现在方便吗？`,
    cautions: (skeleton.storeItems || []).filter((s: any) => s.flags?.length).map((s: any) => `${s.name}：${(s.warnTexts || []).join('；')}（操作前确认）`),
  }

  const doctor = medicalItems.length
    ? `客户${name}，年龄段 ${skeleton.customer?.ageBand}。风险等级 ${skeleton.riskLevel}。转介原因：${(skeleton.medical || []).map((m: any) => `${m.name}（${m.reason || m.reasonCode}${m.facts && Object.keys(m.facts).length ? `，${Object.entries(m.facts).map(([k, v]) => `${k.toUpperCase()} ${v}`).join('，')}` : ''}）`).join('；')}。${opts.selfReport ? `客户自述：${opts.selfReport}` : ''}`
    : ''

  return { customer, advisor, doctor }
}
