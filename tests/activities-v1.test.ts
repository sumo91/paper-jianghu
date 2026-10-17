import assert from "node:assert/strict";
import test from "node:test";
import type { BattleResult, CombatMods } from "../src/core/combat-v1.ts";
import { createActivityService, type ActivityContentV1 } from "../src/core/activities.ts";
import { ACTIVITY_CONTENT } from "../src/data/activities-v1.ts";
import { WORLD_CONTENT_V1 } from "../src/data/world-v1.ts";
import { createFactionEvent } from "../src/core/factions-events.ts";
import { FACTION_EVENT_CONTENT } from "../src/data/factions-events-v1.ts";

const service = createActivityService(ACTIVITY_CONTENT);

function battle(win: boolean, playerHpPct = 0.8, innerPct = 0.5): BattleResult {
  return {
    outcome: win ? "win" : "loss",
    win,
    rounds: 8,
    reason: win ? "胜" : "败",
    objective: "clear",
    roundsTarget: 30,
    playerName: "沈砚",
    playerElement: "taiji",
    enemyName: "试招",
    enemyStyle: "gang",
    playerHp: Math.round(1000 * playerHpPct),
    playerHpPct,
    playerInner: Math.round(100 * innerPct),
    playerInnerMax: 100,
    enemyHp: win ? 0 : 100,
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

test("content validates five waves, three legs, all map tags and no new combat stat", () => {
  const result = service.validateContent(ACTIVITY_CONTENT);
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(ACTIVITY_CONTENT.waves.length, 5);
  assert.equal(ACTIVITY_CONTENT.legs.length, 3);
  for (const map of WORLD_CONTENT_V1.maps) {
    const tags = ACTIVITY_CONTENT.mapTags[map.id];
    assert.ok(tags && tags.length >= 1 && tags.length <= 2, `${map.id} tags`);
  }
  const allowed = new Set(Object.keys({} as CombatMods));
  void allowed;
  for (const effect of Object.values(ACTIVITY_CONTENT.tagEffects)) {
    for (const key of Object.keys(effect.combatMods ?? {})) {
      assert.ok([
        "hpPct", "attackPct", "defensePct", "speedPct", "innerMaxPct", "hit", "evade", "crit",
        "critDamage", "guardReduction", "breakDamage", "comboDamage", "counterDamage", "statusHit",
        "statusResist", "damageReduction", "innerRegen", "reflect", "healBonus", "lifesteal",
        "poisonDamage", "damagePct", "typeDamagePct",
      ].includes(key), `new stat ${key}`);
    }
  }
});

test("survival advances five waves, scales pressure, grants per-wave and clear rewards", () => {
  let state = service.startSurvival("luoyang", 5);
  const offsets: number[] = [];
  const rewards: number[] = [];
  for (let wave = 1; wave <= 5; wave += 1) {
    const spec = service.nextBattle(state)!;
    offsets.push(spec.levelOffset);
    assert.equal(spec.wave, wave);
    const result = service.advance(state, battle(true, 0.7, 0.4));
    state = result.state;
    rewards.push(state.rewards.silver);
  }
  assert.deepEqual(offsets, [0, 2, 4, 6, 8]);
  assert.equal(state.status, "completed");
  assert.equal(state.clearedWaves, 5);
  assert.equal(state.rewards.silver, 80 + 120 + 180 + 250 + 350 + 500);
  assert.equal(state.rewards.materials, 2 + 3 + 5 + 8 + 12 + 25);
  assert.ok(state.playerHpPct > 0.7);
  assert.equal(state.wave, 6);
  assert.deepEqual(rewards, [80, 200, 380, 630, 1480]);
  const after = service.advance(state, battle(true));
  assert.equal(after.advanced, false);
  assert.equal(after.state, state);
});

test("survival failure grants only cleared-wave rewards; stop conditions end the activity", () => {
  let state = service.startSurvival("luoyang", 2);
  state = service.advance(state, battle(true)).state;
  state = service.advance(state, battle(true)).state;
  const failed = service.advance(state, battle(false));
  assert.equal(failed.status, "failed");
  assert.equal(failed.state.rewards.silver, 80 + 120);
  assert.equal(failed.state.rewards.renown, 2 + 3);
  assert.ok(failed.state.reason.includes("失守"));

  const stopped = service.stopActivity(service.startSurvival("luoyang", 2), "手动停止");
  assert.equal(stopped.status, "stopped");
  assert.equal(service.nextBattle(stopped.state), null);

  const manual = service.advance(service.startSurvival("luoyang", 2), battle(true), { manual: true });
  assert.equal(manual.status, "stopped");
  const bag = service.advance(service.startSurvival("luoyang", 2), battle(true), { bagFull: true });
  assert.equal(bag.status, "stopped");
  const timed = service.advance(service.startSurvival("luoyang", 2), battle(true), { elapsedHours: 4, timeLimitHours: 3 });
  assert.equal(timed.status, "stopped");
});

test("escort advances 3 legs / 5 encounters, cart HP matters, success grants escort rewards", () => {
  let state = service.startEscort("caoyun", 7);
  const specs = [] as ReturnType<typeof service.nextBattle>[];
  for (let i = 0; i < 5; i += 1) {
    const spec = service.nextBattle(state)!;
    specs.push(spec);
    assert.ok((spec?.encounter ?? 0) >= 1 && (spec?.encounter ?? 0) <= 2);
    const result = service.advance(state, battle(true, 0.8, 0.4));
    state = result.state;
  }
  assert.equal(state.status, "completed");
  assert.equal(state.clearedLegs, 3);
  assert.equal(state.rewards.silver, 100 + 180 + 300 + 450);
  assert.equal(specs.map((spec) => `${spec?.leg}.${spec?.encounter}`).join(","), "1.1,2.1,2.2,3.1,3.2");
  assert.equal(specs[4]?.finalBoss, true);
  assert.ok(state.cartHp > 0);

  const lowCart = service.startEscort("caoyun", 7);
  lowCart.cartHp = 5;
  const destroyed = service.advance(lowCart, battle(true, 0.1));
  assert.equal(destroyed.status, "failed");
  assert.equal(destroyed.state.rewards.silver, 0);
});

test("ambush/enemy generation is deterministic and every leg has a next battle", () => {
  const a = service.startEscort("caoyun", 9);
  const b = service.startEscort("caoyun", 9);
  assert.deepEqual(service.nextBattle(a), service.nextBattle(b));
  let state = a;
  for (let i = 0; i < 5; i += 1) {
    const spec = service.nextBattle(state);
    assert.ok(spec);
    state = service.advance(state, battle(true, 0.9)).state;
  }
  assert.equal(service.nextBattle(state), null);
});

test("feng shui applies cultivation/offline/element modifiers and no new combat stat", () => {
  const cave = service.fengShui("mudao");
  assert.deepEqual(cave.tags, ["cave"]);
  assert.ok(cave.cultivationPct > 0);
  assert.ok(cave.offlinePct > 0);
  assert.ok(cave.healingPct < 0);
  assert.ok((cave.elementAffinity.yin ?? 0) > 0);
  const market = service.fengShui("caoyun");
  assert.ok(market.silverPct > 0);
  assert.ok(ACTIVITY_CONTENT.tagEffects.market.cultivationPct < 0);
  const mountain = service.fengShui("jinding");
  assert.ok(mountain.tags.includes("snow"));
  assert.ok((mountain.elementAffinity.yang ?? 0) > 0);
  for (const modifier of [cave, market, mountain]) {
    for (const key of Object.keys(modifier.combatMods)) {
      assert.ok(!["newStat", "hidden", "power"].includes(key));
    }
  }
});

test("offline events are 0-3 by elapsed time, use the faction engine, and persist defer/resolve", () => {
  assert.equal(service.offlineEventCount(0.5), 0);
  assert.equal(service.offlineEventCount(2), 1);
  assert.equal(service.offlineEventCount(12), 2);
  assert.equal(service.offlineEventCount(48), 3);
  const faction = createFactionEvent(FACTION_EVENT_CONTENT);
  let factionState = faction.createState(3);
  const queued = service.queueOfflineEvents(faction, factionState, 48, 5);
  assert.equal(queued.count, 3);
  factionState = queued.state;
  assert.equal(factionState.pendingEvents.length, 3);
  const pending = faction.pendingOfflineEvents(factionState);
  assert.ok(pending.length > 0);
  const deferred = faction.deferPending(factionState, pending[0].id);
  assert.equal(deferred.state.pendingEvents.length, 2);
  assert.ok(deferred.state.deferredEvents.includes(pending[0].id));
  const target = faction.pendingOfflineEvents(deferred.state)[0];
  const resolved = faction.applyChoice(deferred.state, target.id, target.choices[0].id);
  assert.equal(resolved.ok, true);
  const reloaded = faction.load(faction.save(resolved.state));
  assert.deepEqual(reloaded, resolved.state);
  assert.equal(faction.applyChoice(reloaded, target.id, target.choices[0].id).ok, false);
});

test("save/load restores survival and escort progress", () => {
  let survival = service.startSurvival("luoyang", 3);
  survival = service.advance(survival, battle(true)).state;
  const survivalRestored = service.load(service.save(survival));
  assert.deepEqual(survivalRestored, survival);

  let escort = service.startEscort("caoyun", 4);
  escort = service.advance(escort, battle(true)).state;
  const escortRestored = service.load(service.save(escort));
  assert.deepEqual(escortRestored, escort);
});

test("survival and escort have distinct reward mixes; neither dominates all resources", () => {
  const survival = ACTIVITY_CONTENT.waves.reduce(
    (sum, wave) => ({ silver: sum.silver + wave.reward.silver, materials: sum.materials + wave.reward.materials, renown: sum.renown + wave.reward.renown }),
    ACTIVITY_CONTENT.survivalClearBonus,
  );
  const escort = ACTIVITY_CONTENT.legs.reduce(
    (sum, leg) => ({ silver: sum.silver + leg.reward.silver, materials: sum.materials + leg.reward.materials, renown: sum.renown + leg.reward.renown }),
    ACTIVITY_CONTENT.escortClearBonus,
  );
  assert.ok(survival.silver > escort.silver);
  assert.ok(escort.materials > survival.materials);
  assert.ok(survival.renown > escort.renown);
});

test("content validation fails on missing map tags, empty waves/legs and illegal feng shui stat", () => {
  const noTags = structuredClone(ACTIVITY_CONTENT) as ActivityContentV1;
  delete noTags.mapTags.luoyang;
  assert.equal(service.validateContent(noTags).ok, false);

  const emptyWaves = structuredClone(ACTIVITY_CONTENT) as ActivityContentV1;
  emptyWaves.waves = [];
  assert.equal(service.validateContent(emptyWaves).ok, false);

  const emptyLegs = structuredClone(ACTIVITY_CONTENT) as ActivityContentV1;
  emptyLegs.legs = [];
  assert.equal(service.validateContent(emptyLegs).ok, false);

  const illegal = structuredClone(ACTIVITY_CONTENT) as ActivityContentV1;
  illegal.tagEffects.mountain.combatMods = { hiddenPower: 1 } as unknown as CombatMods;
  assert.equal(service.validateContent(illegal).ok, false);
});
