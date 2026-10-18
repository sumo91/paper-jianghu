# 战斗核心与内容契约评估（Axis 1：headless combat engine & content contract）

范围：`src/core/combat-v1.ts`（1909 行，v1 唯一战斗 seam）、`src/data/combat-v1.ts`（1053 行内容与 sheet 构建）、旧 v0.6 引擎/数据（`src/core/combat.ts`、`src/core/sim.ts`、`src/core/stats.ts`、`src/data/{arts,builds,enemies,maps}.ts`）、消费方 `session.ts` / `sim-v1.ts` / `content-pipeline.ts` / sim 报告 / UI，以及测试 `tests/combat-v1.test.ts`（16 项）等。设计基线：`docs/design/一纸江湖_养成总表_v0.1.md` §5（268–368 行）。
方法：全量阅读 + 运行仓内脚本（`node --test tests/combat-v1.test.ts` → 16/16 通过；`node src/sim/content-check.ts` → PASS）＋ 一次性只读 probe（节点脚本，不入库：回合分布、preset 差异、心法绑定、内功层级、同伴数据对比）。probe 不是产品代码，仅作证据。

---

## 1. 模块责任图与依赖方向

**唯一 live seam**：`resolveBattle(BattleInput): BattleResult`（`src/core/combat-v1.ts:5-10,1045`）。纯函数：无 IO/Date/全局随机；随机只来自 `new Rng(input.seed)`（`:1071`）。

| 角色 | 模块 | 证据 |
|---|---|---|
| 契约 + 引擎 | `combat-v1.ts`：输入（sheet / loadout / content / enemy / objective / seed / modifiers / activeCompanion），输出（outcome、rounds、损伤分解、events/log、action/rng trace、phase） | `:668-687`、`:754-782` |
| 内容 + 派生 | `data/combat-v1.ts`：20 武学、3 内功、12 心法、6 奇穴、10 同伴、9 preset、3 starter kit、`createBattleSheet`、`enemyBattleDef` | `:749-757,895-951,1001-1053` |
| 敌人/遭遇适配 | `data/world-v1.ts`：`createEncounterBattle` / `encounterBattleModifiers`（把 1–3 敌组合成单个 `BattleEnemyDef`） | `:822-833,842-890` |
| 派生属性 | progression（心法/经脉/熟练 mods）+ itemization（gearMods）→ 由 session/sim 注入 `extraMods` | `src/core/session.ts:636-656` |
| 生产调用方 | session：推图 `:692`、突破 `:737`、活动 `:836`；`sim-v1.ts:439`；`content-pipeline.ts:250`；报告 `sim/companions-report.ts:56,62`、`sim/activities-report.ts:40,64` | 同左 |
| 未接线的消费方 | 天机榜 `EndgameService.challenge(takes BattleResult)` 在 live session 完全未接线（`session.ts:53` 仅 import；`sim/endgame-report.ts:10-20` 直接伪造 `BattleResult`） | |

**依赖方向**：引擎只 import `core/rng`、`core/stats`(仅 `clamp`)、`core/types`(仅 `GearSlot` 类型)（`combat-v1.ts:1-3`），**不 import 任何 data 模块**，内容经 `BattleInput.player.content` 注入——这是本项目最好的 seam 设计。反向依赖干净：data→core、session→data+core、UI→session snapshot。唯一回边：`data/combat-v1.ts:26-29` 依赖旧 `core/types`、`data/builds.ts`、`core/stats.ts`，而 `stats.ts` 又 import `data/arts.ts`（`stats.ts:12-14`），故 v1 的 base 属性事实上仍架在 v0.6 数据上。

**单引擎还是双引擎？** live 只有 v1 一个引擎；v0.6 未删除而是"隔离带"：`core/combat.ts::simulateFight` + `core/sim.ts` + `core/stats.ts` + `data/{arts,builds,enemies,maps}.ts` + `core/loot.ts` + `sim/run.ts` + `sim/report.ts`，约 3.2k 行，仍被 9 个旧测试（`tests/combat.test.ts` 4 + `sim.test.ts` 4 + `acceptance.test.ts` 1）和 `npm run sim` 保活；UI 还经由 `src/ui/gameData.ts:1-15` 把这些旧数据模块拉进 bundle（App 实际只用了标签常量，`App.tsx:8-18`）。报告也明确 v0.6 数值不再是验收合同（`reports/combat-v1-100h.md:19`），但没有删除/迁移计划。

---

## 2. 功能完成度矩阵 vs 设计 §5

| 设计项 | 实现? | 机制摘要 | 证据（file:line） | 深度 |
|---|---|---|---|---|
| 六主属性（气血/内力/攻击/防御/身法/会心） | 是 | 5 个 primary + 会心在 secondary；UI 展示 6 项 | `combat-v1.ts:54-99,1840-1873`；`App.tsx:676-684` | 完整（模型）/够用 |
| 次级属性（破招/连招/状态命中/抵抗/回内） | 是 | 18 个 secondary，全进伤害/命中/状态公式 | `combat-v1.ts:62-99,1875-1909` | 完整 |
| 实/虚/架/气三角 | 部分 | 引擎有 `TYPE_COUNTERS`；玩家出招克敌 +20%、实打断气、虚破架、架挡实；**敌方→玩家只实现"实 vs 玩家架"**，敌方虚招不会破玩家架，气招也不与玩家类型互动 | `:824-829,1242-1277,1507-1515` | 浅（单向克克） |
| 意境/内功匹配 +20%/+10%，不匹配不罚 | 是 | 同属性 +20%，太极 +10%，无惩罚；敌我同公式 | `:993-998,1490-1494` | 完整 |
| 连招 起手/追击/终结 | 部分 | 有 tag/连击层与每层 +4%+comboDamage；**终结不消耗层数**，`finisher` 分支恒 +1（死三元），绝技仅清零 | `:989-991,1012-1030`（`:1024`） | 浅 |
| 破招 + 敌方杀招预警 | 部分 | 破架 1.15+breakDamage、断气 1.1，玩家架招反击（借力反打，=0.35 攻击）；每回合 intent 事件 + 蓄力状态。**无借力/内力/连击资源奖励**，无"杀招"分类 | `:1170-1182,1248-1277,1535-1548` | 浅 |
| 状态系统 | 是 | 8 状态：封穴/毒/破甲/架/蓄力/蓄势/轻身/禁疗；命中-抵抗、层数/回合、到期、毒 DoT | `:18-26,903-957,1409-1442,1550-1575,1582-1609` | 完整（种类）/够用 |
| 心法：4 招各绑 1 个、改变行为 | 仅数据占位 | 有 4 槽与 `heartTargets` 绑定/校验/UI 展示；但**引擎从不读 heartTargets**，`heartMods` 把 4 个心法 mods 全量相加；全部心法只有被动 mods | `:236-241,277,368-375`；`progression.ts:508-523,689-700`；`data/combat-v1.ts:364-437,792`；`App.tsx:812-821` | 仅数据占位（绑定）/浅（数值） |
| 内功：1 门主内功 + 3/6/9 层特效 | 部分 | `signature` 字符串由 sheet builder 消费；但 3/6/9 实际是**对所有内功统一的** guardReduction/innerRegen 硬编码，per-art 数据（破军攻/暴伤、玄阴命中/毒伤）从未进入战斗 | `:226-234,908-911`；`data/progression-v1.ts:112-127`；probe：3 门内功 3/6/9 增量完全相同 | 浅 |
| 轻功槽 | 是（普通技能） | 作为无系数 utility 技能，无独立机制（evadeBuff 效果值被硬编码 0.15 覆盖） | `data/combat-v1.ts:289-330`；`combat-v1.ts:1302-1306,1503` | 够用/浅 |
| 经脉 3 分支 + 36 节点 + 6 keystone | 部分是 | 36 节点（3×12）与 6 奇穴数据齐；节点=纯 stat mods；装备 2 个 keystone；"3 套可行方案"未验证 | `data/progression-v1.ts:136-158`；`combat-v1.ts:243-248,278,321-323`；`progression.ts:682-687` | 够用（数值）/浅（语义） |
| 同伴助战（自动释放、羁绊加成） | 分叉 | 引擎支持条件触发/冷却的 `activeCompanion`（为 CompanionService 设计）；**live 从不传**，走 `CombatContent.companions` 的"每 4 回合"简单 fallback；羁绊不参与战斗 | `:651-666,686,1611-1682`；`session.ts:692-700`（无 activeCompanion）；`companions.ts:379-430` 仅报告/测试使用 | 浅（live）/够用（引擎能力） |
| 同伴助威（2 助威被动） | 分叉 | 用 `CombatContent.companions` 的简单 mods；CompanionService 的助威 mods（含羁绊缩放）未接线 | `data/combat-v1.ts:914`；`session.ts:636-656`；`companions.ts:425-435` | 仅数据/浅 |
| 自动战斗条件优先级规则 | 是 | 14 种条件 AND、顺序首中、技能不可用则跳过、无匹配普攻、fallback rule；绝技门槛 combo≥3 或内力≥50% | `:420-573`；`:489-500` | 完整（引擎） |
| 最多 6 条规则 + 3 套官方预设 | 否（数据超限/重复） | 9 个 preset（3 kit×3 模式）；每条 9–11 条规则远超 6，无任何校验；**farm 与 survival 规则语义完全相同**；每条含 2 条引用未装备的 `common_*`（运行时被"未装备"跳过）；live 只用 farm preset，从不按遭遇切换 | `data/combat-v1.ts:666-747`（farm/survival 同函数）；`:684-685,703-704,722-723`；`combat-v1.ts:560-564`；probe 计数 | 浅 |
| 玩家自定义优先级（硬核细调） | 缺失 | 数据模型+`savePriorityPreset` API 存在，但 session 无命令/snapshot 无入口；即使写入，`build.priorityPresets` 中的自定义 ID 无法被引擎解析（引擎只看 `content.priorityPresets`），会退化为普攻 | `progression.ts:664-671`；`combat-v1.ts:1065-1067`；`priorityRules` 仅测试使用；`session.ts:65-75,77-123` | 缺失 |
| 敌人意图/阶段/精英词缀 | 是 | 每回合 intent + 阶段阈值/换 pattern/announcement；10 精英词缀以 BattleModifier 注入；boss 2–3 阶段 | `:588-622,1032-1039,1159-1176`；`data/world-v1.ts:203-255,467-524,822-833`；测试 `tests/world-v1.test.ts:167-200` | 够用 |
| Boss 狂暴/伤害封顶/反伤 | 是 | enrage=0.35 加攻、damageCapPct 每回合上限、reflectPct；无直接单测 | `:1357-1364,1379-1387,1718-1724`；`data/world-v1.ts:542-557` | 够用（验证薄） |
| 伤害公式（K、会心1.5、破招+20%、≤4 乘区） | 部分是 | K=120+7·level、防御减伤、会心 1.5、破招拆成 1.15/1.1/1.2；但**乘区约 9 类**（offense 和 + type + break + crit + execute + interrupt + 减伤 + damageReduction + damageTaken），超过设计上限 | `:959-998,1239-1355` | 够用（需收敛） |
| 战报（演示/数据） | 浅 | 引擎产出 events/log/伤害分解/trace，但 live 全部 `captureEvents:false`；session 只持久化最近一场 8 字段 + 12 行 log；UI 只显示 10 行 log + 2 个数字 | `:689-714,729-745,1104-1113`；`session.ts:125-134,752-762`；`App.tsx:437-462`；`session.ts:699,746,845` | 浅 |
| 复盘建议 | 缺失 | 全仓无实现；设计要求的"没破招/内力不足/被克制/命中不够"无生成逻辑 | 设计 `:349`；`grep 复盘` 仅 README/设计；引擎 telemetry 未被消费 | 缺失 |
| 推演/木桩 | 缺失 | 仅测试里有 dummy enemy；无"不消耗资源测试优先级/build"的入口 | 设计 `:350,542`；`grep 木桩` 仅测试 | 缺失 |
| 1x/2x/4x 加速 | 缺失 | 无战斗播放/加速概念；只有 `fightSeconds=18+2×round+boss24` 的挂机时间模拟 | 设计 `:325`；`session.ts:210-212,232-234`；UI 无速度控件 | 缺失 |
| 失败惩罚/疗伤 | 浅/缺失 | 失败=掉 1 层+安慰修为（仍正收益），不掉装备；无银两损失/受伤/疗伤 | 设计 `:346-347`；`session.ts:784-790` | 浅 |
| 多敌人语义 | 浅（显式简化） | 1–3 敌合成 1 个敌人：HP 求和×0.9、攻/防均值、身法取最大、pattern 各取前 2 招拼接；无选目标/逐个击杀/波次 | `data/world-v1.ts:842-890`；`world-v1.ts:222-227` | 浅（可接受但有代价） |
| 战斗节奏 6–12 回合/首领 15–25 | 部分 | probe（starter kit、遭遇等级+3/4、405 场）：普通 p50=7、p90=12；精英 p50=14、p90=22；首领 p50=18、p90=26、max=30（30 回合上限）。100h 中位平均回合 16.7/14.1/18.8 | `reports/combat-v1-100h.md:25-27`；probe | 浅（首领超上限） |
| 深度检查表（3 套胜率接近、克制越级、每图需换配置、同套通吃、失败可学） | 未验证 | content matrix 反而显示 taiji 15/15=100%、pojun 6/15=40.0%、xuanyin 8/15=53.3%（本次重跑为 46.7%，同样失衡），仍判 PASS（dominantShare≤0.6 的阈值对 4 build 过宽）；设计清单无对应测试/指标 | `reports/content-v1.md:40-45`；`content-pipeline.ts:276-279`；设计 `:360-368` | 缺失（验证） |

---

## 3. 契约与数据模型质量

**优点**
- 单一纯 seam + 内容注入；引擎不依赖 data；`BattleInput/BattleResult` 类型完整、union 收敛（`MoveType/Element/StatusId/ComboTag/PriorityCondition`，`combat-v1.ts:12-26,420-441`）。
- 确定性可验证：随机统一走 `Rng`（`:1071,1123-1128`），测试断言同 seed 的 events/actionTrace/damageBreakdown 深等、priority 不依赖 RNG（`tests/combat-v1.test.ts:441-458`）。`captureEvents` 只影响记录，不改变 roll 流。
- 优先级从 v0.6 的代码函数（`data/builds.ts:30-88`）改为数据条件（`combat-v1.ts:420-447`），是方向正确的可扩展 seam；`CombatContent`、`BattleModifier`、`CompanionAssistInput`、`PriorityCondition`/`SkillEffects` 都是"加数据即可扩展"的接口点。
- 内容校验 10 层 + 4 build×15 图矩阵 + 100h 模拟（`content-pipeline.ts:199-287`），`content:check` 实测 PASS。

**问题（按严重度）**
1. **两套内容事实源且已漂移**：武学/心法/奇穴/同伴在 `data/arts.ts`（v0.6）与 `data/combat-v1.ts`（v1）各写一遍。例：`pojun_wanjun` 系数 1.65 vs 2.0（arts.ts:117-128 / combat-v1.ts:199-213）、`xuanyin_wangu` 1.4 vs 1.8（arts.ts:175-186 / combat-v1.ts:272-286）、`hm_jieli` parryPct .06 vs guardReduction .04（arts.ts:201-207 / combat-v1.ts:364-370）；v0.6 有 `innerOnParry/innerOnHit` 等属性，v1 的 `CombatMods` 直接没有这些字段。敌人 pattern 也有三份（`data/enemies.ts:3-29`、`data/combat-v1.ts:974-999`（该导出全仓无引用）、`data/world-v1.ts:421-441`）。
2. **同伴双契约、数据不一致**：`CombatContent.companions` 10 人（simple，every-4）与 `COMPANION_CONTENT.companions` 8 人（条件触发/羁绊，`data/companions-v1.ts:55`（共 8 人））同 ID 不同数值；`comp_suwan/comp_heiqiu` 只存在于 simple 侧（combat-v1.ts:506-514,524-532），却被 3 套 starter kit 的支援位引用（`:816,835,854`）和 progression 学习表引用（`data/progression-v1.ts:71,73`），且 `sim-v1.ts:256` 真的会学 `comp_heiqiu`。`content-bundle.ts:33-34` 同时收两份数据，`validateCrossReferences` 不校验两者一致，`content:check` 因此 PASS。live 战斗只用 simple 侧。
3. **心法绑定是"装饰性契约"**：引擎对 `heartTargets` 零消费（probe：交换绑定 → events/伤害完全一致）；`heartMods` 全量求和无视绑定（`progression.ts:689-700`）。设计 §5.5/§4.2.4 要求"心法改变招式行为"，实际全是 +stat。
4. **内功 3/6/9 行为与数据脱节**：战斗用统一硬编码（`data/combat-v1.ts:908-911`），per-art 的 `INNER_LEVEL_EFFECTS_V1`（`data/progression-v1.ts:112-127`）只在服务/展示层，未进战斗（session 只传层数，`session.ts:636-656`）。
5. **玩家配置闭环断裂**：自定义优先级 preset 可存（`progression.ts:664-671`），但 session 不传 `priorityRules`，引擎只解析 `content.priorityPresets`（`combat-v1.ts:1065-1067`），自定义 ID → 兜底普攻；save 会持久化这批"死配置"。
6. **死字段/死语义**：`affixIds`（`:621`，data 只在 `data/world-v1.ts:865` 透传）、`BattleSheet.weaponType`（`:173`）、`BattleModifier.scope`（`:645`）引擎均不读；敌人 `guardReduction=0.35`（`data/combat-v1.ts:1024`）无意义——非虚招打敌方架势固定 0.75 倍（`combat-v1.ts:1272`）；`evadeBuff` 数值被硬编码 0.15 覆盖（`:1503`）；`playerStunnedThisRound` 只写不读（`:1094,1147,1223,1453`）；`updateChain` 恒为 true（`:1392,1396,1403`）；`updateCombo` 的 round 参数 `void` 掉（`:1029`）；`finisher` 三元两分支都是 1（`:1024`）；session 中 `faction/companions` 服务创建后从不调用、`createEndgame` 只 import（`session.ts:53,241-243`）；tsconfig 未开 `noUnusedLocals`，类型检查抓不到这些。
7. **旧引擎债务未清**：v0.6 由 9 个旧测试 + `npm run sim` 保活，旧 `MOVES/hearts/keystones` 数据仍经 `stats.ts → builds.ts → arts.ts` 进入 v1 sheet 构建；两代引擎语义已分叉（v0.6 有借力资源、同伴羁绊缩放、绝技按借力/毒/连击改系数，v1 均无）。全仓无 TODO/FIXME 标记（grep 无命中），债务是结构性的、无显式登记。

8. **`BattleResult` 富 telemetry 无消费者**：`events/damageBreakdown/keyRounds/actionTrace/rngTrace/finalPhase/companionCasts` 在生产代码中只被测试/报告读取（grep）；`damageBreakdown.total` 把双方伤害+反伤混在一个账本里，`bySkill` 键混入敌人 id/`poison`/`environment`/同伴 id（`:1077-1086,1115-1121,1519`），语义未文档化。
9. **序列化/复盘**：session save 持久化 `lastBattle`（8 字段+12 行 log）与 `build.priorityPresets`（`session.ts:611-626` 序列化整个 state；`lastBattle` 见 `:203`；`progression.ts:120` 的 `priorityPresets`），但不存 BattleInput/RNG trace，装备/进度一变就无法复盘同一场；`JianghuSession.load` 对 schema 不匹配直接 throw（`:335-350`），而 `save-compat.recoverSave` 是另一套最小存档契约（`save-compat.ts:13-20`）——两套存档模型，只有后者做迁移。
10. **危险耦合**：live 路径直接用全局 `COMBAT_CONTENT` 而非 bundle 注入（`session.ts:5,36-40`；`sim-v1.ts` 同）；sheet 构建知识在 `data/combat-v1.ts` 与 session `sheet()` 两处重复（session 传空 hearts/keystones/gear 再塞 extraMods，绕开 builder 默认值）；`createBattleSheet` 默认按 starter kit 装配，测试/content matrix 与 live 的 sheet 构成不同，容易掩盖接线 bug（probe 中 loadout.hearts 与 sheet 脱钩即一例）。
11. **魔法数字密集**：初始内力 0.55（`:1062`）、毒 0.06×攻（`:1131`）、破甲每层 -10%（`:986`）、连击每层 4%（`:990`）、克 +20%/太极 +10%（`:995-996`）、断气 1.1、破架 1.15、被架 0.75、反击 0.35（`:1252,1266,1272,1536`）、会心上限 0.85、命中 0.9/下限 0.25、状态上限 0.95、架势默认减伤 0.5（`:1846`）……全部散在循环里，无 balance 表/常量模块；设计要求的"≤4 乘区"在实现上是 9 类相乘（`:1336-1355`）。

**测试/验证质量**
- 引擎侧 16 项测试覆盖类型克制/断气/破架/架反/会心/DoT/状态/连招/伤害单调/seed 确定性/回合上限/survive/破甲到期（`tests/combat-v1.test.ts`）；世界阶段与"每回合先意图后行动"有 1 项（`world-v1.test.ts:167-200`）；同伴 rich 助战 1 项（`companions-v1.test.ts:193-230`）。实测 16/16 通过。
- 未覆盖：BattleModifier 具体效果（只被间接执行）、enrage/damageCap/reflectPct、survive 目标下"提前打死守关者"的 timeout 分支、`captureEvents:false` 的事件缺失/确定性等价、`damageBreakdown` 语义、preset 规则合法性/≤6、心法绑定对战斗的影响、内功 per-art 3/6/9、多敌合成数值。报告"每个 slot/type/status/资源/回合上限边界都有测试"（`src/sim/report-v1.ts:286`）属过度声明。

---

## 4. v1 真正缺失或偏薄的点（非远期 wishlist）

- **P0 玩家可达的"战前配置"闭环**（设计 §5.6 的核心玩法）：规则引擎完整，但 live 无法切 preset、无法编辑规则、per-encounter 不换模式、自定义 preset 引擎不认（证据见 §3.5）；这是"自动战斗有深度"这一支柱的最大空洞。
- **P0 复盘建议 + 有效战报**：只有最近一场 10 行 log（`App.tsx:437-462,458`），无历史、无伤害分解/破招统计、无"下次改什么"（设计 :349；`captureEvents:false` 在 `session.ts:699,746,845`）。
- **P0 心法/内功的"行为"层**：绑定与 per-art 特效停留于数据/展示（§3.3-4），使设计声称的 build 差异主要退化为数值堆叠；"不要做纯 +5% 武学树"（设计 :183）目前未被满足。
- **P0 推演/木桩与 1x/2x/4x**：前者无入口（设计 :350,542），后者与"不播放战斗"的 idle-first 形态冲突（`session.ts:210-212`），需要产品层明确剪裁而不是当作已实现。
- **P1 破招/连招的资源回路**：v1 删掉了 v0.6 的 借力资源与绝技按借力/毒/连击改系数（`core/combat.ts:228-235,282-285,336-346`），但没有用数据化方式补回"破招→借力/内力/连击"的回报（设计 §5.4）；且断气/封穴时敌方 pattern 不前进（`combat-v1.ts:1456-1459`），可能出现重复蓄力提示的观感 bug。
- **P1 反制可读性**：意图只以文本进 160 行 log（`combat-v1.ts:1111-1112`），session 截 12 行再截 10 行展示；战前情报只有敌人流派/等级/地图词缀（`App.tsx:516-620`），没有招式类型/属性/阶段 pattern 情报，玩家无法据此调配置。
- **P1 失败惩罚与疗伤**：失败仍给修为、只掉一层，无银两损失/受伤/回城疗伤（`session.ts:784-790`；设计 :346-347）。
- **P1 多敌语义**：1–3 敌聚合为单 stat block（`data/world-v1.ts:842-890`），没有目标选择/逐个击破/波次；HP 条显示的是聚合血量。
- **P1 验证与平衡杠杆**：preset/modifier 效果不做内容校验（`content-pipeline.ts:71-99`；`world-v1.ts:764-772` 只查描述），matrix 的 dominantShare 阈值（`content-pipeline.ts:278`）掩盖 100%/40.0%/53.3% 的失衡（`reports/content-v1.md:40-45`；本次重跑 pojun 46.7%），与设计 §5.10 第一条直接冲突；100h 模拟只用 farm preset，从未验证"首领换配置"。
- **P2 数值风险**：架势默认减伤 0.5、可叠到 0.87（probe），而敌方虚招不破玩家架 → 架招循环缺少天敌，是 taiji 在 matrix 100% 的最可能主因；`破军` 在 matrix 仅 40.0%（重跑 46.7%）则显示 build 间强度未被调平。

---

## 5. 分层完成度结论（证据化）

| 层 | 完成度 | 理由 |
|---|---|---|
| 契约/数据模型 | **~70%** | 单一纯 seam、强类型、内容注入、确定性可测；扣分在死字段/双份类型（`types.ts` 与 `combat-v1.ts` 各有一套 `Element/MoveType`）、心法绑定与 custom preset 的"假契约"、telemetry/存档两套模型 |
| 引擎机制 | **~70%** | 状态/克制/匹配/优先级/阶段/词缀/modifier/DoT/反伤均已实现且 16 项测试通过；但连招终结、破招资源回报、心法/内功行为层、三角对称性、失败/复盘相关钩子缺位，乘区失控 |
| 内容数据 | **~60%** | 广度达标（20 武学/3 内功/12 心法/6 奇穴/10 同伴/9 preset/30 normal/10 elite/15 boss/10 词缀/15 图，校验 PASS）；深度不足（心法/奇穴/经脉/内功 3-6-9 基本是 +stat；preset 超限、2 条死引用、farm=survival；同伴/武学双源漂移；`comp_suwan/comp_heiqiu` 跨层不一致） |
| 工具/验证 | **~60%** | 10 层校验 + 60 格矩阵 + 100h 模拟 + 148 测试是真实资产；但战斗特性的边界测试缺口明显（modifier 效果/enrage/cap/reflect/绑定/内功层级/规则校验），dominant 阈值与 probe 均显示平衡未被有效守门，报告存在过度声明 |
| 玩家可见战斗体验（§5.6/5.8/5.9 的"局"） | **~20%** | 只有自动挂机 + 最近一场 10 行战报 + 6 项属性 + 只读 preset 展示；无配置、无复盘、无推演、无加速、无战报历史、敌方情报极薄 |

**Bottom line**：作为"headless Combat v1 规则核心"，工程完成度约 **70%**——seam 干净、机制可运行、确定性与内容校验真实存在，足以支撑模拟与后续 UI；但作为设计 §5 定义的"可研究的战斗系统"，完成度约 **55–60%**：决定深度的三件事（玩家配置闭环、心法/内功行为差异、战后复盘/推演）目前是数据占位或缺失，而现有平衡验证既未覆盖它们、又对已暴露的 build 失衡过宽放行。对架构评审而言，v1 不是"未完成引擎"，而是"引擎已过线、产品化与深度层未接上"。
