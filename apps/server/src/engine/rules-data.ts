/**
 * 规则初稿数据（设计文档附录 A、B、D、E、F、I）
 * 条件统一用 JSON Logic 表达，事实对象见 engine/index.ts buildFacts()。
 * 所有阈值上线前需【医生确认】，在后台"方案引擎"中维护。
 */
const a = (code: string) => ({ var: `a.${code}` })
const eq = (code: string, v: string) => ({ '==': [a(code), v] })
const inL = (code: string, vs: string[]) => ({ in: [a(code), vs] })
const has = (code: string, v: string) => ({ in: [v, a(code)] })
const tag = (t: string) => ({ in: [t, { var: 'tags' }] })
const anyTag = (ts: string[]) => ({ or: ts.map(tag) })
const age = (op: string, n: number) => ({ [op]: [{ var: 'age' }, n] })

// ───────── 附录 A：红旗症状 ─────────
export const RED_FLAGS = [
  { code: 'RF01', level: 'L3', source: 'W05 + W06', conditionText: '经量明显增多（1-2 小时就要更换），并伴头晕、乏力或心慌', condition: { and: [eq('W05', 'heavy'), eq('W06', 'yes')] }, services: ['M1', 'M10'], customerText: '您提到的情况需要尽快就医。如果出血量很大或头晕加重，请马上拨打 120。', staffAction: '1 小时内电话；协助当日就诊' },
  { code: 'RF02', level: 'L2', source: 'W05 + W06', conditionText: '经量明显增多，无头晕乏力', condition: { and: [eq('W05', 'heavy'), eq('W06', 'no')] }, services: ['M1'], customerText: '建议尽快到妇科看一下。', staffAction: '协助预约妇科' },
  { code: 'RF03', level: 'L2', source: 'W07', conditionText: '非经期出血或同房后出血', condition: eq('W07', 'yes'), services: ['M1'], customerText: '需要妇科检查，明确原因。', staffAction: '协助预约' },
  { code: 'RF04', level: 'L2', source: 'W11', conditionText: '绝经一年以上再次出血', condition: eq('W11', 'yes'), services: ['M1'], customerText: '需要尽快到妇科看一下。', staffAction: '协助预约' },
  { code: 'RF05', level: 'L2', source: 'W08', conditionText: '月经推迟且有怀孕可能', condition: eq('W08', 'late_maybe'), services: ['M1'], tags: ['pregnancy_related'], customerText: '先确认是否怀孕；怀孕期间很多门店项目不适合做。', staffAction: '协助预约；生成 pregnancy_related 标签' },
  { code: 'RF06', level: 'L3', source: 'W18', conditionText: '剧烈或越来越重的腹痛', condition: eq('W18', 'yes'), services: ['M10'], customerText: '请尽快去医院急诊。', staffAction: '1 小时内电话' },
  { code: 'RF07', level: 'L2', source: 'W17', conditionText: '摸到乳房肿块，或乳头有异常液体流出', condition: eq('W17', 'yes'), services: ['M4'], customerText: '需要乳腺专科检查。', staffAction: '协助预约' },
  { code: 'RF08', level: 'L2', source: 'B04', conditionText: '没有刻意减重，半年内体重下降 3 公斤以上', condition: eq('B04', 'unintended'), services: ['M7'], customerText: '建议请医生做一次全面检查。', staffAction: '协助预约' },
  { code: 'RF09', level: 'L3', source: 'M08', conditionText: '最近两周出现过伤害自己的念头', condition: eq('M08', 'yes'), services: ['M6'], customerText: '您的感受很重要。请拨打 12356 心理援助热线，紧急情况拨打 120；顾问会马上联系您。', staffAction: '1 小时内电话；必要时联系家人', hotline: true },
  { code: 'RF10', level: 'L3', source: 'H04', conditionText: '近期出现胸痛、胸闷、气短', condition: eq('H04', 'yes'), services: ['M10', 'M13'], customerText: '请尽快就医；症状正在发生请立即拨打 120。', staffAction: '1 小时内电话' },
  { code: 'RF11', level: 'L3', source: 'H05', conditionText: '最近突然出现一侧手脚无力、嘴歪、说话不清', condition: eq('H05', 'yes'), services: ['M10'], customerText: '请立即拨打 120。', staffAction: '1 小时内电话' },
  { code: 'RF12', level: 'L2', source: '门店血压', conditionText: '收缩压 ≥ 180 或舒张压 ≥ 110 mmHg', condition: { or: [{ '>=': [{ var: 'm.sbp' }, 180] }, { '>=': [{ var: 'm.dbp' }, 110] }] }, services: ['M13'], customerText: '血压偏高较多，请尽快就医复测；今天先不做门店项目。', staffAction: '当场暂停项目；协助就医' },
  { code: 'RF13', level: 'L2', source: 'H06', conditionText: '近一个月内晕倒过', condition: eq('H06', 'yes'), services: ['M13'], customerText: '建议尽快请医生查一下原因。', staffAction: '协助预约' },
]

// ───────── 附录 B：风险信号（L1）─────────
export const RISK_SIGNALS = [
  { code: 'R01', conditionText: '月经周期不规律持续 ≥ 3 个月（W03）', condition: inL('W03', ['m3_6', 'gt6']), services: ['M1'], tags: ['menstrual_irregular'], reason: '周期不规律超过 3 个月' },
  { code: 'R02', conditionText: '痛经影响工作生活，或止痛药也难以缓解（W04）', condition: inL('W04', ['affect', 'severe']), services: ['M1'], tags: ['dysmenorrhea'], reason: '痛经影响生活' },
  { code: 'R03', conditionText: '潮热每天都有，或已影响睡眠（W10）', condition: inL('W10', ['daily', 'sleep']), services: ['M2'], tags: ['hot_flash'], reason: '潮热明显' },
  { code: 'R04', conditionText: '年龄 ≥ 50 且 OSTA ≤ −1；或有母亲 / 姐妹髋部骨折史（W22）', condition: { or: [{ and: [age('>=', 50), { '<=': [{ var: 'c.osta' }, -1] }] }, has('W22', 'hip')] }, services: ['M3'], tags: ['osteoporosis_mid'], tagsIf: [{ if: { '<': [{ var: 'c.osta' }, -4] }, tag: 'osteoporosis_high' }], reason: 'OSTA 指数偏低', factKeys: ['osta'] },
  { code: 'R05', conditionText: '年龄 ≥ 60 且跌倒风险 3 问任一为"是"；或坐站测试低于参考值', condition: { or: [{ and: [age('>=', 60), { '==': [{ var: 'c.fall3' }, true] }] }, { '==': [{ var: 'c.chairLow' }, true] }] }, services: ['M11'], tagsIf: [{ if: { '==': [{ var: 'c.fall3' }, true] }, tag: 'fall_risk' }, { if: { '==': [{ var: 'c.chairLow' }, true] }, tag: 'chair_stand_low' }], reason: '跌倒风险或下肢力量偏低' },
  { code: 'R06', conditionText: 'SARC-F ≥ 4', condition: { '>=': [{ var: 'c.sarcf' }, 4] }, services: ['M12'], tags: ['sarcf_positive'], reason: 'SARC-F 阳性', factKeys: ['sarcf'] },
  { code: 'R07', conditionText: '入睡困难或夜醒每周 ≥ 3 次，且持续 > 3 个月', condition: { and: [eq('M02', '3plus'), eq('M03', 'gt3')] }, services: ['M5'], tags: ['sleep_chronic'], reason: '睡眠困扰超过 3 个月' },
  { code: 'R08', conditionText: 'PHQ-2 ≥ 3 或 GAD-2 ≥ 3（且未命中 RF09）', condition: { and: [{ or: [{ '>=': [{ var: 'c.phq2' }, 3] }, { '>=': [{ var: 'c.gad2' }, 3] }] }, { '!=': [a('M08'), 'yes'] }] }, services: ['M6'], tags: ['mood_positive'], reason: '情绪筛查阳性', factKeys: ['phq2', 'gad2'] },
  { code: 'R09', conditionText: '酸痛持续 > 3 个月（P03）', condition: eq('P03', 'gt3'), services: ['M11'], tags: ['pain_chronic'], reason: '酸痛超过 3 个月' },
  { code: 'R10', conditionText: '门店血压收缩压 140–179 或舒张压 90–109 mmHg', condition: { or: [{ '<=': [140, { var: 'm.sbp' }, 179] }, { '<=': [90, { var: 'm.dbp' }, 109] }] }, services: ['M13'], tags: ['bp_high'], reason: '门店血压偏高' },
  { code: 'R11', conditionText: 'BMI ≥ 28，或女性腰围 ≥ 85 cm', condition: { or: [{ '>=': [{ var: 'c.bmi' }, 28] }, { '>=': [{ var: 'c.waist' }, 85] }] }, services: ['M7'], tags: ['metabolic_risk'], reason: 'BMI 或腰围偏高', factKeys: ['bmi', 'waist'] },
  { code: 'R12', conditionText: '乳腺检查 ≥ 3 年未做（≥40 岁）；宫颈筛查 ≥ 5 年未做（≥25 岁）；或有乳腺癌 / 卵巢癌家族史', condition: { or: [{ and: [age('>=', 40), inL('W14', ['gt3', 'never'])] }, { and: [age('>=', 25), inL('W15', ['gt5', 'never'])] }, has('W22', 'breast'), has('W22', 'ovary')] }, services: ['M4'], tags: ['screening_due'], reason: '乳腺 / 宫颈筛查到期' },
  { code: 'R13', conditionText: '产后漏尿"经常"（W13）', condition: eq('W13', 'often'), services: ['M8'], tags: ['pelvic_floor'], reason: '产后漏尿' },
  { code: 'R14', conditionText: '对医美有兴趣（C03），且客户开启个性化推荐', condition: { and: [eq('C03', 'curious'), { '==': [{ var: 'personalization' }, true] }] }, services: ['M9'], tags: ['interest_aesthetics'], reason: '对医美感兴趣（兴趣推荐，非风险）', interest: true },
  { code: 'R15', conditionText: '血压"不太稳定"（H02）', condition: eq('H02', 'unstable'), services: ['M13'], tags: ['htn_uncontrolled'], reason: '血压不太稳定' },
]

// ───────── 附录 D：门店项目与禁忌 ─────────
export const PROJECT_ATTRS: Record<string, string> = {
  manual: '手法类', deep_pressure: '深层按压', spinal_manipulation: '脊柱扳动类手法', heat: '热疗、热敷',
  high_temp_bath: '高温浴、汗蒸、温泉', rf_energy: '射频、能量类仪器', electrical: '微电流、电刺激',
  bia_measure: '生物电阻抗测量', facial_device: '面部仪器', abdominal: '腹部操作', leg_massage: '腿部按摩',
  body_shaping: '塑形类', strong_aroma: '浓香精油、熏香', exercise: '运动训练',
}

export const PROJECTS = [
  { code: 'P01', name: '面部年轻化护理', dimension: 'skin', attributes: ['manual', 'facial_device'], durationMin: 75, priceRef: 680 },
  { code: 'P02', name: '肩颈舒缓护理', dimension: 'posture', attributes: ['manual'], durationMin: 60, priceRef: 398 },
  { code: 'P03', name: '腹部温养舒缓护理', dimension: 'fitness', attributes: ['abdominal', 'heat'], durationMin: 60, priceRef: 468 },
  { code: 'P04', name: '背部舒压护理', dimension: 'posture', attributes: ['manual', 'deep_pressure'], durationMin: 60, priceRef: 428 },
  { code: 'P05', name: '睡眠舒压 SPA', dimension: 'mind', attributes: ['manual', 'strong_aroma'], durationMin: 90, priceRef: 588 },
  { code: 'P06', name: '体态评估与形体调理', dimension: 'posture', attributes: ['manual', 'deep_pressure'], durationMin: 60, priceRef: 498 },
  { code: 'P07', name: '体成分检测与纤体管理', dimension: 'shape', attributes: ['bia_measure', 'body_shaping'], durationMin: 45, priceRef: 368 },
  { code: 'P08', name: '轻体能训练课（负重与平衡）', dimension: 'fitness', attributes: ['exercise'], durationMin: 45, priceRef: 168 },
  { code: 'P09', name: '正念减压课', dimension: 'mind', attributes: [], durationMin: 45, priceRef: 128 },
  { code: 'P10', name: '产后形体修复护理', dimension: 'shape', attributes: ['abdominal', 'body_shaping'], durationMin: 60, priceRef: 528 },
  { code: 'P11', name: '汗蒸舒缓', dimension: 'fitness', attributes: ['high_temp_bath', 'heat'], durationMin: 40, priceRef: 198 },
  { code: 'P12', name: '科技美肤（射频 / 光电类）', dimension: 'skin', attributes: ['rf_energy', 'facial_device'], durationMin: 60, priceRef: 980 },
  { code: 'P13', name: '腿部舒缓护理', dimension: 'shape', attributes: ['manual', 'leg_massage'], durationMin: 50, priceRef: 368 },
]

const ALL = '*'
export const CONTRAINDICATIONS = [
  { code: 'CI01', tags: ['pacemaker_implant'], attributes: ['rf_energy', 'electrical', 'bia_measure'], effect: 'block', text: '体内有起搏器或金属植入，不做能量、电流类项目和测量' },
  { code: 'CI02', tags: ['anticoagulant'], attributes: ['deep_pressure', 'spinal_manipulation'], effect: 'block', text: '服用抗凝药，避免深层按压' },
  { code: 'CI03', tags: ['anticoagulant'], attributes: ['manual'], effect: 'warn', text: '手法力度放轻，留意瘀青' },
  { code: 'CI04', tags: ['sensory_reduced'], attributes: ['heat', 'high_temp_bath'], effect: 'block', text: '皮肤感觉迟钝，有烫伤风险' },
  { code: 'CI05', tags: ['htn_uncontrolled'], attributes: ['high_temp_bath'], effect: 'block', text: '血压不稳定，不做高温项目' },
  { code: 'CI06', tags: ['htn_uncontrolled', 'htn_unknown'], attributes: ['heat'], effect: 'warn', text: '操作前测血压' },
  { code: 'CI07', tags: ['dx_heart'], attributes: ['high_temp_bath'], effect: 'block', text: '有心脏病，不做高温项目' },
  { code: 'CI08', tags: ['osteoporosis_high'], attributes: ['deep_pressure', 'spinal_manipulation'], effect: 'block', text: '骨质疏松高风险，只用轻手法' },
  { code: 'CI09', tags: ['osteoporosis_mid'], attributes: ['deep_pressure'], effect: 'warn', text: '手法力度放轻' },
  { code: 'CI10', tags: ['varicose_thrombosis'], attributes: ['leg_massage'], effect: 'block', text: '静脉曲张或血栓史，不做腿部按摩' },
  { code: 'CI11', tags: ['pregnancy_related'], attributes: ['abdominal', 'rf_energy', 'electrical', 'heat', 'high_temp_bath', 'strong_aroma', 'body_shaping', 'bia_measure'], effect: 'block', text: '怀孕或备孕期间暂停' },
  { code: 'CI12', tags: ['postpartum_42d'], attributes: ['abdominal', 'body_shaping'], effect: 'block', text: '产后 42 天内暂停' },
  { code: 'CI13', tags: ['menstruation_now'], attributes: ['abdominal'], effect: 'block', text: '经期内暂停腹部项目' },
  { code: 'CI14', tags: ['recent_surgery'], attributes: ['manual', 'rf_energy', 'heat'], effect: 'warn', text: '确认手术部位，避开' },
  { code: 'CI15', tags: ['cosmetic_allergy'], attributes: ['facial_device'], effect: 'warn', text: '确认过敏成分' },
  { code: 'CI16', tags: ['red_flag_active'], attributes: [ALL], effect: 'block', text: '先就医，医生确认后恢复' },
  { code: 'CI17', tags: ['doctor_hold_manual'], attributes: ['manual', 'deep_pressure', 'spinal_manipulation'], effect: 'block', text: '医生建议暂停手法类' },
  { code: 'CI18', tags: ['doctor_hold_heavy_manual'], attributes: ['deep_pressure', 'spinal_manipulation'], effect: 'block', text: '医生建议暂停重手法' },
  { code: 'CI19', tags: ['doctor_hold_heat'], attributes: ['heat', 'high_temp_bath'], effect: 'block', text: '医生建议暂停热疗类' },
  { code: 'CI20', tags: ['doctor_hold_device'], attributes: ['rf_energy', 'electrical', 'facial_device'], effect: 'block', text: '医生建议暂停仪器类' },
  { code: 'CI21', tags: ['doctor_hold_all'], attributes: [ALL], effect: 'block', text: '医生建议暂停全部门店项目' },
]

// ───────── 附录 E：方案包 ─────────
export const PACKAGES = [
  { code: 'PK10', name: '就医优先计划', priority: 1, triggerText: '存在 L2 / L3', trigger: { '==': [{ var: 'redFlagActive' }, true] }, items: [], medicalLinks: [], weeks: null, target: '存在红旗症状的客户' },
  { code: 'PK05', name: '骨骼与防跌倒计划', priority: 2, triggerText: '年龄 ≥ 50，且 osteoporosis_*、fall_risk、chair_stand_low、sarcf_positive 任一', trigger: { and: [age('>=', 50), anyTag(['osteoporosis_mid', 'osteoporosis_high', 'fall_risk', 'chair_stand_low', 'sarcf_positive'])] }, items: [{ project: 'P06', freq: '每 2 周 1 次（轻手法，医生确认后开始）' }, { project: 'P08', freq: '每周 2 次，工作日上午' }, { project: 'P02', freq: '每周 1 次' }], medicalLinks: ['M3', 'M11'], weeks: 12, target: '50 岁以上，骨骼或跌倒风险' },
  { code: 'PK04', name: '更年期管理计划', priority: 3, triggerText: 'hot_flash，或 W01 = 可能进入更年期', trigger: { or: [tag('hot_flash'), eq('W01', 'peri')] }, items: [{ project: 'P05', freq: '每周 1 次' }, { project: 'P06', freq: '每 2 周 1 次' }, { project: 'P01', freq: '每 2 周 1 次' }], medicalLinks: ['M2'], weeks: 12, target: '更年期女性' },
  { code: 'PK01', name: '经期养护 3 个月计划', priority: 4, triggerText: 'menstrual_irregular 或 dysmenorrhea', trigger: anyTag(['menstrual_irregular', 'dysmenorrhea']), items: [{ project: 'P03', freq: '经前 1 周、经后 1 周各 1 次（经期暂停）' }, { project: 'P05', freq: '每周 1 次' }, { project: 'P09', freq: '每周 1 次' }], medicalLinks: ['M1'], weeks: 12, target: '经期不适' },
  { code: 'PK02', name: '产后修复计划', priority: 5, triggerText: 'postpartum（产后 ≥ 42 天）', trigger: { and: [tag('postpartum'), { '!': tag('postpartum_42d') }] }, items: [{ project: 'P10', freq: '每周 1 次' }, { project: 'P07', freq: '每月 1 次' }, { project: 'P02', freq: '每周 1 次' }], medicalLinks: ['M8'], weeks: 12, target: '产后 42 天至 1 年' },
  { code: 'PK03', name: '睡眠与压力计划', priority: 6, triggerText: 'sleep_chronic 或 mood_positive，或心灵维度 < 60', trigger: { or: [anyTag(['sleep_chronic', 'mood_positive']), { '<': [{ var: 'd.mind' }, 60] }] }, items: [{ project: 'P05', freq: '每周 1 次' }, { project: 'P09', freq: '每周 1 次' }, { project: 'P02', freq: '每周 1 次' }], medicalLinks: ['M5', 'M6'], weeks: 8, target: '睡眠或情绪困扰' },
  { code: 'PK08', name: '慢病生活管理计划', priority: 7, triggerText: 'dx_hypertension、dx_diabetes、dx_lipid 任一，且年龄 ≥ 55', trigger: { and: [anyTag(['dx_hypertension', 'dx_diabetes', 'dx_lipid']), age('>=', 55)] }, items: [{ project: 'P08', freq: '每周 2 次' }, { project: 'P09', freq: '每周 1 次' }], medicalLinks: ['M13', 'M7'], weeks: null, target: '55 岁以上慢病客户' },
  { code: 'PK07', name: '体重与代谢计划', priority: 8, triggerText: 'metabolic_risk，或体型维度 < 60', trigger: { or: [tag('metabolic_risk'), { '<': [{ var: 'd.shape' }, 60] }] }, items: [{ project: 'P07', freq: '每月 1 次' }, { project: 'P08', freq: '每周 2 次' }], medicalLinks: ['M7'], weeks: 12, target: '体重与代谢' },
  { code: 'PK09', name: '乐龄焕颜计划', priority: 9, triggerText: '年龄 ≥ 55，且肌肤或轮廓维度 < 70', trigger: { and: [age('>=', 55), { or: [{ '<': [{ var: 'd.skin' }, 70] }, { '<': [{ var: 'd.contour' }, 70] }] }] }, items: [{ project: 'P01', freq: '每 2 周 1 次' }, { project: 'P02', freq: '每周 1 次' }], medicalLinks: [], weeks: 12, target: '55 岁以上焕颜' },
  { code: 'PK06', name: '六维年轻化计划', priority: 10, triggerText: '默认（以上都不满足）', trigger: true, items: [{ project: 'P01', freq: '每 2 周 1 次' }, { project: 'P05', freq: '每周 1 次' }, { project: 'P12', freq: '每月 1 次（通过禁忌时）' }], medicalLinks: [], weeks: 12, target: '所有客户' },
]

// ───────── 附录 F：医疗服务与体检套餐 ─────────
export const MEDICAL_SERVICES = [
  { code: 'M1', name: '妇科门诊', dept: '妇科' },
  { code: 'M2', name: '妇科内分泌 / 更年期门诊', dept: '妇科内分泌' },
  { code: 'M3', name: '骨密度检查（DXA）', dept: '放射科' },
  { code: 'M4', name: '乳腺与宫颈筛查 / 乳腺专科', dept: '乳腺外科' },
  { code: 'M5', name: '睡眠门诊', dept: '神经内科' },
  { code: 'M6', name: '心理门诊 / 精神心理科', dept: '精神心理科' },
  { code: 'M7', name: '定制体检 / 代谢检查', dept: '健康管理中心' },
  { code: 'M8', name: '产后康复门诊（含盆底评估）', dept: '产科康复' },
  { code: 'M9', name: '集团医美面诊', dept: '医疗美容科' },
  { code: 'M10', name: '急诊', dept: '急诊科' },
  { code: 'M11', name: '骨科 / 康复科门诊', dept: '骨科' },
  { code: 'M12', name: '老年医学科', dept: '老年医学科' },
  { code: 'M13', name: '心血管内科', dept: '心内科' },
]

export const CHECKUP_PACKAGES = [
  { code: 'CP01', name: '基础体检包', elderOnly: false, agreementPrice: 380, items: ['一般检查（身高、体重、血压）', '血常规', '尿常规', '血脂', '血糖', '肝肾功能', '甲状腺功能', '乳腺超声', '妇科超声'] },
  { code: 'CP02', name: '乐龄基础体检包', elderOnly: true, agreementPrice: 560, items: ['基础体检包全部项目', '骨密度', '心电图', '按指南的肠癌初筛'] },
]

// ───────── 生活建议库 ─────────
export const LIFESTYLE_TIPS = [
  { code: 'L_CALCIUM', text: '每天喝一杯奶或吃豆制品，补充钙。', textElder: '每天一杯奶，或吃点豆腐。', tags: ['osteoporosis_mid', 'osteoporosis_high', 'dx_osteoporosis'] },
  { code: 'L_SUN', text: '天气好时到户外晒 15–20 分钟太阳。', textElder: '天好时出门晒晒太阳。', tags: ['osteoporosis_mid', 'osteoporosis_high', 'sarcf_positive'] },
  { code: 'L_ANTI_SLIP', text: '浴室铺防滑垫，夜里起床先开灯。', textElder: '浴室放防滑垫，起夜先开灯。', tags: ['fall_risk', 'chair_stand_low', 'balance_low'] },
  { code: 'L_SLEEP_ROUTINE', text: '固定时间上床和起床，睡前一小时少看手机。', textElder: '按时睡、按时起，睡前少看手机。', tags: ['sleep_chronic', 'hot_flash'] },
  { code: 'L_MOOD_SHARE', text: '心里有事时找家人或朋友聊聊，也可以和小镜说说。', textElder: '有心事，找人聊聊。', tags: ['mood_positive', 'lonely'] },
  { code: 'L_WALK', text: '每周至少 5 天快走 30 分钟。', textElder: '每天走走路，半小时就好。', tags: ['metabolic_risk', 'dx_hypertension', 'dx_diabetes', 'dx_lipid'] },
  { code: 'L_DIET', text: '少油少盐，晚饭七分饱。', textElder: '少油少盐，晚饭吃七分饱。', tags: ['metabolic_risk', 'dx_hypertension', 'dx_lipid', 'dx_diabetes'] },
  { code: 'L_BP_LOG', text: '在家定时量血压并记下来，复诊时带给医生看。', textElder: '在家量血压，记在本子上。', tags: ['dx_hypertension', 'htn_uncontrolled', 'htn_unknown', 'bp_high'] },
  { code: 'L_SUNSCREEN', text: '出门前涂防晒，阴天也要涂。', textElder: '出门记得涂防晒。', tags: ['skin_care_low'] },
  { code: 'L_PERIOD_WARM', text: '经期注意保暖，少吃生冷，记录经期日记。', textElder: '经期注意保暖。', tags: ['menstrual_irregular', 'dysmenorrhea'] },
  { code: 'L_PELVIC', text: '每天做 3 组盆底肌练习（凯格尔运动）。', textElder: '每天练练盆底肌。', tags: ['pelvic_floor', 'postpartum'] },
  { code: 'L_STRETCH', text: '久坐 1 小时起身活动肩颈 5 分钟。', textElder: '坐一小时，起来动一动。', tags: ['pain_chronic'] },
]

// ───────── 附录 I：禁用词 ─────────
export const BANNED_WORDS = [
  '治疗', '治愈', '治好', '根治', '疗效', '药到病除', '包治', '处方', '诊断', '确诊', '无副作用', '保证有效',
  '防癌', '抗癌', '降血压', '降血糖', '降血脂', '排毒', '调理内分泌', '激活细胞', '修复细胞', '逆转衰老', '返老还童', '增强免疫力',
  '量子', '能量场', '弱磁共振', '全身扫描', '器官功能检测',
  '最佳', '最好', '第一', '顶级', '国家级', '极品', '100%', '绝对', '万能', '首选',
  '最后机会', '不买后悔', '错过再等一年', '仅剩最后',
  '高端', '中端', '低端', '老年版', '老人专用',
]

export function findBannedWords(text: string): string[] {
  if (!text) return []
  const hits = BANNED_WORDS.filter(w => text.includes(w))
  // "最"单字按词语边界匹配：最近、最后、最多 等常用词不拦截
  const re = /最(?![近后多少初终早晚小])/g
  if (re.test(text)) hits.push('最')
  return [...new Set(hits)]
}

export const TAG_NAMES: Record<string, string> = {
  dx_hypertension: '高血压', dx_diabetes: '糖尿病', dx_lipid: '高血脂', dx_heart: '心脏病', dx_osteoporosis: '骨质疏松', dx_thyroid: '甲状腺疾病',
  htn_uncontrolled: '血压不稳定', htn_unknown: '血压情况不清楚', pacemaker_implant: '起搏器 / 金属植入', anticoagulant: '服用抗凝药',
  recent_surgery: '近期手术', varicose_thrombosis: '静脉曲张 / 血栓史', sensory_reduced: '皮肤感觉迟钝', cosmetic_allergy: '护肤品过敏',
  interest_aesthetics: '对医美感兴趣', chair_stand_low: '坐站测试偏低', balance_low: '平衡偏弱', sarcf_positive: 'SARC-F 阳性',
  osteoporosis_mid: '骨质疏松中风险', osteoporosis_high: '骨质疏松高风险', fall_risk: '跌倒风险', pain_chronic: '慢性酸痛',
  sleep_chronic: '长期睡眠困扰', mood_positive: '情绪筛查阳性', lonely: '常感孤单', menstrual_irregular: '月经不规律',
  dysmenorrhea: '痛经', hot_flash: '潮热', pregnancy_related: '怀孕 / 备孕', postpartum: '产后', postpartum_42d: '产后 42 天内',
  pelvic_floor: '盆底问题', screening_due: '筛查到期', metabolic_risk: '代谢风险', bp_high: '门店血压偏高', fh_breast_ovary: '乳腺 / 卵巢癌家族史',
  fh_hip_fracture: '髋部骨折家族史', red_flag_active: '红旗未关闭', doctor_hold_manual: '医生：暂停手法类', doctor_hold_heavy_manual: '医生：暂停重手法',
  doctor_hold_heat: '医生：暂停热疗类', doctor_hold_device: '医生：暂停仪器类', doctor_hold_all: '医生：暂停全部项目',
  skin_type_dry: '干性皮肤', skin_type_oily: '油性皮肤', skin_type_combo: '混合皮肤', skin_type_sensitive: '敏感皮肤', skin_care_low: '护肤习惯待加强',
}
