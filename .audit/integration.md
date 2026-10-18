# 战斗系统集成 / UI 呈现完成度审计（Axis 2）

> 审计对象：`JianghuSession` 挂机循环中的战斗接线、离线结算、战报/战斗簇 UI、玩家控制面。
> 审计快照：HEAD `bebd8e4`（2026-10-18 13:34，"show battle immediately and restore ring-only HP"）。审计期间 HEAD 从 `d06bc2e` 推进到 `444ab87` 再到 `bebd8e4`（12:59→13:34 共 6 个 UI 提交）；`src/` 工作区干净；`reports/*` 被并发 sim 运行重写（脏），并新增 `reports/ui-idle-waiting.png`。下文行号已按 `bebd8e4` 重算。
> 我未修改任何源码/测试/报告；唯一产出是本文件。
> 本地验证：`npx tsc --noEmit` 通过；`npm run build` 通过（vite 8.3.4，148ms，exit 0）。完整 `npm test` 由 evidence 同学负责，本轴未重复。

## 0. 结论速览

| 集成层 | 完成度（本轴判断） | 一句话依据 |
|---|---|---|
| 战斗生命周期接线（触发→遭遇→结算→奖励→世界→日志→续挂） | **~85%** | 全链路存在且同一条纯 seam；但节奏由 tick 粒度决定、无进行中状态、停止条件未接线 |
| 离线结算 | **~50%** | 真逐场模拟 + 8h cap + 幂等有测试；但绕过 `advanceOffline` 契约、会离线自动换图、>1h 阈值跳变、呈现字段缺失 |
| UI 呈现（战斗簇/战报/挂机状态） | **~40%** | 有可用的地图战斗簇 + 空态 + 战报弹层 + 状态条；但无意图/状态/回合/内力/ticker/战利品/历史，且靠启发式重算 |
| 玩家控制面（配装/优先级/速度/推演） | **~20%** | 配招/学招/换装/换图/止行是真实 UI；速度、优先级预设切换与编辑、推演、复盘建议全部缺失 |
| 横切（可测性/可访问性/性能/确定性） | **~30%** | 零 UI 组件测试；a11y 局部退化；每秒全量 snapshot + 全树渲染；UI/引擎时间口径不一致 |
| **本轴整体** | **~50%** | “挂机循环接上了、能玩”；“战斗表现/研究/复盘”几乎未落地，对照 concept A–D 只是 D 的视觉壳 |

### 0.1 真 / 预览 / 缺失清单

| 面 | 真实（读 session 数据、走 dispatch 命令） | 预览 / 死代码 | 完全缺失 |
|---|---|---|---|
| 战斗触发与结算 | `advanceTo`→`stepClear`/`stepActivity`→`resolveBattle`→`lastBattle`（session.ts:547-815） | — | 进行中战斗状态、战斗历史 |
| 战报 | `BattleLogDrawer` 的 rounds/伤害/承伤/残血/尾 10 行（App.tsx:437-462） | `TutorialSlip` 未渲染（App.tsx:476-499）；`JianghuTab` 被 flag 隐藏（App.tsx:311） | 意图/状态/内力/回合轨迹/loot/复盘建议/推演 |
| 战场呈现 | `BattleCluster`：空态“待战/接敌”、多敌标签、双方头像、HP 环、胜负、战报入口（App.tsx:380-435） | 无限循环的 lunge/impact/damage 动画（styles.css:1236-1251,1315-1327） | 实时 ticker、敌方意图、statuses、本图刷取上下文 |
| 挂机条/地图页 | 资源/等级/XP/战/胜/止行续行/继续启程/离线 banner（App.tsx:204-255） | 地图页固定层数基数（App.tsx:524,569,601）、`mini-progress` 假进度条（App.tsx:574,584,614,625） | 速度、停止条件设置、换层、拾取过滤 |
| 配装/成长 | 6 槽切换/学招/手动装备/自动换装结果（App.tsx:730-893） | 装备对比/锁定/淬炼（README:94 自认预览） | 优先级编辑/预设切换、推演、守关/护镖入口 |
| 战斗日志数据 | `snapshot.lastBattle` / `recentLog` / `newLogLines` / `offlineReport`（session.ts:415,431,595,596） | `recentLog`/`newLogLines` 零消费；`lastBattle.log` 只留尾 12 行（session.ts:757） | 结构化事件时间线、多场历史、离线战报列表 |

## 1. 战斗生命周期接线（seam 与节奏）

链路真实存在：`sessionStore` 每 1000ms 调 `advanceSession`（`src/ui/sessionStore.ts:209-223`）→ `session.advanceTo(now)`（`src/core/session.ts:547-617`）→ 用“秒预算”循环：试炼（`session.ts:571-575`）→ `stepClear`（`session.ts:717-815`）或 `stepActivity`（`session.ts:817-880`）→ `generateEncounter`（`session.ts:720`）→ `createEncounterBattle` + `encounterBattleModifiers`（`session.ts:728,745`）→ `resolveBattle`（`session.ts:739-747`）→ 奖励/XP/掉落/目标掉落/首通/换图（`session.ts:764-802`）→ `lastBattle` 尾 12 行（`session.ts:748-758`）→ 循环继续（`session.ts:569`）。UI 只通过 `dispatch`（`session.ts:436-545`）下单，不自己开战。seam 本身是干净的：session 未复制战斗规则，只调用 `resolveBattle`。

| 阶段 | 归属 | 代码 | 备注 |
|---|---|---|---|
| 触发 | UI/host | `sessionStore.ts:211`；`App.tsx:249` | 无显式“开战”命令；时间到了就自动打 |
| 遭遇生成 | core/world | `session.ts:720`；`world-v1.ts:265-324` | 层/种子确定；首小时有削怪（session.ts:729-738） |
| 敌阵合成 | data/world | `data/world-v1.ts:842-901` | 多敌合并成一个敌阵；名字 join 成“A、B”（:889） |
| 结算 | core/combat | `resolveBattle`（combat-v1.ts:1045-1827） | 纯函数、种子确定；session 关 `captureEvents`（session.ts:746） |
| 奖励/成长 | session 自持 | `rewardsFor`+`gainXp`+`gainGear`（session.ts:216-230,882-896,922-967） | 奖励公式不在内容数据 |
| 世界推进 | core/world | `recordMapClear/Loss`、`rollTargetsForEncounter`（session.ts:780-801,809） | 首通后自动 `chooseNextMap`（:896-918） |
| 记录 | session | `lastBattle`(415,747-756)、`recentLog`(431)、`offlineReport`(594-613) | 有损记录，见 §6 风险 4 |
| 呈现 | UI | `BattleCluster`(App.tsx:380-435)、`BattleLogDrawer`(432-457) | 只读 snapshot |
| 续挂 | host | `sessionStore.ts:211-215`；session.ts:569 | 止行/可见性切换会断/续 |

但存在 4 个结构性问题：

1. **tick 粒度决定进度速率（最严重）**。`advanceTo` 每次结算后把 `lastSettledMs = nowMs`（`session.ts:590-593`），于是每次战斗“超支”的秒数被丢弃；在线 1s tick 下每场只需 18s 墙钟就开下一场（`FIGHT_BASE_SECONDS=18`，`session.ts:210`）。实测同一 seed：实时 1s tick 1 小时 = **198 战 / 显示行止 3.33h / Lv.22**；单次 `advanceTo(1h)` = **78 战 / 1.02h / Lv.15**。也就是说 `reports/*`（sim 全部用单次推进，如 `src/sim/idle-loop-report.ts:9-10`、`tests/session-v1.test.ts:26-37`）与真人 UI 不是同一节奏，README 的 10/30 分钟、100h 日历结论不能直接外推到在线玩家。
2. **离线/在线口径不对称**：同一 seed 8h，实时 tick = **1596 战 / Lv.38 / 显示 29h**；8h 离线结算 = **230 战 / Lv.23 / 4h 有效**（离线只有实时墙钟战斗速率的 ~14%，不是 50%）。
3. **没有“进行中战斗”状态**。`resolveBattle` 是一次性批处理（`src/core/combat-v1.ts:1045-1827`），session 同步算完才写 `lastBattle`；UI 在 18–100s 的间隔里看到的永远是上一场的结果。战斗 UI 的任何“实时感”只能是事后回放或假动画。
4. **session 自持部分规则**：奖励公式 `rewardsFor`（`session.ts:216-230`）、战斗时长 `fightSeconds`（`session.ts:232-234`）、首小时数值补偿（`session.ts:721-738`）都在 session 内定义，而非内容数据；与 README “session 不重定义规则”（`README.md:56-60`）的边界描述不完全一致。

增量/缺口：战报没有遭遇元数据（rank/词缀/enemy level/style），UI 只能猜（见 §5）；`AdvanceResult.newLogLines`（`session.ts:595,616`）只有测试消费，UI 从未使用；`snapshot.recentLog`（`session.ts:431`）零消费。

## 2. 离线结算

**结论：是真模拟，不是聚合**。`advanceTo` 在 `elapsedSeconds >= 3600` 时判离线（`session.ts:562`），`budget = min(elapsed, 8h) * 50%`（`session.ts:563-564`），仍逐场走 `stepClear`/`resolveBattle`；8h 离线约 230 场、73ms 内跑完。`OfflineReportV1` 从前后差值汇总（`session.ts:596-615`），测试覆盖 8h/12h cap 与同时间戳幂等（`tests/session-v1.test.ts:39-55`）。

Fidelity 缺口与边界：

- **契约漂移**：`world-v1` 有一份完整的离线契约 `advanceOffline` + `shouldStop`（`src/core/world-v1.ts:520-532,570-640`，注释明言“离线只推进当前图、不换图，`changedMap:false`”，`world-v1.ts:566-569`），并有单测（`tests/world-v1.test.ts:243-330`）；**session 完全没有调用它**。session 的离线是复用在线 `stepClear`，因此会触发 `chooseNextMap` 自动换图（`session.ts:784-800,898-920`）。实测 seed 1–5：洛阳 8h 离线后全部 → 黑市。这直接违反 `reports/economy-v1-500h.md:72,78` 的“离线不会自动换图/换 loadout”，是两套离线语义并存。
- **59 分钟 ≠ 离线**：没有任何 report 的 30/59 分钟回来按 100% 速率静默结算（实测 30min→44 战 Lv.10；59min→76 战 Lv.15）；61 分钟突然变成 50% + 报告（45 战，effectiveHours 0.508）。阈值 1h 处收益不连续，且 1h 内的回归没有任何“离线总结”，与产品“回来必须看到三件事”冲突（设计 `docs/design/一纸江湖_养成总表_v0.1.md:485-488`）。
- **停止条件没接线**：session 的 `stepClear` 永远 `fatal:false`（`session.ts:814`），首领失败只是掉层继续（`session.ts:802-812`）；`stoppedBy` 实际只会出现 `activity-ended`（`session.ts:577-581`）。UI 却把“首领失败 / 目标掉落 / 背包满 / 时限”写成现行规则（`src/ui/App.tsx:624`）。
- **报告字段与呈现脱节**：report 有 xp/renown/loot（`session.ts:136-153`），UI banner 只展示 effectiveHours/场次/胜/等级/掉落数/银两（`App.tsx:204-215`），且 8h 离线顶部写“4.0h 结算”；`stoppedBy` 直接渲染英文 code（`App.tsx:210`）；离线期间的试炼不写 `lastBattle` 也不计数（`session.ts:673-715`），活动失败/结束只置 `active=false`（`session.ts:863-877`）。
- 离线后被展示的“战报”是离线最后一场（`stepClear` 覆写 `lastBattle`），与在线战报在 UI 上不可区分，也没有离线战斗列表。

## 3. UI 呈现：BattleCluster、战报、挂机条

现状（HEAD `bebd8e4`）：

- **地图战斗簇**（`App.tsx:380-435`，CSS `src/ui/styles.css:931-1072,1222-1419`）：按地区锚点浮在地图上（`App.tsx:39-45,405`），显示敌人组标签（多敌合并为“A 等 N 人”，`App.tsx:392-393`）、双方头像球 + 外环血量 + 裸百分比（`App.tsx:413-428`）、一个伤害数字（`-{总伤害}`，`App.tsx:421`）、招式名 + 胜负（`App.tsx:396-397,429-432`）、“战报 ›”入口。`key={snapshot.fights}`（`App.tsx:200`）使每场重挂载并重播入场动画。
- **战报弹层**（`App.tsx:437-462`）：标题“第 N 回合 + 胜负”（`:443`）、伤害/承伤/残血（`:448-452`）、`<pre>{battle.log.slice(-10)}`（`:453`）。session 只存 `battle.log.slice(-12)`（`session.ts:757`），所以 21 回合的一场实际只留下最后一回合尾巴；且日志里直接泄露内部规则 id（实测样例：`优先级：「四两拨千斤」（priority_taiji_farm_ult）`，由 `combat-v1.ts:1746` 生成）。没有意图、状态、内力、伤害分解、关键回合、历史。
- **挂机条与离线横幅**（`App.tsx:233-255,204-215`）：战/胜、行止时间、止行/续行、继续/启程是真实的；行止时间来自 `elapsedHours = timeSeconds/3600`（`session.ts:379`），是“模拟战斗秒”，不是墙钟，在线 1h 后会显示 3.3h。
- **掉落/学招提示**（`App.tsx:218-231`）：真实，`lastDrop`/`pendingArts` 都来自 snapshot。
- **地图页**（`App.tsx:501-655`）：地点/词缀/怪物/掉落/胜率/银两真实；但“精英率”固定按第 8 层算（`App.tsx:524`），怪物等级固定第 8 层（`:596`），危险度固定按第 10 层（`:564`），“已刷时长/战斗/胜率”只对当前图有效（`:571-576`）。`dangerFor/eliteChanceFor/levelForLayer` 是从 core 直接 import 到 UI 计算的（`App.tsx:6`），并非读 snapshot。

**Concept vs current（A–D 为 `concept/battle-prototype.html`）**

| 维度 | A 战报卷轴（html:369-423） | B 对阵书页（html:426-480） | C 行止战况带（html:483-514） | D 头像互撞（html:518-584） | 当前实现 |
|---|---|---|---|---|---|
| 形态 | 右侧常驻卷轴 | 中央书页弹层 | 底部常驻战况带 | 地图上双方头像 | 地图 mini 战斗簇（D 壳）+ 点击弹层（B 弱化版） |
| 血量 | 条 + 绝对值 | 条 + 绝对值 | 条 + 绝对值 | 外环 + 百分比 | 外环 + 裸百分比（444ab87 明确“sole health cue”，styles.css:1379-1419） |
| 内力/资源 | ✔ | ✔ | ✔ | 状态行 | ✘ |
| 敌方意图/应对 | ✔（实/虚 + 提示） | ✔ | ✔ | ✔（skill-callout） | ✘ |
| 状态/连击/借力 | ✔ | ✔ | ✔ | ✔ | ✘ |
| 回合数/实时 | 第 7 回合 | 第 7 回合 | 第 7 回合 | 第 7 回合 | 仅战报事后 rounds；簇无 |
| 战斗日志 ticker | ✔ | ✔ | ✔ | ✔ | ✘（d06bc2e 删 ticker；CSS 仍 hide，styles:1304） |
| 上一战/战利品 | ✔ | ✔ | ✔ | ✔ | 仅 status-toast 的单件 lastDrop；战报无 loot |
| 刷取统计 | 本层 2h13m/84战/78胜 | 局部 | ✔ | ✔ | 全局战/胜 + 模拟时长；无本图本层实时统计 |
| 展开完整战报 | ✔ | ✔ | ✔ | ✔ | 10 行日志尾巴 |
| 信息密度 | 高 | 最高 | 中 | 中 | 低 |

**方向判断：当前最接近 D（地图头像互撞），但只保留了 D 的视觉符号，丢掉了 D 的信息层（意图、status、ticker、loot、战力差、expand）；`bebd8e4` 补了“待战/接敌”空态与右侧面板防遮挡，是可用性改善，但仍不是 D 的信息层**。A/B/C 的“常驻战报面/战况带”完全不存在；战报弹层质量低于四个概念中的任何一个。

**对最近 UI 提交的判断（审计期间 HEAD 从 d06bc2e 前进到 444ab87）**

- `010d74b`（12:59）：引入战斗簇 + 战报弹层 + 同步当前图，是本轮唯一“新增能力”的提交；同时给 `SessionBattleReportV1` 补 `enemyHpPct`（session.ts:130,754,853）。
- `256c735`（13:14）：加“战斗回放 ticker”和行止计时；ticker 在一个**已结算**的战报上以 520ms 滚动最后 12 行（commit diff），本质是伪回放，但至少给了时间感，且带 `aria-live="polite"`。
- `d06bc2e`（13:27）：删除 ticker、回合数、撞字，加 HP 条/多敌标签/冲击环。**多敌分组是唯一实质改善**；回退的是仅有的时间/回合线索与 `aria-live`。CSS 用 `display:none!important` 假装删除（styles.css:1304），`cluster-hit` keyframes 变成死代码。
- `444ab87`（13:31）：把外环作为唯一血量提示，删掉“气血”二字和 hpbar。视觉更贴 D，但有代价：血量失去语义标签（`aria-hidden` 环 + 裸 `%`，`App.tsx:415-418`）、敌人球的名字被 CSS 全局隐藏（styles.css:1409）、`.orb-hp-ring` 定义重复三遍（styles.css:1382-1392、1403-1408、1411-1419）、`.orb-hpbar`/`.combat-orb::before`/`.cluster-clash`/`.cluster-replay` 全成死 CSS。
- `bebd8e4`（13:34）：战斗簇空态（“自动行止中 / 待战 / 接敌 ?”，`App.tsx:389-432`）、右侧面板打开时把 x 钳到 60% 防遮挡（`App.tsx:398-405,411`）、换图/换层清空 `lastBattle`（`src/core/session.ts:511,528`）、无战报时禁用“战报”按钮（`App.tsx:431`）；新增 `reports/ui-idle-waiting.png`。这三项是真实可用性修复；但空态语义含糊（标题写“普通”、双方环一满一空，`reports/ui-idle-waiting.png`），`.orb-hp-ring` 变成第三份重复定义（`styles.css:1411-1419`），仍无意向/ticker/历史。
- 6 个提交（12:59→13:34）全是表现层微调：没有动 session 契约、没有补意图/回合/内力/历史、没有加任何测试；每轮都堆一层覆盖 CSS。**评价：444ab87 相对 d06bc2e 是轻微视觉改善、信息与 a11y 净退化；没有“坏掉”**（tsc/build 均过），但这是对着截图调参，不是补集成完成度。另：`reports/ui-idle-battle.png` 每个提交都被重生成并提交，而仓库无 Playwright/截图 harness（`reports/ui-v1-smoke.md:5`），该截图不可复现，不能作为证据。

### 3.1 战斗 UI 现存缺陷（逻辑可推演/实测）

| # | 缺陷 | 位置 | 影响 |
|---|---|---|---|
| 1 | 精英/首领 rank 误判：多敌精英名字是“精英、小怪”（data/world-v1.ts:889），与 `elite.name` 永不相等；且 `mapLayer>=10` 把所有第 10 层战斗标成首领 | App.tsx:391 | 标签错误，玩家无法判断遭遇等级 |
| 2 | 玩家名硬编码“沈/沈砚”，不读 `snapshot.playerName` | App.tsx:421-417（CharacterTab 同：667） | 改名玩家在战斗簇显示错误名字 |
| 3 | 伤害数字是整场 `damageDealt`，配“命中冲击”无限动画 | App.tsx:421；styles.css:1236-1251,1315-1341 | 像单次命中，实际是全场总和；已结束战斗在“假装打” |
| 4 | 战报=只存尾 12 行、只显示尾 10 行，且含内部规则 id | session.ts:757；App.tsx:458；combat-v1.ts:1746 | 21 回合的战斗只剩最后 1 回合；泄露 `priority_taiji_farm_ult` |
| 5 | 战报打开期间读实时 `snapshot.lastBattle` | App.tsx:441 | 下一场结算会静默替换正在看的战报 |
| 6 | “行止”时间用模拟战斗秒而非墙钟，在线 1h 后显示 ~3.3h | session.ts:379；App.tsx:245 | 时间认知失真，离线/在线同一字段语义不同 |
| 7 | 止行后战斗簇隐藏，续行立刻显示停之前那场 | App.tsx:389 | 显示过期战况；没有“等待下一场”状态 |
| 8 | `snapshot.active && lastBattle` 后隐藏当前位置 pin | App.tsx:158；styles.css:930 | 首次战斗后玩家位置标记永久消失 |
| 9 | 8h 离线只显示“4.0h 结算”，`stoppedBy` 直接渲染英文 code | App.tsx:207,210 | 玩家以为只挂到 4h；`activity-ended` 对玩家无意义 |

## 4. 玩家控制面：真 / 预览 / 缺失

| 能力 | 状态 | 证据 |
|---|---|---|
| 4 招 + 绝技 + 轻功切换 | **真** | `App.tsx:769-807` → `equipArt`（session.ts:471-484）；只在已学范围内 |
| 学招 | **真** | `App.tsx:758-766`（另有 toast 快捷学习 218-224） |
| 手动装备 | **真** | `App.tsx:871-879` → `equipItem`（session.ts:485-500） |
| 自动换装 | **真（策略自动）** | session.ts:922-967；UI 只展示结果（App:850-855），无对比/锁定/淬炼 UI（README:94 也承认） |
| 换图 / 自动开打 | **真** | `App.tsx:137-152`；session.ts:501-516；首通后还会自动换图（session.ts:898-920） |
| 止行 / 续行 | **真** | `App.tsx:249`；session.ts:533-541 |
| 换层 | **缺** | 设计要求（`docs/design/一纸江湖_养成总表_v0.1.md:535`），UI 无入口；`setActivity` 能传 layer 但 UI 只用当前层（App.tsx:141） |
| 守关/护镖（survive/escort） | **引擎有、UI 无** | session.ts:817-880；UI 仅状态文案 App.tsx:236-237，选择行被 `NARRATIVE_ENABLED` 隐藏（App.tsx:616-622） |
| 速度 1x/2x/4x | **完全缺失** | 设计 `docs/design/一纸江湖_养成总表_v0.1.md:329`；无命令、无 session 参数（`JianghuCommand` session.ts:65-75）、无 UI |
| 优先级预设切换（刷图/首领/守关） | **数据有、UI/命令无** | 9 个 preset + 每套 3 个（src/data/combat-v1.ts:679-755,800-844），但 loadout 永远停在 farm preset；`JianghuCommand` 无切换命令 |
| 条件优先级编辑（设计：≤6 条） | **完全缺失** | 设计 `docs/design/一纸江湖_养成总表_v0.1.md:316-330`；现有 preset 每套 ~10 条（combat-v1.ts:679-735），UI 只读且截断 8 条（App.tsx:830-835）；`advanceTo`/UI 不传 `priorityRules` 覆盖（combat-v1.ts:673-674） |
| 推演/木桩 | **完全缺失** | 设计 `docs/design/一纸江湖_养成总表_v0.1.md:350,542`；无入口、无 session 命令 |
| 复盘建议 | **完全缺失** | 设计 `docs/design/一纸江湖_养成总表_v0.1.md:349`；`src/` 无相关实现（grep 无“建议/推演/木桩”） |
| 战斗历史/多份战报 | **缺失** | snapshot 只有 `lastBattle`（session.ts:415），新战斗即覆盖 |
| 目标掉落/停止条件设置 | **缺失** | 设计 `docs/design/一纸江湖_养成总表_v0.1.md:535`；UI 只显示 `停止条件 · ...` 文案（App.tsx:624） |

补充：`TutorialSlip`（App.tsx:476-499）定义了但从未渲染，且 `NARRATIVE_ENABLED=false` 时必返回 null——旧引导 UI 是死代码（`src/ui/features.ts:5`）。`onboarding-v1.md` 所述“下一步目标由 milestone 生成”在当前 UI 已不存在。

## 5. README/报告声称核对（按代码逐条）

| 声称 | 判定 | 证据 |
|---|---|---|
| UI 只读 snapshot/内容数据，不重算规则（README:56） | **不完全成立** | UI 直接 import `dangerFor/eliteChanceFor/levelForLayer/recommendedRealmFor` 计算（App.tsx:6,524,569,601）；战斗簇自行推断 rank/skill/HP fallback（App.tsx:391-397） |
| 4 tab、叙事面隐藏、代码保留（README:92） | 成立 | tabs.ts:3-11；features.ts:5；idle-first.test.ts:6-10 |
| “已实时：…最近战报…”（README:93） | 部分成立 | 战报只有最后一场的最后 10 行（App.tsx:458），无历史/无结构化字段 |
| 武学 6 槽可切换（README:93） | 成立（受限） | App.tsx:769-807；但预设/优先级不可换 |
| 行囊全部/手动装备（README:93） | 成立 | App.tsx:840-893 |
| 地图换点自动开打（README:93） | 成立（且会自动换图，未披露） | App.tsx:137-152；session.ts:898-920 |
| “离线数字总结”（README:93 / idle-loop-v1.md:14） | 部分成立 | 仅 6 个字段，且 8h 显示“4.0h”；无修为/名望/loot/地图变化（App.tsx:204-215） |
| “战报”在 #15 保留（idle-loop-v1.md:44） | 成立但薄 | App.tsx:437-462 |
| 战斗 UI 不在 Combat v1 issue 内（combat-v1-100h.md:83） | 成立，也解释了现状 | 文件原话 |
| 新游戏/姓名/starter kit/起始图只在设置向导（README:95） | 成立 | App.tsx:342-356,368；boot 无存档直接开新局（sessionStore.ts:54-58） |
| 46 级 fixture 非新玩家默认（README:96） | 成立 | sessionStore.ts:25-31；session.ts:314-335；newGame 从 1 级开始 |
| 离线不自动换图（economy-v1-500h.md:72,78） | **不成立** | 实测 5 seeds 均自动换图；session.ts:784-800,898-920 |
| UI 验证含战报/会话接线（ui-v1-smoke.md:12） | 部分成立 | 只是静态断言，逐像素 smoke 未执行（ui-v1-smoke.md:5,56-63） |

## 6. 集成架构风险

1. **时间/节奏归谁所有**：session 以墙钟差+秒预算驱动（session.ts:561-593），但丢弃余数使速率依赖调用频率（1s/60s/30min/8h 四种 cadence 给出四种速率）。建议：session 内部维护 `pendingSeconds`（余数进位），并把 UI tick 频率与规则节奏解耦；否则“同一 seed 同一时钟序列结果一致”只在单一调用节奏下成立（测试只用 30min 间隔，session-v1.test.ts:148-158）。
2. **批量战斗 seam 限制 UI 上限**：`resolveBattle` 是同步一次性；session 关闭 `captureEvents`（session.ts:700,746,845），只留尾 12 行 log。概念 A–D 都假设逐回合实时面，现架构下无法诚实实现；正确方向是保留 `BattleEvent` 轻量时间线（engine 已产出 `events`/`keyRounds`/`damageBreakdown`，combat-v1.ts:754-782）并由 session 提供 replay timeline 或“进行中 battle 状态”。
3. **离线两套实现**：`world-v1.advanceOffline`（有 stop 条件、写测试）是死路径；session 自研离线循环（无 stop 条件、会换图）。任何关于离线的产品文案/验收都失去单一真相源。
4. **snapshot 契约有损，逼 UI 猜**：`lastBattle` 不含 kind/词缀/enemy level/style/首通，UI 用 `enemyName === elite.name` 判精英（App.tsx:391）——多敌精英名是“精英、小怪”（`src/data/world-v1.ts:889`），永远匹配不上；又用 `mapLayer >= 10` 判首领，导致第 10 层任何一场普通战被标成“首领”。
5. **状态所有权**：`sessionStore` 是模块级单例 + 1s 墙钟 interval（sessionStore.ts:7-17,209-223）；`boot()`（:23-64）不做离线结算，首次结算延迟到 1s 后。`BattleLogDrawer` 直接读实时 snapshot（App.tsx:441），打开期间下一场结算会静默换掉你正在看的战报。
6. **性能**：每秒构造完整 snapshot（gear score/背包扫描/structuredClone，session.ts:353-433,1015-1024）并全树重渲染；数值格式化每次 new `Intl.NumberFormat`（App.tsx:47-49）；5 组 infinite CSS 动画（styles.css:1236-1251,1327）。当前能跑，但无性能测试/无 memo，移动端风险未验证。
7. **UI 可测性**：`tests/` 无任何 DOM/组件测试（package.json:9 只跑 node:test；`tests/idle-first.test.ts` 只断言 flag/tab）；`BattleCluster`/`BattleLogDrawer` 内联在 941 行 App.tsx，其 rank/skill 启发式无法单测；`pwa:check` 只是字符串存在性检查（scripts/verify-pwa.mjs:36-56）。本次回放 ticker 删除无任何测试可捕获。
8. **可访问性**：战斗簇 `aria-label` 恒为“战斗中”（App.tsx:407），实际是已结束战报；ticker 删除后失去唯一 `aria-live`；HP 环 `aria-hidden` + 裸百分比（App.tsx:415-418）；战报弹层无 Escape/焦点陷阱/焦点迁移（App.tsx:444-452），明显弱于 SettingsDrawer（SettingsDrawer.tsx:47-53）；战斗数据字号 8–11px（styles.css:951-952,1402）。
9. **文案-行为一致性**：`App.tsx:624` 的停止条件、`App.tsx:207` 的“4.0h 结算”、`App.tsx:245` 的“行止”时间都会误导玩家（分别为未实现、只显示有效小时、模拟战斗秒）。

## 7. 完成度小结与优先修复建议

按“战斗系统完成度”的一半是“能不能挂起来”（已基本具备）另一半是“战斗是否可读、可研究、可复盘”（基本没有）：

1. **P0：修 tick 余数/节奏**。`advanceTo` 保留未消耗秒（或改为固定 fight step），让实时 UI、sim、离线共享同一时间模型；同时把离线统一到 `advanceOffline`+`shouldStop`，补 1h 内离线报告。
2. **P0：给战斗一个诚实的“进行中/时间线”契约**。session 保留最后一场的 `events/keyRounds/damageBreakdown` 瘦身时间线（或增加 `battleTimeline`），UI 据此做 6–15s 回放；否则 A–D 哪个方向都做不出来。
3. **P1：补战斗研究面**：优先级预设切换（刷图/首领/守关）+ 规则编辑（≤6 条）+ 1x/2x/4x + 推演/木桩 + 复盘建议。数据与引擎接口已存在，主要缺 session 命令与 UI。
4. **P1：扩展 snapshot 战斗契约**：`lastBattle` 加 encounter kind/词缀/enemy level/firstClear/damageBreakdown，及最近 N 场战报（含离线摘要），消除 UI 启发式。
5. **P2：战报呈现**：意图/内力/statuses/回合 ticker/本图统计/loot；离线 banner 补 xp/renown/loot/起止地图；修 `stoppedBy` 文案；补组件测试与 a11y（aria-live、drawer 焦点）。

> 给 Lead 的提醒：我审计期间 `src/ui/App.tsx`、`src/ui/styles.css`、`src/core/session.ts` 从 d06bc2e 前进到 444ab87 → bebd8e4（13:34），`reports/*` 也被并发 sim 重写；`src` 当前干净、tsc/build 通过。若最终报告引用具体行号/报告数值，请在冻结 HEAD 后复核一次；本轮 UI 提交（含 bebd8e4 的空态/清 lastBattle）仍是表现层微调，不建议当作“战斗 UI 完成度提升”计入。

## 8. 复现命令与口径

```bash
npx tsc --noEmit      # 通过（无输出）
npm run build         # vite 8.3.4 PASS，148ms，exit 0
# 1h 实时 1s tick vs 单次推进（同一 seed=3, taiji）
node -e 'const {JianghuSession}=await import("./src/core/session.ts");
 const a=JianghuSession.newGame("taiji",3,0);let t=0;for(let i=0;i<3600;i++){t+=1000;a.advanceTo(t,{offline:false});}
 const sa=a.snapshot();const b=JianghuSession.newGame("taiji",3,0);const sb=b.advanceTo(3600*1000,{offline:false}).snapshot;
 console.log(sa.fights,sa.elapsedHours.toFixed(2),sb.fights,sb.elapsedHours.toFixed(2));'
# → 198 3.33 78 1.02
# 8h 实时 vs 8h 离线（同上 seed）
node -e '... 8h 按 1s 推进 → fights 1596 / level 38 / map digong；8h 离线 → fights 230 / level 23 / map heishi'
# >1h 阈值跳变
node -e '... 59×60s 单次推进 → 76 战、无 offlineReport；61×60s → 45 战、effectiveHours 0.508、有报告'
# 离线自动换图（seed 1–5）
node -e '... newGame("taiji",seed,0).advanceTo(8h) → 起始 luoyang → 结束 heishi，5/5 seed 一致'
```

口径说明：`advanceTo` 的 `offline` 默认由“距上次结算的墙钟 ≥3600s”推出（session.ts:562），UI 从不显式传参；`reports/*` 的 sim 全部用单次推进（如 idle-loop-report.ts:9-10），所以本文件中“实时 tick”数字只能通过上面脚本复现。UI 侧无 Playwright，无法对战斗簇/战报做逐像素或交互验证（reports/ui-v1-smoke.md:5,56-63）。
