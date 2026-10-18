# 战斗系统验证证据 / 平衡基线 / 可复现性审计（Axis 3）

> 审计员：evidence-analyst（task-3）· 时间：2026-10-18 13:28–13:32 CST
> 仓库：`/Users/chaoliu/Documents/Ai/Games/IdleGames/JianghuIdle` @ `d06bc2e`
> 环境：macOS / Node v24.22.0 / `node --test` + TS 直接执行
> 约束：**未修改任何源文件**；`sim:v1`/`content:check`/`sim:idle` 会重写 `reports/*`（脚本设计如此），按要求只记录、不还原、不提交；唯一写入产物为 `.audit/`。

---

## 1. 命令实录（精确结果与耗时）

| # | 命令 | 结果 | 实测耗时 | 副作用 |
|---|---|---|---|---|
| 1 | `npm test` | **148 tests / 148 pass / 0 fail / 0 cancelled / 0 skipped**，`duration_ms 13979.333791` | `real 14.26s`（user 22.70s） | 无 |
| 2 | `npx tsc --noEmit` | **exit 0，无输出** | `real 0.69s` | 无 |
| 3 | `npm run content:check` | `PASS — checks 10, matrix 60, dominant taiji 33.3%` | `real 0.29s` | **重写 `reports/content-v1.{md,json,csv}` + `reports/release-manifest.json`** |
| 4 | `npm run sim:v1` | 9/9 runs 完成（3 builds × 3 seeds × 100h），每 run 2.9–7.3s | `real 38.09s`（user 27.16s） | **重写 `reports/combat-v1-100h.{md,json,csv}`** |
| 5 | `npm run sim:idle` | 10/30min 指标全部复现（见 §2.3） | `real 0.30s` | 重写 `reports/idle-loop-v1.{md,json}` |
| 6 | `npm run build`（附录） | `✓ built in 137ms`，dist 产物正常 | <1s | 写 `dist/`（允许） |
| 7 | `npm run pwa:check`（附录） | `PASS — manifest, sw, icons, shell, 14px CSS, orientation, reduced motion` | <1s | 无 |

必需 5 条命令总耗时 **≈ 53.6s**；为验证可复现性额外跑了 `sim:v1` 第二遍（+≈27s）与 3 次 `content:check`、真会话 100h 探针（+≈7s）。全部日志留在 `.audit/logs-evidence/`。
`npm test` 的 148 项中有 **1 项占 13521.6ms**（`acceptance-v1.test.ts` 的 3×100h headless 验收），即 96.7% 套件时长集中于单一长测；剩余 147 项约 0.46s。

### 1.1 测试文件分布（`grep -c '^test('`，合计 148，与 README:61/88 的 148 一致 ✔）

| 覆盖战斗的文件 | 项数 | 备注 |
|---|---|---|
| `tests/combat-v1.test.ts` | 16 | 唯一直接针对 `resolveBattle` 规则的测试 |
| `tests/world-v1.test.ts` | 13 | 遭遇生成、Boss 阶段、首通/保底、可通图 |
| `tests/session-v1.test.ts` | 19 | 真实会话：10min/30min/1h/8h 离线/存档/确定性/100h |
| `tests/companions-v1.test.ts` | 10 | 含 1 项 `resolveBattle` 同伴助战断言 |
| `tests/activities-v1.test.ts` | 10 | 守关（survive objective）等 |
| `tests/endgame-v1.test.ts` | 10 | 天机榜/赛季战斗接入 |
| `tests/content-pipeline.test.ts` | 6 | 10 层校验、60 格矩阵确定性、存档兼容 |
| **legacy v0.6 引擎（`src/core/combat.ts` + `src/core/sim.ts`）** | **9** | `combat.test.ts` 4 + `sim.test.ts` 4 + `acceptance.test.ts` 1 —— **不测生产战斗路径**，但计入 148 |

---

## 2. 可复现性：两次运行结果与已提交报告对比

### 2.1 确定性成立（好证据）

- `sim:v1` 连续跑两遍，`reports/combat-v1-100h.json` **`cmp` 逐字节相同（IDENTICAL）**；只差报告内 `生成时间` 文本与 csv 同值。
- 3 次 `content:check` 除 `generatedAt` 外 JSON 完全一致（固定 seed=31，见 `src/core/content-pipeline.ts:229`）。
- 引擎级：同 seed → `events`/`actionTrace`/`damageBreakdown` 深比较相等，异 seed 只改 `rngTrace`（`tests/combat-v1.test.ts:441-458`）。会话级：同 seed+时钟快照全等（`tests/session-v1.test.ts:148-158`）。

### 2.2 但**已提交报告已与当前代码漂移**（严重证据问题）

`reports/combat-v1-100h.md` 生成于 `2026-10-17T20:15:01Z`（`combat-v1-100h.md:3`），而 `bfeeb1e balance(idle): smooth first-hour starter progression`（2026-10-18 13:10 +0800）改了破军数值（`src/data/builds.ts: hp 1000→1060, defense 58→66, +damageReductionPct 0.06`）后才产生当前代码。重跑结果：

| 破军爆发（中位） | 已提交报告（stale） | 本次重跑 |
|---|---|---|
| 等级 / 境界 | 47 / 5 | **48 / 5** |
| 宗师时间 | 76.5h | **74.2h** |
| 胜率 | 86.21% | **92.88%** |
| 场次 / 平均回合 | 5758 / 13.8 | **5593 / 14.1** |
| 宗师日历 | 15.3 天 | **14.8 天** |
| 装备评分 / 银两 | 595 / 188796 | **600 / 222492** |

太极/玄阴两行在重跑 CSV 中**逐字节未变**（`git diff reports/combat-v1-100h.csv` 只改破军 3 行）——证明漂移来自 `bfeeb1e` 的破军数值改动，而非随机性。
`content:check` 同因：已提交 `content-v1.md:11-12` 写 `总胜 44 / dominant share 34.1%`，当前确定性重跑为 `总胜 45 / 33.3%`（破军矩阵 6/15→7/15，`武当金顶` 由负转胜，且全部 60 格回合/残血值变化）。
README 仍在引用旧值：`README.md:81`「100h 宗师玩家日历 15.3–16.9 天」（实际 14.8–16.9）、`:83`「dominant share 34.1%」（实际 33.3%）。CI 不拦截此类漂移：`ci.yml` 只跑命令不 diff 报告；`nightly.yml` 只上传 artifact，**没有任何 golden/阈值断言**（`.github/workflows/ci.yml`、`nightly.yml`）。
另：`content:check` 自称 “check”，实为会写 4 个受版本控制报告的生成器（`src/sim/content-check.ts:88-107`），在 CI 里会隐式改动工作区，语义上应拆分 `check`/`report`。

### 2.3 idle-first 报告可复现（好证据）

`npm run sim:idle` 走**真实 `JianghuSession`**（`src/sim/idle-loop-report.ts:3`），重跑输出与已提交 `idle-loop-v1.md:19-23` 完全一致：taiji L5/D7→L10/D15、pojun L3/D4→L7/D9、xuanyin L4/D5→L9/D12，arts=2，travel caoyun/true；md/json 仅 `生成时间` 变化。

### 2.4 两套 100h harness 结论不一致（重要）

同 seed=1、100h、在线（offline:false）下，用**生产会话** `JianghuSession` 实测：

| Build | 真实会话 L / 宗师h / 场次 / 负场 | `sim-v1` 报告 L / 宗师h / 场次 / 负场 |
|---|---|---|
| taiji | 48 / **71h** / 5754 / 9 | 48 / **78.7h** / 5018 / 1 |
| pojun | 48 / **70h** / 6095 / 538 | 48 / **74.2h** / 5593 / 454 |
| xuanyin | 47 / **78h** / 5610 / 266 | 47 / **84.7h** / 4760 / 168 |

生产循环比报告快 5–7h 到宗师、场次多 300–800。原因：`session.ts:721-735` 有首小时“≤2 敌 + 攻×0.82/hp×0.94”宽容，`:805-806` 失败给补偿修为；而 `sim-v1.ts`（报告所用）**没有这些规则**，且用的是自己的一套奖励/换层/退层逻辑（`sim-v1.ts:103-121, 566-591`）。即 `resolveBattle` 是同一 seam，但**成长循环被复制了两份**，报告验证的不是玩家实际跑的循环。

---

## 3. 单一真源（Single Source of Truth）风险

- **战斗规则：真源唯一（好）**。生产 `session.ts:692/737/836`、世界/终局/同伴、内容矩阵、`sim-v1`、`report-v1` 全部调用 `resolveBattle`（`src/core/combat-v1.ts:1045`）；`sim-v1.ts:439` 明确复用，`cmp` 级可复现说明无隐藏随机源。
- **但仓库仍保留第二个完整战斗引擎** `src/core/combat.ts`（`simulateFight`，v0.6），被 `src/core/sim.ts`、`npm run sim` 和 **9 项测试**使用；`reports/balance-v0.6.md:90` 还写着「冻结数值基线：v0.6 作为后续 UI/内容开发的平衡基线」，与 `reports/combat-v1-100h.md:19`「v0.6 的旧数值不再是不变验收合同」**互相矛盾**。对外口径两套基线，测试计数把 legacy 也算进 148。
- **成长循环双份**：`session.ts` vs `sim-v1.ts`（见 §2.4），是比战斗引擎更实际的漂移点。
- **报告由代码生成、可重跑（好）**：`src/sim/report-v1.ts:88, 296-309` 写 md/json/csv；`content-check.ts:88-107` 写 md/json/csv/manifest。没有手填数字，但提交时机依赖人工，导致 §2.2 的 stale 状态。

---

## 4. 战斗行为“真正被断言”清单（`tests/combat-v1.test.ts`）

| 行为 | 断言位置 | 强度 |
|---|---|---|
| loadout 6 主动槽 + 4 心法：缺/多/重/无效装备拒绝 | :93-116 | 强（正向+5 类负例） |
| 优先级首匹配优先、不可用跳过并继续、无匹配回普攻 | :118-166 | 强（含 skipped.reason） |
| 内力/冷却/绝技 combo≥3 或内力≥50%、轻功冷却门槛 | :168-177 | 强（边界值 11/12、20/50） |
| 速度序真实：快敌先动，但“架”在本回合开始即生效并反击 | :179-198 | 强（事件顺序+反伤>0） |
| 控制先手可取消目标行动（封穴 interrupt） | :200-214 | 强 |
| 实→虚、虚→架、架→实三角；架反打与反震独立、均不可会心 | :216-290 | 强（事件类别+breakdown 双断言） |
| 会心独立判定；DoT/反震不吃会心乘区 | :292-339 | 强 |
| 状态：施加/跳伤/过期/抵抗（毒、破甲、架势） | :341-383, :519-572 | 强（≥3 tick + expire + 抵抗文本） |
| combo starter→chase→finisher 叠层，绝技清层 | :385-418 | 中强（actionTrace + 事件序号） |
| 伤害随攻/系数上升、随防御/减伤下降、永不为负 | :420-439 | 中（只验 4 个方向，未验系数/K/属性匹配/命中） |
| 同 seed 全等、异 seed 不改变选招 | :441-458 | 强 |
| 回合上限 → timeout + reason/rounds | :460-473 | 强 |
| 三套 kit 各赢 ≥1 场、无一套全胜 3 场 | :475-502 | **弱**（`some(Boolean)`，无胜率/差值） |
| survive 目标恰好撑满 N 回合 | :504-517 | 强 |
| Boss 阶段阈值触发、换 pattern、提前一回合预告 | `tests/world-v1.test.ts:167-202` | 中强（事件级） |
| 同伴助战进入 `resolveBattle`、有冷却、非必需 | `tests/companions-v1.test.ts:193-232` | 中强 |
| 5 层守关/离线/天机榜的 survive 接入 | `activities-v1/endgame-v1` | 中（各自系统级） |

**已实现但无任何断言（dead branches / 内容在用但未验）**：
- `enrage`（`combat-v1.ts:1719-1722`）、`damageCapPct`（:1358-1364）：设计 §5.8 的“首领 50% 狂暴 + 单回合封顶”**零测试**。
- 状态 `attackBuff`/`evadeBuff`/`healBlock`（内容里 attackBuff 出现 2 处、evadeBuff 1 处、cleanse 2 处）——测试 0。
- `extraHits`（多段）与 `executeBonusPct` 内容在用，测试 0；`healBlockRounds`、`interruptBonusPct` 实现了但内容从未使用（引擎死代码）。
- 优先级条件 14 种中，`enemyIntentElement`、`hpAtLeast`、`statusOnSelf`、`bossPhaseAtLeast` 无测试；`enemyHpBelow`/`enemyCharging` 仅在同伴测试间接出现。内容 preset 只用到 6 种。
- 多敌人：只测了 `groupSizeFor` 1–3（`world-v1.test.ts:158-165`）；`createEncounterBattle` 把 1–3 只合成为**单个聚合敌人**（`world-v1.ts:842-900`：HP 求和×0.9、攻击取均值×1.05^n、取最高速度、pattern 拼接）——该聚合公式**无断言**，也无多目标/选敌语义。
- 暴击/命中/闪避/属性匹配的具体数值公式（`elementBonus` +20%/太极 +10%、`hitChance` 0.90+hit-evade、mitigation K=120+7L）没有数值级断言。
- 优先级 preset：9 个 preset 均被定义（`src/data/combat-v1.ts:737`），但 `boss`/`survival` 两类**从未被生产路径消费**：会话/模拟只读 `loadout.priorityPresetId`（=farm），UI 仅展示名称（`src/ui/App.tsx:730,825`），没有切换 dispatch；progression 只保存/校验。**“换 preset 影响胜负”零验证**。
- 首小时“敌群 ≤2、攻×0.82/hp×0.94”（`session.ts:721-735`）只有 10/30min 整体指标间接覆盖，无针对性断言。

---

## 5. 平衡质量判断（基于报告数据 + 断言，不基于叙事）

1. **“3 套胜率接近”不被同层数据支持。** 内容矩阵（同等级 = 推荐境界×9+5、同 seed=31、同一 Boss）当前：taiji **15/15=100%**、hybrid 15/15、xuanyin **8/15=53.3%**、pojun **7/15=46.7%**（`reports/content-v1.md` 矩阵小节；重跑值）。设计 §5.10（`docs/design/一纸江湖_养成总表_v0.1.md:362`）要求“至少 3 套胜率接近”，实测差 53.3pp，不满足。100h 长跑胜率 99.96/92.88/96.53（差 7.1pp）看似接近，但那是高等级刷低层 + 失败仅掉层/给补偿（`sim-v1.ts:566-591`）的“便宜失败”，不能作为强度等价证据。
2. **胜率与成长速度反向，说明失败惩罚主导平衡。** 破军胜率最低却最快到宗师（74.2h，3 seed 74.2/74.2/74.3），因为它场均回合最短（14.1 vs 16.7/18.8）、单位时间场次最多；失败只损失层数+30% 修为补偿。**报告对 86%↔99.96% 的差异没有任何解释**（`combat-v1-100h.md` §0/§8 只有数字与“跨套武学只进 codex”说明；旧 v0.6 报告 §7.3 才有“速刷代价是失败数”的解释，但那是旧引擎）。
3. **dominant share 34.1%/33.3% 是自证指标。** `dominantShare = 最强 build 胜场 / 总胜场`（`content-pipeline.ts:272-274`），4 个 build 均分时约 25%，阈值 ≤60% 不可能触发；且第 4 个 “hybrid” 是 taiji 换 1 招（`content-pipeline.ts:230-232`），60 格中 **15/15 行回合与残血值与 taiji 完全相同**（重跑核验）——实际只有 3 个不同 build，按不重复 build 计 taiji 占比 = 15/30 = **50%**，仍过阈但指标失真。
4. **“低战力靠克制越级”无数据支持/反驳。** 引擎克制收益很小：类型克制 +20%、破架 +15%、打断 +10%（`combat-v1.ts:1243, 1252, 1266`），反击为攻击×0.35，而敌方 HP 按 +13%/级、攻击 +10%/级增长；没有“固定战力、换 counter 让胜负翻转”的实验。同层矩阵只显示 kit 强弱差，不是越级窗口。设计 §5.10 第 2 条**未验证**。
5. **“同一套优先级通吃”已出现。** 自动战斗只用 farm preset，taiji farm preset 在 15/15 图全胜（矩阵），说明一套优先级确实通吃当前内容；设计 §5.10 第 5 条被数据反证。9 个 preset 中 6 个（boss/survival）是未被消费的“死配置”。
6. **破军/玄阴差异的定性结论**：三 kit 打法确有差异（`combat-v1.test.ts:475-502` 用三个代表遭遇证明“各赢至少一场、无一套全胜”），但这是**存在性**断言；等层强度、成长速度、容错率三项指标合起来看，**taiji 在胜率维度主导、pojun 在速度维度主导**，并非“接近”。平衡可接受性取决于产品口径，但“近似”不成立。

---

## 6. README / 报告声明逐条核验

| 声明 | 位置 | 核验 |
|---|---|---|
| `npm test` 148 项 / 148/148 | `README.md:61,88` | **✔ 准确**（148 pass，0 fail） |
| `content:check` PASS | `README.md:88` | **✔ PASS**（但会改写 4 个报告文件，含 release-manifest） |
| `pwa:check` PASS / `build` PASS | `README.md:88` | **✔ 均 PASS**（build 137ms） |
| 100h 三 kit 全到宗师、等级差 ≤5%、宗师差 ≤12h | `README.md:80` | **✔ 成立**（sim：2.1% / 10.2h；真实会话：2.1% / 8h） |
| 100h 宗师日历 15.3–16.9 天 | `README.md:81` | **✘ 已 stale**（重跑 14.8–16.9；旧破军 15.3 是改动前值） |
| dominant share 34.1%，无不可通地图 | `README.md:83` | **✘ 已 stale**（33.3%）；“无不可通图”✔ |
| 首小时三 kit 首战/首升/首掉/首精英、60min 首个首领尝试 | `README.md:84` | **✔ 有测试**（`session-v1.test.ts:226-239`） |
| 报告由代码生成、可重跑 | `combat-v1-100h.md:4-6` | **✔**（`report-v1.ts:88`），但提交件不会自动更新 |
| “每个 slot/type/status/资源/回合上限边界都有测试” | `combat-v1-100h.md:82` | **✘ 过宽**：enrage/damageCap、多敌聚合、attackBuff/evadeBuff/extraHits/execute、5/14 优先级条件无测试 |
| “模拟关闭 captureEvents 但不绕过 resolveBattle” | `combat-v1-100h.md:90` | **✔**（`sim-v1.ts:439-447`） |
| v0.6 不再是验收合同 | `combat-v1-100h.md:19` | **✔ 叙述**，但与 `balance-v0.6.md:90`「冻结 v0.6 为基线」冲突；README 仍链接旧报告 |
| balance-v0.6 的“近期胜率 100%” | `balance-v0.6.md:86` vs :61-69 全场 71.7–100% | 内部口径不一致（近期 50 场 vs 全程），且为旧引擎，仅历史参考 |
| idle-first 10/30min 三 kit ≥3/≥5 次成长、可学招、换图自动开打 | `README.md:87`、`idle-loop-v1.md:9-15` | **✔ 可复现**（真实会话，重跑逐值一致） |

---

## 7. 缺失的验证层（按风险排序）

1. **UI/组件/e2e：0 自动化**。无 `*.test.tsx`、无 Playwright；`reports/ui-v1-smoke.md:5` 明写“本机无 Playwright/Chromium，逐像素截图未自动执行”，人工 smoke 清单仍“待执行”。战斗反馈（战报/HP/克制提示/阶段提示）只有静态结构检查。
2. **平衡回归无门禁**。nightly 只跑并上传报告，不比对/不失败；`report-v1.ts` 只打印不 assert（:150-158 只是计算展示值）；`acceptance-v1.test.ts:31-34` 的守卫是 **10% / 24h**，比 README 的 5% / 12h 宽一倍（5%/12h 只由 `session-v1.test.ts:179-183` 覆盖，且只 seed 1）。代码改动后报告 stale 不会被任何 CI 发现（本次实证）。
3. **存档/迁移对战斗状态**：有会话快照 round-trip（`session-v1.test.ts:127-138`）与内容 ID 迁移/隔离/版本不符报错（`content-pipeline.test.ts:96-131`）；但**没有**跨 schema 的“战斗相关字段”（loadout/preset/mastery/经脉/world 进度）逐字段迁移测试，也没有 mid-battle 存档（战斗同步原子完成，属隐式假设而非显式约定）。
4. **性能/长时离线**：无 benchmark/内存/耗时限；100h headless 单 run 2.9–7.3s、8h 离线仅功能断言。UI 长时间挂机、切后台、计时器漂移无验证。
5. **fuzz/seed sweep**：全仓只有 itemization 1500 seeds、world 30 seeds；战斗规则只有每个测试固定 1–2 个 seed，**没有 seed 扫描/属性测试**来发现“某 seed 下出现负伤害/无限循环/非有限值”。
6. **内容新增回归**：内容层 10 层校验 + 60 格矩阵能挡 ID/引用错误（强），但新增武学/preset/boss pattern 的**行为回归**（胜率带、回合数上界）没有阈值测试。
7. **多敌人/合阵语义**：遭遇生成有测，聚合战斗公式无测（见 §4），若未来改为真多目标，无现成基线。

---

## 8. 验证层数值化评分（0–100，按“证据能否支撑声明”）

| 层 | 分数 | 理由 |
|---|---|---|
| 单元/引擎战斗规则 | **78** | 克制三角、combo、状态、会心、反震、时序、确定性都有强断言；扣分于 enrage/damageCap/多敌聚合/属性匹配/5 类条件/多段与斩杀词条无测试，且无覆盖率工具 |
| 内容校验/矩阵 | **85** | 10 层校验 + 每层负例 + 60 格确定性 + 存档兼容，工程完成度高；扣分于 dominant 指标自证、hybrid 重复 taiji、矩阵单 seed 单遭遇 |
| 平衡模拟（100h/500h） | **55** | 可重跑、确定性、3 seeds、复用同一引擎；但报告无阈值断言、已提交件 stale、与真实会话循环漂移、单 preset、无胜率差异解释、坏样本失败代价失真 |
| UI/e2e | **12** | 无组件/e2e/截图自动化；仅 PWA 结构检查 + 人工待办清单（构建本身可用） |
| 可复现性/回归门禁 | **72** | 报告完全代码生成、两次运行逐字节一致；但 stale 提交件无人拦截、check 命令写文件、两套 100h harness 数字不一致 |
| 综合（战斗验证完成度） | **≈60** | 引擎规则层证据扎实（生产可用），但“平衡/验收/可复现”证据链在提交件层面已失效，且 UI/性能/模糊测试空缺 |

---

## 9. 给 Lead 的结论要点

- **最强证据**：`combat-v1.test.ts` 的确定性/克制/combo/状态/时序断言 + `session-v1.test.ts` 的真实会话 100h（5%/12h）+ `idle-loop-v1` 可逐值复现 + `sim:v1` 两次运行逐字节一致 + 内容矩阵确定性。
- **最弱证据**：已提交的 `combat-v1-100h.md`/`content-v1.md` **不是当前代码的数字**（破军 86.21%→92.88%、47→48 级、76.5→74.2h；矩阵 44→45 胜、34.1%→33.3%），README 两处直接引用旧值；CI/nightly 无 stale 拦截。
- **可直接引用的“完成度”判断**：战斗**规则 seam** 完成度高（单引擎 + 16 项规则测试 + 确定性），但战斗**验证体系**仅到“引擎单测 + 内容校验 + 可重跑模拟”，缺 UI/e2e、缺平衡阈值门禁、缺多敌/性能/fuzz，且报告与生产会话是两套成长循环。
- 本次运行改写了 `reports/combat-v1-100h.*`、`content-v1.*`、`idle-loop-v1.*`、`release-manifest.json`（9 个文件，均未还原/未提交），差异即 §2.2/§2.4 的实证。
