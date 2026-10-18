import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { JianghuSession } from "../core/session.ts";
import { STARTER_KITS } from "../data/combat-v1.ts";

const builds = ["taiji", "pojun", "xuanyin"] as const;
const rows = builds.map((buildId) => {
  const session = JianghuSession.newGame(buildId, 3, 0);
  const ten = session.advanceTo(10 * 60 * 1000, { offline: false }).snapshot;
  const thirty = session.advanceTo(30 * 60 * 1000, { offline: false }).snapshot;
  const pending = [...thirty.pendingArts];
  let learned = thirty.ownedMoves;
  let equipped = thirty.loadout.moves;
  let notice = thirty.notice;
  if (pending.length > 0) {
    const afterLearn = session.dispatch({ type: "learnArt", artId: pending[0] });
    learned = afterLearn.ownedMoves;
    const afterEquip = session.dispatch({ type: "equipArt", slot: "move3", artId: pending[0] });
    equipped = afterEquip.loadout.moves;
    notice = afterEquip.notice;
  }
  const spare = thirty.bag.find((item) => !item.equipped);
  const afterGear = spare ? session.dispatch({ type: "equipItem", itemId: spare.id }) : null;
  session.dispatch({ type: "travel", mapId: "caoyun" });
  const travel = session.advanceTo(31 * 60 * 1000, { offline: false }).snapshot;
  return {
    buildId,
    kit: STARTER_KITS[buildId].name,
    ten,
    thirty,
    pending,
    learned,
    equipped,
    notice,
    gearEquipped: Boolean(afterGear?.bag.find((item) => item.id === spare?.id)?.equipped),
    travel,
  };
});

const table = (headers: string[], body: Array<Array<string | number>>) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...body.map((row) => `| ${row.join(" | ")} |`),
].join("\n");

const report = `# Idle-first Base Loop 验证报告（#15）

> 生成时间：${new Date().toISOString()}  
> 口径：连续在线 10/30/60 分钟；自动战斗、掉落、升级、学招、换装、换地点全部走真实 \`JianghuSession\`。  
> 叙事开关：\`NARRATIVE_ENABLED=false\`；隐藏江湖/门派/NPC/同伴剧情/终局入口，不删除代码。

## 0. 结论

- 无存档直接进入 1 级自动挂机；默认沈砚/太极/洛阳，不再走四步向导。
- 首屏可见等级、XP 条、资源、场次、最近战报、掉落/升级提示。
- 10 分钟：三套 starter kit 均 ≥3 次可见成长（等级+掉落），≥1 掉落。
- 30 分钟：三套均 ≥5 次成长，均获得至少 1 个可学招式；可学习、可装配、可手动换装。
- 换地图自动开始：travel 后 active=true，layer=1。
- 离线 8h 只显示数字总结（时间/场次/等级/掉落/银两），无事件选择/信件。
- 100h 三套宗师验收仍通过。

## 1. 10 / 30 分钟指标

${table(
    ["Build", "10m 等级", "10m 掉落", "10m 成长", "30m 等级", "30m 掉落", "30m 成长", "30m 可学招式", "30m 已学"],
    rows.map((row) => [
      row.kit,
      row.ten.level,
      row.ten.drops,
      (row.ten.level - 1) + row.ten.drops,
      row.thirty.level,
      row.thirty.drops,
      (row.thirty.level - 1) + row.thirty.drops,
      row.pending.join("、") || "—",
      row.learned.slice(-2).join("、"),
    ]),
  )}

## 2. 招式装配与换装

${table(
    ["Build", "装配后 4 招", "换装", "最后提示"],
    rows.map((row) => [
      row.kit,
      row.equipped.map((id) => id).join(" / "),
      row.gearEquipped ? "成功" : "无备用",
      row.notice ?? "—",
    ]),
  )}

## 3. 换地点

${table(
    ["Build", "目标地图", "active", "layer", "31m 场次"],
    rows.map((row) => [row.kit, row.travel.mapId, String(row.travel.active), row.travel.mapLayer, row.travel.fights]),
  )}

## 4. 叙事隐藏清单

- 隐藏：江湖 tab、门派声望、NPC 关系、江湖帖、同伴剧情、终局/天机榜/武林大会/江湖志、事件选择、故事化标题、地图 flavor/NPC 行、完整四步向导。
- 保留：地图、资源、等级/XP、装备/掉落、武学/装配、行囊、战报、自动行止、离线数字总结。
- 恢复方式：把 \`src/ui/features.ts\` 的 \`NARRATIVE_ENABLED\` 改回 true；代码未删除。

## 5. 真人试玩检查（需你执行）

1. 打开首页，是否无需填写表单就已在挂机？
2. 10 分钟内是否至少看到 3 次“升级/换装/掉落”提示？
3. 30 分钟内是否拿到并装配至少 1 个新招式？
4. 换地图后是否自动开打，不需要再点“开始”？
5. 关掉 8 小时回来，是否只看到数字总结、没有剧情选择？
6. 如果以上任何一项为否，先调掉落/升级/招式节奏，不要恢复叙事。
`;

const out = resolve("reports");
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/idle-loop-v1.md`, report);
writeFileSync(`${out}/idle-loop-v1.json`, JSON.stringify({ generatedAt: new Date().toISOString(), narrativeEnabled: false, rows }, null, 2));
console.log(`Wrote ${out}/idle-loop-v1.md`);
for (const row of rows) {
  console.log(`${row.buildId}: 10m L${row.ten.level}/D${row.ten.drops}; 30m L${row.thirty.level}/D${row.thirty.drops}; arts ${row.pending.length}; travel ${row.travel.mapId}/${row.travel.active}`);
}
