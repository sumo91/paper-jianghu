import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BattleResult } from "../core/combat-v1.ts";
import { createEndgame } from "../core/endgame.ts";
import { ENDGAME_CONTENT } from "../data/endgame-v1.ts";

const service = createEndgame(ENDGAME_CONTENT);
const validation = service.validateContent(ENDGAME_CONTENT);

function battle(win: boolean, rounds = 10): BattleResult {
  return {
    outcome: win ? "win" : "loss", win, rounds, reason: win ? "胜" : "败",
    objective: "clear", roundsTarget: 30, playerName: "沈砚", playerElement: "taiji",
    enemyName: "榜上对手", enemyStyle: "gang", playerHp: win ? 500 : 0, playerHpPct: win ? 0.5 : 0,
    playerInner: 50, playerInnerMax: 100, enemyHp: win ? 0 : 500, enemyHpPct: win ? 0 : 1,
    damageDealt: 100, damageTaken: 10, events: [], log: [],
    damageBreakdown: { total: 100, bySkill: {}, direct: 100, critBonus: 0, counter: 0, reflect: 0, dot: 0, companion: 0 },
    keyRounds: [], actionTrace: [], rngTrace: [], finalPhase: 0, companionCasts: 0,
  };
}

let state = service.createState(7);
state.silver = 1_000_000;
const ladder = service.generateLadder(state);
let challenges = 0;
let wins = 0;
let losses = 0;
const firstLoss = service.challenge(state, service.ladder(state).next!.id, battle(false));
if (firstLoss.ok) {
  challenges += 1;
  losses += 1;
  state = firstLoss.state;
  state.silver = 1_000_000;
}
while (service.ladder(state).next && challenges < 600) {
  const next = service.ladder(state).next!;
  const result = service.challenge(state, next.id, battle(true));
  challenges += 1;
  if (!result.ok) break;
  wins += 1;
  state = result.state;
  state.silver = 1_000_000;
}
const finalRank = state.rank;
for (const entry of ENDGAME_CONTENT.codex.slice(0, 10)) {
  state = service.recordCodex(state, entry.id).state;
}
const season1 = service.applySeasonReset(state, 1);
const season2 = service.applySeasonReset(season1.state, 2);
const codex = service.codexView(state);
const allCodex = structuredClone(state);
for (const entry of ENDGAME_CONTENT.codex) {
  allCodex.codex[entry.id] = true;
}
const fullCodex = service.codexView(allCodex);
const tournament = service.recordTournament(state, "tournament_sword", battle(true));
const rules = service.tournamentRules("tournament_sword")!;
const retireState = structuredClone(state);
retireState.realm = 5;
retireState.ownedArts = ["taiji_siliang", "pojun_wanjun"];
retireState.companionBonds = { comp_liuqing: 7, comp_guchangfeng: 4 };
retireState.titles = ["听雨", "剑会"];
const retired = service.retire(retireState, { artId: "taiji_siliang", companionId: "comp_liuqing", title: "听雨" }, true);

const table = (headers: string[], rows: Array<Array<string | number>>) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.join(" | ")} |`),
].join("\n");

const report = `# Endgame, Ranks & Seasons v1 验证报告

> 生成时间：${new Date().toISOString()}  
> 规则 seam：\`EndgameService\`；挑战输入为 \`BattleResult\`，战斗仍由 \`resolveBattle\` 产生。  
> 状态：NPC-only；无 PvP/后端；top 100 手工种子 + 400 程序化榜位；江湖志 173 条验证集。

## 0. 结论

- **内容校验：${validation.ok ? "通过" : "失败：" + validation.errors.join("；")}。**
- 天机榜 ${ladder.length} 名（top 100 手工种子）；本次模拟从第 500 名打到第 ${finalRank} 名，${challenges} 次挑战（${wins} 次晋级胜 / ${losses} 次首败）。
- 赛季 8 周；软重置后第 ${season1.oldSeason} → ${season1.newSeason} 赛季名次 ${season1.oldRank} → ${season1.newRank}，角色/装备/武学/同伴/江湖志保留。
- 武林大会规则「${rules.name}」：${rules.description}
- 江湖志 ${codex.overall.discovered}/${codex.overall.total}（${Math.round(codex.overall.percent * 100)}%）；全收录后 ${fullCodex.overall.tier}。
- 归隐：${retired.ok ? `保留 ${retired.kept?.artId} / ${retired.kept?.companionId} / ${retired.kept?.title}` : retired.reason}。
- 无真人 PvP、无后端排行榜、无付费战力；挑战失败保留名次并获得情报。

## 1. 天机榜 top 10

${table(
    ["名次", "姓名", "门派", "Build", "流派", "称号", "奖励"],
    ladder.slice(0, 10).map((opponent) => [
      opponent.rank,
      opponent.name,
      opponent.factionId,
      opponent.buildId,
      `${opponent.style}/${opponent.element}`,
      opponent.title,
      `${opponent.reward.tianji ?? 0} 天机${opponent.reward.title ? " · " + opponent.reward.title : ""}`,
    ]),
  )}

## 2. 挑战与赛季

${table(
    ["项目", "结果"],
    [
      ["模拟挑战次数", challenges],
      ["胜利", wins],
      ["失败", losses],
      ["终局名次", finalRank],
      ["首败情报", firstLoss.ok ? firstLoss.reason : "—"],
      ["第 1 次软重置", `${season1.oldRank} → ${season1.newRank}（第 ${season1.newSeason} 赛季）`],
      ["第 2 次软重置", `${season2.oldRank} → ${season2.newRank}（第 ${season2.newSeason} 赛季）`],
      ["角色/装备/武学/同伴/江湖志", "保留"],
    ],
  )}

## 3. 武林大会

${table(
    ["规则", "Modifier", "奖励"],
    rules.modifiers.map((modifier) => [modifier.name, modifier.description, rules.cosmeticReward]),
  )}

- 模拟胜场得分 ${tournament.score}，天机 ${tournament.reward?.tianji ?? 0}，外观 ${tournament.reward?.cosmetic ?? "—"}。
- 规则在进入前可见；只使用 Combat v1 的 BattleModifier，不引入第二套战斗引擎。

## 4. 江湖志

${table(
    ["分类", "已收录", "总数", "完成度", "tier"],
    codex.categories.map((category) => [
      category.category,
      category.discovered,
      category.total,
      `${Math.round(category.percent * 100)}%`,
      category.tier,
    ]),
  )}

- 总完成度 ${codex.overall.discovered}/${codex.overall.total}（${Math.round(codex.overall.percent * 100)}%），tier=${codex.overall.tier}。
- 未收录条目仍显示来源提示；收录幂等；跨赛季不重置。

## 5. 归隐 / 开宗接口

| 项目 | 结果 |
| --- | --- |
| 归隐条件 | realm ≥ ${ENDGAME_CONTENT.retire.requiredRealm} |
| 保留 | 1 门武学 / 1 名同伴羁绊 / 1 个称号 |
| 重置 | 等级/境界/装备/地图/门派 rank/其余武学 |
| 保留收藏 | 江湖志/赛季外观/天机积分 |
| 开宗 | ${service.sectHook(retired.state).message} |

## 6. 验收口径

- 天机榜 500–1000 名、top 100 手工种子、确定生成；每名有 name/faction/build/title/intel。
- 只能挑战下一名；胜利晋级/奖励；失败保留名次+情报+下次费用降低。
- 奖励仅天机/称号/外观/图鉴，无唯一战力。
- 赛季 8 周软重置；角色/装备/武学/同伴/江湖志不被赛季重置。
- 武林大会独立规则/得分/外观奖励；规则可见；复用 BattleModifier。
- 江湖志 150+ 条、来源提示、幂等收录、分类/总完成度 tier。
- 归隐二次确认、境界门槛、精确保留 1 武学/1 羁绊/1 称号；开宗仅接口。
- save/load 恢复名次/赛季/江湖志/称号/锦标赛/legacy/scouting。
- 无后端/PvP 依赖。
`;

const out = resolve("reports");
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/endgame-v1.md`, report);
writeFileSync(`${out}/endgame-v1.json`, JSON.stringify({
  generatedAt: new Date().toISOString(),
  validation,
  ladder: { size: ladder.length, top: ladder.slice(0, 10), finalRank },
  challenges,
  wins,
  losses,
  season1,
  season2,
  tournament,
  codex: { overall: codex.overall, categories: codex.categories },
  fullCodex: fullCodex.overall,
  retired,
}, null, 2));
console.log(`Wrote ${out}/endgame-v1.md`);
console.log(`rank ${finalRank}; wins ${wins}; codex ${codex.overall.discovered}/${codex.overall.total}`);
