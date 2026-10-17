# 一纸江湖

武侠题材 · 手机横屏 16:9 · 放置挂机 RPG。

当前阶段：**#2–#6 核心契约已实现并关闭**，进入后续内容/会话/UI 实现。战斗、世界、装备、构筑、经济均已各自收敛到单一 pure seam；100h / 500h 回归报告已重设基线。

## 文件

- 设计正文：[`docs/design/一纸江湖_养成总表_v0.1.md`](docs/design/一纸江湖_养成总表_v0.1.md)
- 可编辑总表：[`docs/design/一纸江湖_养成总表_v0.1.xlsx`](docs/design/一纸江湖_养成总表_v0.1.xlsx)
- v1 100h 验收报告：[`reports/combat-v1-100h.md`](reports/combat-v1-100h.md)（含 Combat / World / Itemization / Build Progression / Economy）
- v1 500h 经济压力报告：[`reports/economy-v1-500h.md`](reports/economy-v1-500h.md)
- 原始数据：`reports/combat-v1-100h.json` / `.csv`、`reports/economy-v1-500h.json` / `.csv`
- 历史 v0.6 参照：[`reports/balance-v0.6.md`](reports/balance-v0.6.md)
- UI 首屏截图：[`reports/ui-v0.6-main.png`](reports/ui-v0.6-main.png)
- UI 代码：[`src/ui/App.tsx`](src/ui/App.tsx)、[`src/ui/styles.css`](src/ui/styles.css)、[`src/ui/worldUi.ts`](src/ui/worldUi.ts)
- 概念主界面：[`concept/main-screen.png`](concept/main-screen.png)

## Spec 地图（实现以 GitHub Issues 为准）

| # | Spec | 状态/依赖 |
|---|---|---|
| [#14](https://github.com/sumo91/paper-jianghu/issues/14) | Product Direction：叙事/美术/音频/商业化 | `ready-for-human`；v1 免费已拍板，商业化后置 |
| [#2](https://github.com/sumo91/paper-jianghu/issues/2) | Combat v1：六槽、回合制、属性/公式/表现 | **closed** |
| [#3](https://github.com/sumo91/paper-jianghu/issues/3) | World & Encounter v1：15 图、首领、词缀、首通 | **closed** |
| [#4](https://github.com/sumo91/paper-jianghu/issues/4) | Itemization & Gear Agency v1 | **closed** |
| [#5](https://github.com/sumo91/paper-jianghu/issues/5) | Build Acquisition & Progression v1 | **closed** |
| [#6](https://github.com/sumo91/paper-jianghu/issues/6) | Economy & Time Budget v1 | **closed** |
| [#7](https://github.com/sumo91/paper-jianghu/issues/7) | Factions, NPCs & Events v1 | blocked by #3/#5/#6 |
| [#8](https://github.com/sumo91/paper-jianghu/issues/8) | Companions & Bonds v1 | blocked by #2/#3/#7 |
| [#9](https://github.com/sumo91/paper-jianghu/issues/9) | Endgame, Ranks & Seasons v1 | blocked by #2/#5/#6 |
| [#10](https://github.com/sumo91/paper-jianghu/issues/10) | Survival, Feng Shui & Offline Events v1 | blocked by #2/#3/#6/#7 |
| [#1](https://github.com/sumo91/paper-jianghu/issues/1) | 实时江湖会话：行止/离线/存档/UI 绑定 | blocked by #2–#6 |
| [#11](https://github.com/sumo91/paper-jianghu/issues/11) | Onboarding, New Game & First Hour v1 | blocked by #1/#5/#12 |
| [#12](https://github.com/sumo91/paper-jianghu/issues/12) | UI/UX, Settings & PWA v1 | blocked by #1 |
| [#13](https://github.com/sumo91/paper-jianghu/issues/13) | Content Pipeline, Validation & Simulator v1 | blocked by #2–#6 |

下一实现顺序：**#7/#8/#9/#10 → #1 → #11/#12/#13**。v1 硬约束仍是**无广告、无抽卡、无付费战力**；商业化与叙事/美术范围由 #14 决定。

## 核心 seam

| 模块 | 入口 |
|---|---|
| 战斗 | `resolveBattle(BattleInput): BattleResult`（`src/core/combat-v1.ts`） |
| 世界/遭遇 | `generateEncounter` / `canEnterMap` / `recordMapClear` / `advanceOffline`（`src/core/world-v1.ts`） |
| 装备 | `ItemizationService`（`src/core/itemization.ts`） |
| 构筑 | `BuildProgression`（`src/core/progression.ts`） |
| 经济 | `Economy`（`src/core/economy.ts`） |

内容数据在 `src/data/*-v1.ts`。UI 只读内容/结果，不重算规则；地图页已改为读 world 内容。

## 命令

```bash
npm test                  # 79 项测试：seam / 内容校验 / 100h 验收
npx tsc --noEmit          # 全量类型检查
npm run build             # 生产构建（Vite）

npm run sim:v1            # 3 builds × 3 seeds × 100h，生成 combat-v1-100h.*
npm run sim:economy       # 100h 经济日历 + 500h 战斗 + 500h 经济压力
npm run sim               # v0.6 legacy 平衡模拟（仅历史参照）
```

## v1 基线结论（100h / 500h）

- 100h 三套 starter kit 全部到宗师（realm 5），等级差 2.1%，宗师时间差 7.8h；15/15 图首通。
- 终局装备评分 596 / 595 / 593；神装各 2 件（仅高层首通保底）；熟练 7、内功 7 层、经脉 12/11/11 节点、洗点 1 次。
- 100h 宗师玩家日历 **15.3–16.9 天**（1h 主动 + 8h 离线 50%/天），落在 2–4 周目标内。
- 500h 连续战斗：太极反伤 61 级 / 传说 / 15 图 / 25,042 场；约 3,377 银两/小时。
- 500h 经济压力：3 seeds 无负余额、无零消耗货币、无无限银两；离线 50%/8h；天机积分只换外观/称号。
- v0.6 只作为历史数值参照；Combat v1 后的验收以 `reports/combat-v1-100h.md` 与 `reports/economy-v1-500h.md` 为准。

## 当前 UI 边界

首屏仍按 16:9 搭起：原画作地图、右侧常驻“江湖信息台”、五枚红印切换地点、底栏行止。地图页已接入 world 内容（推荐境界、危险、精英率、首领阶段、词缀、目标掉落来源）。战斗/装备/武学编辑器仍是无 seam 的展示层，实时会话、存档、离线结算与完整 UI 由 #1–#13 定义，尚未实现。

## 设计原则

- 画是主界面，不是背景；五枚红印 = 五章。
- 战斗几乎没有动画，但配招、克制、破招、复盘必须有深度。
- 江湖味不是字体，是地点、NPC、门派、事件、声望和后果。
- 不做体力、广告、每日打卡墙。
