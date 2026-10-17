# 一纸江湖

武侠题材 · 手机横屏 16:9 · 放置挂机 RPG。

当前阶段：**#1–#13 全部 ready-for-agent specs 已关闭**；只剩 **#14 Product Direction**（`ready-for-human`）需要人类拍板叙事结局、美术/音频范围与首发边界。v1 硬约束已定：**免费、无广告、无抽卡、无付费战力**。

## 文件

- 设计正文：[`docs/design/一纸江湖_养成总表_v0.1.md`](docs/design/一纸江湖_养成总表_v0.1.md)
- 可编辑总表：[`docs/design/一纸江湖_养成总表_v0.1.xlsx`](docs/design/一纸江湖_养成总表_v0.1.xlsx)
- v1 100h 验收：[`reports/combat-v1-100h.md`](reports/combat-v1-100h.md)
- v1 500h 经济压力：[`reports/economy-v1-500h.md`](reports/economy-v1-500h.md)
- 内容/矩阵/CI：[`reports/content-v1.md`](reports/content-v1.md)、[`reports/release-manifest.json`](reports/release-manifest.json)
- 系统验证：[factions](reports/factions-events-v1.md)、[companions](reports/companions-v1.md)、[activities](reports/activities-v1.md)、[endgame](reports/endgame-v1.md)、[onboarding](reports/onboarding-v1.md)、[UI/PWA](reports/ui-v1-smoke.md)
- UI 代码：[`src/ui/App.tsx`](src/ui/App.tsx)、[`src/ui/sessionStore.ts`](src/ui/sessionStore.ts)、[`src/ui/SettingsDrawer.tsx`](src/ui/SettingsDrawer.tsx)、[`src/ui/StartScreen.tsx`](src/ui/StartScreen.tsx)
- PWA：[`public/manifest.webmanifest`](public/manifest.webmanifest)、[`public/sw.js`](public/sw.js)
- 概念主界面：[`concept/main-screen.png`](concept/main-screen.png)

## Spec 地图

| # | Spec | 状态 |
|---|---|---|
| [#14](https://github.com/sumo91/paper-jianghu/issues/14) | Product Direction：叙事/美术/音频/商业化/首发 | **ready-for-human**（唯一未决） |
| [#1](https://github.com/sumo91/paper-jianghu/issues/1) | 实时江湖会话：行止/离线/存档/UI 绑定 | closed |
| [#2](https://github.com/sumo91/paper-jianghu/issues/2) | Combat v1 | closed |
| [#3](https://github.com/sumo91/paper-jianghu/issues/3) | World & Encounter v1 | closed |
| [#4](https://github.com/sumo91/paper-jianghu/issues/4) | Itemization & Gear Agency v1 | closed |
| [#5](https://github.com/sumo91/paper-jianghu/issues/5) | Build Acquisition & Progression v1 | closed |
| [#6](https://github.com/sumo91/paper-jianghu/issues/6) | Economy & Time Budget v1 | closed |
| [#7](https://github.com/sumo91/paper-jianghu/issues/7) | Factions, NPCs & Events v1 | closed |
| [#8](https://github.com/sumo91/paper-jianghu/issues/8) | Companions & Bonds v1 | closed |
| [#9](https://github.com/sumo91/paper-jianghu/issues/9) | Endgame, Ranks & Seasons v1 | closed |
| [#10](https://github.com/sumo91/paper-jianghu/issues/10) | Survival, Feng Shui & Offline Events v1 | closed |
| [#11](https://github.com/sumo91/paper-jianghu/issues/11) | Onboarding, New Game & First Hour v1 | closed |
| [#12](https://github.com/sumo91/paper-jianghu/issues/12) | UI/UX, Settings & PWA v1 | closed |
| [#13](https://github.com/sumo91/paper-jianghu/issues/13) | Content Pipeline, Validation & Simulator v1 | closed |

## 核心 seam

| 模块 | 入口 |
|---|---|
| 实时会话 | `JianghuSession`（`src/core/session.ts`） |
| 战斗 | `resolveBattle(BattleInput): BattleResult`（`src/core/combat-v1.ts`） |
| 世界/遭遇 | `generateEncounter` / `canEnterMap` / `recordMapClear` / `advanceOffline`（`src/core/world-v1.ts`） |
| 装备 | `ItemizationService`（`src/core/itemization.ts`） |
| 构筑 | `BuildProgression`（`src/core/progression.ts`） |
| 经济 | `Economy`（`src/core/economy.ts`） |
| 门派/NPC/事件 | `FactionEventService`（`src/core/factions-events.ts`） |
| 同伴 | `CompanionService`（`src/core/companions.ts`） |
| 守关/护镖/风水 | `ActivityService`（`src/core/activities.ts`） |
| 天机榜/赛季/江湖志 | `EndgameService`（`src/core/endgame.ts`） |
| 内容管线 | `validateContent` / `runContentMatrix` / `recoverSave`（`src/core/content-pipeline.ts`、`save-compat.ts`） |

内容数据在 `src/data/*-v1.ts`，统一由 `src/data/content-bundle.ts` 汇总。UI 只读 session snapshot / 内容数据，不重算规则。

## 命令

```bash
npm test                  # 144 项测试
npx tsc --noEmit          # 全量类型检查
npm run build             # 生产构建
npm run content:check     # 10 层内容校验 + 15 图 × 4 builds 矩阵
npm run pwa:check         # manifest/sw/icons/14px/16:9/44px/a11y 结构检查

npm run sim:v1            # 3 builds × 3 seeds × 100h
npm run sim:economy       # 100h 日历 + 500h 战斗 + 500h 经济压力
npm run sim:factions      # 门派/事件/中原链模拟
npm run sim:companions    # 8 同伴 + 有/无同伴矩阵
npm run sim:activities    # 守关/护镖实跑 + 风水 + 离线事件
npm run sim:endgame       # 500 名天机榜 + 赛季 + 江湖志 + 归隐
npm run sim:onboarding    # 5/30/60 分钟首小时 pacing
npm run sim               # v0.6 legacy 平衡模拟（仅历史参照）
```

## 当前基线

- 100h 三套 starter kit 全部到宗师，等级差 ≤5%，宗师时间差 ≤12h；15/15 图首通。
- 100h 宗师玩家日历 15.3–16.9 天（1h 主动 + 8h 离线 50%/天）。
- 500h 战斗与 3 seeds 经济压力：无负余额、无零消耗货币、无无限银两；天机积分只换外观/称号。
- 内容矩阵 dominant share 34.1%，无不可通地图；hybrid 合法。
- 首小时：三套均有首战/首升/首掉/首精英；60min 内出现第一个首领尝试。
- 会话：1 级新游戏 → 行止/离线 → 存档恢复；坏档导出恢复；`?fixture=endgame` 保留 46 级视觉 QA fixture。
- UI/PWA：16:9 信息台、设置/导出/导入/重开、字号/减少动效、离线报告、战报、安装/更新提示、离线 app shell。
- 全量验证：`npm test` 144/144；`content:check` PASS；`pwa:check` PASS；`npm run build` PASS。

## 当前 UI 边界

- 已实时：顶部资源/等级、当前地图/层/行止、止行/续行、离线归来报告、最近战报、人物属性/装备、武学 6 槽/心法/经脉/优先级、行囊最近掉落与当前装备、地图实时统计、风水/活动摘要、设置/PWA/引导/新游戏入口。
- 仍是预览/增量：门派/同伴/天机榜/江湖志的完整内容页、loadout 拖拽编辑器、背包逐件比较/锁定 UI、事件选择弹层。规则/服务均已实现，后续只接页面。
- 当前 46 级宗师画面只作为 `?fixture=endgame` 开发者 fixture，不再是新玩家默认状态。

## #14 待人类决策

以下不是 agent 可自行拍板的内容：

- 叙事主线/结局数量与五地区个人线取舍。
- 美术边界：是否维持现有原画 + 纸墨 UI，不做立绘/重绘。
- 音频：v1 静音/极简环境音，不做配音/授权音乐。
- 首发平台/语言/分级/隐私文案的最终确认。
- 商业化已拍板 v1 免费；后续商业化评估不得回填付费战力/广告。

## 设计原则

- 画是主界面，不是背景；五枚红印 = 五章。
- 战斗几乎没有动画，但配招、克制、破招、复盘必须有深度。
- 江湖味不是字体，是地点、NPC、门派、事件、声望和后果。
- 不做体力、广告、每日打卡墙。
