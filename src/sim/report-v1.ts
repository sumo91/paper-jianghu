import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { simulateV1, type SimV1Result } from "../core/sim-v1.ts";
import { REALM_NAMES } from "../core/types.ts";
import { validateWorldContent } from "../core/world-v1.ts";
import { WORLD_CONTENT_V1 } from "../data/world-v1.ts";

const BUILDS = ["taiji", "pojun", "xuanyin"] as const;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function table(headers: string[], rows: Array<Array<string | number>>): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function run(hours: number, seeds: number[]): SimV1Result[] {
  const results: SimV1Result[] = [];
  for (const buildId of BUILDS) {
    for (const seed of seeds) {
      const started = Date.now();
      const result = simulateV1({ buildId, seed, hours });
      results.push(result);
      console.log(
        `${result.buildName} seed=${seed} level=${result.final.level} realm=${result.final.realm} ` +
          `maps=${result.mapsCleared.length} fights=${result.totalFights} ` +
          `win=${(result.final.winRate * 100).toFixed(1)}% (${Date.now() - started}ms)`,
      );
    }
  }
  return results;
}

function csv(results: SimV1Result[]): string {
  const rows = results.map((result) => [
    result.buildId,
    result.seed,
    result.hours.toFixed(2),
    result.final.level,
    result.final.realm,
    result.realmTimes["5"]?.toFixed(2) ?? "",
    result.final.layer,
    result.final.mapId,
    result.mapsCleared.length,
    result.totalFights,
    result.totalWins,
    result.totalLosses,
    (result.final.winRate * 100).toFixed(1),
    result.avgRounds.toFixed(2),
    result.timeoutLosses,
    result.totalXp,
    result.totalSilver,
    result.totalRenown,
    result.mapsCleared.length,
    result.mapsVisited.length,
    result.targetDrops.length,
    result.firstClears,
  ].join(","));
  return [
    "build,seed,hours,level,realm,realm5_hours,layer,map,map_cleared,fights,wins,losses,win_rate,avg_rounds,timeouts,xp,silver,renown,maps_cleared,maps_visited,target_drops,first_clears",
    ...rows,
  ].join("\n");
}

export function writeCombatV1Report(outDir = "reports", hours = 100, seeds = [1, 2, 3]): string {
  const results = run(hours, seeds);
  const byBuild = BUILDS.map((buildId) => {
    const runs = results.filter((result) => result.buildId === buildId);
    return {
      buildId,
      name: runs[0].buildName,
      levels: runs.map((result) => result.final.level),
      realm5: runs.map((result) => result.realmTimes["5"]).filter((value): value is number => value !== null),
      maps: runs.map((result) => result.mapsCleared.length),
      winRate: runs.map((result) => result.final.winRate),
      fights: runs.map((result) => result.totalFights),
      rounds: runs.map((result) => result.avgRounds),
      timeouts: runs.map((result) => result.timeoutLosses),
      realm: runs.map((result) => result.final.realm),
      targets: runs.map((result) => result.targetDrops.length),
      firstClears: runs.map((result) => result.firstClears),
      visited: runs.map((result) => result.mapsVisited.length),
      notes: runs.flatMap((result) => result.notes).slice(0, 6),
    };
  });
  const medians = byBuild.map((build) => ({
    buildId: build.buildId,
    name: build.name,
    level: median(build.levels),
    realm: median(build.realm),
    realm5: build.realm5.length > 0 ? median(build.realm5) : null,
    maps: median(build.maps),
    winRate: median(build.winRate),
    fights: median(build.fights),
    rounds: median(build.rounds),
    timeouts: median(build.timeouts),
    targets: median(build.targets),
    firstClears: median(build.firstClears),
    visited: median(build.visited),
  }));
  const levelSpread = (Math.max(...medians.map((m) => m.level)) - Math.min(...medians.map((m) => m.level)))
    / Math.max(...medians.map((m) => m.level));
  const realmTimes = medians.map((m) => m.realm5).filter((value): value is number => value !== null);
  const realmGap = realmTimes.length > 1 ? Math.max(...realmTimes) - Math.min(...realmTimes) : 0;
  const allReached = medians.every((m) => m.realm >= 5);
  const allMaps = medians.every((m) => m.maps >= 15);
  const worldValidation = validateWorldContent(WORLD_CONTENT_V1);
  const mapCoverage = [...new Set(results.flatMap((result) => result.mapsVisited))];
  const clearedCoverage = [...new Set(results.flatMap((result) => result.mapsCleared))];

  const report = `# 《一纸江湖》Combat & World v1 100h 验收报告

> 生成时间：${new Date().toISOString()}  
> 规模：3 starter kits × ${seeds.length} seeds × ${hours}h 连续模拟  
> 规则 seam：\`resolveBattle(BattleInput): BattleResult\`  
> 说明：100h 连续模拟是上限/回归测试，不是玩家日历；玩家日历由 #6 用 active + offline 另算。

## 0. 结论

- **三套 starter kit 全部到达宗师（realm 5）：${allReached ? "是" : "否"}。**
- **中位等级：${medians.map((m) => `${m.name} ${m.level}`).join(" / ")}；等级差 ${(levelSpread * 100).toFixed(1)}%。**
- **宗师中位到达时间：${medians.map((m) => `${m.name} ${m.realm5 === null ? "—" : `${m.realm5.toFixed(1)}h`}`).join(" / ")}；最早/最晚差 ${realmGap.toFixed(1)}h。**
- **15 张地图全部被三套 build 走到：${allMaps ? "是" : "否"}；实际访问 ${mapCoverage.length}/15，首通 ${clearedCoverage.length}/15。**
- **World 内容校验：${worldValidation.ok ? "通过" : `失败：${worldValidation.errors.join("；")}`}。**
- v0.6 的旧数值不再是不变验收合同；本报告是 Combat v1 + World v1 的新基线。

## 1. 终局

${table(
    ["Build", "中位等级", "中位境界", "宗师中位", "清图", "访问", "目标掉落", "首通", "场次", "胜率", "平均回合", "限时败"],
    medians.map((m) => [
      m.name,
      m.level,
      `${m.realm} · ${REALM_NAMES[Math.floor(m.realm)] ?? "—"}`,
      m.realm5 === null ? "—" : `${m.realm5.toFixed(1)}h`,
      `${m.maps}/15`,
      Math.round(m.visited),
      Math.round(m.targets),
      Math.round(m.firstClears),
      Math.round(m.fights),
      `${(m.winRate * 100).toFixed(1)}%`,
      m.rounds.toFixed(1),
      Math.round(m.timeouts),
    ]),
  )}

## 2. 逐 seed 原始结果

${table(
    ["Build", "Seed", "等级", "境界", "宗师(h)", "清图", "访问", "目标", "首通", "场次", "胜率", "平均回合"],
    results.map((result) => [
      result.buildName,
      result.seed,
      result.final.level,
      result.final.realm,
      result.realmTimes["5"]?.toFixed(1) ?? "—",
      `${result.mapsCleared.length}/15`,
      `${result.mapsVisited.length}/15`,
      result.targetDrops.length,
      result.firstClears,
      result.totalFights,
      `${(result.final.winRate * 100).toFixed(1)}%`,
      result.avgRounds.toFixed(1),
    ]),
  )}

## 3. World v1 内容与覆盖

${table(
    ["项目", "数量"],
    [
      ["地区", `${WORLD_CONTENT_V1.regions.length} / 5`],
      ["地图", `${WORLD_CONTENT_V1.maps.length} / 15`],
      ["层", `${WORLD_CONTENT_V1.maps.length * 10} / 150`],
      ["普通怪", `${Object.keys(WORLD_CONTENT_V1.normals).length} / 30`],
      ["精英", `${Object.keys(WORLD_CONTENT_V1.elites).length} / 10`],
      ["首领（地图/章节/终局）", `${Object.values(WORLD_CONTENT_V1.bosses).filter((boss) => boss.kind === "map").length} / ${Object.values(WORLD_CONTENT_V1.bosses).filter((boss) => boss.kind === "chapter").length} / ${Object.values(WORLD_CONTENT_V1.bosses).filter((boss) => boss.kind === "final").length}`],
      ["精英词缀", `${Object.keys(WORLD_CONTENT_V1.eliteAffixes).length} / 10`],
      ["目标掉落", `${Object.keys(WORLD_CONTENT_V1.targetDrops).length}`],
      ["内容校验", worldValidation.ok ? "通过" : "失败"],
    ],
  )}

## 4. 验收口径

- 三套 starter kit 至少各赢一场代表遭遇；没有一套预设赢下全部代表遭遇（见 \`tests/combat-v1.test.ts\` 的 battle matrix）。
- 相同 seed/input 的战斗事件、行动序列、伤害分解完全一致；不同 seed 只改变随机判定，不改变优先级选招。
- 每个 slot/type/status/资源/回合上限边界都有测试；测试只读 \`BattleResult\` / \`selectPriorityAction\` / \`validateLoadout\`，不读战斗内部对象。
- 生产构建通过；战斗 UI 尚未在本 issue 引入（按 spec 的第一里程碑，先完成 headless seam）。

## 5. 模型边界

- 本报告使用 3 starter kits 的固定 loadout；跨套混搭、掉落与洗点由 #4/#5 接入。
- 遭遇由 #3 的 \`generateEncounter\` 生成，战斗仍只走 \`resolveBattle\`；多敌人遭遇被组合为一个敌阵输入，不引入第二个战斗引擎。
- 目标掉落与首通走 \`WorldProgressV1\`；离线/背包/停止条件由 #1/#6 接入 session。
- 奖励曲线是 Combat v1 的第一版基线，不是最终经济；#6 会重算 active/offline 日历。
- 模拟关闭了 \`captureEvents\`，但不绕过 \`resolveBattle\`；胜负、回合与资源仍由同一 seam 产生。
`;

  const out = resolve(outDir);
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/combat-v1-100h.md`, report);
  writeFileSync(`${out}/combat-v1-100h.json`, JSON.stringify({ hours, seeds, medians, results }, null, 2));
  writeFileSync(`${out}/combat-v1-100h.csv`, csv(results));
  console.log(`\nWrote ${out}/combat-v1-100h.md`);
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeCombatV1Report();
}
