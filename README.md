# 一纸江湖

武侠题材 · 手机横屏 16:9 · 放置挂机 RPG。

当前阶段：**系统设计与无 UI 平衡模拟**。不做内容切片，不先造空壳流程。

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

当前 UI 使用 v0.6 的冻结快照，交互覆盖：tab 切换、地点选择、启程、展开/收起信息台。战斗循环、离线信、真实状态与存档还没接——那是下一步。

## 当前结论（v0.6 · 数值基线冻结）

100h × 3 builds × 3 seeds，激进 bot：

- 100h 中位等级：太极 46 / 破军 47 / 玄阴 48；等级差 **4.2%**。
- 三套全部 **3/3 宗师**；宗师到达时间 太极 83.4h / 破军 80.9h / 玄阴 74.1h，最早最晚只差 **9.3h**。
- 每套在 100h 内都从“5 图以上首领首通”拿到 1 件确定性神装（3 seeds 共 3 件），其余为绝装。
- 太极靠伤害上调 + 守关稳定（占场次 20%，胜率 100%）追上时间差。
- 玄阴带毒回血，是最快曲线；破军仍靠失败场次换速度。
- 14 项测试全过，其中包括一条 100h 三 build 的验收回归。

**v0.6 通过核心数值验收，数值循环到此冻结。** 下一步不再开 v0.7 数值轮，进入：

1. 16:9 主界面；
2. 常驻信息台（地图/人物/武学/行囊/江湖）；
3. 第一批完整内容系统（5 地区骨架、门派/声望、NPC/事件）。

数值基线一旦被后续内容带崩，用回归测试和模拟器重新拉回。

## 设计原则

- 画是主界面，不是背景；五枚红印 = 五章。
- 战斗几乎没有动画，但配招、克制、破招、复盘必须有深度。
- 江湖味不是字体，是地点、NPC、门派、事件、声望和后果。
- 不做体力、广告、每日打卡墙。
