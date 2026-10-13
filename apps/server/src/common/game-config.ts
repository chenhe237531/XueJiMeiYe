/**
 * 互动小游戏配置（issue #7）。放在 src 内而不是 prisma/seed-config：
 * src 引用 prisma/ 下的文件会让 nest build 产物变成 dist/src/main.js，容器启动找不到 dist/main.js。
 */

/** 积分转盘奖品（issue #7）：weight 即公示概率（总和 100），积分奖走健康存折，讲座/小样走线索跟进 */
export const WHEEL_PRIZES = [
  { type: 'points', value: 5, weight: 40, label: '5 积分' },
  { type: 'points', value: 10, weight: 25, label: '10 积分' },
  { type: 'points', value: 20, weight: 10, label: '20 积分' },
  { type: 'lead', value: 'lecture', weight: 3, label: '医生讲座名额' },
  { type: 'lead', value: 'sample', weight: 2, label: '门店小样' },
  { type: 'none', value: 0, weight: 20, label: '谢谢参与' },
]

/** 消消乐关卡（issue #7）：前两关小盘 3 色（乐龄友好），后面逐级加色加格；防刷不设下界步数，靠每日积分封顶 + 单步均分上限 */
export const MATCH3_LEVELS = [
  { level: 1, rows: 5, cols: 5, tileTypes: 3, targetScore: 300 },
  { level: 2, rows: 5, cols: 5, tileTypes: 3, targetScore: 500 },
  { level: 3, rows: 7, cols: 7, tileTypes: 4, targetScore: 800 },
  { level: 4, rows: 7, cols: 7, tileTypes: 4, targetScore: 1200 },
  { level: 5, rows: 7, cols: 7, tileTypes: 5, targetScore: 1600 },
  { level: 6, rows: 7, cols: 7, tileTypes: 5, targetScore: 2000 },
]
