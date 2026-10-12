# 雪姬美业 · 六维健康平台（黑客松 MVP）

面向雪姬美业客户（以乐龄女性为主）的健康美学平台：六维测评、免费体检与合作医院转介、个性化门店养护方案、健康档案、会员分级权益与魔镜 AI 陪伴。

- 产品设计：[docs/01_产品设计与开发文档_v1.0（原始稿）.md](docs/01_产品设计与开发文档_v1.0（原始稿）.md)
- 本次迭代、演示指南与部署：[docs/02_产品设计与开发文档_v1.1（黑客松MVP迭代）.md](docs/02_产品设计与开发文档_v1.1（黑客松MVP迭代）.md)

## 组成

| 目录 | 说明 | 框架 |
|---|---|---|
| `apps/miniapp` | 用户端：微信小程序 + H5 演示版 | [unibest](https://github.com/feige996/unibest)（uni-app + Vue3 + TS） |
| `apps/admin` | 管理端 + 医院端 + 顾问移动工作台 | [pure-admin-thin](https://github.com/pure-admin/pure-admin-thin)（Vue3 + Element Plus） |
| `apps/server` | API + 规则引擎 + AI 网关 | NestJS + Prisma（SQLite） |
| `deploy` | 构建、上传脚本，Docker 运行配置 | Docker Compose，可选 Nginx |

## 本地运行

需要 Node.js 20+ 与 pnpm 9+。

```bash
pnpm install
```

```bash
pnpm db:reset
```

```bash
pnpm dev:server
```

```bash
pnpm dev:admin
```

```bash
pnpm dev:h5
```

- API：http://localhost:3000/api/v1
- 管理端 / 医院端：http://localhost:8848（登录页可点击演示账号，密码均为 `123456`）
- 小程序 H5 版：http://localhost:9000（登录页可选择演示客户）
- 微信小程序：`pnpm dev:mp`，用微信开发者工具导入 `apps/miniapp/dist/dev/mp-weixin`

`pnpm db:reset` 会删除并重建本地 SQLite 演示库 `apps/server/prisma/xueji.db`，只用于开发环境。

## 部署到 VPS

```bash
deploy/deploy.sh root@<服务器地址>
```

本地构建前端后上传，在 VPS 上用 Docker Compose 构建并运行（`restart: unless-stopped`，开机自启）。部署后访问 `http://<服务器地址>:3000/`（管理端）与 `http://<服务器地址>:3000/h5/`（小程序 H5 版）。详见迭代文档第 9 章。

## 大模型（可选）

管理端"系统管理 - AI 参数"填写任一 OpenAI 兼容服务（Base URL、模型、API Key）。未配置时，方案文案、魔镜对话等全部使用模板，功能完整可用。
