# 一纸江湖

武侠题材 · 手机横屏 16:9 · 放置挂机 RPG。

当前阶段：**系统设计 + 实现规格完成，进入实现前审计**。不做内容切片，不先造空壳流程。

## 文件

- 设计正文：[`docs/design/一纸江湖_养成总表_v0.1.md`](docs/design/一纸江湖_养成总表_v0.1.md)
- 可编辑总表：[`docs/design/一纸江湖_养成总表_v0.1.xlsx`](docs/design/一纸江湖_养成总表_v0.1.xlsx)
- 最新平衡模拟报告：[`reports/balance-v0.6.md`](reports/balance-v0.6.md)
- 历史基线：[`reports/balance-v0.4.md`](reports/balance-v0.4.md)、[`reports/balance-v0.3.md`](reports/balance-v0.3.md)、[`reports/balance-v0.2.md`](reports/balance-v0.2.md)、[`reports/balance-v0.1.md`](reports/balance-v0.1.md)
- 原始数据：`reports/balance-v0.6.json`、`reports/balance-v0.6.csv`
- UI 首屏截图：[`reports/ui-v0.6-main.png`](reports/ui-v0.6-main.png)
- UI 代码：[`src/ui/App.tsx`](src/ui/App.tsx)、[`src/ui/styles.css`](src/ui/styles.css)
- 概念主界面：[`concept/main-screen.png`](concept/main-screen.png)
- 原图：`JianghuBG.png`

## Spec 地图（实现以 GitHub Issues 为准）

设计总表是综述；真正的实现规格在 GitHub Issues。除特别标注外均为 `ready-for-agent`。

| # | Spec | 状态/依赖 |
|---|---|---|
| [#14](https://github.com/sumo91/paper-jianghu/issues/14) | Product Direction：叙事/美术/音频/商业化 | `ready-for-human`；v1 免费已拍板，商业化后置 |
| [#2](https://github.com/sumo91/paper-jianghu/issues/2) | Combat v1：六槽、回合制、属性/公式/表现 | 核心，无 blocker |
| [#3](https://github.com/sumo91/paper-jianghu/issues/3) | World & Encounter v1：15 图、首领、词缀、首通 | 核心 |
| [#4](https://github.com/sumo91/paper-jianghu/issues/4) | Itemization & Gear Agency v1 | 依赖 #3 的内容契约 |
| [#5](https://github.com/sumo91/paper-jianghu/issues/5) | Build Acquisition & Progression v1 | 依赖 #2/#4 |
| [#6](https://github.com/sumo91/paper-jianghu/issues/6) | Economy & Time Budget v1 | 依赖 #3/#4/#5 |
| [#7](https://github.com/sumo91/paper-jianghu/issues/7) | Factions, NPCs & Events v1 | blocked by #3/#5/#6 |
| [#8](https://github.com/sumo91/paper-jianghu/issues/8) | Companions & Bonds v1 | blocked by #2/#3/#7 |
| [#9](https://github.com/sumo91/paper-jianghu/issues/9) | Endgame, Ranks & Seasons v1 | blocked by #2/#5/#6 |
| [#10](https://github.com/sumo91/paper-jianghu/issues/10) | Survival, Feng Shui & Offline Events v1 | blocked by #2/#3/#6/#7 |
| [#1](https://github.com/sumo91/paper-jianghu/issues/1) | 实时江湖会话：行止/离线/存档/UI 绑定 | blocked by #2–#6 |
| [#11](https://github.com/sumo91/paper-jianghu/issues/11) | Onboarding, New Game & First Hour v1 | blocked by #1/#5/#12 |
| [#12](https://github.com/sumo91/paper-jianghu/issues/12) | UI/UX, Settings & PWA v1 | blocked by #1 |
| [#13](https://github.com/sumo91/paper-jianghu/issues/13) | Content Pipeline, Validation & Simulator v1 | blocked by #2–#6 |

实现顺序：**#2 → #3/#4/#5/#6 → #7/#8/#9/#10 → #1 → #11/#12/#13**。

#14 已拍板 **v1 完全免费、商业化后置**；叙事/美术/音频范围仍需 review。v1 硬约束是**无广告、无抽卡、无付费战力**。

> 旧设计文档中的 4+1 招式槽、8–12h/50–70% 离线、无条件自动穿戴、5+1 首领等口径已被 spec 覆盖。以 issues 为准。

## 模拟器

无第三方运行时依赖；使用 Node 24 原生 TypeScript 类型擦除直接运行 `.ts`。

```bash
# 3 套 build × 3 seeds × 100h，激进 bot
npm run sim

# 自定义
npm run sim -- --hours=24 --seeds=1,2 --policy=balanced --out=reports

# 测试（14 项）
npm test
```

模拟器是设计工具，不是可玩游戏；它的任务是验证成长曲线、战斗深度、经济与 build 差异。

## UI（首屏 shell）

```bash
pnpm dev
# http://127.0.0.1:5173
```

首屏已按 16:9 搭起：原画作地图，右侧常驻“江湖信息台”（地图 / 人物 / 武学 / 行囊 / 江湖），信息台默认展开、可收起；点击红印切换地点，地图页显示怪物/掉落/行止统计，底栏是人物/当前行止/启程。

当前 UI 仍是 v0.6 冻结快照的原型；交互覆盖 tab、地点、启程、面板展开/收起。实时循环、离线、存档、loadout/gear agency 和完整页面由 #1–#13 定义，尚未实现。

## 当前结论（v0.6 · 数值参照，待 Combat v1 重设基线）

100h × 3 builds × 3 seeds，激进 bot：

- 100h 中位等级：太极 46 / 破军 47 / 玄阴 48；等级差 **4.2%**。
- 三套全部 **3/3 宗师**；宗师到达时间 太极 83.4h / 破军 80.9h / 玄阴 74.1h，最早最晚只差 **9.3h**。
- 每套在 100h 内都从“5 图以上首领首通”拿到 1 件确定性神装（3 seeds 共 3 件），其余为绝装。
- 太极靠伤害上调 + 守关稳定（占场次 20%，胜率 100%）追上时间差。
- 玄阴带毒回血，是最快曲线；破军仍靠失败场次换速度。
- 14 项测试全过，其中包括一条 100h 三 build 的验收回归。

**v0.6 只作为数值参照。** Combat v1（#2）会改变行动顺序、二级属性、装备/构筑和战斗表现，落地后必须用 #13 的内容/模拟管线重新基线，不能把 v0.6 当成不可变验收合同。

当前不做新数值轮；按 Spec 地图实现 #2，再并行补 #3–#6。任何后续改动都走 #13 的 schema/模拟/验收，不再手调 v0.6 报告。

## 设计原则

- 画是主界面，不是背景；五枚红印 = 五章。
- 战斗几乎没有动画，但配招、克制、破招、复盘必须有深度。
- 江湖味不是字体，是地点、NPC、门派、事件、声望和后果。
- 不做体力、广告、每日打卡墙。
