/**
 * 测评题库 v1（设计文档附录 C）
 * - options[].score：0–4 分，越高越好；null 表示不计分
 * - options[].tags：选中后产生的健康标签
 * - options[].sarc / phq / gad：量表计分
 * - config.scoring：特殊计分方式（multiCount / bmi / waist / chairStand / balance）
 * - showIf：JSON Logic，事实对象为 { age, gender, a: {题目编码: 答案值} }
 */
export interface QOption {
  label: string
  /** 选项补充说明（无配图时帮助判断，如站姿、肤质） */
  desc?: string
  value: string
  score?: number | null
  tags?: string[]
  exclusive?: boolean
  sarc?: number
  phq?: number
  gad?: number
}

export interface QDef {
  code: string
  level: string
  type: 'single' | 'multi' | 'slider' | 'number' | 'image_choice' | 'counter' | 'timer'
  title: string
  voiceText?: string
  intro?: string
  options?: QOption[]
  config?: Record<string, any>
  showIf?: any
  required?: boolean
  sensitive?: boolean
}

export const LEVELS = [
  { code: 'safety', name: '健康安全关', short: '安全', scored: false, desc: '必答，保障门店项目安全' },
  { code: 'skin', name: '肌肤', short: '肌肤', scored: true, desc: '皮肤状态与护理习惯' },
  { code: 'shape', name: '体型', short: '体型', scored: true, desc: '身高体重、腰围与变化' },
  { code: 'contour', name: '轮廓', short: '轮廓', scored: true, desc: '面部轮廓与变化' },
  { code: 'fitness', name: '体能', short: '体能', scored: true, desc: '运动、坐站与平衡小测' },
  { code: 'posture', name: '体态', short: '体态', scored: true, desc: '站姿、酸痛与跌倒' },
  { code: 'mind', name: '心灵', short: '心灵', scored: true, desc: '睡眠与情绪' },
  { code: 'women', name: '女性健康进阶关', short: '进阶', scored: false, desc: '涉及隐私，每题可跳过' },
]

export const DIMENSIONS = ['skin', 'shape', 'contour', 'fitness', 'posture', 'mind']
export const DIM_NAMES: Record<string, string> = {
  skin: '肌肤', shape: '体型', contour: '轮廓', fitness: '体能', posture: '体态', mind: '心灵',
}

const has = (code: string, v: string) => ({ in: [v, { var: `a.${code}` }] })
const eq = (code: string, v: string) => ({ '==': [{ var: `a.${code}` }, v] })
const inList = (code: string, vs: string[]) => ({ in: [{ var: `a.${code}` }, vs] })
const ageGte = (n: number) => ({ '>=': [{ var: 'age' }, n] })
const ageLt = (n: number) => ({ '<': [{ var: 'age' }, n] })
const hasPeriod = inList('W01', ['regular', 'irregular', 'peri'])

const freq4 = (prefix: 'phq' | 'gad') => [
  { label: '完全没有', value: '0', score: 4, [prefix]: 0 },
  { label: '有几天', value: '1', score: 3, [prefix]: 1 },
  { label: '一半以上的天数', value: '2', score: 1, [prefix]: 2 },
  { label: '几乎每天', value: '3', score: 0, [prefix]: 3 },
] as QOption[]

const sarcOpts = (hard: string) => [
  { label: '没有困难', value: 'none', score: 4, sarc: 0 },
  { label: '有些困难', value: 'some', score: 2, sarc: 1 },
  { label: hard, value: 'hard', score: 0, sarc: 2 },
] as QOption[]

export const QUESTIONS: QDef[] = [
  // ── C.2 健康安全关（必答）
  {
    code: 'H01', level: 'safety', type: 'multi', required: true,
    title: '已经确诊的慢性病有哪些？',
    voiceText: '您有没有医生确诊过的慢性病？可以选多个。',
    options: [
      { label: '高血压', value: 'htn', tags: ['dx_hypertension'] },
      { label: '糖尿病', value: 'diabetes', tags: ['dx_diabetes'] },
      { label: '高血脂', value: 'lipid', tags: ['dx_lipid'] },
      { label: '心脏病', value: 'heart', tags: ['dx_heart'] },
      { label: '骨质疏松', value: 'osteoporosis', tags: ['dx_osteoporosis'] },
      { label: '甲状腺疾病', value: 'thyroid', tags: ['dx_thyroid'] },
      { label: '都没有', value: 'none', exclusive: true },
    ],
  },
  {
    code: 'H02', level: 'safety', type: 'single', required: true,
    title: '血压控制得怎么样？',
    showIf: has('H01', 'htn'),
    options: [
      { label: '医生说控制得好', value: 'good' },
      { label: '不太稳定', value: 'unstable', tags: ['htn_uncontrolled'] },
      { label: '不清楚', value: 'unknown', tags: ['htn_unknown'] },
    ],
  },
  {
    code: 'H03', level: 'safety', type: 'multi', required: true,
    title: '以下情况有没有？',
    intro: '和门店项目安全有关，请如实选择。',
    options: [
      { label: '心脏起搏器或体内有金属植入', value: 'pacemaker', tags: ['pacemaker_implant'] },
      { label: '正在吃抗凝药（如华法林、阿司匹林）', value: 'anticoagulant', tags: ['anticoagulant'] },
      { label: '近 3 个月做过手术', value: 'surgery', tags: ['recent_surgery'] },
      { label: '静脉曲张或得过血栓', value: 'varicose', tags: ['varicose_thrombosis'] },
      { label: '手脚皮肤感觉变迟钝', value: 'sensory', tags: ['sensory_reduced'] },
      { label: '对某些护肤品过敏', value: 'allergy', tags: ['cosmetic_allergy'] },
      { label: '都没有', value: 'none', exclusive: true },
    ],
  },
  {
    code: 'H04', level: 'safety', type: 'single', required: true,
    title: '最近有没有出现胸痛、胸闷、喘不上气？',
    options: [{ label: '没有', value: 'no' }, { label: '有', value: 'yes' }],
  },
  {
    code: 'H05', level: 'safety', type: 'single', required: true,
    title: '最近有没有突然一侧手脚没力、嘴歪、说话不清？',
    options: [{ label: '没有', value: 'no' }, { label: '有', value: 'yes' }],
  },
  {
    code: 'H06', level: 'safety', type: 'single', required: true,
    title: '最近一个月有没有晕倒过？',
    options: [{ label: '没有', value: 'no' }, { label: '有', value: 'yes' }],
  },

  // ── C.3 肌肤
  {
    code: 'S01', level: 'skin', type: 'image_choice',
    title: '您觉得自己的皮肤更接近哪种？',
    options: [
      { label: '干性', desc: '洗脸后发紧，容易起皮', value: 'dry', score: null, tags: ['skin_type_dry'] },
      { label: '油性', desc: '全脸容易出油，毛孔明显', value: 'oily', score: null, tags: ['skin_type_oily'] },
      { label: '混合', desc: '额头鼻子油，两颊偏干', value: 'combo', score: null, tags: ['skin_type_combo'] },
      { label: '敏感', desc: '容易泛红、发痒或刺痛', value: 'sensitive', score: null, tags: ['skin_type_sensitive'] },
      { label: '说不清', value: 'unsure', score: null },
    ],
  },
  {
    code: 'S02', level: 'skin', type: 'multi',
    title: '最困扰您的皮肤问题？',
    intro: '挑最在意的就好',
    config: { max: 3, scoring: 'multiCount', map: { 0: 4, 1: 3, 2: 2, 3: 1 } },
    options: [
      { label: '皱纹细纹', value: 'wrinkle', tags: ['skin_aging'] }, { label: '松弛', value: 'sagging', tags: ['skin_aging'] },
      { label: '色斑', value: 'spots', tags: ['skin_spots'] }, { label: '暗沉', value: 'dull', tags: ['skin_dull'] },
      { label: '毛孔粗大', value: 'pores', tags: ['skin_pores'] }, { label: '干燥', value: 'dry', tags: ['skin_dry'] },
      { label: '敏感泛红', value: 'red', tags: ['skin_sensitive'] }, { label: '痘痘', value: 'acne', tags: ['skin_acne'] },
      { label: '没有特别困扰', value: 'none', exclusive: true },
    ],
  },
  {
    code: 'S03', level: 'skin', type: 'single', title: '您每天防晒吗？',
    options: [
      { label: '每天', value: 'daily', score: 4 },
      { label: '偶尔', value: 'sometimes', score: 2 },
      { label: '从不', value: 'never', score: 0 },
    ],
  },
  {
    code: 'S04', level: 'skin', type: 'single', title: '晚上的护肤步骤？',
    options: [
      { label: '清洁加保湿', value: 'full', score: 4 },
      { label: '只清洁', value: 'clean', score: 2 },
      { label: '基本不护肤', value: 'none', score: 0 },
    ],
  },

  // ── C.4 体型
  {
    code: 'B01', level: 'shape', type: 'slider', required: true, title: '您的身高？',
    config: { min: 140, max: 185, step: 1, unit: '厘米', default: 158 },
  },
  {
    code: 'B02', level: 'shape', type: 'slider', required: true, title: '您的体重？',
    config: { min: 35, max: 100, step: 1, unit: '公斤', default: 56, scoring: 'bmi' },
  },
  {
    code: 'B03', level: 'shape', type: 'number', title: '您的腰围？',
    intro: '不知道可以跳过，到店帮您量',
    config: { min: 50, max: 140, unit: '厘米', scoring: 'waist' },
  },
  {
    code: 'B04', level: 'shape', type: 'single', title: '近半年体重有变化吗？',
    options: [
      { label: '基本不变', value: 'same', score: 4 },
      { label: '增加 3 公斤以上', value: 'gain', score: 1 },
      { label: '有意减重，减了 3 公斤以上', value: 'intentional', score: 3 },
      { label: '没有刻意减，却瘦了 3 公斤以上', value: 'unintended', score: 0 },
    ],
  },

  // ── C.5 轮廓
  {
    code: 'C01', level: 'contour', type: 'multi', title: '脸上最在意哪些地方？',
    config: { scoring: 'multiCount', map: { 0: 4, 1: 3, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1 } },
    options: [
      { label: '额头', value: 'forehead' }, { label: '眼周', value: 'eyes' },
      { label: '苹果肌', value: 'apple' }, { label: '法令纹', value: 'nasolabial' },
      { label: '下颌线', value: 'jaw' }, { label: '颈部', value: 'neck' },
      { label: '都还好', value: 'none', exclusive: true },
    ],
  },
  {
    code: 'C02', level: 'contour', type: 'single', title: '和三年前比，脸部有什么变化？',
    options: [
      { label: '差不多', value: 'same', score: 4 },
      { label: '有一点松', value: 'bit', score: 2 },
      { label: '明显松了', value: 'obvious', score: 0 },
    ],
  },
  {
    code: 'C03', level: 'contour', type: 'single', title: '有没有了解过医美项目（如注射、光电）？',
    options: [
      { label: '没兴趣', value: 'no', score: null },
      { label: '想了解一下', value: 'curious', score: null, tags: ['interest_aesthetics'] },
      { label: '做过', value: 'done', score: null },
    ],
  },

  // ── C.6 体能
  {
    code: 'F01', level: 'fitness', type: 'single', title: '每周有几天运动 30 分钟以上？',
    intro: '快走、跳舞都算',
    options: [
      { label: '0 天', value: '0', score: 0 }, { label: '1-2 天', value: '1_2', score: 1 },
      { label: '3-4 天', value: '3_4', score: 3 }, { label: '5 天以上', value: '5plus', score: 4 },
    ],
  },
  {
    code: 'F02', level: 'fitness', type: 'counter', title: '30 秒坐站小测',
    intro: '请在有人陪同、身边有稳固椅子时进行。可以跳过，到店再测。',
    config: { seconds: 30, scoring: 'chairStand', page: 'test-chair' },
  },
  {
    code: 'F03', level: 'fitness', type: 'timer', title: '单腿站立（睁眼，最长 30 秒）',
    intro: '扶好椅背，有人陪同。可以跳过，到店再测。',
    config: { max: 30, scoring: 'balance', page: 'test-balance' },
  },
  {
    code: 'F04', level: 'fitness', type: 'single', title: '爬一层楼梯感觉怎么样？', showIf: ageLt(50),
    options: [
      { label: '轻松', value: 'easy', score: 4 },
      { label: '有点累', value: 'tired', score: 2 },
      { label: '要扶或歇一下', value: 'rest', score: 0 },
    ],
  },
  { code: 'F05', level: 'fitness', type: 'single', title: '提起或搬运 4.5 公斤（约一袋米）有多困难？', showIf: ageGte(50), options: sarcOpts('很困难或做不到') },
  { code: 'F06', level: 'fitness', type: 'single', title: '走过一个房间有多困难？', showIf: ageGte(50), options: sarcOpts('很困难、需要辅助或做不到') },
  { code: 'F07', level: 'fitness', type: 'single', title: '从床或椅子上站起来有多困难？', showIf: ageGte(50), options: sarcOpts('很困难或需要别人帮忙') },
  { code: 'F08', level: 'fitness', type: 'single', title: '爬 10 级台阶有多困难？', showIf: ageGte(50), options: sarcOpts('很困难或做不到') },
  {
    code: 'F09', level: 'fitness', type: 'single', title: '过去一年跌倒过几次？', showIf: ageGte(50),
    options: [
      { label: '没有', value: 'none', score: 4, sarc: 0 },
      { label: '1-3 次', value: 'few', score: 2, sarc: 1 },
      { label: '4 次以上', value: 'many', score: 0, sarc: 2 },
    ],
  },

  // ── C.7 体态
  {
    code: 'P01', level: 'posture', type: 'image_choice', title: '哪种最像您平时的站姿？',
    options: [
      { label: '挺直', desc: '侧面看耳朵、肩膀、胯大致在一条线上', value: 'straight', score: 4 },
      { label: '头往前伸', desc: '侧面看耳朵在肩膀前面', value: 'forward_head', score: 2 },
      { label: '圆肩驼背', desc: '肩膀往前收，后背拱起', value: 'round', score: 2 },
      { label: '腰往前挺', desc: '小肚子往前顶，腰往里凹得明显', value: 'sway', score: 2 },
      { label: '说不清', value: 'unsure', score: null },
    ],
  },
  {
    code: 'P02', level: 'posture', type: 'multi', title: '经常酸痛的部位？',
    config: { scoring: 'multiCount', map: { 0: 4, 1: 3, 2: 2, 3: 1, 4: 1 } },
    options: [
      { label: '肩颈', value: 'neck' }, { label: '腰', value: 'waist' },
      { label: '背', value: 'back' }, { label: '膝盖', value: 'knee' },
      { label: '没有', value: 'none', exclusive: true },
    ],
  },
  {
    code: 'P03', level: 'posture', type: 'single', title: '酸痛有多久了？',
    showIf: { and: [{ '!!': { var: 'a.P02' } }, { '!': has('P02', 'none') }] },
    options: [
      { label: '不到 1 个月', value: 'lt1', score: 3 },
      { label: '1-3 个月', value: 'm1_3', score: 2 },
      { label: '超过 3 个月', value: 'gt3', score: 0 },
    ],
  },
  {
    code: 'P04', level: 'posture', type: 'single', title: '过去一年里，您跌倒过吗？',
    showIf: { and: [ageGte(60), { '!': { var: 'a.F09' } }] },
    options: [{ label: '没有', value: 'no', score: 4 }, { label: '有', value: 'yes', score: 0 }],
  },
  {
    code: 'P05', level: 'posture', type: 'single', title: '站着或走路时，会觉得不稳吗？', showIf: ageGte(60),
    options: [{ label: '不会', value: 'no', score: 4 }, { label: '会', value: 'yes', score: 0 }],
  },
  {
    code: 'P06', level: 'posture', type: 'single', title: '您担心自己会跌倒吗？', showIf: ageGte(60),
    options: [{ label: '不担心', value: 'no', score: 4 }, { label: '担心', value: 'yes', score: 0 }],
  },

  // ── C.8 心灵
  {
    code: 'M01', level: 'mind', type: 'single', title: '平时每晚睡几个小时？',
    options: [
      { label: '不到 5 小时', value: 'lt5', score: 0 }, { label: '5-6 小时', value: '5_6', score: 1 },
      { label: '6-7 小时', value: '6_7', score: 3 }, { label: '7-8 小时', value: '7_8', score: 4 },
      { label: '8 小时以上', value: 'gt8', score: 3 },
    ],
  },
  {
    code: 'M02', level: 'mind', type: 'single', title: '入睡困难或夜里醒了睡不着，一周几次？',
    options: [
      { label: '几乎没有', value: 'rare', score: 4 },
      { label: '1-2 次', value: '1_2', score: 2 },
      { label: '3 次以上', value: '3plus', score: 0 },
    ],
  },
  {
    code: 'M03', level: 'mind', type: 'single', title: '这种情况有多久了？',
    showIf: { and: [{ '!!': { var: 'a.M02' } }, { '!=': [{ var: 'a.M02' }, 'rare'] }] },
    options: [
      { label: '不到 1 个月', value: 'lt1', score: null },
      { label: '1-3 个月', value: 'm1_3', score: null },
      { label: '超过 3 个月', value: 'gt3', score: null },
    ],
  },
  { code: 'M04', level: 'mind', type: 'single', title: '过去两周，做事提不起劲或没有兴趣？', options: freq4('phq') },
  { code: 'M05', level: 'mind', type: 'single', title: '过去两周，感到心情低落、沮丧或没有希望？', options: freq4('phq') },
  { code: 'M06', level: 'mind', type: 'single', title: '过去两周，感到紧张、焦虑或烦躁？', options: freq4('gad') },
  { code: 'M07', level: 'mind', type: 'single', title: '过去两周，没办法停止或控制担忧？', options: freq4('gad') },
  {
    code: 'M08', level: 'mind', type: 'single', title: '最近两周，有没有出现过伤害自己的念头？',
    intro: '这个问题是为了在需要时及时帮到您。',
    showIf: { '>=': [{ var: 'c.phq2' }, 3] },
    sensitive: true,
    options: [{ label: '没有', value: 'no', score: null }, { label: '有过', value: 'yes', score: null }],
  },
  {
    code: 'M09', level: 'mind', type: 'single', title: '平时会觉得孤单吗？',
    options: [
      { label: '很少', value: 'rarely', score: 4 },
      { label: '有时', value: 'sometimes', score: 2 },
      { label: '经常', value: 'often', score: 0, tags: ['lonely'] },
    ],
  },

  // ── C.9 女性健康进阶关（女性显示，每题可跳过）
  {
    code: 'W01', level: 'women', type: 'single', title: '您目前的状态？', sensitive: true,
    options: [
      { label: '有月经，比较规律', value: 'regular' },
      { label: '有月经，不太规律', value: 'irregular' },
      { label: '月经开始变乱，可能进入更年期', value: 'peri' },
      { label: '已经绝经（停经满一年）', value: 'meno' },
      { label: '产后一年内', value: 'postpartum' },
      { label: '正在怀孕或备孕', value: 'pregnant', tags: ['pregnancy_related'] },
    ],
  },
  {
    code: 'W02', level: 'women', type: 'single', title: '月经周期大概多少天？', sensitive: true,
    showIf: inList('W01', ['regular', 'irregular']),
    options: [
      { label: '21-35 天', value: '21_35' }, { label: '经常少于 21 天', value: 'lt21' },
      { label: '经常超过 35 天', value: 'gt35' }, { label: '很乱，说不准', value: 'chaotic' },
    ],
  },
  {
    code: 'W03', level: 'women', type: 'single', title: '不规律有多久了？', sensitive: true,
    showIf: inList('W02', ['lt21', 'gt35', 'chaotic']),
    options: [
      { label: '不到 3 个月', value: 'lt3' }, { label: '3-6 个月', value: 'm3_6' }, { label: '超过 6 个月', value: 'gt6' },
    ],
  },
  {
    code: 'W04', level: 'women', type: 'single', title: '痛经程度？', sensitive: true, showIf: hasPeriod,
    options: [
      { label: '不痛', value: 'none' }, { label: '轻微', value: 'mild' },
      { label: '影响工作或生活', value: 'affect' }, { label: '吃止痛药也缓解不了', value: 'severe' },
    ],
  },
  {
    code: 'W05', level: 'women', type: 'single', title: '经量怎么样？', sensitive: true, showIf: hasPeriod,
    options: [
      { label: '正常', value: 'normal' }, { label: '偏少', value: 'less' },
      { label: '明显变多（1-2 小时就要换）', value: 'heavy' },
    ],
  },
  {
    code: 'W06', level: 'women', type: 'single', title: '有没有头晕、乏力、心慌？', sensitive: true,
    showIf: eq('W05', 'heavy'),
    options: [{ label: '没有', value: 'no' }, { label: '有', value: 'yes' }],
  },
  {
    code: 'W07', level: 'women', type: 'single', title: '有没有非经期出血，或同房后出血？', sensitive: true, showIf: hasPeriod,
    options: [{ label: '没有', value: 'no' }, { label: '有', value: 'yes' }],
  },
  {
    code: 'W08', level: 'women', type: 'single', title: '这次月经推迟了吗？有没有怀孕的可能？', sensitive: true,
    showIf: inList('W01', ['regular', 'irregular']),
    options: [
      { label: '没有推迟', value: 'no' }, { label: '推迟了，不可能怀孕', value: 'late_no' },
      { label: '推迟了，有可能怀孕', value: 'late_maybe', tags: ['pregnancy_related'] },
    ],
  },
  {
    code: 'W09', level: 'women', type: 'single', title: '停经多久了？', sensitive: true, showIf: eq('W01', 'meno'),
    options: [{ label: '1-5 年', value: '1_5' }, { label: '5-10 年', value: '5_10' }, { label: '10 年以上', value: 'gt10' }],
  },
  {
    code: 'W10', level: 'women', type: 'single', title: '有没有潮热、出汗？', sensitive: true,
    showIf: inList('W01', ['peri', 'meno']),
    options: [
      { label: '没有', value: 'no' }, { label: '偶尔', value: 'sometimes' },
      { label: '每天都有', value: 'daily' }, { label: '已经影响睡眠', value: 'sleep' },
    ],
  },
  {
    code: 'W11', level: 'women', type: 'single', title: '停经满一年后，有没有再出过血？', sensitive: true, showIf: eq('W01', 'meno'),
    options: [{ label: '没有', value: 'no' }, { label: '有', value: 'yes' }],
  },
  {
    code: 'W12', level: 'women', type: 'single', title: '产后多久了？', sensitive: true, showIf: eq('W01', 'postpartum'),
    options: [
      { label: '不到 42 天', value: 'lt42', tags: ['postpartum_42d'] },
      { label: '42 天到 6 个月', value: 'd42_6m', tags: ['postpartum'] },
      { label: '6 个月到 1 年', value: 'm6_12', tags: ['postpartum'] },
    ],
  },
  {
    code: 'W13', level: 'women', type: 'single', title: '咳嗽、打喷嚏时会漏尿吗？', sensitive: true, showIf: eq('W01', 'postpartum'),
    options: [{ label: '没有', value: 'no' }, { label: '偶尔', value: 'sometimes' }, { label: '经常', value: 'often' }],
  },
  {
    code: 'W14', level: 'women', type: 'single', title: '上一次做乳腺检查是什么时候？', sensitive: true,
    options: [{ label: '1 年内', value: 'lt1' }, { label: '1-3 年', value: 'y1_3' }, { label: '3 年以上', value: 'gt3' }, { label: '从来没做过', value: 'never' }],
  },
  {
    code: 'W15', level: 'women', type: 'single', title: '上一次做宫颈癌筛查是什么时候？', sensitive: true,
    options: [{ label: '3 年内', value: 'lt3' }, { label: '3-5 年', value: 'y3_5' }, { label: '5 年以上', value: 'gt5' }, { label: '从来没做过', value: 'never' }],
  },
  {
    code: 'W16', level: 'women', type: 'single', title: '上一次全面体检是什么时候？', sensitive: true,
    options: [{ label: '1 年内', value: 'lt1' }, { label: '1-2 年', value: 'y1_2' }, { label: '2 年以上', value: 'gt2' }, { label: '从来没做过', value: 'never' }],
  },
  {
    code: 'W17', level: 'women', type: 'single', title: '有没有摸到乳房肿块，或乳头有异常液体流出？', sensitive: true,
    options: [{ label: '没有', value: 'no' }, { label: '有', value: 'yes' }],
  },
  {
    code: 'W18', level: 'women', type: 'single', title: '最近有没有剧烈的、或越来越重的肚子痛？', sensitive: true,
    options: [{ label: '没有', value: 'no' }, { label: '有', value: 'yes' }],
  },
  {
    code: 'W22', level: 'women', type: 'multi', title: '母亲或姐妹中，有没有人得过以下疾病？', sensitive: true,
    options: [
      { label: '乳腺癌', value: 'breast', tags: ['fh_breast_ovary'] },
      { label: '卵巢癌', value: 'ovary', tags: ['fh_breast_ovary'] },
      { label: '髋部骨折', value: 'hip', tags: ['fh_hip_fracture'] },
      { label: '都没有', value: 'none', exclusive: true },
    ],
  },
]

/** 30 秒坐站测试参考值（女性，低于此值为偏低），附录 C.6；50–59 岁暂按 60–64 岁标准 */
export function chairStandRef(age: number) {
  if (age < 65) return 12
  if (age < 70) return 11
  if (age < 80) return 10
  if (age < 85) return 9
  if (age < 90) return 8
  return 4
}
