import assert from "node:assert/strict";
import test from "node:test";
import type { BattleResult } from "../src/core/combat-v1.ts";
import { createEndgame, type EndgameContentV1 } from "../src/core/endgame.ts";
import { ENDGAME_CONTENT } from "../src/data/endgame-v1.ts";

const service = createEndgame(ENDGAME_CONTENT);

function battle(win: boolean, rounds = 10): BattleResult {
  return {
    outcome: win ? "win" : "loss",
    win,
    rounds,
    reason: win ? "胜" : "败",
    objective: "clear",
    roundsTarget: 30,
    playerName: "沈砚",
    playerElement: "taiji",
    enemyName: "榜上对手",
    enemyStyle: "gang",
    playerHp: win ? 500 : 0,
    playerHpPct: win ? 0.5 : 0,
    playerInner: 50,
    playerInnerMax: 100,
    enemyHp: win ? 0 : 500,
    enemyHpPct: win ? 0 : 1,
    damageDealt: 100,
    damageTaken: 10,
    events: [],
    log: [],
    damageBreakdown: { total: 100, bySkill: {}, direct: 100, critBonus: 0, counter: 0, reflect: 0, dot: 0, companion: 0 },
    keyRounds: [],
    actionTrace: [],
    rngTrace: [],
    finalPhase: 0,
    companionCasts: 0,
  };
}

test("ladder generation is deterministic, 500 entries, unique ranks/names and valid builds", () => {
  const state = service.createState(7);
  const a = service.generateLadder(state);
  const b = service.generateLadder(service.createState(7));
  assert.deepEqual(a, b);
  assert.equal(a.length, 500);
  assert.equal(new Set(a.map((opponent) => opponent.rank)).size, 500);
  assert.equal(new Set(a.map((opponent) => opponent.name)).size, 500);
  assert.equal(a[0].rank, 1);
  assert.equal(a[499].rank, 500);
  for (const opponent of a) {
    assert.ok(["taiji", "pojun", "xuanyin"].includes(opponent.buildId));
    assert.ok(["gang", "rou", "kuai", "gui"].includes(opponent.style));
    assert.ok(opponent.intel.length > 0);
  }
  assert.equal(ENDGAME_CONTENT.topOpponents.length, 100);
});

test("only the next rank can be challenged; win takes rank/reward; loss keeps rank and gives intel", () => {
  let state = service.createState(7);
  const next = service.ladder(state).next!;
  assert.equal(next.rank, 499);
  const wrong = service.challenge(state, "ladder_1", battle(true));
  assert.equal(wrong.ok, false);
  assert.match(wrong.reason, /下一名/);

  const win = service.challenge(state, next.id, battle(true));
  assert.equal(win.ok, true);
  assert.equal(win.win, true);
  assert.equal(win.state.rank, 499);
  assert.equal(win.state.defeated.length, 1);
  assert.equal(win.state.silver, 950);
  assert.ok((win.reward?.tianji ?? 0) > 0);
  assert.ok(win.state.titles.length > 0 || win.state.seasonRewards.length > 0 || win.reward?.cosmetic === undefined);

  state = service.createState(7);
  const lossOpponent = service.ladder(state).next!;
  const loss = service.challenge(state, lossOpponent.id, battle(false));
  assert.equal(loss.ok, true);
  assert.equal(loss.win, false);
  assert.equal(loss.state.rank, 500);
  assert.equal(loss.state.scouting[lossOpponent.id], true);
  assert.equal(loss.state.challengeDiscount, 10);
  assert.equal(loss.state.silver, 950);

  const poor = { ...state, silver: 0 };
  const noMoney = service.challenge(poor, lossOpponent.id, battle(true));
  assert.equal(noMoney.ok, false);
  assert.match(noMoney.reason, /银两不足/);
});

test("scouting reveals intel only for the next opponent; ladder rewards are cosmetic/currency-only", () => {
  const state = service.createState(7);
  const next = service.ladder(state).next!;
  const scouted = service.scout(state, next.id);
  assert.equal(scouted.reason, "已获得情报");
  assert.equal(scouted.state.scouting[next.id], true);
  assert.ok(scouted.intel.includes("taiji") || scouted.intel.includes("pojun") || scouted.intel.includes("xuanyin"));
  assert.equal(service.scout(state, "ladder_1").reason, "只能侦查下一名");
  for (const opponent of service.generateLadder(state).slice(0, 100)) {
    assert.ok(opponent.reward.tianji !== undefined || opponent.reward.title !== undefined || opponent.reward.cosmetic !== undefined);
    assert.equal("artId" in opponent.reward, false);
    assert.equal("itemId" in opponent.reward, false);
  }
});

test("season state is deterministic and 8 weeks; soft reset drops rank and preserves character/codex", () => {
  const epoch = ENDGAME_CONTENT.season.epochMs;
  assert.equal(service.seasonAt(epoch), 0);
  assert.equal(service.seasonAt(epoch + 8 * 7 * 24 * 60 * 60 * 1000), 1);
  const state = service.createState(7);
  state.rank = 300;
  state.seasonIndex = 0;
  state.titles = ["旧称号"];
  state.codex.codex_region_zhongyuan = true;
  state.realm = 5;
  state.ownedArts = ["taiji_lanque"];
  state.companionBonds = { comp_liuqing: 7 };
  state.seasonRewards = ["旧题跋"];
  state.defeated = ["ladder_499"];
  const view = service.seasonState(state, epoch);
  assert.equal(view.weeks, 8);
  assert.equal(view.week, 1);
  const reset = service.applySeasonReset(state, 1);
  assert.equal(reset.oldRank, 300);
  assert.equal(reset.newRank, 400);
  assert.equal(reset.newSeason, 1);
  assert.equal(reset.state.titles.includes("旧称号"), true);
  assert.equal(reset.state.codex.codex_region_zhongyuan, true);
  assert.equal(reset.state.realm, 5);
  assert.equal(reset.state.ownedArts[0], "taiji_lanque");
  assert.equal(reset.state.companionBonds.comp_liuqing, 7);
  assert.equal(reset.state.seasonRewards.includes("旧题跋"), true);
  assert.equal(reset.state.defeated.length, 0);
});

test("武林大会 rulesets are visible, data-driven and cosmetic-only", () => {
  const rules = service.tournamentRules("tournament_sword");
  assert.ok(rules);
  assert.ok(rules!.modifiers.length >= 2);
  assert.ok(rules!.description.length > 0);
  assert.ok(rules!.modifiers.every((modifier) => modifier.description.length > 0));
  const state = service.createState(7);
  const win = service.recordTournament(state, "tournament_sword", battle(true));
  assert.equal(win.ok, true);
  assert.ok(win.score > 0);
  assert.ok((win.reward?.tianji ?? 0) > 0);
  assert.ok(win.reward?.cosmetic);
  const loss = service.recordTournament(win.state, "tournament_inner", battle(false));
  assert.equal(loss.ok, true);
  assert.equal(loss.reward?.cosmetic, undefined);
  assert.ok((loss.reward?.tianji ?? 0) > 0);
  assert.equal(service.tournamentRules("missing"), null);
});

test("codex discovery is idempotent, locked entries keep source hints, and tiers calculate", () => {
  const state = service.createState(7);
  const view = service.codexView(state);
  assert.ok(view.entries.length >= 150);
  assert.ok(view.entries.every((entry) => entry.sourceHint.length > 0));
  const entry = view.entries.find((candidate) => candidate.category === "region")!;
  const first = service.recordCodex(state, entry.id);
  assert.equal(first.ok, true);
  assert.equal(first.alreadyDiscovered, false);
  const second = service.recordCodex(first.state, entry.id);
  assert.equal(second.ok, true);
  assert.equal(second.alreadyDiscovered, true);
  const after = service.codexView(first.state);
  assert.equal(after.overall.discovered, 1);
  assert.equal(after.overall.tier, "bronze");
  assert.ok(after.categories.some((category) => category.category === "region" && category.percent > 0));
  assert.equal(service.recordCodex(state, "missing").ok, false);
});

test("归隐 requires confirmation, realm and exact legacy ownership; keeps exactly art/companion/title", () => {
  let state = service.createState(7);
  state.realm = 5;
  state.ownedArts = ["taiji_siliang", "pojun_wanjun", "xuanyin_wangu"];
  state.companionBonds = { comp_liuqing: 7, comp_guchangfeng: 4 };
  state.titles = ["听雨", "剑会"];
  state.codex.codex_region_zhongyuan = true;
  state.seasonRewards = ["题跋·剑会"];
  const legacy = { artId: "taiji_siliang", companionId: "comp_liuqing", title: "听雨" };

  const unconfirmed = service.retire(state, legacy, false);
  assert.equal(unconfirmed.ok, false);
  assert.match(unconfirmed.reason, /二次确认/);

  const lowRealm = service.retire({ ...state, realm: 4 }, legacy, true);
  assert.equal(lowRealm.ok, false);

  const wrong = service.retire(state, { ...legacy, artId: "missing" }, true);
  assert.equal(wrong.ok, false);

  const retired = service.retire(state, legacy, true);
  assert.equal(retired.ok, true);
  assert.equal(retired.state.retired, true);
  assert.equal(retired.state.realm, 1);
  assert.equal(retired.state.rank, 500);
  assert.deepEqual(retired.state.ownedArts, ["taiji_siliang"]);
  assert.deepEqual(retired.state.companionBonds, { comp_liuqing: 7 });
  assert.deepEqual(retired.state.titles, ["听雨"]);
  assert.equal(retired.state.codex.codex_region_zhongyuan, true);
  assert.equal(retired.state.seasonRewards.includes("题跋·剑会"), true);
  assert.equal(service.sectHook(retired.state).unlocked, true);
  assert.equal(service.sectHook(state).unlocked, false);
});

test("save/load restores rank, season, codex, titles, tournaments, legacy and scouting", () => {
  let state = service.createState(7);
  const next = service.ladder(state).next!;
  state = service.scout(state, next.id).state;
  state = service.challenge(state, next.id, battle(true)).state;
  state = service.recordCodex(state, "codex_region_zhongyuan").state;
  state = service.recordTournament(state, "tournament_sword", battle(true)).state;
  state.realm = 5;
  state.ownedArts = ["taiji_siliang"];
  state.companionBonds = { comp_liuqing: 7 };
  state.titles.push("听雨");
  const retired = service.retire(state, { artId: "taiji_siliang", companionId: "comp_liuqing", title: "听雨" }, true).state;
  const restored = service.load(service.save(retired));
  assert.deepEqual(restored, retired);
});

test("content validation fails on invalid opponent, duplicate codex, missing hint or missing rules", () => {
  const invalidBuild = structuredClone(ENDGAME_CONTENT) as EndgameContentV1;
  invalidBuild.topOpponents[0].buildId = "missing" as never;
  assert.equal(service.validateContent(invalidBuild).ok, false);

  const duplicate = structuredClone(ENDGAME_CONTENT) as EndgameContentV1;
  duplicate.codex.push({ ...duplicate.codex[0] });
  assert.equal(service.validateContent(duplicate).ok, false);

  const noHint = structuredClone(ENDGAME_CONTENT) as EndgameContentV1;
  noHint.codex[0].sourceHint = "";
  assert.equal(service.validateContent(noHint).ok, false);

  const noRules = structuredClone(ENDGAME_CONTENT) as EndgameContentV1;
  noRules.tournaments = {};
  assert.equal(service.validateContent(noRules).ok, false);

  const smallLadder = structuredClone(ENDGAME_CONTENT) as EndgameContentV1;
  smallLadder.ladderSize = 400;
  assert.equal(service.validateContent(smallLadder).ok, false);
});

test("the ladder requires no backend/PvP: challenge is a pure state transition over a BattleResult", () => {
  const state = service.createState(7);
  const next = service.ladder(state).next!;
  const result = service.challenge(state, next.id, battle(true));
  assert.equal(result.ok, true);
  assert.equal(result.state.rank, 499);
  assert.equal("backend" in result, false);
  assert.equal("socket" in result, false);
});
