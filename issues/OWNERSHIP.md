# 文件独占表（多 Agent 并行防冲突）

> 规则：**一个文件在同一时刻只能有一个 Owner**。需要修改他人文件时，先看本表找到 Owner，在对应 Issue 留言申请，由 Owner 合并。
> 表中的「串行顺序」表示这些 Issue 必须按序合并（同一文件被多次修改）。

## 1. 共享文件（多方需要 → 必须串行）

| 文件 | Owner 与串行顺序 |
|---|---|
| `apps/miniapp/src/style/index.scss` | 1. `XJ-102` → 2. `XJ-103` → 3. `XJ-104` → 4. `XJ-204` |
| `apps/miniapp/src/components/home/HomeRender.vue` | 1. `XJ-201` → 2. `XJ-202` → 3. `XJ-203` |
| `apps/server/src/controllers/app.controller.ts` | 1. `XJ-302` → 2. `XJ-303` → 3. `XJ-304` |
| `apps/miniapp/src/style/graphics.scss` | 1. `XJ-104` → 2. `XJ-601` |
| `apps/miniapp/src/pkg-family/relay.vue` | 1. `XJ-106` → 2. `XJ-402` |
| `apps/miniapp/src/pkg-me/achievements.vue` | 1. `XJ-106` → 2. `XJ-403` |
| `apps/miniapp/src/pkg-game/box.vue` | 1. `XJ-106` → 2. `XJ-404` |
| `apps/miniapp/src/pkg-archive/weekly.vue` | 1. `XJ-106` → 2. `XJ-405` |
| `apps/miniapp/src/pkg-module/stamps.vue` | 1. `XJ-106` → 2. `XJ-406` |
| `apps/miniapp/src/pkg-assess/intro.vue` | 1. `XJ-208` → 2. `XJ-702` |
| `apps/miniapp/src/pkg-assess/map.vue` | 1. `XJ-208` → 2. `XJ-702` |

## 2. 独占文件（可完全并行）

| Issue | Owner Agent | 独占文件 |
|---|---|---|
| `XJ-000` | `pm` | `issues/DECISIONS.md`<br>`issues/issues.json` |
| `XJ-101` | `infra` | `package.json`<br>`apps/miniapp/package.json`<br>`scripts/ci-check.sh` |
| `XJ-103` | `ds` | `apps/miniapp/src/style/visual.scss` |
| `XJ-105` | `ds` | `apps/miniapp/src/components/XMascot.vue`<br>`apps/miniapp/src/style/mascot.scss` |
| `XJ-107` | `ds` | `apps/miniapp/src/style/motion.scss`<br>`apps/miniapp/src/xj/motion.ts`<br>`apps/miniapp/src/components/XGraphic.vue`<br>`apps/miniapp/src/components/XBadge.vue`<br>`apps/miniapp/src/components/XReveal.vue`<br>`apps/miniapp/src/main.ts` |
| `XJ-201` | `fe` | `apps/miniapp/src/pages/index/index.vue`<br>`apps/miniapp/src/components/home/HomeSignin.vue`<br>`apps/miniapp/src/components/home/HomeTasks.vue` |
| `XJ-202` | `fe` | `apps/miniapp/src/components/home/HomeGate.vue` |
| `XJ-203` | `fe` | `apps/miniapp/src/components/home/HomeElder.vue` |
| `XJ-204` | `ds` | `apps/miniapp/src/xj/store.ts` |
| `XJ-205` | `fe` | `apps/miniapp/src/pages/mirror/index.vue`<br>`apps/miniapp/src/components/mirror/ActionCard.vue` |
| `XJ-206` | `ds` | `apps/miniapp/src/components/chart/XIndexRing.vue`<br>`apps/miniapp/src/components/chart/XTrendChart.vue` |
| `XJ-207` | `fe` | `apps/miniapp/src/pages/archive/index.vue`<br>`apps/miniapp/src/components/archive/DimCard.vue` |
| `XJ-208` | `fe` | `apps/miniapp/src/pkg-assess/question.vue`<br>`apps/miniapp/src/pkg-assess/result.vue`<br>`apps/miniapp/src/components/XRadar.vue` |
| `XJ-301` | `be` | `apps/server/prisma/schema.prisma`<br>`apps/server/prisma/seed.ts` |
| `XJ-302` | `be` | `apps/server/src/services/archive.service.ts` |
| `XJ-303` | `be` | `apps/server/src/services/tier.service.ts` |
| `XJ-304` | `be` | `apps/server/src/controllers/game.controller.ts` |
| `XJ-305` | `be` | `apps/server/src/services/home.service.ts` |
| `XJ-401` | `fe` | `apps/miniapp/src/pkg-points/checkin.vue`<br>`apps/miniapp/src/components/points/CalendarGrid.vue`<br>`apps/miniapp/src/components/points/RewardTrack.vue` |
| `XJ-501` | `fe` | `apps/miniapp/src/pages/me/index.vue` |
| `XJ-601` | `ds` | `apps/miniapp/src/icons/graphics`<br>`apps/miniapp/src/xj/graphics.ts`<br>`apps/miniapp/src/uno.config.ts`<br>`apps/miniapp/scripts/fetch-graphics.js`<br>`docs/09_小程序图形资源替换说明_v2.3.md` |
| `XJ-602` | `be` | `apps/server/src/common/icon-enum.ts`<br>`apps/miniapp/src/xj/icon-map.ts` |
| `XJ-603` | `ds` | `apps/miniapp/src/static` |
| `XJ-701` | `fe` | `apps/miniapp/src/pkg-archive/trend.vue`<br>`apps/miniapp/src/pkg-archive/report.vue`<br>`apps/miniapp/src/pkg-archive/timeline.vue`<br>`apps/miniapp/src/pkg-archive/hospital.vue` |
| `XJ-702` | `fe` | `apps/miniapp/src/pkg-assess/test-balance.vue`<br>`apps/miniapp/src/pkg-assess/test-chair.vue` |
| `XJ-703` | `fe` | `apps/miniapp/src/pkg-plan/detail.vue`<br>`apps/miniapp/src/pkg-checkup/book.vue`<br>`apps/miniapp/src/pkg-checkup/coupons.vue` |
| `XJ-704` | `fe` | `apps/miniapp/src/pkg-module/store.vue`<br>`apps/miniapp/src/pkg-module/detail.vue`<br>`apps/miniapp/src/pkg-module/book.vue`<br>`apps/miniapp/src/pkg-module/buy.vue`<br>`apps/miniapp/src/pkg-module/orders.vue`<br>`apps/miniapp/src/pkg-module/transport.vue`<br>`apps/miniapp/src/pkg-module/lead-form.vue`<br>`apps/miniapp/src/pkg-module/vip.vue` |
| `XJ-705` | `fe` | `apps/miniapp/src/pkg-family/list.vue`<br>`apps/miniapp/src/pkg-family/view.vue`<br>`apps/miniapp/src/pkg-family/accept.vue` |
| `XJ-706` | `fe` | `apps/miniapp/src/pkg-me/tier.vue`<br>`apps/miniapp/src/pkg-me/requests.vue`<br>`apps/miniapp/src/pkg-me/messages.vue`<br>`apps/miniapp/src/pkg-me/settings.vue`<br>`apps/miniapp/src/pkg-me/advisor.vue`<br>`apps/miniapp/src/pkg-me/memories.vue` |
| `XJ-707` | `fe` | `apps/miniapp/src/pkg-points/passbook.vue`<br>`apps/miniapp/src/pkg-game/wheel.vue`<br>`apps/miniapp/src/pkg-game/cards.vue`<br>`apps/miniapp/src/pkg-game/quiz.vue`<br>`apps/miniapp/src/pkg-game/tree.vue`<br>`apps/miniapp/src/pkg-game/match3.vue` |
| `XJ-708` | `fe` | `apps/miniapp/src/pkg-auth/login.vue`<br>`apps/miniapp/src/pkg-auth/profile.vue`<br>`apps/miniapp/src/pkg-auth/consent.vue`<br>`apps/miniapp/src/pkg-me/privacy.vue`<br>`apps/miniapp/src/pkg-me/consents.vue`<br>`apps/miniapp/src/pkg-me/about.vue` |
| `XJ-801` | `qa` | `docs/10_验收_性能_v1.0.md` |
| `XJ-802` | `qa` | `docs/10_验收_无障碍_v1.0.md` |
| `XJ-803` | `qa` | `docs/10_验收_视觉回归_v1.0.md` |

## 3. 关键串行点提醒

- `apps/miniapp/src/pages.json`：**不纳入独占管理** —— 它是 `gitignore` 的构建生成物（`apps/miniapp/.gitignore:34`），由各页 `definePage()` 宏经 uni-pages 生成，不在版本控制内。新增路由只需**在自己的页面 `.vue` 里写 `definePage()`**；不要手改、也不要提交该文件。
- `apps/miniapp/src/style/index.scss`：`XJ-102` → `XJ-103` → `XJ-104` 严格按序；之后页面级 Issue 不得再改该文件（新令牌只能由 ds 追加）。
- `apps/server/src/controllers/app.controller.ts`：`XJ-302` → `XJ-303` → `XJ-304` 严格按序（同一个 936 行的控制器文件，多人同时改必然冲突）。`XJ-305` 只改 `home.service.ts`，与前三者无文件冲突，但需等 `XJ-302` 冻结数据契约。
- `apps/miniapp/src/components/home/HomeRender.vue`：`XJ-201` → `XJ-202` → `XJ-203` 严格按序。
- `apps/miniapp/src/icons/graphics/**` 与 `uno.config.ts`：`XJ-104` → `XJ-601` → `XJ-602`（图形资源三层必须保持一致）。