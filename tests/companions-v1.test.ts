import assert from "node:assert/strict";
import test from "node:test";
import { createCompanionService, bondLevelFor, type CompanionStateV1 } from "../src/core/companions.ts";
import { COMPANION_CONTENT, COMPANIONS_V1 } from "../src/data/companions-v1.ts";
import { COMBAT_CONTENT, createBattleSheet, starterLoadoutFor, enemyBattleDef } from "../src/data/combat-v1.ts";
import { resolveBattle } from "../src/core/combat-v1.ts";

const service = createCompanionService(COMPANION_CONTENT);

function base(): CompanionStateV1 {
  const state = service.createState(3);
  state.flags.invite_faction_wudang = true;
  state.flags.invite_faction_shuyuan = true;
  state.flags.invite_faction_wulin = true;
  state.flags.invite_faction_caobang = true;
  state.flags.invite_faction_shoumu = true;
  return state;
}

function withRoster(ids: string[]): CompanionStateV1 {
  let state = base();
  for (const id of ids) {
    const def = COMPANIONS_V1[id];
    state.activeFactionId = def.requiredFaction ?? null;
    const result = service.recruit(state, id, { kind: def.sourceKinds[0], id: "test" });
    assert.equal(result.ok, true, `${id}: ${result.reason}`);
    state = result.state;
  }
  state.activeFactionId = null;
  return state;
}

test("content validates eight major companions, five regions, assists, passives, gifts and quests", () => {
  const result = service.validateContent(COMPANION_CONTENT);
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(Object.values(COMPANIONS_V1).filter((companion) => companion.major).length, 8);
  const regions = new Set(Object.values(COMPANIONS_V1).map((companion) => companion.region));
  assert.equal(regions.size, 5);
  for (const companion of Object.values(COMPANIONS_V1)) {
    assert.ok(companion.assist.name.length > 0);
    assert.ok(companion.support.mods && Object.keys(companion.support.mods).length > 0);
    assert.ok(COMPANION_CONTENT.gifts[companion.giftPreferenceId]);
    assert.ok(companion.personalQuest.outcomes.length >= 2);
  }
});

test("recruitment requires source/realm/flag/faction; duplicate recruitment is idempotent", () => {
  let state = base();
  const wrongSource = service.recruit(state, "comp_guchangfeng", { kind: "ending", id: "x" });
  assert.equal(wrongSource.ok, false);
  assert.match(wrongSource.reason, /来源不符/);

  const noFlag = structuredClone(state);
  delete noFlag.flags.invite_faction_wudang;
  const missingFlag = service.recruit(noFlag, "comp_guchangfeng", { kind: "faction", id: "x" });
  assert.equal(missingFlag.ok, false);
  assert.match(missingFlag.reason, /flag/);

  const lowRealm = service.createState(0);
  lowRealm.flags.invite_faction_wudang = true;
  const realm = service.recruit(lowRealm, "comp_guchangfeng", { kind: "faction", id: "x" });
  assert.equal(realm.ok, false);
  assert.match(realm.reason, /境界不足/);

  const valid = service.recruit(state, "comp_guchangfeng", { kind: "faction", id: "x" });
  assert.equal(valid.ok, true);
  assert.equal(valid.alreadyRecruited, false);
  assert.ok(valid.state.roster.includes("comp_guchangfeng"));
  const again = service.recruit(valid.state, "comp_guchangfeng", { kind: "faction", id: "x" });
  assert.equal(again.ok, true);
  assert.equal(again.alreadyRecruited, true);

  state = base();
  state.activeFactionId = "faction_shuyuan";
  const faction = service.recruit(state, "comp_yushi", { kind: "faction", id: "x" });
  assert.equal(faction.ok, true);
});

test("party requires one active + two supports, no duplicates, and only recruited companions", () => {
  const state = withRoster(["comp_guchangfeng", "comp_liuqing", "comp_moya"]);
  const valid = service.setParty(state, "comp_guchangfeng", ["comp_liuqing", "comp_moya"]);
  assert.equal(valid.validation.ok, true, valid.validation.errors.join("; "));

  const missing = service.setParty(state, "comp_yanshisan", ["comp_liuqing", "comp_moya"]);
  assert.equal(missing.validation.ok, false);
  assert.equal(missing.state, state);

  const duplicate = service.setParty(state, "comp_guchangfeng", ["comp_guchangfeng", "comp_moya"]);
  assert.equal(duplicate.validation.ok, false);

  const duplicateSupports = service.setParty(state, "comp_guchangfeng", ["comp_liuqing", "comp_liuqing"]);
  assert.equal(duplicateSupports.validation.ok, false);

  const missingSupport = service.setParty(state, "comp_guchangfeng", ["comp_liuqing", "comp_yanshisan"]);
  assert.equal(missingSupport.validation.ok, false);
  assert.equal(service.validateParty(state).ok, false);
});

test("gifts use preference, same-time cooldown, daily cap and diminishing returns", () => {
  let state = withRoster(["comp_liuqing"]);
  const first = service.giveGift(state, "comp_liuqing", "gift_herb");
  assert.equal(first.ok, true);
  assert.equal(first.gained, 21);
  state = first.state;
  assert.equal(service.giveGift(state, "comp_liuqing", "gift_herb").ok, false);

  state = service.addBond(state, "comp_liuqing", 0, "test").state;
  state.clock = 1;
  const second = service.giveGift(state, "comp_liuqing", "gift_herb");
  assert.equal(second.gained, 21);
  state = second.state;
  state.clock = 2;
  const third = service.giveGift(state, "comp_liuqing", "gift_herb");
  assert.equal(third.gained, 11);
  state = third.state;
  state.clock = 3;
  const fourth = service.giveGift(state, "comp_liuqing", "gift_herb");
  assert.equal(fourth.ok, false);
  assert.match(fourth.reason, /3 次/);
  state.clock = 24;
  assert.equal(service.giveGift(state, "comp_liuqing", "gift_herb").ok, true);

  const wrongGift = service.giveGift(withRoster(["comp_liuqing"]), "comp_liuqing", "gift_missing");
  assert.equal(wrongGift.ok, false);
});

test("bond levels 3/6/9 unlock the correct breakpoints without duplicating unlocks", () => {
  let state = withRoster(["comp_liuqing"]);
  assert.equal(service.bondLevel(state, "comp_liuqing"), 1);
  state = service.addBond(state, "comp_liuqing", 250, "quest").state;
  assert.equal(service.bondLevel(state, "comp_liuqing"), 3);
  let points = service.bondBreakpoints(state, "comp_liuqing");
  assert.equal(points.find((entry) => entry.level === 3)?.unlocked, true);
  assert.equal(points.find((entry) => entry.level === 6)?.unlocked, false);
  state = service.addBond(state, "comp_liuqing", 750, "quest").state;
  assert.equal(service.bondLevel(state, "comp_liuqing"), 6);
  points = service.bondBreakpoints(state, "comp_liuqing");
  assert.equal(points.find((entry) => entry.level === 6)?.unlocked, true);
  assert.equal(points.find((entry) => entry.level === 9)?.unlocked, false);
  state = service.addBond(state, "comp_liuqing", 1200, "quest").state;
  assert.equal(service.bondLevel(state, "comp_liuqing"), 9);
  assert.equal(service.bondBreakpoints(state, "comp_liuqing").find((entry) => entry.level === 9)?.unlocked, true);
  assert.equal(bondLevelFor(0), 1);
  assert.equal(bondLevelFor(2700), 10);
});

test("personal quest requires bond, applies outcome flags once, and leaves a letter", () => {
  let state = withRoster(["comp_liuqing"]);
  const gated = service.completePersonalQuest(state, "comp_liuqing", "save");
  assert.equal(gated.ok, false);
  assert.match(gated.reason, /羁绊不足/);

  state = service.addBond(state, "comp_liuqing", 1000, "quest").state;
  const done = service.completePersonalQuest(state, "comp_liuqing", "save");
  assert.equal(done.ok, true);
  assert.equal(done.state.questFlags.liu_saved, true);
  assert.ok(done.state.completedQuests.includes("quest_comp_liuqing"));
  assert.ok(done.state.letters.some((letter) => letter.title.includes("后续")));
  const repeat = service.completePersonalQuest(done.state, "comp_liuqing", "remember");
  assert.equal(repeat.ok, false);
  assert.match(repeat.reason, /已完成/);
});

test("active assist trigger/cooldown and support passives scale with bond and only apply while slotted", () => {
  let state = withRoster(["comp_guchangfeng", "comp_liuqing", "comp_moya"]);
  state = service.setParty(state, "comp_guchangfeng", ["comp_liuqing", "comp_moya"]).state;
  const low = service.activeAssistInput(state);
  assert.ok(low);
  assert.equal(low?.trigger.kind, "enemyHpBelow");
  const lowPower = low!.effect.power;
  const context = { round: 5, hpPct: 1, enemyCharging: false, allyDebuffed: false, enemyHpPct: 0.4, lastCastRound: -99 };
  const assist = service.assistFor(state, context);
  assert.equal(assist?.companionId, "comp_guchangfeng");
  assert.equal(service.assistFor(state, { ...context, lastCastRound: 4 }), null);
  assert.equal(service.assistFor(state, { ...context, enemyHpPct: 0.9 }), null);

  const supportLow = service.supportMods(state);
  assert.ok((supportLow.hpPct ?? 0) > 0);
  assert.ok((supportLow.speedPct ?? 0) > 0);
  state = service.addBond(state, "comp_guchangfeng", 2700, "quest").state;
  const high = service.activeAssistInput(state);
  assert.ok(high!.effect.power > lowPower);
  const supportMid = service.supportMods(state);
  assert.equal(supportMid.hpPct ?? 0, supportLow.hpPct ?? 0);
  state = service.addBond(state, "comp_liuqing", 2700, "quest").state;
  const supportHigh = service.supportMods(state);
  assert.ok((supportHigh.hpPct ?? 0) > (supportLow.hpPct ?? 0));

  const unslotted = service.setParty(state, "comp_liuqing", ["comp_moya", "comp_guchangfeng"]).state;
  assert.notDeepEqual(service.supportMods(unslotted), supportHigh);
});

test("active assist appears in resolveBattle, respects cooldown, and is not mandatory to clear", () => {
  let state = withRoster(["comp_guchangfeng", "comp_liuqing", "comp_moya"]);
  state = service.setParty(state, "comp_guchangfeng", ["comp_liuqing", "comp_moya"]).state;
  const assist = service.activeAssistInput(state)!;
  const enemy = enemyBattleDef({
    id: "companion_dummy", name: "木人", style: "gang", element: "gang", level: 8,
    hp: 5000, attack: 1, defense: 20, speed: 10,
    pattern: [{ id: "e", name: "轻击", type: "shi", element: "gang", coefficient: 0.5 }],
  });
  const loadout = starterLoadoutFor("taiji");
  const sheet = createBattleSheet("taiji", { level: 12, extraMods: service.supportMods(state) });
  const withCompanion = resolveBattle({
    player: { sheet, loadout, content: COMBAT_CONTENT },
    enemy,
    objective: "clear",
    maxRounds: 12,
    seed: 3,
    activeCompanion: assist,
    captureEvents: true,
  });
  assert.ok(withCompanion.companionCasts > 0);
  assert.ok(withCompanion.events.some((event) => event.category === "companion"));

  const noCompanionLoadout = structuredClone(loadout);
  noCompanionLoadout.companions.active = "none";
  const noCompanion = resolveBattle({
    player: { sheet, loadout: noCompanionLoadout, content: COMBAT_CONTENT },
    enemy: enemyBattleDef({
      id: "weak", name: "弱敌", style: "gang", element: "gang", level: 8,
      hp: 1200, attack: 1, defense: 10, speed: 10,
      pattern: [{ id: "e", name: "轻击", type: "shi", element: "gang", coefficient: 0.5 }],
    }),
    objective: "clear",
    maxRounds: 20,
    seed: 3,
    captureEvents: false,
  });
  assert.equal(noCompanion.win, true);
  assert.equal(noCompanion.companionCasts, 0);
});

test("offline letters are capped, readable, and save/load round-trips roster/party/bond/quests/flags", () => {
  let state = withRoster(["comp_liuqing", "comp_guchangfeng", "comp_moya"]);
  state = service.setParty(state, "comp_guchangfeng", ["comp_liuqing", "comp_moya"]).state;
  state = service.addBond(state, "comp_liuqing", 1000, "quest").state;
  state = service.completePersonalQuest(state, "comp_liuqing", "save").state;
  const letters = service.queueOfflineLetters(state, 7, 2);
  assert.ok(letters.letters.filter((letter) => letter.title.includes("来信")).length <= 2);
  state = letters.state;
  const letter = state.letters.find((entry) => entry.title.includes("来信"));
  assert.ok(letter);
  state = service.readLetter(state, letter!.id);
  assert.equal(state.letters.find((entry) => entry.id === letter!.id)?.read, true);

  const restored = service.load(service.save(state));
  assert.deepEqual(restored, state);
  assert.deepEqual(restored.roster, state.roster);
  assert.deepEqual(restored.party, state.party);
  assert.deepEqual(restored.bondPoints, state.bondPoints);
  assert.deepEqual(restored.questFlags, state.questFlags);
});

test("content validation fails on missing assist, passive, gift, source or region coverage", () => {
  const noAssist = structuredClone(COMPANION_CONTENT) as typeof COMPANION_CONTENT;
  delete (noAssist.companions.comp_liuqing as unknown as Record<string, unknown>).assist;
  assert.equal(service.validateContent(noAssist).ok, false);

  const noPassive = structuredClone(COMPANION_CONTENT) as typeof COMPANION_CONTENT;
  delete (noPassive.companions.comp_liuqing as unknown as Record<string, unknown>).support;
  assert.equal(service.validateContent(noPassive).ok, false);

  const noGift = structuredClone(COMPANION_CONTENT) as typeof COMPANION_CONTENT;
  noGift.companions.comp_liuqing.giftPreferenceId = "gift_missing";
  assert.equal(service.validateContent(noGift).ok, false);

  const noSource = structuredClone(COMPANION_CONTENT) as typeof COMPANION_CONTENT;
  noSource.companions.comp_liuqing.sourceKinds = [];
  assert.equal(service.validateContent(noSource).ok, false);

  const noRegion = structuredClone(COMPANION_CONTENT) as typeof COMPANION_CONTENT;
  noRegion.companions.comp_cangbo.region = "xihu";
  assert.equal(service.validateContent(noRegion).ok, false);
});
