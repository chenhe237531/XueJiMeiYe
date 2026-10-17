# 雪姬美业 · Issue 包使用说明

本目录由 `scripts/gen-issues.mjs` 生成，**不要手工编辑 Issue 正文**（改数据源后重新生成即可）。

## 目录内容

| 文件 | 用途 |
|---|---|
| `README.md` | 本文件：Agent 认领协议 |
| `BOARD.md` | 看板：波次、Agent 分工、依赖图、逐 Issue 索引 |
| `OWNERSHIP.md` | 文件独占表（多 Agent 并行防冲突的**唯一依据**） |
| `DECISIONS.md` | 21 项决议（**全部已定稿，无待定项**） |
| `issues.json` | 机器可读索引，供 Agent 自动筛选 |
| `XJ-*.md` | 单张 Issue 卡片 |
| `../scripts/issue-status.json` | **执行进度台账**（status / assignee / note），用 `--claim` / `--set-status` 读写 |

> **决策门已定稿**：`XJ-000` 状态为 `done`，21 项决议全部为「✅ 已定」。
> Agent 遇到决议未覆盖的边界情况时，按 `DECISIONS.md` 的「决议理由」自行裁量并在 PR 中说明，**不要停下来等确认**。
> `issues.json` 的 `decisionSummary.pending` 恒为 `0`。

## 为什么拆成 Issue

设计文档（`docs/06` ~ `docs/09`）是**给人看的**，Issue 是**给 Agent 执行用的**。每张卡都自带：

- 精确到文件的写入边界（`files_own`）与只读参考（`files_read`）
- 明确的依赖与解锁关系（避免并发等待）
- 可勾选的验收标准（可被机器或人逐条判定）
- 禁止事项（把踩过的坑固化成约束）

## Agent 认领流程

状态存在 `scripts/issue-status.json` 台账里（`status` / `assignee` / `note`），
**不要手改 `issues/*.md` 的 frontmatter**——那是生成物，下次生成就没了。

```bash
# 1. 拿下一个可认领的 Issue（自动跳过 deps 未完成的）
node scripts/gen-issues.mjs --next

# 2. 认领（会把状态置 claimed 并写台账；前置未完成会被拒）
node scripts/gen-issues.mjs --claim XJ-101 infra-agent
git add scripts/issue-status.json issues/ && git commit -m "chore(XJ-101): claim"

# 3. 建分支
git checkout -b feat/XJ-101-ci-check

# 4. 开发（只改 files_own 列出的文件）

# 5. 自检
bash scripts/ci-check.sh <你改动的文件列表>

# 6. 提交，置 in_review
node scripts/gen-issues.mjs --set-status XJ-101 in_review infra-agent
#    PR 标题：[XJ-101] 工程基建：构建与校验脚本化、CI 入口
#    PR 描述：粘贴 Issue 的「验收标准」并逐条勾选 + 验证证据

# 7. 合并后置 done，解锁下游
node scripts/gen-issues.mjs --set-status XJ-101 done
```

> 进度速查：`node scripts/gen-issues.mjs --check` 会打印各状态数量；`issues/BOARD.md` 有完成度概览。

## 并行策略

- **优先认领路径**：`XJ-101`（基建，全员依赖，工期最短）→ `XJ-102`（令牌）→ `XJ-105`（小镜形象）→ `XJ-106`（路由预登记）。这 4 个是解锁下游最多的节点。
- **可安全并行的组合**：`ds` 做 W1 地基的同时，`be` 可以并行做 `XJ-301` / `XJ-302`（互不碰同一文件）。
- **必须排队**：同一文件被多个 Issue 写入时，严格按 `OWNERSHIP.md` 的串行顺序合并。
- **不要跨波次抢跑**：W4 的页面 Issue 依赖 W3 的接口契约，接口未冻结前开工会导致返工。

## 状态流转

```
ready ──(认领)──> claimed ──(提交 PR)──> in_review ──(合并)──> done
                    │
                    └──(放弃/阻塞)──> ready（并留言说明原因）
```

## 发现 Issue 有问题怎么办

不要直接改 Issue 正文。在 `XJ-000` 下留言，由 `pm` Agent 更新数据源并重新生成。

## 校验

`node scripts/gen-issues.mjs --check` 会校验：依赖成环、悬空依赖、文件独占冲突、生成结果与磁盘一致。
