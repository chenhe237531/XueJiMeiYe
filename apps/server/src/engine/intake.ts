/**
 * 门店《健康档案表（女）》数字化
 * 字段与门店现有纸质表一致；姓名、电话取自客户资料，住址按数据最小化原则（1.5）不再收集。
 * 录入结果映射为健康标签（来源 staff），参与禁忌筛查与方案引擎；完整内容仅健康顾问可见。
 */
export interface IntakeField {
  key: string
  label: string
  type: 'number' | 'select' | 'multi' | 'text' | 'textarea'
  options?: string[]
  unit?: string
  sensitive?: boolean
}

export interface IntakeGroup {
  title: string
  fields: IntakeField[]
}

export const INTAKE_FORM: IntakeGroup[] = [
  {
    title: '基本情况',
    fields: [
      { key: 'height', label: '身高', type: 'number', unit: 'cm' },
      { key: 'weight', label: '体重', type: 'number', unit: 'kg' },
      { key: 'births', label: '生育', type: 'select', options: ['未育', '1 胎', '2 胎及以上', '不便填写'], sensitive: true },
      { key: 'bp', label: '血压', type: 'select', options: ['正常', '偏高', '偏低', '不清楚'] },
      { key: 'bpValue', label: '血压数值（如有）', type: 'text', unit: 'mmHg' },
      { key: 'lipid', label: '血脂', type: 'select', options: ['正常', '偏高', '不清楚'] },
      { key: 'glucose', label: '血糖', type: 'select', options: ['正常', '偏高', '不清楚'] },
      { key: 'allergy', label: '过敏史', type: 'multi', options: ['无', '护肤品 / 化妆品', '药物', '食物', '花粉 / 其他'] },
      { key: 'allergyNote', label: '过敏说明', type: 'text' },
    ],
  },
  {
    title: '皮肤、头发、指甲、眼睛',
    fields: [
      { key: 'skin', label: '皮肤', type: 'multi', options: ['正常', '干燥', '油腻', '敏感泛红', '长痘', '色斑', '暗沉'] },
      { key: 'hair', label: '头发', type: 'multi', options: ['正常', '干枯', '易掉发', '头皮油', '白发多'] },
      { key: 'nails', label: '指甲', type: 'multi', options: ['正常', '易断', '有竖纹', '颜色异常'] },
      { key: 'eyes', label: '眼睛有无不适', type: 'multi', options: ['无', '干涩', '易疲劳', '视物模糊'] },
    ],
  },
  {
    title: '二便与口干',
    fields: [
      { key: 'stoolDaily', label: '能否保证每天排便', type: 'select', options: ['能', '不能'] },
      { key: 'stoolSticky', label: '粘便池', type: 'select', options: ['否', '是'] },
      { key: 'constipation', label: '便秘', type: 'select', options: ['否', '偶尔', '经常'] },
      { key: 'dryMouth', label: '晨起口干', type: 'select', options: ['否', '是'] },
      { key: 'urineYellow', label: '晨起小便黄', type: 'select', options: ['否', '是'] },
      { key: 'urineOdor', label: '小便有气味', type: 'select', options: ['否', '是'] },
      { key: 'urineFoam', label: '小便有泡沫', type: 'select', options: ['否', '是'] },
      { key: 'urineCloudy', label: '小便浑浊', type: 'select', options: ['否', '是'] },
    ],
  },
  {
    title: '女性健康',
    fields: [
      { key: 'thyroid', label: '甲状腺情况', type: 'select', options: ['正常', '结节', '功能异常（甲亢 / 甲减）', '不清楚'], sensitive: true },
      { key: 'leucorrhea', label: '白带情况', type: 'select', options: ['正常', '偏多', '异味或颜色异常', '不便填写'], sensitive: true },
      { key: 'fibroid', label: '是否有子宫肌瘤', type: 'select', options: ['否', '是', '不清楚'], sensitive: true },
      { key: 'hyperplasia', label: '是否有增生（如乳腺增生）', type: 'select', options: ['否', '是', '不清楚'], sensitive: true },
      { key: 'menstruation', label: '月经情况', type: 'multi', options: ['规律', '不规律', '痛经', '量多', '量少', '已绝经'], sensitive: true },
    ],
  },
  {
    title: '睡眠、不适与病史',
    fields: [
      { key: 'sleep', label: '睡眠情况', type: 'multi', options: ['好', '入睡难', '易醒', '多梦', '早醒'] },
      { key: 'discomfort', label: '身体出现的不适（近 1 周）', type: 'textarea' },
      { key: 'surgery', label: '手术情况', type: 'select', options: ['无', '近 3 个月内有', '3 个月以前有'] },
      { key: 'surgeryNote', label: '手术种类', type: 'text' },
      { key: 'chronic', label: '健康记录（慢病史）', type: 'multi', options: ['无', '高血压', '糖尿病', '高血脂', '心脏病', '骨质疏松', '甲状腺疾病'] },
      { key: 'chronicNote', label: '慢病补充说明', type: 'text' },
    ],
  },
]

/** 需要健康顾问尽快评估的不适关键词（与魔镜急症词表一致的子集） */
const URGENT_WORDS = ['胸痛', '胸闷', '喘不上气', '呼吸困难', '晕倒', '昏厥', '半边没力', '嘴歪', '说话不清', '大量出血', '剧烈腹痛', '想死', '不想活']

const has = (v: any, opt: string) => (Array.isArray(v) ? v.includes(opt) : v === opt)

/** 表单 → 健康标签（来源 staff）与需要关注的事项 */
export function mapIntake(d: Record<string, any>) {
  const tags = new Set<string>()
  const notes: string[] = []
  const chronic = d.chronic || []
  if (has(chronic, '高血压')) tags.add('dx_hypertension')
  if (has(chronic, '糖尿病')) tags.add('dx_diabetes')
  if (has(chronic, '高血脂')) tags.add('dx_lipid')
  if (has(chronic, '心脏病')) tags.add('dx_heart')
  if (has(chronic, '骨质疏松')) tags.add('dx_osteoporosis')
  if (has(chronic, '甲状腺疾病') || d.thyroid === '功能异常（甲亢 / 甲减）') tags.add('dx_thyroid')
  if (d.bp === '偏高' && !has(chronic, '高血压')) {
    tags.add('bp_high_self')
    notes.push('自述血压偏高，热疗类项目前先测血压')
  }
  if (d.bp === '不清楚' && !has(chronic, '高血压')) tags.add('htn_unknown')
  const allergy = d.allergy || []
  if (has(allergy, '护肤品 / 化妆品')) tags.add('cosmetic_allergy')
  if (['药物', '食物', '花粉 / 其他'].some(x => has(allergy, x))) tags.add('allergy_history')
  const skin = d.skin || []
  if (has(skin, '敏感泛红')) tags.add('skin_sensitive')
  if (has(skin, '长痘')) tags.add('skin_acne')
  if (has(skin, '色斑')) tags.add('skin_spots')
  if (has(skin, '暗沉')) tags.add('skin_dull')
  if (has(skin, '干燥')) tags.add('skin_dry')
  if (d.fibroid === '是' || d.hyperplasia === '是') {
    tags.add('gyn_condition')
    notes.push('有子宫肌瘤或增生史，建议按时做妇科与乳腺检查')
  }
  if (d.surgery === '近 3 个月内有') tags.add('recent_surgery')
  else if (d.surgery === '3 个月以前有') tags.add('surgery_history')
  const mens = d.menstruation || []
  if (has(mens, '不规律')) tags.add('menstrual_irregular')
  if (has(mens, '痛经')) tags.add('dysmenorrhea')
  const sleep = d.sleep || []
  if (['入睡难', '易醒', '早醒'].some(x => has(sleep, x))) tags.add('sleep_issue')
  if (d.constipation === '经常') tags.add('constipation')
  const discomfort = `${d.discomfort || ''}`
  const urgent = URGENT_WORDS.filter(w => discomfort.includes(w))
  if (urgent.length) notes.push(`近 1 周不适含"${urgent.join('、')}"，需健康顾问尽快评估`)
  return { tags: [...tags], notes, urgent }
}
