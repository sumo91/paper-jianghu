# 战斗系统实现完成度评审（架构视角）

> **冻结基线**：`bebd8e4`（2026-10-18 13:34 +0800，"fix(ui): show battle immediately and restore ring-only HP"）
> **评审日期**：2026-10-18 · 评审人：Lead（三轴并行审计 + Lead 复核）
> **验证基线**：`npm test` 148/148 pass · `npx tsc --noEmit` pass · `npm run build` pass（均在 `bebd8e4` 复跑）
> **证据工件**：`.audit/core.md`（引擎/数据）、`.audit/integration.md`（会话/挂机/UI）、`.audit/evidence.md`（验证/平衡/复现）
> **口径说明**：设计总表 v0.1 已被 Issue #1–#14 覆盖（`docs/design/一纸江湖_养成总表_v0.1.md:13`）；战斗实现规范以 **Issue #2 Combat v1** 为准，当前阶段目标以 **Issue #15 idle-first** 为准。本文所有百分比是评审判断，不是形式化度量。
> **注意**：评审期间仓库 HEAD 从 `256c735` 前移到 `bebd8e4`（其间落地 `d06bc2e` / `444ab87` / `bebd8e4` 三个表现层提交）。若后续 HEAD 继续前移，行号需复核；`reports/*` 在本评审中被审计脚本重写后已还原到提交状态。

---

## 0. 结论速览

**一句话**：战斗系统不是"引擎没写完"，而是**引擎已经过线，四个契约（时间、遥测、配置、验证）没有接上**，导致玩家实际能玩到的战斗深度和报告声称的完成度之间有明显落差。

| 口径 | 完成度（评审判断） | 说明 |
|---|---|---|
| A. headless 战斗规则核心（`resolveBattle` seam） | **≈75%** | 单引擎、纯函数、确定性、16 项规则测试、内容矩阵与 100h 基线；可直接作为后续开发地基 |
| B. Issue #2 "Combat v1"完整交付（含表现/配置/复盘/推演） | **≈55%** | 引擎与数据大部分交付，但战前配置闭环、战中信息面、战后复盘/推演基本未交付 |
| C. 设计 §5 "可研究的战斗系统" | **≈50%** | 心法/内功行为层、破招资源回路、克制对称性停留在数据占位或单向实现 |
| D. #15 idle-first 当前竖切（能挂、能成长、能换图） | **≈80%** | 闭环真实存在且可玩；但时间模型缺陷使真人节奏 ≠ 报告节奏，扣分 |
| **综合（B 为主口径）** | **≈55–60%** | 产品化与深度层是主要缺口，不是引擎能力 |

**五个最重要判断**：

1. **引擎设计质量高于完成度数字。** `resolveBattle` 是纯函数、不 import 任何 data、内容经 `BattleInput.player.content` 注入（`src/core/combat-v1.ts:1-3,1045,668-687`），随机统一走 seeded RNG。这是本项目最好的架构资产，改造成本低。
2. **战斗遥测在 session 边界被丢弃，锁死了表现层上限。** 引擎产出 `events/damageBreakdown/keyRounds/actionTrace/rngTrace`（`combat-v1.ts:754-782`），但生产调用全部 `captureEvents:false`（`src/core/session.ts:700,746,845`），只持久化 8 个字段 + 尾 12 行 log（`session.ts:125-134,757`），UI 展示尾 10 行（`src/ui/App.tsx:458`）。没有这个契约修复，任何"战报/意图/复盘"UI 都做不诚实。
3. **"策略在战前"的支柱落空。** 9 个优先级 preset 已定义，但 live 永远只用 starter 的 farm preset；无切换命令、无编辑 UI、无自定义规则解析（`session.ts:65-75`、`combat-v1.ts:1065-1067`、`progression.ts:664-671`）。farm 与 survival preset 由同一 builder 生成、规则完全相同（`data/combat-v1.ts:679-740`）。
4. **时间模型依赖调用频率，三类消费者三套节奏。** `advanceTo` 结算后丢弃未消耗秒（`session.ts:561,592`），在线 1s tick 与单次推进结果不同（实测 198 战/h vs 78 战/h），离线实际只有在线墙钟速率的 ~14%，并非 50%。**所有基于单次推进生成的报告（100h、idle-loop、README 指标）不能直接代表真人体验。**
5. **验证体系会"绿"，但不会"守门"。** 148 测试全绿、内容校验 PASS、报告可逐字节复现；但已提交报告已落后于代码（破军数值改动后未重跑）、矩阵失衡仍 PASS（100% / 46.7% / 53.3%）、UI/e2e 零自动化、CI 不拦截报告漂移。完成度声明目前只能当"最近一次人工测量"看，不能当持续保证。

---

## 1. 审计对象与验证基线

### 1.1 范围与方法

- **Axis 1（核心）**：`src/core/combat-v1.ts`（1909 行）、`src/data/combat-v1.ts`（1053 行）、派生属性（progression/itemization/stats）、旧 v0.6 引擎与数据、`tests/combat-v1.test.ts`（16 项）。
- **Axis 2（集成）**：`JianghuSession`、world 遭遇适配、挂机/离线、`App.tsx` 战斗簇/战报、concept A–D 对照、命令面。
- **Axis 3（验证）**：全量测试/类型/构建/内容校验/100h 模拟/闲置循环模拟的实跑与报告复现，README/报告声明逐条核验。
- Lead 复核：关键探针亲自复跑（1s tick vs 单次推进、8h 离线、59/61 分钟阈值、离线换图），并在冻结 HEAD 上复跑 `npm test`/`tsc`/`build`。

### 1.2 命令实录（`bebd8e4`）

| 命令 | 结果 |
|---|---|
| `npm test` | 148 tests / 148 pass / 0 fail（`duration_ms≈10s`；其中 3×100h 验收单条占绝大部分耗时） |
| `npx tsc --noEmit` | pass，无输出 |
| `npm run build` | pass（vite，121ms，`dist/` 正常） |
| `npm run content:check` | PASS — checks 10 / matrix 60 / dominant taiji 33.3%（审计重跑值；脚本会重写报告，已还原） |
| `npm run sim:v1` | 9/9 runs 完成；两次运行 JSON 逐字节一致（确定性成立） |
| `npm run sim:idle` | 10/30 分钟指标可逐值复现（但见 §2.1 节奏口径） |
| `npm run pwa:check` | PASS（结构检查；非逐像素/交互验证） |

### 1.3 证据的边界

- 100h/500h 报告是**模拟基线**，不是玩家日历；报告本身已声明这一点，但 README 面向玩家的指标引用未区分。
- 已提交 `reports/combat-v1-100h.md`/`reports/content-v1.md` 的数字**与当前代码不一致**（审计重跑实证，见 §6 P1-2）；本文引用模拟结论时以"审计重跑"注明。
- UI 无 Playwright/组件测试，`reports/ui-idle-*.png` 手工截图不可自动化复现（`reports/ui-v1-smoke.md:5`）。

---

## 2. As-built 系统地图

### 2.1 分层与依赖方向

```text
UI (App.tsx / sessionStore.ts)
  │ 每 1000ms：advanceSession() → session.advanceTo(now, {offline?})
  │ 玩家操作：dispatch({ newGame|travel|setActivity|learnArt|equipArt|equipItem|stop|resume })
  ▼
JianghuSession (src/core/session.ts) —— 唯一可变状态所有者
  ├─ 遭遇：generateEncounter → createEncounterBattle（world 适配，1–3 敌 → 单个 BattleEnemyDef）
  ├─ 战斗：resolveBattle(BattleInput) → BattleResult（纯函数、seeded、同步批处理）
  ├─ 结算：奖励/XP/掉落/目标掉落/首通/换图（奖励公式内联在 session.ts:216-234）
  ├─ 记录：lastBattle（8 字段 + 尾 12 行 log）、recentLog、offlineReport
  └─ 存档：整状态 JSON envelope（schema 1；contentVersion 校验）
        ▲ 内容注入（不反向依赖 data）
CombatContent（data/combat-v1.ts） · World 内容（data/world-v1.ts）
Itemization / BuildProgression（派生 mods、loadout、preset、心法/经脉）
```

**依赖方向是干净的**：引擎只 import `core/rng`、`core/stats`（仅 clamp）、`core/types`（仅 GearSlot 类型）；data→core；session→data+core；UI→snapshot。这正是 Issue #2 要求的"单一纯 seam"。

**但要指出两条回边**：

1. v1 的 base 属性仍架在 v0.6 数据上：`data/combat-v1.ts:26-29` → `data/builds.ts` → `core/stats.ts` → `data/arts.ts`。两代内容同时存在。
2. 成长循环有两份：live `session.ts` 与报告用 `sim-v1.ts`，不是同一 driver（见 §6 P0-2）。

### 2.2 模块职责与真实状态

| 模块 | 职责 | 状态 |
|---|---|---|
| `combat-v1.ts` | 规则引擎（唯一 live seam） | **真实、完整、确定性** |
| `data/combat-v1.ts` | 20 武学 / 3 内功 / 12 心法 / 6 奇穴 / 10 同伴 / 9 preset / 3 starter kit / sheet 构建 | 真实；部分深度为"数值壳" |
| `data/world-v1.ts` | 15 图 / 30 普通 / 10 精英 / 15 首领 / 10 词缀 / 地图 modifier；敌阵合成 | 真实；多敌=聚合单敌 |
| `session.ts` | 挂机循环、结算、存档、离线 | 真实；时间模型有缺陷、离线契约漂移 |
| `sim-v1.ts` | 100h headless 模拟 | 真实但是**第二套成长循环** |
| `world-v1.advanceOffline` | 离线契约（不换图、停止条件） | **有实现、有测试、生产未使用（死路径）** |
| `sim/idle-loop-report.ts` | idle-first 指标 | 真实会话，但单次推进口径 |
| `App.tsx` 战斗簇/战报 | 战斗呈现 | 可用但为"战后摘要"；非实时战斗面 |

---

## 3. 分层完成度矩阵

| # | 层 | 完成度 | 主要依据 | 判断 |
|---|---|---|---|---|
| L1 | 契约/数据模型 | **≈75%** | 纯 seam + 强类型 union + 内容注入 + 确定性可测；扣分：死字段（`affixIds`/`weaponType`/`scope`）、心法绑定与自定义 preset 的"假契约"、两套存档模型 | 可直接复用 |
| L2 | 规则引擎 | **≈72%** | 8 状态、类型克制、元素匹配、14 种优先级条件、阶段/词缀/modifier/DoT/反伤/回合上限；16 项规则测试覆盖核心路径 | 能跑，深度语义不足 |
| L3 | 内容资产 | **≈65%** | 广度达标（15 图、20 武学、9 preset、3 kit、10 词缀）；校验 10 层 PASS。深度不足：心法/奇穴/经脉/内功 3-6-9 ≈ 纯 +stat；双源数据已漂移；同伴双契约 | 量足质浅 |
| L4 | 构筑/配置闭环 | **≈30%** | 6 槽配招/学招/手动装备真实；preset 切换/编辑、换层、守关入口、速度、推演全缺；自定义规则引擎不认 | **最大产品缺口** |
| L5 | 战斗呈现/战报/复盘 | **≈25%** | 战斗簇（D 的方向、信息量低）+ 战报弹层（尾 10 行）；无进行中状态/意图/内力/status/ticker/伤害分解/关键回合/复盘建议/历史 | 上限被遥测契约锁死 |
| L6 | 会话/挂机/离线集成 | **≈65%** | 链路完整可玩、存档/离线/幂等有测试；时间模型依赖 tick、离线自研且换图、报告字段不上屏 | 能挂但不精确 |
| L7 | 平衡与验证 | **≈52%** | 148 测试、矩阵、可复现报告是真实资产；但提交件 stale、阈值过宽、单 seed、无门禁、双 harness 漂移 | 绿但不守门 |
| L8 | UI/端到端/可访问性 | **≈15%** | 零组件/e2e 测试；战斗数据字号 8–11px；`aria-label` 恒为"战斗中"；无焦点管理；截图不可复现 | 工程空白 |

> 加权（按"完整战斗系统"口径，L4/L5 权重较高）后综合约 **55–60%**；只看 L1–L2 的 headless 核心约 **73%**。

---

## 4. 做对了什么（架构资产，不应在返工中丢掉）

1. **单一纯 seam**：`resolveBattle(BattleInput): BattleResult`，无 IO/无 `Date`/无全局随机（`combat-v1.ts:1045,1071`）。生产、模拟、内容矩阵、同伴/活动/终局全部走它。
2. **依赖倒置**：引擎不 import data，内容注入。这是让"改数值不改引擎、加内容不加分支"成立的关键。
3. **数据驱动优先级**：从 v0.6 的代码函数改为 `PriorityCondition` 数据 union（`combat-v1.ts:420-573`），方向正确、可扩展。
4. **确定性可验证**：统一 RNG；同 seed 的 events/actionTrace/damageBreakdown 深等（`tests/combat-v1.test.ts:441-458`）；100h 报告两次运行逐字节一致。
5. **前瞻的 telemetry**：即使当前无人消费，`events/damageBreakdown/keyRounds/actionTrace/rngTrace` 的设计是对的（`combat-v1.ts:729-782`）——修复成本远低于重建。
6. **内容治理**：10 层校验 + 60 格矩阵 + 报告由代码生成（`src/core/content-pipeline.ts`、`src/sim/report-v1.ts`），在原型阶段属于超配资产。
7. **会话职责边界大体正确**：UI 通过 snapshot/dispatch 读写，不直接持规则；battle 批量计算结果由 session 应用奖励。

---

## 5. 规格符合度（Issue #2 / 设计 §5）

### 5.1 已交付（有代码、有测试或有生产调用）

- 6 主动槽（4 招 + 绝技 + 轻功）、4 心法、1 内功、2 奇穴、1 主战 + 2 助威同伴、6 装备槽的**结构契约与校验**（`combat-v1.ts:271-414`）。
- 普攻永远可用、0 内力、回内力、可会心/克制（`combat-v1.ts:472-487`）。
- 自动回合制：每回合先亮意图 → 优先级选招 → 身法定序 → 结算（`combat-v1.ts:1159-1176,1726-1771`）。
- 类型三角：实断气、虚破架、架挡实并借力反打；元素匹配 +20%/太极 +10%（`combat-v1.ts:824-829,993-998,1242-1277,1508-1548`）。
- 状态系统、毒 DoT、破甲、封穴、蓄力、禁疗字段；命中/闪避、会心/暴伤、招架减伤、反伤、吸血、治疗加成等二级属性（`combat-v1.ts:54-125,903-957,1409-1442`）。
- 绝技门槛（连击 ≥3 或内力 ≥50%）、冷却、轻功低频功能位（`combat-v1.ts:489-500`）。
- 敌人意图/阶段（threshold + announcement + 换 pattern）、精英词缀（BattleModifier 注入）、Boss 狂暴/单回合伤害封顶/反伤（`combat-v1.ts:588-622,1032-1039,1358-1364,1719-1724`）。
- 回合上限、`survive` 目标、胜负 reason、确定性回放字段。
- 内容矩阵/100h 基线/报告生成、ID 与跨引用校验、存档 contentVersion。

### 5.2 部分交付（有数据/引擎能力，但玩家可达性或语义不完整）

| 规格项 | 现状 | 缺口 |
|---|---|---|
| 三套预设（刷图/首领/守关） | 9 个 preset 数据 + `BuildProgression.savePreset/loadPreset` 服务 | live 无切换命令/UI，永远 farm preset；farm 与 survival 规则完全相同；每套 9–11 条 > 设计 ≤6 条；含未装备 `common_*` 规则运行时被跳过 |
| 条件优先级编辑 | 引擎支持 `priorityRules` 覆盖与 14 种条件 | 无编辑入口；自定义 preset 即便保存，引擎只解析 `content.priorityPresets`，自定义 ID 退化为普攻 |
| 心法"改变行为" | 4 槽、绑定校验、UI 展示 | 引擎从不读 `heartTargets`；4 个心法 mods 全量相加；全部是 +stat |
| 内功 3/6/9 特效 | 有 per-art 数据（`progression-v1.ts:112-127`） | 战斗用**统一硬编码** guardReduction/innerRegen（`data/combat-v1.ts:909-911`），per-art 数据不进战斗 |
| 经脉/精通 | 3×12 节点、6 奇穴、熟练变体数据齐 | 全部是纯 stat mods；"至少 3 套可行方案"未验证 |
| 连招 | starter→chase→finisher 叠层、绝技清层 | 终结不消耗连击层数；`finisher` 分支恒 +1（`combat-v1.ts:1024` 死三元）；无"破招→借力/内力/连击"资源回路 |
| 克制对称性 | 玩家→敌人方向完整 | 敌方虚招不破玩家架（`combat-v1.ts:1508-1515` 只处理实招减伤）；气招只单向可被打断；玩家架招缺天敌 |
| 同伴助战 | 引擎支持条件触发/冷却的 `activeCompanion` | live 从不传入（`session.ts:737-747`），走 `CombatContent.companions` 的 every-4 简化 fallback；羁绊不参与战斗 |
| 多敌遭遇 | 1–3 敌聚合为一个 `BattleEnemyDef` | 无选目标/逐个击杀/波次；HP 条是聚合血量；聚合公式无测试（`data/world-v1.ts:842-890`） |
| 失败与疗伤 | 失败掉层 + 安慰修为 | 无银两损失/受伤/回城疗伤；失败仍正收益（`session.ts:801-810`） |
| 战斗节奏 | 普通怪 p50≈7 回合（达标） | 首领 p50≈18 / p90≈26 / max=30，超出设计 15–25 回合区间（core probe） |

### 5.3 未交付（Issue #2 明确要求或设计 §5 明确要求）

- **战前**：敌情卡（流派/属性/意图 pattern/推荐克制/风险评估）——当前地图页只有名称/流派/等级/精英标记。
- **战中**：双方内力、状态 chips、当前意图、三行 ticker、速度/自动指示、可展开完整 log；"进行中战斗"数据结构不存在。
- **战后**：关键回合、按技能/类型/会心/DoT 的伤害分解、一句"为什么赢/输"、调整配置再战、战报历史。
- **推演/木桩**：同 seam、零奖励、选敌测试 build——无入口。
- **1x/2x/4x 加速**：无概念、无参数、无 UI。
- **复盘建议生成**：全仓无实现；引擎 telemetry 无消费者。
- **战斗中锁定 loadout**：当前行止中可随时切换主动技能（`equipArt` 无 active 校验，`session.ts:471-484`）；由于战斗是同步批处理，"战斗进行中"本身不可表示，Issue #2 用户故事 6 的约束无法按原意落地，需要显式定义"行止中是否允许改配置"。
- **UI 只从 `BattleResult`/events 渲染、不重算规则**：部分违反——UI 用启发式推断精英/首领（`App.tsx:391-392`）、硬编码玩家名"沈砚"（`App.tsx:417`）、从 log 正则提取技能名。

---

## 6. 关键架构风险（按严重度）

### P0-1 时间契约断裂：进度速率取决于 `advanceTo` 调用频率

**证据**：`advanceTo` 用"秒预算"循环，每次结算后 `lastSettledMs = nowMs`（`session.ts:561,592`），未消耗秒被丢弃；只有"active 且未推进"时才保留（`session.ts:588-591`）。UI 每 1000ms 调一次（`src/ui/sessionStore.ts:209-223`）。

**实测（冻结 HEAD，seed=3，taiji）**：

| 场景 | 结果 |
|---|---|
| 1h，1s tick × 3600 次 | **198 战 / 显示行止 3.33h / Lv22** |
| 1h，单次 `advanceTo` | **78 战 / 1.02h / Lv15** |
| 8h，1s tick | 1596 战 / Lv38 |
| 8h，单次离线结算 | 230 战 / effective 4h / Lv23（≈在线墙钟速率的 14%，不是 50%） |
| 59min 单次 | 76 战，无离线报告 |
| 61min 单次 | 45 战，有报告（effectiveHours 0.508） |

**影响**：README 的 10/30 分钟与 100h 日历、`idle-loop` 报告、离线收益口径全部建立在"单次推进"上，不能直接对齐真人 UI；同一 seed 的"确定性"只在固定调用节奏下成立。**这是完成度最大的隐性缺口，优先级高于任何表现层打磨。**

**修复方向**：session 内维护 `pendingSeconds`（余数进位），或改为固定 fight-step；把 session/sim/离线统一到同一 stepping driver，并加"不同 cadence 收敛到同一结果"的测试。

### P0-2 成长循环双份：报告验证的不是玩家实际循环

**证据**：Issue #1 明确要求"bulk simulate 重构为同一套 stepping rules 的 thin headless driver，live session 与 100h 基线不能漂移"（issue #1 "One session seam, one source of truth"）。现状 `sim-v1.ts` 复制了 chooseNextMap/奖励/装备/换层/经济流程，且**没有** session 的首小时宽容（`session.ts:721-738`）和失败补偿（`session.ts:801-810`）。

**实测（seed=1，100h 在线，审计探针）**：

| Build | 真实 `JianghuSession` 到宗师 | `sim-v1` 报告 | 场次差 |
|---|---|---|---|
| 太极 | 71h | 78.7h | +300 左右 |
| 破军 | 70h | 74.2h | 相近 |
| 玄阴 | 78h | 84.7h | 相近 |

**影响**：报告可以证明"引擎+一条循环能到宗师"，不能证明"玩家那条循环的节奏/胜负/经济"。平衡结论因此只有方向参考价值。

**修复方向**：抽出 `IdleStepper`（一次推进的完整规则：战斗→奖励→成长→换层→掉落），session 与 sim-v1 共用；报告改为"真实 session 驱动"。

### P0-3 遥测契约断裂：战斗结果信息在 session 边界被丢弃

**证据**：引擎返回 `events/damageBreakdown/keyRounds/actionTrace/rngTrace/finalPhase/companionCasts`（`combat-v1.ts:754-782`）；生产调用全部 `captureEvents:false`（`session.ts:700,746,845`）；`lastBattle` 只有 8 字段 + 尾 12 行 log（`session.ts:125-134,757`）；UI 显示尾 10 行（`App.tsx:458`）。

**后果**：
- 21 回合的战斗在战报里只剩最后一回合尾巴，且日志泄露内部 rule id（如 `priority_taiji_farm_ult`，`combat-v1.ts:1746`）。
- 无法诚实实现"战中意图/状态/内力/ticker"和"战后伤害分解/关键回合/一句 why"；概念 A–D 中任何一个方向都做不出来。
- `damageBreakdown` 把双方伤害、反伤、环境、同伴混在一个账本，键语义未文档化，即使接出也需先规范化。

**修复方向**：新增 `SessionBattleReportV2`：encounter 元数据（kind/level/style/affix/firstClear）+ 每回合精简事件（intent/action/hit/key）+ 伤害分解 + 一句 why；保留最近 N 场；`captureEvents` 只在需要时开启（性能可接受：100h 模拟 2.9–7.3s/run）。

### P0-4 配置契约断裂：玩家不可达"策略在战前"

**证据**：
- `JianghuCommand` 仅 9 个命令（`session.ts:65-75`），无 preset/priority/速度/换层；UI 武学页的优先级是只读展示（`App.tsx:735,830-835`）。
- 9 个 preset 定义（`data/combat-v1.ts:737-748`），live loadout 始终是 farm preset；farm/survival 由同一 builder 生成、规则相同（`:679-740`）。
- 自定义 preset 可保存（`progression.ts:664-671`），但引擎只解析 `content.priorityPresets`（`combat-v1.ts:1065-1067`）→ 自定义 ID 没有对应对象，退化为普攻。
- 每套 preset 9–11 条规则，超出设计"最多 6 条"（设计 §5.6），且前两条 `common_*` 在 starter loadout 中未装备、运行时被跳过。

**影响**：设计支柱"策略在战前、战斗中不操作"实际上变成"一套 farm preset 通吃"。而矩阵中 taiji farm preset 15/15 全胜，正是"同优先级通吃"（设计 §5.10 第 5 条）的直接反证。

### P1-1 深度语义名实不符：心法/内功/经脉/连招的"行为层"

- **心法绑定是装饰性契约**：`heartTargets` 有校验/UI/存档（`combat-v1.ts:368-375`、`progression.ts:508-523`），但引擎零消费；`heartMods` 把 4 个心法 mods 全量相加（`progression.ts:689-700`）。core probe：交换绑定后 events/伤害完全一致。
- **内功特效脱节**：per-art 的 3/6/9 效果数据（`data/progression-v1.ts:112-127`）只在服务/展示层；战斗统一硬编码（`data/combat-v1.ts:909-911`），三类内功增量完全相同。
- **经脉/精通 = 纯数值**：36 节点 + 变体全为 stat mods；设计的"至少 3 套可行方案"没有验证机制。
- **破招无资源回报**：设计 §5.4 要求破招获得借力/内力/连击；v1 只有伤害倍率（破架 1.15+breakDamage、断气 1.1），没有资源回路；v0.6 的借力资源在 v1 被删除且未用数据化方式补回。
- **终结语义与设计不一致**：设计说"终结招消耗连击层数打爆发"；实现是"终结招照样 +1 层，绝技才清零"（`combat-v1.ts:1012-1030`，`:1024` 三元两分支相同）。若以 Issue #2 为准可接受，但需要在设计文档中显式 supersede，否则是验收歧义。

### P1-2 平衡与验证"绿而不守门"

- **同层矩阵失衡**（审计重跑；已还原提交件）：taiji 15/15=100%、hybrid 15/15=100%、玄阴 8/15=53.3%、破军 7/15=46.7%。设计 §5.10 第一条"至少 3 套胜率接近"**不成立**；hybrid 只是 taiji 换 1 招（`content-pipeline.ts:230-238`），60 格实际只有 3 个不同 build，按不重复 build 计 taiji 占比 50%。
- **阈值过宽**：`dominantShare ≤ 0.6`（`content-pipeline.ts:274-283`）对 4 build 均分 25% 来说几乎不可触发；100/46.7/53.3 仍 PASS。
- **失衡最可能主因**：玩家架招默认减伤 0.5（`combat-v1.ts:1846`），starter 实战可叠到 0.72–0.87（core probe），而敌方虚招不破玩家架、气招不给压力 → 架招循环缺天敌；taiji 因此 100%。
- **100h 胜率不能证明强度接近**：99.96% / 92.88% / 96.53% 的差异被"失败廉价"（掉层 + 安慰修为）掩盖；破军胜率最低却最快到宗师（场均回合最短 = 速度换容错）。
- **提交件 stale**：`reports/combat-v1-100h.md` 生成于 `bfeeb1e` 破军数值改动之前；审计重跑：破军 L47→48、宗师 76.5→74.2h、胜率 86.21→92.88%、日历 15.3→14.8 天；README:81/83 仍引用旧值（15.3–16.9 天 / 34.1%）。CI 只跑 `content:check` 并上传 artifact，不 diff、不失败；nightly 同理。
- **验收阈值口径不一**：`tests/acceptance-v1.test.ts:32,34` 守 10%/24h；README 的 5%/12h 只由 `tests/session-v1.test.ts:160-184` 覆盖且仅 seed=1。
- **单 seed 矩阵/无对照实验**：没有"同战力换 counter 翻转胜负"实验；没有"换 boss preset 改变结果"实验。

### P1-3 离线契约漂移

- `world-v1.advanceOffline` + `shouldStop` 有完整实现与单测（`src/core/world-v1.ts:520-640`、`tests/world-v1.test.ts:243-330`），注释明确"离线只推进当前图、不换图"；**session 完全没用它**，离线复用 `stepClear` 并会 `chooseNextMap`（`session.ts:794,898`）。实测 seed 1–5：8h 离线后洛阳 → 黑市，5/5 一致，违反 `reports/economy-v1-500h.md:72,78` 的"离线不会自动换图"。
- `offline` 由 `elapsed >= 1h` 推断（`session.ts:560`）；<1h 的回归按 100% 速率静默结算且无报告，1h 处不连续（59min vs 61min 实测见 P0-1）。
- `OfflineReportV1` 有 xp/renown/loot/levels，但 UI banner 只展示 effectiveHours/场次/胜/等级/掉落数/银两（`App.tsx:204-215`）；8h 离线显示"4.0h 结算"（有效小时当总时长）、`stoppedBy` 直接渲染英文 code。
- 离线期间试炼不入 `lastBattle`、不计数；活动失败/结束只置 `active=false`。

### P1-4 双引擎 / 双内容源债务

- v0.6 引擎与数据约 3.2k 行仍被 `npm run sim`、`src/core/sim.ts`、9 项旧测试保活；v0.6 报告仍称"冻结基线"（`reports/balance-v0.6.md:90`），而 v1 报告说 v0.6 不再是不变契约（`reports/combat-v1-100h.md:19`）——对外口径两套。
- 武学/心法/奇穴/同伴在 `data/arts.ts`（v0.6）与 `data/combat-v1.ts`（v1）各写一遍，且已漂移：`pojun_wanjun` 系数 1.65 vs 2.0、`xuanyin_wangu` 1.4 vs 1.8、`hm_jieli` mods 不同；敌人 pattern 三份拷贝。
- 同伴双契约：`CombatContent.companions` 10 人（every-4 简化）vs `CompanionService` 8 人（条件触发/羁绊）；`comp_suwan`/`comp_heiqiu` 只存在于前者，却被 starter kit 支援位和 progression 解锁表引用；`content-bundle` 同时收两份，跨引用校验不比对一致性 → `content:check` 放行。
- `sim-v1.ts` 与 live 的差异（P0-2）是比"双引擎"更实际的漂移点。

### P1-5 引擎数值完整性缺陷（可修，但影响平衡可信度）

| 缺陷 | 位置 | 影响 |
|---|---|---|
| `executeBonusPct` 双计：先加入 offense，再乘 `(1+execute)` | `combat-v1.ts:1327-1352` | 破军斩 0.4 → ≈1.96x（应 1.4x），绝技 0.3 → ≈1.69x；无测试 |
| `evadeBuff` 回合开始清零、减伤硬编码 0.15 | `combat-v1.ts:1155,1503` | 轻功"保命"只在玩家先手且当回合生效；速度加成（`:1761`）实际永不生效；技能数据 0.15/0.2 被覆盖 |
| `healBlock` 是 fighter 字段而非 status | `combat-v1.ts:1433-1441` vs `:524-525`、`:1625` | `statusOnEnemy: healBlock` 条件与"allyDebuffed"触发永远不会命中 |
| 死字段/死语义 | `affixIds`(:621)、`BattleSheet.weaponType`(:173)、`BattleModifier.scope`(:645)、`playerStunnedThisRound` 只写不读、敌方 `guardReduction` 不参与 | 类型/契约噪音，误导后续开发 |
| 9 类乘区 vs 设计 ≤4 | `combat-v1.ts:1336-1355` | 数值失控风险；无 balance 常量模块，魔法数字散落引擎 |
| enrage/damageCap/reflectPct/extraHits/execute | 引擎实现 | **零直接测试** |

### P2 呈现、可测性、可访问性、遗留

- **战斗 UI 是"赛后摘要"**：`BattleCluster` 在地图上显示战后双方 HP/总伤害/胜负（`App.tsx:380-435`）；"伤害数字"实为整场 `damageDealt`，配无限循环动画，像单次命中；战报弹层读实时 `snapshot.lastBattle`，下一场会静默替换。
- **启发式推断**：用 `enemyName === elite.name` 判精英——多敌精英名是"精英、小怪"（`data/world-v1.ts:889`），永远匹配不上；`mapLayer>=10` 把所有第 10 层战斗标成首领；玩家名硬编码"沈砚"（`App.tsx:417`），不读 `snapshot.playerName`。
- **A11y 退化**：战斗簇 `aria-label` 恒为"战斗中"（`App.tsx:407`）；HP 环 `aria-hidden` + 裸百分比；战报弹层无 Escape/焦点陷阱；战斗数据字号 8–11px。
- **可测性空白**：无 `.test.tsx`/Playwright；`reports/ui-idle-*.png` 每提交重生成但不可复现（`reports/ui-v1-smoke.md:5`）；审计期间 13:27–13:34 连续 3 个战斗簇外观提交（`d06bc2e`→`444ab87`→`bebd8e4`）均为表现层微调、未加测试、无契约变化，且 `d06bc2e` 删除了 `256c735` 刚加入的 ticker/回合数/`aria-live`，CSS 死代码累积。
- **测试/CI 结构**：148 中含 9 项 legacy v0.6；单条 3×100h 验收占套件绝大部分时长；`content:check` 名为 check、实为会写受版本控制报告的生成器；无 golden/阈值门禁、无 fuzz/seed sweep、无性能/长离线基准确认。
- **多敌语义需产品决策**：聚合公式（HP 求和 ×0.9、攻击均值 ×1.05^(n-1)、取最高身法、pattern 交错截断每敌 2 招，`data/world-v1.ts:842-890`）无测试、无文档化平衡影响；若后续要"逐个击破"需重构敌阵模型。

---

## 7. "完成"应该怎么定义

当前"完成度"争议的根源是**三个不同的完成定义被混用**：

| 定义 | 判断 | 说明 |
|---|---|---|
| D1. Issue #2 第一里程碑：headless `resolveBattle` + 测试 + 代表战斗矩阵 | **≈85% 完成** | 报告自己也声明"战斗 UI 尚未在本 issue 引入"（`reports/combat-v1-100h.md:83`），按该里程碑可说"过线" |
| D2. Issue #2 全量交付（含战前/战中/战后、preset、推演、复盘） | **≈55% 完成** | 但 #2 已 closed；现状是"以里程碑范围关闭了完整 spec" |
| D3. 设计 §5"可研究、搭配、读懂的战斗" | **≈50% 完成** | 心法/内功行为层、克制对称、破招资源回路缺失，导致"研究"空间主要退化为数值与 preset 顺序 |
| D4. #15 idle-first 竖切"挂着有意思" | **≈80% 完成** | 可玩闭环成立；时间模型 bug 使得"真人节奏"尚未被报告验证；#15 用户故事 19（战报解释胜负）未完成 |

**建议**：对外表述采用 D2/D3 口径（"战斗系统约 55–60%"），并**补开 follow-up issues** 承接 D2 未交付项，而不是把 #2 的 closed 当作战斗系统已完成的证据。

---

## 8. 建议路线图（按依赖排序，而非按功能堆叠）

### Phase 0：把契约修好（P0，最高 ROI）

1. **统一时间模型**：`advanceTo` 保留 `pendingSeconds`；session/sim/离线共用同一 fight-step；新增测试：同一 seed 同一总墙钟下，1s/10s/60s/单次 cadence 结果一致（允许固定容差）；离线 8h 与在线 8h 的场次比 = 50%（±容差）。
2. **统一成长 driver**：抽 `IdleStepper`，`sim-v1` 改为薄驱动；100h 验收改跑真实 session 等价路径。
3. **战斗报告契约 v2**：session 存精简时间线 + encounter 元数据 + 分解 + why；UI 战报从它渲染；战斗中锁定 loadout（Issue #2 用户故事 6）。
4. **配置闭环**：`setPreset` / `setPriorityRules` / `setSpeed` / `startTrial` 命令；引擎解析 `build.priorityPresets`；规则校验（≤6 条、必须有 fallback、引用已装备技能）；UI 先做 preset 三选一 + 规则只读，再做编辑。

**验收**：同一 seed 下 cadence 收敛；8h 离线 50% 对齐；20 回合战斗可完整复盘；boss 战切换首领 preset 能改变结果；战斗中不可改招。

### Phase 1：把"研究面"做出来（P1）

5. **战前**：敌情卡（意图 pattern/类型/属性/危险度/推荐克制）+ build 摘要 + 预估风险。
6. **战中/回放**：基于 v2 契约做 6–15s 轻量回放或"最近一场逐回合战报"（二者选一，先明确产品方向）。
7. **战后**：伤害分解、关键回合、一句 why、再战/调配置。
8. **推演/木桩**：零奖励、选敌、同 seam。
9. **离线**：统一走 `advanceOffline` + `shouldStop`；<1h 也给总结；报告字段上屏；修 `stoppedBy` 文案。
10. **平衡**：先修 taiji 架招缺天敌的问题（敌方虚破架/气招压力/架招资源），再调破军/玄阴；矩阵阈值从 60% 收紧到 ~35–40% 并按不重复 build 计数；重跑并提交报告；README 同步。
11. **CI 门禁**：golden 报告 diff 或阈值 assert；nightly 失败即红；`content:check` 拆分 check/generate。

### Phase 2：深度与清理（P1/P2）

12. **深度行为层**：心法按绑定招式生效、per-inner 3/6/9 进战斗、破招资源回路（借力/内力/连击）、敌方类型三角对称、终结消耗层数（或以 Issue 明确 supersede 设计）。
13. **引擎修复**：execute 双计、evadeBuff、healBlock、死字段、乘区收敛、balance 常量模块；补 enrage/damageCap/multi-enemy 聚合/extraHits/execute 测试。
14. **清债**：删除或归档 v0.6 引擎与数据（迁移 `npm run sim` 历史）；统一同伴契约；删除死 CSS/未渲染组件（`TutorialSlip` 等）；补种子扫描/fuzz。
15. **UI 质量**：从 snapshot/报告派生一切（不猜 rank/名字）、a11y（aria-live/焦点/字号）、组件测试/Playwright smoke、截图可复现。

---

## 9. 需要人类/产品拍板的问题

1. **#2 的关闭语义**：战斗表现/配置/推演/复盘未交付，是补 follow-up issue，还是重开 #2 部分范围？（建议前者，明确"headless milestone 已完成，产品化另立"）
2. **战斗表现方向**：A 卷轴 / B 书页 / C 战况带 / D 头像互撞——当前是 D 的视觉壳。选择方向会决定"进行中战斗/回放"契约的形态，必须先拍板再投入。
3. **多敌语义**：v1 接受"合阵单血条"吗？若要逐个击破，需要目标选择模型与平衡重算，成本显著。
4. **深度层优先级**：心法行为/内功特效是否 v1 必须（设计说是 build 核心）？若是，应优先于更多 UI。
5. **idle-first 阶段边界**：#15 当前口径允许研究面后置，但 #15 用户故事 19 要求"战报解释胜负"，两者矛盾；需明确当前阶段是否豁免。
6. **时间模型的产品语义**：玩家看到的"行止时间"应是墙钟还是模拟战斗时间？离线收益按墙钟 50% 是硬承诺吗？这会决定 P0-1 的验收标准。

---

## 10. 风险登记（摘要）

| ID | 风险 | 级别 | 影响面 | 证据 |
|---|---|---|---|---|
| R1 | 时间模型依赖调用频率 | P0 | 所有节奏/离线/报告可信度 | §6 P0-1 实测 |
| R2 | 成长循环双份 | P0 | 平衡结论/回归 | §6 P0-2 |
| R3 | 战斗遥测丢弃 | P0 | 表现/复盘/推演全部 | §6 P0-3 |
| R4 | 配置闭环断裂 | P0 | 核心玩法支柱 | §6 P0-4 |
| R5 | 心法/内功行为层缺失 | P1 | build 深度/长期留存 | §6 P1-1 |
| R6 | 平衡失衡 + 验证过宽 + 提交件 stale | P1 | 玩家体验/发布判断 | §6 P1-2 |
| R7 | 离线契约漂移 | P1 | 放置核心承诺 | §6 P1-3 |
| R8 | 双引擎/双源数据漂移 | P1 | 维护成本/隐性 bug | §6 P1-4 |
| R9 | 数值完整性缺陷 | P1 | 平衡/可解释性 | §6 P1-5 |
| R10 | 呈现/a11y/测试空白 | P2 | 质量/可维护性 | §6 P2 |
| R11 | 多敌聚合语义未决 | P2 | 内容扩展方向 | §6 P2 |
| R12 | #2 关闭语义与完成度口径 | 流程 | 对外声明/资源分配 | §7 |

---

## 附录 A：审计证据与复现

- 三轴详细证据（含逐条 file:line、probe 输出、命令日志）：`.audit/core.md`、`.audit/integration.md`、`.audit/evidence.md`、`.audit/logs-evidence/`。
- 冻结 HEAD：`bebd8e4`；最终验证：`npm test` 148/148、`tsc` pass、`build` pass。
- 复现关键探针（可按需重跑，不改仓库）：
  - `1s tick 1h` vs `单次 advanceTo(1h)` 的场次/模拟时长；
  - `advanceTo(8h)` 与 `59/61min` 的离线报告差异；
  - `sim:v1` 两次运行逐字节一致；`content:check` 重跑值 vs 提交件差异；
  - `node --test tests/combat-v1.test.ts` 16/16。
- 说明：审计期间 `reports/combat-v1-100h.*`、`reports/idle-loop-v1.*` 被审计脚本重写，已 `git checkout` 还原；`.audit/` 为未跟踪的审计工作区，可按需删除。

## 附录 B：一句话给不同角色

- **给产品**：玩家今天能挂机、能变强、能换招换图；但"为什么赢/输、下一场怎么配"还看不见，P0 不是加内容，是把时间/遥测/配置三个契约接上。
- **给主程**：引擎 seam 是好资产，不要重写；先做 `IdleStepper` + `SessionBattleReportV2` + 配置命令，再谈 UI 方向。
- **给平衡/QA**：现在的绿是"能复现"，不是"守得住"；报告 stale、矩阵失衡、阈值过宽、cadence 不唯一，任何一项都会让"完成度"声明失真。
- **给玩家**：这个江湖的"打"已经成立，"读招—配招—复盘"的循环还差最后一层产品化。
