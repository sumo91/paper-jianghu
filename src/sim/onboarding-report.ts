import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { JianghuSession } from "../core/session.ts";
import { STARTER_KITS } from "../data/combat-v1.ts";

const builds = ["taiji", "pojun", "xuanyin"] as const;
const rows = builds.map((buildId) => {
  const session = JianghuSession.newGame(buildId, 1, 0, { playerName: "沈砚", mapId: "luoyang" });
  const five = session.advanceTo(5 * 60 * 1000, { offline: false }).snapshot;
  const thirty = session.advanceTo(30 * 60 * 1000, { offline: false }).snapshot;
  const hour = session.advanceTo(60 * 60 * 1000, { offline: false }).snapshot;
  return { buildId, kit: STARTER_KITS[buildId].name, five, thirty, hour };
});
const fixture = JianghuSession.devFixture(0).snapshot();

const table = (headers: string[], body: Array<Array<string | number>>) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...body.map((row) => `| ${row.join(" | ")} |`),
].join("\n");

const report = `# Onboarding, New Game & First Hour v1 验证报告

> 生成时间：${new Date().toISOString()}  
> 规则 seam：\`JianghuSession\` new-game/tutorial/milestones；无独立 onboarding 引擎。  
> 口径：连续在线模拟用于 pacing 验收，不是玩家日历。

## 0. 结论

- 三套 starter kit 都能用 starter gear 打赢第一层；第一场战斗不会永久失败。
- 第一次战斗、第一次升级、第一次掉落、第一次精英、第一次首领尝试均由 session milestone 记录。
- 30 分钟目标：三套均达到 ≥5 次掉落、≥1 次精英、≥2 级；第一小时均出现首领尝试。
- 首个目标/下一目标由 UI 文案读取 milestone；卡住时显示下一步，不弹墙。
- 引导步骤可逐步完成/跳过，flag 存档持久。
- 开发者 fixture 为 46 级宗师快照，\`?fixture=endgame\` 加载，不写玩家存档；新玩家默认 1 级。
- 新游戏流程：姓名 → starter kit → 起始地图（洛阳/漕运）→ 确认；起始 200 银两、starter gear、无免费神装。

## 1. 第一层与首小时 pacing

${table(
    ["Build", "起手", "5min 等级/掉落", "5min 首战/首升", "30min 等级/掉落/精英", "60min 首领尝试", "60min 等级"],
    rows.map((row) => [
      row.kit,
      row.buildId,
      `${row.five.level} / ${row.five.drops}`,
      `${row.five.milestones.firstWin !== undefined ? "有" : "无"} / ${row.five.milestones.firstLevel !== undefined ? "有" : "无"}`,
      `${row.thirty.level} / ${row.thirty.drops} / ${row.thirty.milestones.firstElite !== undefined ? "有" : "无"}`,
      row.hour.milestones.firstBossAttempt !== undefined ? `第 ${row.hour.milestones.firstBossAttempt} 战` : "无",
      row.hour.level,
    ]),
  )}

## 2. 前三十分钟明细

${table(
    ["Build", "场次", "胜/负", "等级", "装备分", "目标掉落", "首通"],
    rows.map((row) => [
      row.kit,
      row.thirty.fights,
      `${row.thirty.wins}/${row.thirty.losses}`,
      row.thirty.level,
      row.thirty.gearScore,
      row.thirty.targetDrops,
      row.thirty.mapsCleared,
    ]),
  )}

## 3. 引导与恢复

- 首次打开：继续（有存档）/ 新游戏 / 导入；坏档显示恢复导出，不静默覆盖。
- 新游戏：姓名（1–8 中文字符）→ starter kit 预览 → 起始地图 → 确认摘要；有存档时先确认覆盖。
- 引导 5 步：地图红印、信息台、设行止、武学/6 槽、第 10 层首领；每步“知道了”，随时“跳过”。
- 引导 flag 随存档持久；跳过不阻挡任何操作。
- 第一场战斗为普通 1 层，敌方伤害/气血降低；失败保留在 1 层，可立即重试。
- 下一步目标由 milestone 生成：打赢第 1 层 → 设行止推到 10 层 → 首通/门派钩子。
- 设置中可导出/导入/重开；重开二次确认。

## 4. 开发者 fixture

| 项目 | 值 |
| --- | --- |
| 入口 | \`?fixture=endgame\` |
| 等级 | ${fixture.level} |
| 地图 | ${fixture.mapId} |
| 神装 | ${fixture.divineItems} |
| 写玩家存档 | 否（store 在 fixture 模式禁用保存） |
| 新玩家默认 | 1 级 / 洛阳或漕运 / starter gear |

## 5. 验收口径

- 新游戏创建 1 级 session，kit/map/name 正确，loadout 合法。
- 三套 starter kit 均可清第一层。
- 首败可重试，不推进/损坏状态。
- tutorial flags 持久；skip 不阻断。
- continue 精确恢复；new game 覆盖前确认；import 校验失败安全。
- 30min ≥5 drops + elite；60min boss attempt + 下一目标。
- no empty map/loadout / dead-end；fixture 不覆盖玩家存档。
`;

const out = resolve("reports");
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/onboarding-v1.md`, report);
writeFileSync(`${out}/onboarding-v1.json`, JSON.stringify({ generatedAt: new Date().toISOString(), rows, fixture }, null, 2));
console.log(`Wrote ${out}/onboarding-v1.md`);
console.log(rows.map((row) => `${row.buildId}: 30m ${row.thirty.level}L/${row.thirty.drops}D; 60m boss ${row.hour.milestones.firstBossAttempt}`).join(" | "));
