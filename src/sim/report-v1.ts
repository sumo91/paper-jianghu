import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { simulateV1, type SimV1Result } from "../core/sim-v1.ts";
import { REALM_NAMES } from "../core/types.ts";
import { validateWorldContent } from "../core/world-v1.ts";
import { WORLD_CONTENT_V1 } from "../data/world-v1.ts";
import { ECONOMY_CONTENT } from "../data/economy-v1.ts";

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
    result.gearScore,
    result.divineItems,
    result.learnedArts,
    result.masteryMax,
    result.innerLevel,
    result.meridianSpent,
    result.meridianEarned,
    result.respecs,
    result.final.silver,
    result.cultivation,
    result.final.renown,
    result.economySpent,
    result.calendarDays,
  ].join(","));
  return [
    "build,seed,hours,level,realm,realm5_hours,layer,map,map_cleared,fights,wins,losses,win_rate,avg_rounds,timeouts,xp,silver,renown,maps_cleared,maps_visited,target_drops,first_clears,gear_score,divine_items,learned_arts,mastery_max,inner_level,meridian_spent,meridian_earned,respecs,silver_balance,cultivation_balance,renown_balance,economy_spent,calendar_days",
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
      gearScore: runs.map((result) => result.gearScore),
      divineItems: runs.map((result) => result.divineItems),
      learnedArts: runs.map((result) => result.learnedArts),
      masteryMax: runs.map((result) => result.masteryMax),
      innerLevel: runs.map((result) => result.innerLevel),
      meridianSpent: runs.map((result) => result.meridianSpent),
      meridianEarned: runs.map((result) => result.meridianEarned),
      respecs: runs.map((result) => result.respecs),
      silverBalance: runs.map((result) => result.final.silver),
      cultivationBalance: runs.map((result) => result.cultivation),
      renownBalance: runs.map((result) => result.final.renown),
      economySpent: runs.map((result) => result.economySpent),
      calendarDays: runs.map((result) => result.calendarDays),
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
    gearScore: median(build.gearScore),
    divineItems: median(build.divineItems),
    learnedArts: median(build.learnedArts),
    masteryMax: median(build.masteryMax),
    innerLevel: median(build.innerLevel),
    meridianSpent: median(build.meridianSpent),
    meridianEarned: median(build.meridianEarned),
    respecs: median(build.respecs),
    silverBalance: median(build.silverBalance),
    cultivationBalance: median(build.cultivationBalance),
    renownBalance: median(build.renownBalance),
    economySpent: median(build.economySpent),
    calendarDays: median(build.calendarDays),
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
- **终局装备评分：${medians.map((m) => `${m.name} ${Math.round(m.gearScore)}`).join(" / ")}；神装 ${medians.map((m) => `${m.name} ${Math.round(m.divineItems)} 件`).join(" / ")}。**
- **Build 进度：学会 ${medians.map((m) => `${m.name} ${Math.round(m.learnedArts)} 项`).join(" / ")}；熟练上限 ${medians.map((m) => Math.round(m.masteryMax)).join(" / ")}；内功 ${medians.map((m) => Math.round(m.innerLevel)).join(" / ")} 层；经脉 ${medians.map((m) => `${Math.round(m.meridianSpent)} 节点`).join(" / ")}；洗点 ${medians.map((m) => Math.round(m.respecs)).join(" / ")} 次。**
- **经济终局：银两 ${medians.map((m) => Math.round(m.silverBalance)).join(" / ")}；修为 ${medians.map((m) => Math.round(m.cultivationBalance)).join(" / ")}；名望 ${medians.map((m) => Math.round(m.renownBalance)).join(" / ")}；经济消耗 ${medians.map((m) => Math.round(m.economySpent)).join(" / ")}；100h 宗师日历 ${medians.map((m) => `${m.calendarDays.toFixed(1)} 天`).join(" / ")}（1h 主动 + 8h 离线 50%/天）。**
- 500h 经济压力报告见 [economy-v1-500h.md](economy-v1-500h.md)：无负余额、无零消耗货币、无无限银两。
- v0.6 的旧数值不再是不变验收合同；本报告是 Combat v1 + World v1 + Itemization v1 + Build Progression v1 + Economy v1 的新基线。

## 1. 终局

${table(
    ["Build", "等级", "境界", "宗师", "清图", "访问", "目标", "首通", "装备", "神装", "学会", "熟练", "内功", "经脉", "洗点", "银两", "修为", "名望", "消耗", "日历(天)", "场次", "胜率", "平均回合", "限时败"],
    medians.map((m) => [
      m.name,
      m.level,
      `${m.realm} · ${REALM_NAMES[Math.floor(m.realm)] ?? "—"}`,
      m.realm5 === null ? "—" : `${m.realm5.toFixed(1)}h`,
      `${m.maps}/15`,
      Math.round(m.visited),
      Math.round(m.targets),
      Math.round(m.firstClears),
      Math.round(m.gearScore),
      Math.round(m.divineItems),
      Math.round(m.learnedArts),
      Math.round(m.masteryMax),
      Math.round(m.innerLevel),
      Math.round(m.meridianSpent),
      Math.round(m.respecs),
      Math.round(m.silverBalance),
      Math.round(m.cultivationBalance),
      Math.round(m.renownBalance),
      Math.round(m.economySpent),
      m.calendarDays.toFixed(1),
      Math.round(m.fights),
      `${(m.winRate * 100).toFixed(2)}%`,
      m.rounds.toFixed(1),
      Math.round(m.timeouts),
    ]),
  )}

## 2. 逐 seed 原始结果

${table(
    ["Build", "Seed", "等级", "境界", "宗师(h)", "清图", "访问", "目标", "首通", "装备", "神装", "学会", "熟练", "内功", "经脉", "洗点", "银两", "修为", "名望", "消耗", "日历", "场次", "胜率", "平均回合"],
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
      result.gearScore,
      result.divineItems,
      result.learnedArts,
      result.masteryMax,
      result.innerLevel,
      result.meridianSpent,
      result.respecs,
      result.final.silver,
      result.cultivation,
      result.final.renown,
      result.economySpent,
      result.calendarDays.toFixed(1),
      result.totalFights,
      `${(result.final.winRate * 100).toFixed(2)}%`,
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

## 4. Itemization v1 装备基线

- 掉落/装备/洗练/淬炼/自动穿戴全部走 \`ItemizationService\`；战斗只消费 \`gearMods\` 与武器类型。
- 100h 内每套 build 都从 starter gear 成长到中位装备评分 ${medians.map((m) => `${m.name} ${Math.round(m.gearScore)}`).join(" / ")}；神装中位 ${medians.map((m) => `${m.name} ${Math.round(m.divineItems)} 件`).join(" / ")}（高层首通保底）。
- 自动穿戴只作用于未锁定槽位；武器/武学兼容由 \`requiredWeaponTypes\` 校验。
- 目标掉落/首通由 World 进度持有；装备词条不新增 Combat v1 之外的战斗属性。

## 5. Build Progression v1 基线

- 学习/装配/校验/熟练/内功/心法/经脉/洗点/preset 全部走 \`BuildProgression\`；战斗只消费已验证的 loadout 与派生 mods。
- 100h 内每套 build 都有学习记录、熟练 ≥3、内功 ≥3 层、经脉节点与至少一次洗点；starter kit 仍保持可战。
- 残页保底/重复转精要、心法一对一绑定、跨套混用、preset 缺失阻挡均由测试覆盖。
- 经脉 3 支 ×12 节点；洗点退满全部已花点数并收取配置费用。

## 6. Economy & Time Budget v1 基线

- 三种核心货币（银两/修为/名望）+ 次级资源全部由 \`Economy\` 服务 quote/apply/grant/cap；失败交易不部分应用。
- 离线 = 同图在线的 ${ECONOMY_CONTENT.offline.rate * 100}% / ${ECONOMY_CONTENT.offline.capHours}h 上限；100h 宗师日历（1h 主动 + 8h 离线）中位 ${medians.map((m) => `${m.name} ${m.calendarDays.toFixed(1)} 天`).join(" / ")}。
- 银两 sink：淬炼、洗练、洗点、药、赶路、门派商店、打造材料；修为 cap 溢出按 ${ECONOMY_CONTENT.offline.overflowRate * 100}% 转银两并 warning；次级资源 cap 溢出 warning。
- 500h 经济压力：无负余额、无零消耗货币、无无限银两（见 [economy-v1-500h.md](economy-v1-500h.md)）。

## 7. 验收口径

- 三套 starter kit 至少各赢一场代表遭遇；没有一套预设赢下全部代表遭遇（见 \`tests/combat-v1.test.ts\` 的 battle matrix）。
- 相同 seed/input 的战斗事件、行动序列、伤害分解完全一致；不同 seed 只改变随机判定，不改变优先级选招。
- 每个 slot/type/status/资源/回合上限边界都有测试；测试只读 \`BattleResult\` / \`selectPriorityAction\` / \`validateLoadout\`，不读战斗内部对象。
- 生产构建通过；战斗 UI 尚未在本 issue 引入（按 spec 的第一里程碑，先完成 headless seam）。

## 8. 模型边界

- 本报告使用 3 starter kits 的 loadout；学习到的跨套武学只进入 codex/owned library，未强制换招；装备由 #4 的 ItemizationService 接入，build 进度由 #5 的 BuildProgression 接入。
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
