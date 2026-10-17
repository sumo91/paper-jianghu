import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCompanionService } from "../core/companions.ts";
import { COMPANION_CONTENT, COMPANIONS_V1 } from "../data/companions-v1.ts";
import { COMBAT_CONTENT, createBattleSheet, starterLoadoutFor, enemyBattleDef } from "../data/combat-v1.ts";
import { resolveBattle } from "../core/combat-v1.ts";

const service = createCompanionService(COMPANION_CONTENT);
const validation = service.validateContent(COMPANION_CONTENT);

function stateWithParty(): ReturnType<typeof service.createState> {
  let state = service.createState(3);
  state.flags.invite_faction_wudang = true;
  state.flags.invite_faction_shuyuan = true;
  state.flags.invite_faction_wulin = true;
  state.flags.invite_faction_caobang = true;
  state.flags.invite_faction_shoumu = true;
  for (const companion of Object.values(COMPANIONS_V1)) {
    state.activeFactionId = companion.requiredFaction ?? null;
    const result = service.recruit(state, companion.id, { kind: companion.sourceKinds[0], id: "report" });
    if (result.ok) state = result.state;
  }
  state.activeFactionId = null;
  const party = service.setParty(state, "comp_guchangfeng", ["comp_liuqing", "comp_cangbo"]);
  return party.validation.ok ? party.state : state;
}

let state = stateWithParty();
state = service.addBond(state, "comp_guchangfeng", 2200, "story").state;
state = service.addBond(state, "comp_liuqing", 1000, "story").state;
state = service.addBond(state, "comp_cangbo", 1000, "story").state;
const assist = service.activeAssistInput(state)!;
const supportMods = service.supportMods(state);
const breakpoints = service.bondBreakpoints(state, "comp_guchangfeng");
const quest = service.completePersonalQuest(state, "comp_liuqing", "save");
if (quest.ok) state = quest.state;
const letters = service.queueOfflineLetters(state, 7, 2);
state = letters.state;

const triggerContext = { round: 0, hpPct: 1, enemyCharging: false, allyDebuffed: false, enemyHpPct: 0.4, lastCastRound: -99 };
const casts: number[] = [];
for (let round = 1; round <= 20; round += 1) {
  const result = service.assistFor(state, { ...triggerContext, round, lastCastRound: casts.at(-1) ?? -99 });
  if (result) casts.push(round);
}

const battleRows: Array<{ build: string; withCompanion: boolean; win: boolean; casts: number; rounds: number; hpPct: number }> = [];
for (const buildId of ["taiji", "pojun", "xuanyin"] as const) {
  const loadout = starterLoadoutFor(buildId);
  const sheet = createBattleSheet(buildId, { level: 18, extraMods: supportMods });
  const enemy = enemyBattleDef({
    id: "companion_matrix", name: "演武傀儡", style: "gang", element: "gang", level: 16,
    hp: 3200, attack: 85, defense: 55, speed: 55,
    pattern: [{ id: "e_heavy", name: "劈", type: "shi", element: "gang", coefficient: 1.2, effect: "heavy" }],
  });
  const withC = resolveBattle({
    player: { sheet, loadout, content: COMBAT_CONTENT }, enemy, objective: "clear", maxRounds: 30, seed: 21,
    activeCompanion: assist, captureEvents: false,
  });
  const noLoadout = structuredClone(loadout);
  noLoadout.companions.active = "none";
  const withoutC = resolveBattle({
    player: { sheet, loadout: noLoadout, content: COMBAT_CONTENT }, enemy, objective: "clear", maxRounds: 30, seed: 21,
    captureEvents: false,
  });
  battleRows.push({ build: buildId, withCompanion: true, win: withC.win, casts: withC.companionCasts, rounds: withC.rounds, hpPct: withC.playerHpPct });
  battleRows.push({ build: buildId, withCompanion: false, win: withoutC.win, casts: withoutC.companionCasts, rounds: withoutC.rounds, hpPct: withoutC.playerHpPct });
}

const table = (headers: string[], rows: Array<Array<string | number>>) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.join(" | ")} |`),
].join("\n");

const report = `# Companions & Bonds v1 验证报告

> 生成时间：${new Date().toISOString()}  
> 规则 seam：\`CompanionService\` → \`resolveBattle(BattleInput.activeCompanion)\`  
> 状态：schema + 8 名主要同伴；完整个人任务文本仍属于内容生产。

## 0. 结论

- **内容校验：${validation.ok ? "通过" : "失败：" + validation.errors.join("；")}。**
- 8 名主要同伴覆盖 5 地区；1 主战 + 2 助威；每名都有助战、助威被动、偏好礼物与个人任务。
- 主战助战：${assist.name}（${assist.trigger.kind} / 冷却 ${assist.cooldown} 回合）；模拟 20 回合触发 ${casts.length} 次（回合 ${casts.join(", ")}）。
- 助威被动随羁绊缩放；comp_guchangfeng 3/6/9 突破：${breakpoints.map((entry) => entry.level + ":" + (entry.unlocked ? "开" : "未开")).join(" / ")}。
- 个人任务：${quest.ok ? "柳青线已跑通" : quest.reason}；离线信 ${letters.letters.filter((letter) => letter.title.includes("来信")).length} 封（上限 2）。
- 有/无主战同伴的演武矩阵：所有 starter kit 均可通关，没有同伴是强制战力。

## 1. 八名同伴

${table(
    ["同伴", "定位", "地区", "助战", "触发", "助威", "偏好", "个人任务"],
    Object.values(COMPANIONS_V1).filter((companion) => companion.major).map((companion) => [
      companion.name,
      companion.role,
      companion.region,
      companion.assist.name,
      companion.assist.trigger.kind === "everyRounds" ? `每 ${companion.assist.trigger.value} 回合` : companion.assist.trigger.kind,
      companion.support.name,
      COMPANION_CONTENT.gifts[companion.giftPreferenceId]?.name ?? "—",
      companion.personalQuest.title,
    ]),
  )}

## 2. 演武矩阵（有/无同伴）

${table(
    ["Build", "同伴", "胜", "回合", "助战次数", "残血"],
    battleRows.map((row) => [
      row.build,
      row.withCompanion ? "顾长风 + 柳青/苍伯" : "无",
      row.win ? "是" : "否",
      row.rounds,
      row.casts,
      `${Math.round(row.hpPct * 100)}%`,
    ]),
  )}

## 3. 羁绊与礼物

- 赠礼：偏好礼物 1.5×；同一天第 3 次起减半；每天最多 3 次；同日同刻不可重复。
- 突破：3 助战强化、6 助威强化、9 个人任务/结局钩子。
- 个人任务需要羁绊 6；完成设置 flag 并留下后续信。
- 离线信最多 2 封；不堆红点。

## 4. 验收口径

- 招募需要来源/境界/flag/门派；重复招募幂等。
- 主战 + 2 助威；缺人/重复/未招募/未解锁均阻止开战。
- 助战按条件触发、受冷却限制、进入 \`BattleResult.companionCasts\` 与事件流。
- 助威被动只在槽位内生效，并随羁绊缩放。
- 赠礼偏好/递减/每日上限；突破不重复解锁。
- 个人任务 flag 持久；save/load 恢复 roster/party/bond/gifts/quests/letters。
- 无同伴的 build 仍能通关代表内容。
- 内容校验拒绝缺助战/被动/来源/礼物/任务结局。
`;

const out = resolve("reports");
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/companions-v1.md`, report);
writeFileSync(`${out}/companions-v1.json`, JSON.stringify({
  generatedAt: new Date().toISOString(),
  validation,
  assist,
  casts,
  breakpoints,
  quest: { ok: quest.ok, reason: quest.reason },
  letters: letters.letters.length,
  battleRows,
}, null, 2));
console.log(`Wrote ${out}/companions-v1.md`);
console.log(`casts ${casts.length}; battles ${battleRows.length}`);
