/** 种子配置：授权文本（附录 J）、模块（附录 G）、首页布局（附录 H）、魔镜人设、问答题库等 */

export const CONSENT_TEXTS = [
  { type: 'C1', title: '用户协议与隐私政策', required: true, summary: ['用于提供平台基本服务', '收集微信标识、手机号、称呼、出生年份、性别、使用记录', '接收方：雪姬美业', '保存到账号注销为止', '不同意将无法使用需要登录的功能'] },
  { type: 'C2', title: '健康信息处理（单独同意）', required: false, summary: ['只用于健康测评、档案、养护方案和风险提示', '包括测评答案（含女性健康）、门店测量数据、打卡记录', '只有您和授权的健康顾问、顾问按权限查看', '随时可以在"我的 - 授权管理"撤回', '不同意将无法使用测评、档案、方案、体检券，其他功能不受影响'] },
  { type: 'C3', title: '向合作医院提供信息（单独同意）', required: false, summary: ['用于为您预约体检或转介就诊', '提供：称呼、性别、年龄、手机号、推荐服务、相关测评要点、您的补充说明', '接收方：所选合作医院', '不提供：消费记录、会员等级、门店方案、魔镜聊天内容', '不同意也可以自行前往医院'] },
  { type: 'C4', title: '医院向雪姬美业回传结果（单独同意）', required: false, summary: ['让顾问按医生意见调整您的门店方案', '回传内容：医生结论、建议、复查日期、报告', '不影响您就诊；您也可以直接从医院拿报告', '随时可以撤回'] },
  { type: 'C5', title: '人脸 / 身体照片（单独同意）', required: false, summary: ['用于 AI 测肤、体态分析、前后对比', '照片仅您本人可见，可随时删除', '不同意不影响其他功能'] },
  { type: 'C6', title: '家人查看（单独同意）', required: false, summary: ['让您指定的家人查看健康信息、接收提醒', '按家人、按您勾选的范围授权', '随时可以修改范围或解除绑定'] },
  { type: 'C7', title: '个性化推荐', required: false, summary: ['根据您的情况调整首页内容的顺序', '使用等级以外的标签和行为数据', '关闭后按默认顺序展示，价格和权益不受影响'] },
  { type: 'C8', title: '向境外机构提供信息（单独同意）', required: false, summary: ['仅在海外 VIP 服务进入实际服务阶段时请求', '按机构单独授权，列明接收方和所在国家或地区', '咨询阶段不会把您的健康信息传到境外'] },
  { type: 'C9', title: '魔镜记忆（单独同意）', required: false, summary: ['让小镜记住您在对话中主动说过的生活小事', '不记诊断、用药、财务、证件信息', '可以随时在"魔镜记得的事"里查看和删除'] },
]

const healthHot = [
  { tags: ['htn_uncontrolled', 'dx_heart', 'recent_surgery'], text: '如果您的血压控制得不太好，或有心脏病、近期做过手术，出行前请先咨询医生；单次泡浴不宜超过 15 分钟。', require_ack: true },
  { tags: ['sensory_reduced'], text: '您的手脚皮肤感觉偏迟钝，泡温泉时请注意水温，防止烫伤。', require_ack: true },
]

const tripForm = {
  type: 'form',
  fields: [
    { key: 'people', label: '出行人数', type: 'number', required: true, min: 1, max: 6, default: 2 },
    { key: 'date', label: '期望日期', type: 'date', required: true },
    { key: 'buddy', label: '是否和老姐妹同行', type: 'radio', options: ['是', '否'] },
    { key: 'contact', label: '联系人手机号', type: 'phone', required: true },
    { key: 'note', label: '特殊需求', type: 'textarea', placeholder: '如：需要轮椅、饮食忌口' },
  ],
}

export const MODULES: any[] = [
  { code: 'assessment', name: '六维测评', category: 'builtin', entryType: 'builtin', icon: 'hexagon', summary: '约 8 分钟，可以分几次做', tiers: ['A', 'B', 'C'], sort: 1, version: 'V1.1' },
  { code: 'checkup_coupon', name: '免费体检', category: 'builtin', entryType: 'builtin', icon: 'stethoscope', summary: '完成测评领取基础体检券', tiers: ['A', 'B', 'C'], sort: 2, version: 'V1.1' },
  { code: 'my_plan', name: '我的方案', category: 'builtin', entryType: 'builtin', icon: 'clipboard-heart', summary: '顾问为您整理的养护方案', tiers: ['A', 'B', 'C'], sort: 3, version: 'V1.1' },
  { code: 'mirror', name: '和小镜聊聊', category: 'builtin', entryType: 'builtin', icon: 'message-heart', summary: 'AI 陪伴，读报告、聊家常', tiers: ['A', 'B', 'C'], sort: 4 },
  { code: 'family', name: '家人', category: 'builtin', entryType: 'builtin', icon: 'users', summary: '让子女放心', tiers: ['A', 'B', 'C'], sort: 5 },
  { code: 'passbook', name: '健康存折', category: 'builtin', entryType: 'builtin', icon: 'notebook', summary: '积分换讲座、体验和好物', tiers: ['A', 'B', 'C'], sort: 6, version: 'V1.2' },
  { code: 'checkin', name: '每日打卡', category: 'builtin', entryType: 'builtin', icon: 'calendar-check', summary: '睡眠、运动、喝水', tiers: ['A', 'B', 'C'], sort: 7, version: 'V1.2' },
  { code: 'game_tree', name: '种健康树', category: 'interactive', entryType: 'builtin', icon: 'plant', summary: '打卡答题攒水滴，长成兑好礼', tiers: ['A', 'B', 'C'], sort: 12, version: 'V1.0' },
  { code: 'game_wheel', name: '积分转盘', category: 'interactive', entryType: 'builtin', icon: 'refresh', summary: '每天免费一次，转出积分好礼', tiers: ['A', 'B', 'C'], sort: 13, version: 'V1.0' },
  { code: 'game_match3', name: '消消乐', category: 'interactive', entryType: 'builtin', icon: 'grid-dots', summary: '健康图标三消，通关得积分', tiers: ['A', 'B', 'C'], sort: 14, version: 'V1.0' },
  { code: 'daily_quiz', name: '健康问答', category: 'interactive', entryType: 'builtin', icon: 'bulb', summary: '每天 3 题，答对得积分', tiers: ['B', 'C'], sort: 8, version: 'V1.2' },
  { code: 'memory_cards', name: '记忆翻牌', category: 'interactive', entryType: 'builtin', icon: 'cards', summary: '轻松小游戏', tiers: ['C'], sort: 9, version: 'V1.2' },
  { code: 'buddy_group', name: '结伴拼团', category: 'interactive', entryType: 'builtin', icon: 'users-group', summary: '约上老姐妹一起来', tiers: ['B', 'C'], sort: 10, version: 'V1.2' },
  { code: 'mall_organic', name: '有机好物', category: 'mall', entryType: 'miniprogram', icon: 'leaf', summary: '雪姬美业有机商城', tiers: ['B', 'C'], sort: 20,
    cover: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=70&auto=format&fit=crop',
    entryConfig: { type: 'miniprogram', appId: '[商城小程序 AppID]', path: 'pages/index/index', tip: '即将前往雪姬美业有机商城', h5Url: '' }, detail: { priceText: '会员专享价' } },
  { code: 'gift_private', name: '私享礼盒', category: 'mall', entryType: 'form', icon: 'gift', summary: '节令私享礼盒，专人配送', tiers: ['A'], sort: 21, lead: { type: 'gift', sla_hours: 24 },
    cover: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&q=70&auto=format&fit=crop',
    detail: { priceText: '臻享会员权益', highlights: ['节令养生食材', '专人上门配送', '可附手写祝福卡'], content: ['每季度一份私享礼盒，按您的口味偏好挑选。', '提交意向后，专属顾问会与您确认收货时间和地址。'] },
    entryConfig: { type: 'form', fields: [{ key: 'season', label: '想要的礼盒', type: 'radio', options: ['秋冬养生', '新春团圆', '其他'], required: true }, { key: 'note', label: '口味偏好或忌口', type: 'textarea' }] } },
  { code: 'lecture', name: '医生健康讲座', category: 'activity', entryType: 'page', icon: 'presentation', summary: '重阳健康日 · 骨骼健康与防跌倒', tiers: ['A', 'B'], sort: 22, lead: { type: 'other', sla_hours: 24 },
    cover: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&q=70&auto=format&fit=crop',
    detail: { priceText: '会员免费', days: '周六上午 9:30', highlights: ['合作医院骨科医生主讲', '现场学习防跌倒小动作', '名额 30 人，先到先得'], content: ['讲座在五月花店二楼多功能厅举行，约 90 分钟。', '讲座只讲健康知识，不推销任何产品。'], suitable: '50 岁以上会员及家属' },
    entryConfig: { type: 'form', fields: [{ key: 'people', label: '参加人数', type: 'number', required: true, min: 1, max: 2, default: 1 }, { key: 'family', label: '是否带家人', type: 'radio', options: ['是', '否'] }] } },
  { code: 'trip_qingyuan_value', name: '清远温泉老姐妹结伴团', category: 'travel', entryType: 'form', icon: 'beach', summary: '2 天 1 晚，工作日出发', tiers: ['C'], sort: 30, partner: 0, lead: { type: 'travel', sla_hours: 24 },
    cover: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=70&auto=format&fit=crop',
    detail: { priceText: '会员价 ¥299 起', days: '2 天 1 晚', highlights: ['工作日出发，人少不排队', '温泉酒店双人间，含早晚餐', '全程领队陪同，节奏放慢'], suitable: '喜欢结伴出游的会员', content: ['第 1 天：上午门店集合乘车，约 2 小时到达；午餐后入住，下午自由泡汤；晚餐后早点休息。', '第 2 天：早餐后山间慢走半小时；午餐后返程，约 16:00 回到门店。'], priceNote: '以合作方最终报价为准' },
    healthRules: healthHot, entryConfig: tripForm },
  { code: 'trip_qingyuan_boutique', name: '清远温泉精品小团', category: 'travel', entryType: 'form', icon: 'beach', summary: '6 人小团，私汤别院', tiers: ['A', 'B'], sort: 31, partner: 0, lead: { type: 'travel', sla_hours: 24 },
    cover: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=70&auto=format&fit=crop',
    detail: { priceText: '会员价 ¥899 起', days: '2 天 1 晚', highlights: ['6 人精品小团', '私汤别院', '养生药膳晚餐'], content: ['行程节奏舒缓，全程专车接送。'], priceNote: '以合作方最终报价为准' },
    healthRules: healthHot, entryConfig: tripForm },
  { code: 'trip_maoming_agarwood', name: '茂名沉香文化之旅', category: 'travel', entryType: 'form', icon: 'trees', summary: '沉香馆参观、香道体验', tiers: ['A', 'B'], sort: 32, partner: 1, lead: { type: 'travel', sla_hours: 24 },
    cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=70&auto=format&fit=crop',
    detail: { priceText: '会员价 ¥1,280 起', days: '3 天 2 晚', highlights: ['沉香馆深度参观', '香道老师现场体验课', '岭南古村漫步'], content: ['以文化体验为主，每天步行不超过 5000 步。'], priceNote: '以合作方最终报价为准' },
    healthRules: [{ always: true, text: '香道体验会接触较浓的香味，对香味敏感或有哮喘的客户请提前告知。', require_ack: false }], entryConfig: tripForm },
  { code: 'trip_hainan_sojourn', name: '海南旅居康养', category: 'travel', entryType: 'form', icon: 'sun', summary: '冬季 7-30 天，避寒慢生活', tiers: ['A', 'B'], sort: 33, partner: 2, lead: { type: 'travel', sla_hours: 24 },
    cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=70&auto=format&fit=crop',
    detail: { priceText: '会员价 ¥3,980 起 / 7 天', days: '7-30 天', highlights: ['海边康养公寓', '每日晨练与太极课', '可安排就近医疗机构'], content: ['适合冬季避寒，可按周续住。'], priceNote: '以合作方最终报价为准' },
    healthRules: [{ tags: ['dx_heart', 'dx_hypertension', 'dx_diabetes'], text: '长途出行前请咨询医生，带足常用药，备好用药清单。', require_ack: true }], entryConfig: tripForm },
  { code: 'trip_yunnan', name: '云南文化游', category: 'travel', entryType: 'form', icon: 'mountain', summary: '丽江、大理慢游', tiers: ['A', 'B'], sort: 34, partner: 3, lead: { type: 'travel', sla_hours: 24 },
    cover: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800&q=70&auto=format&fit=crop',
    detail: { priceText: '会员价 ¥4,680 起', days: '6 天 5 晚', highlights: ['丽江古城', '洱海骑行（可选乘车）', '香格里拉可选'], content: ['高原行程，节奏放慢，每天留出午休时间。'], priceNote: '以合作方最终报价为准' },
    healthRules: [{ tags: ['dx_heart', 'htn_uncontrolled'], logic: { '>=': [{ var: 'age' }, 70] }, text: '丽江约 2400 米、香格里拉约 3300 米，有心脑血管病或慢性肺病的客户，出行前请先咨询医生。', require_ack: true }], entryConfig: tripForm },
  { code: 'vip_overseas', name: '海外 VIP 通道', category: 'benefit', entryType: 'form', icon: 'plane', summary: '香港 · 日本 · 瑞士 · 美国', tiers: ['A'], sort: 40, partner: 4, lead: { type: 'overseas_vip', sla_hours: 4 },
    cover: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=70&auto=format&fit=crop',
    detail: { priceText: '臻享会员权益' },
    entryConfig: { type: 'form', fields: [{ key: 'destination', label: '目的地', type: 'radio', options: ['香港', '日本', '瑞士', '美国'], required: true }, { key: 'need', label: '需求类型', type: 'radio', options: ['高端体检', '抗衰', '专科诊疗', '第二诊疗意见'], required: true }, { key: 'date', label: '期望时间', type: 'date' }, { key: 'translator', label: '是否需要陪同翻译', type: 'radio', options: ['需要', '不需要'] }] } },
  { code: 'vip_advisor', name: '专属顾问', category: 'benefit', entryType: 'builtin', icon: 'headset', summary: '4 小时内响应', tiers: ['A'], sort: 41 },
  { code: 'vip_checkup', name: '高端体检', category: 'medical', entryType: 'form', icon: 'heart-rate-monitor', summary: '优先号源，专人陪检', tiers: ['A'], sort: 42, lead: { type: 'checkup', sla_hours: 4 }, version: 'V1.1',
    cover: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=70&auto=format&fit=crop',
    detail: { priceText: '臻享会员权益', highlights: ['合作医院高端体检套餐', '优先号源', '专人陪同、报告解读由医院医生出具'], content: ['提交需求后，专属顾问 4 小时内联系您确认套餐和时间。'] },
    entryConfig: { type: 'form', fields: [{ key: 'date', label: '期望日期', type: 'date', required: true }, { key: 'focus', label: '想重点关注', type: 'textarea' }] } },
  { code: 'vip_transport', name: '接送车', category: 'benefit', entryType: 'builtin', icon: 'car', summary: '到店、到院专车接送', tiers: ['A'], sort: 43, version: 'V1.2' },
  { code: 'private_events', name: '私享活动', category: 'activity', entryType: 'form', icon: 'glass-full', summary: '秋季私享茶会 · 10 月 26 日', tiers: ['A'], sort: 44, lead: { type: 'other', sla_hours: 24 },
    cover: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=70&auto=format&fit=crop',
    detail: { priceText: '臻享会员专享', days: '下午 14:30-17:00', highlights: ['岭南茶艺', '养生点心', '每场 12 位'], content: ['在五月花店私享厅举行。'] },
    entryConfig: { type: 'form', fields: [{ key: 'people', label: '人数', type: 'number', required: true, min: 1, max: 2, default: 1 }] } },
  { code: 'store_services', name: '门店项目', category: 'builtin', entryType: 'builtin', icon: 'building-store', summary: '五月花店团购项目与到店预约', tiers: ['A', 'B', 'C'], sort: 11, lead: { type: 'visit', sla_hours: 24 },
    cover: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=800&q=70&auto=format&fit=crop',
    entryConfig: { type: 'form', fields: [{ key: 'project', label: '想做的项目', type: 'text', required: true }, { key: 'date', label: '期望日期', type: 'date', required: true }, { key: 'period', label: '时间段', type: 'radio', options: ['上午', '下午', '晚上'], required: true }, { key: 'people', label: '人数', type: 'number', min: 1, max: 4, default: 1 }, { key: 'note', label: '备注', type: 'textarea', placeholder: '如：想约指定美容师、需要 VIP 包房' }] } },
  { code: 'annual_report', name: '年度健康报告', category: 'builtin', entryType: 'builtin', icon: 'report-medical', summary: '一年的变化都在这里', tiers: ['A'], sort: 45, version: 'V1.2' },
]

export const LAYOUTS: { tier: string, elderMode: boolean, components: any[] }[] = [
  { tier: 'C', elderMode: true, components: [
    { type: 'elderToday', props: { showTodos: true, maxTodos: 2 } },
    { type: 'entryGrid', props: { columns: 3, modules: ['assessment', 'checkup_coupon', 'mirror', 'buddy_group', 'checkin', 'family'] } },
    { type: 'divider', props: { title: '康养出游' } },
    { type: 'moduleList', props: { modules: ['trip_qingyuan_value'], style: 'card' } },
    { type: 'moduleList', props: { modules: ['game_tree', 'store_services', 'mall_organic', 'daily_quiz'], style: 'list' } },
    { type: 'mirrorFab', props: { label: '和小镜聊聊' } },
  ] },
  { tier: 'C', elderMode: false, components: [
    { type: 'greeting', props: { showElderToggle: true } },
    { type: 'tierCard', props: { showBenefits: true } },
    { type: 'healthCard', props: { showTodos: true, maxTodos: 3 } },
    { type: 'entryGrid', props: { columns: 4, modules: ['assessment', 'checkup_coupon', 'my_plan', 'mirror', 'store_services', 'buddy_group', 'daily_quiz', 'family'] } },
    { type: 'divider', props: { title: '康养出游' } },
    { type: 'moduleList', props: { modules: ['trip_qingyuan_value'], style: 'card' } },
    { type: 'moduleList', props: { modules: ['game_tree', 'game_wheel', 'mall_organic', 'memory_cards', 'passbook'], style: 'list' } },
    { type: 'mirrorFab', props: { label: '小镜' } },
  ] },
  { tier: 'B', elderMode: false, components: [
    { type: 'greeting', props: { showElderToggle: true } },
    { type: 'tierCard', props: { showBenefits: true } },
    { type: 'healthCard', props: { showTodos: true, maxTodos: 3 } },
    { type: 'entryGrid', props: { columns: 4, modules: ['assessment', 'checkup_coupon', 'my_plan', 'mirror', 'store_services', 'lecture', 'buddy_group', 'family'] } },
    { type: 'banner', props: { modules: ['lecture'], autoplay: true } },
    { type: 'divider', props: { title: '康养精选' } },
    { type: 'moduleList', props: { modules: ['trip_qingyuan_boutique', 'trip_maoming_agarwood', 'trip_hainan_sojourn', 'trip_yunnan'], style: 'card' } },
    { type: 'moduleList', props: { modules: ['game_tree', 'game_wheel', 'game_match3', 'mall_organic'], style: 'list' } },
    { type: 'mirrorFab', props: { label: '小镜' } },
  ] },
  { tier: 'B', elderMode: true, components: [
    { type: 'elderToday', props: { showTodos: true, maxTodos: 2 } },
    { type: 'entryGrid', props: { columns: 3, modules: ['assessment', 'checkup_coupon', 'my_plan', 'mirror', 'lecture', 'family'] } },
    { type: 'divider', props: { title: '康养精选' } },
    { type: 'moduleList', props: { modules: ['trip_qingyuan_boutique', 'trip_hainan_sojourn'], style: 'card' } },
    { type: 'moduleList', props: { modules: ['game_tree', 'store_services'], style: 'list' } },
    { type: 'mirrorFab', props: { label: '和小镜聊聊' } },
  ] },
  { tier: 'A', elderMode: false, components: [
    { type: 'greeting', props: { showElderToggle: true } },
    { type: 'tierCard', props: { showBenefits: true } },
    { type: 'entryGrid', props: { columns: 4, modules: ['vip_advisor', 'vip_overseas', 'vip_checkup', 'vip_transport', 'assessment', 'my_plan', 'annual_report', 'family'] } },
    { type: 'healthCard', props: { showTodos: true, maxTodos: 3 } },
    { type: 'divider', props: { title: '私享' } },
    { type: 'moduleList', props: { modules: ['private_events', 'trip_yunnan', 'trip_maoming_agarwood', 'gift_private'], style: 'card' } },
    { type: 'moduleList', props: { modules: ['store_services'], style: 'list' } },
    { type: 'mirrorFab', props: { label: '小镜' } },
  ] },
  { tier: 'A', elderMode: true, components: [
    { type: 'elderToday', props: { showTodos: true, maxTodos: 2 } },
    { type: 'entryGrid', props: { columns: 3, modules: ['vip_advisor', 'assessment', 'vip_overseas', 'vip_transport', 'my_plan', 'family'] } },
    { type: 'divider', props: { title: '私享' } },
    { type: 'moduleList', props: { modules: ['private_events', 'trip_maoming_agarwood', 'gift_private'], style: 'card' } },
    { type: 'mirrorFab', props: { label: '和小镜聊聊' } },
  ] },
]

/** 积分转盘奖品（issue #7）：weight 即公示概率（总和 100），积分奖走健康存折，讲座/小样走线索跟进 */
export const WHEEL_PRIZES = [
  { type: 'points', value: 5, weight: 40, label: '5 积分' },
  { type: 'points', value: 10, weight: 25, label: '10 积分' },
  { type: 'points', value: 20, weight: 10, label: '20 积分' },
  { type: 'lead', value: 'lecture', weight: 3, label: '医生讲座名额' },
  { type: 'lead', value: 'sample', weight: 2, label: '门店小样' },
  { type: 'none', value: 0, weight: 20, label: '谢谢参与' },
]

/** 消消乐关卡（issue #7）：前两关小盘 3 色（乐龄友好），后面逐级加色加格；minMoves 为合法最少步数下界 */
export const MATCH3_LEVELS = [
  { level: 1, rows: 5, cols: 5, tileTypes: 3, targetScore: 300, minMoves: 7 },
  { level: 2, rows: 5, cols: 5, tileTypes: 3, targetScore: 500, minMoves: 12 },
  { level: 3, rows: 7, cols: 7, tileTypes: 4, targetScore: 800, minMoves: 18 },
  { level: 4, rows: 7, cols: 7, tileTypes: 4, targetScore: 1200, minMoves: 27 },
  { level: 5, rows: 7, cols: 7, tileTypes: 5, targetScore: 1600, minMoves: 36 },
  { level: 6, rows: 7, cols: 7, tileTypes: 5, targetScore: 2000, minMoves: 45 },
]

export const PERSONA = {
  name: '小镜',
  tone: '温柔、耐心、真诚；会发现对方的好并真诚夸奖，不浮夸',
  opening: '{{salutation}}，您好呀，我是小镜。今天想聊点什么？我可以陪您聊天、给您读报告。',
  quickTopics: ['读我的报告', '今天要做什么', '陪我聊聊', '讲个故事', '我想记下一件事'],
  forbiddenTopics: ['诊断与用药', '商品与价格推荐', '政治宗教', '投资理财'],
  dailyLimit: 100,
}

export const QUIZ = [
  { title: '每天晒太阳有助于身体合成哪种维生素？', options: ['维生素 C', '维生素 D', '维生素 B'], answer: 1, knowledge: '晒太阳能帮助身体合成维生素 D，有助于钙的吸收。' },
  { title: '预防跌倒，浴室里最好放什么？', options: ['地毯', '防滑垫', '花瓶'], answer: 1, knowledge: '浴室地面湿滑，放防滑垫、装扶手都能减少跌倒。' },
  { title: '成年人每天大约需要睡几个小时？', options: ['4-5 小时', '7-8 小时', '10 小时以上'], answer: 1, knowledge: '大多数成年人每晚睡 7-8 小时比较合适。' },
  { title: '阴天需要涂防晒吗？', options: ['需要', '不需要'], answer: 0, knowledge: '阴天紫外线依然存在，出门同样需要防晒。' },
  { title: '久坐一小时后，最好怎么做？', options: ['继续坐着', '起身活动几分钟', '马上躺下'], answer: 1, knowledge: '每坐一小时起身活动 5 分钟，对肩颈和腰背都好。' },
  { title: '哪种食物含钙比较丰富？', options: ['牛奶和豆腐', '白米饭', '苹果'], answer: 0, knowledge: '牛奶、豆制品、深绿色蔬菜都是补钙的好选择。' },
  { title: '量血压前最好先怎么做？', options: ['刚运动完马上量', '安静休息 5 分钟再量', '喝杯浓茶再量'], answer: 1, knowledge: '安静坐 5 分钟再量，结果更准确。' },
  { title: '每天喝水大约多少比较合适？', options: ['1500-1700 毫升', '300 毫升', '5000 毫升'], answer: 0, knowledge: '一般成年人每天喝 1500-1700 毫升水，少量多次。' },
  { title: '快走算不算运动？', options: ['算', '不算'], answer: 0, knowledge: '快走、跳舞、太极都是很好的运动方式。' },
  { title: '心情不好时，哪个做法更好？', options: ['一个人憋着', '找家人朋友聊聊', '不睡觉'], answer: 1, knowledge: '和信任的人聊一聊，心里会轻松很多。' },
]

export const SCRIPTS = [
  { scene: '发送方案', text: '{{salutation}}您好，您的养护方案整理好了，我先跟您说说为什么这样安排，您看哪天方便来店里？', avoid: ['最后机会', '不买后悔'] },
  { scene: '预约体检', text: '{{salutation}}，您的免费体检券可以预约了，体检由合作医院执行，当天门店不推销任何产品。', avoid: ['顺便', '加项优惠'] },
  { scene: 'L2 沟通', text: '{{salutation}}，看到您测评里提到的情况，建议先到医院看一看，我帮您预约，门店项目我们先暂停。', avoid: ['没什么大事', '做个护理就好'] },
  { scene: '乐龄沟通', text: '说慢一点，一次说一件事；用"您"，用客户的称呼；确认她听清楚了再往下说。', avoid: ['老人', '老年版'] },
]
