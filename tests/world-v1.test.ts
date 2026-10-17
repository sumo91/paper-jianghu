import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceOffline,
  canEnterMap,
  createWorldProgress,
  eliteChanceFor,
  eligibleTargets,
  generateEncounter,
  groupSizeFor,
  levelForLayer,
  mapProgress,
  recordMapClear,
  recommendedRealmFor,
  rollTargetDrop,
  rollTargetsForEncounter,
  shouldStop,
  targetPityChance,
  validateWorldContent,
  type MapProgressV1,
  type WorldContentV1,
} from "../src/core/world-v1.ts";
import { WORLD_CONTENT_V1, createEncounterBattle, encounterBattleModifiers, rewardPctForEncounter } from "../src/data/world-v1.ts";
import { COMBAT_CONTENT, createBattleSheet, starterLoadoutFor } from "../src/data/combat-v1.ts";
import { resolveBattle } from "../src/core/combat-v1.ts";
import { Rng } from "../src/core/rng.ts";
import type { BuildId } from "../src/core/types.ts";
import { enemiesForMap, mapsForRegion, modifiersForMap, targetDropsForMap } from "../src/ui/worldUi.ts";

function content(): WorldContentV1 {
  return structuredClone(WORLD_CONTENT_V1) as WorldContentV1;
}

test("world content validates all 15 maps; missing boss, target, previous map, modifier or phase fails", () => {
  const valid = content();
  const result = validateWorldContent(valid);
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(valid.maps.length, 15);
  assert.equal(valid.regions.length, 5);
  assert.equal(Object.keys(valid.normals).length, 30);
  assert.equal(Object.keys(valid.elites).length, 10);
  assert.equal(Object.keys(valid.bosses).length, 15);
  assert.equal(Object.keys(valid.eliteAffixes).length, 10);

  const noBoss = content();
  delete noBoss.bosses[noBoss.maps[0].bossId];
  assert.equal(validateWorldContent(noBoss).ok, false);

  const noTarget = content();
  noTarget.maps[0].targetDrops = [];
  assert.equal(validateWorldContent(noTarget).ok, false);

  const noPrevious = content();
  noPrevious.maps[0].previousMapId = null;
  noPrevious.startingMapIds = ["caoyun"];
  assert.equal(validateWorldContent(noPrevious).ok, false);

  const noModifier = content();
  noModifier.maps[0].modifiers = [];
  assert.equal(validateWorldContent(noModifier).ok, false);

  const noPhase = content();
  noPhase.bosses[noPhase.maps[0].bossId].phases = [];
  assert.equal(validateWorldContent(noPhase).ok, false);

  const unreachable = content();
  unreachable.startingMapIds = ["luoyang"];
  unreachable.maps.find((map) => map.id === "caoyun")!.previousMapId = "zhumu";
  assert.equal(validateWorldContent(unreachable).ok, false);
});

test("unlock chain: starts open, next map waits for previous layer-10 boss and realm gate", () => {
  let progress = createWorldProgress(WORLD_CONTENT_V1);
  assert.equal(canEnterMap(WORLD_CONTENT_V1, progress, "luoyang", 0).ok, true);
  assert.equal(canEnterMap(WORLD_CONTENT_V1, progress, "caoyun", 0).ok, true);
  const locked = canEnterMap(WORLD_CONTENT_V1, progress, "huanghe", 0);
  assert.equal(locked.ok, false);
  assert.equal(locked.reason, "missing-previous");

  const clear = recordMapClear(WORLD_CONTENT_V1, progress, "luoyang", 10);
  progress = clear.progress;
  assert.equal(clear.granted, true);
  assert.equal(mapProgress(progress, "luoyang").bossCleared, true);
  assert.equal(canEnterMap(WORLD_CONTENT_V1, progress, "huanghe", 0).ok, true);
  const huanghe = recordMapClear(WORLD_CONTENT_V1, progress, "huanghe", 10);
  progress = huanghe.progress;
  const realmLocked = canEnterMap(WORLD_CONTENT_V1, progress, "biaoju", 0);
  assert.equal(realmLocked.ok, false);
  assert.equal(realmLocked.reason, "realm");
  assert.equal(canEnterMap(WORLD_CONTENT_V1, progress, "biaoju", 1).ok, true);

  const repeat = recordMapClear(WORLD_CONTENT_V1, progress, "luoyang", 10);
  assert.equal(repeat.granted, false);
  assert.equal(repeat.reward, undefined);
});

test("final map additionally requires all five chapter bosses", () => {
  const progress = createWorldProgress(WORLD_CONTENT_V1);
  for (const map of WORLD_CONTENT_V1.maps) {
    progress.maps[map.id] = {
      ...mapProgress(progress, map.id),
      bossCleared: map.id !== "zhumu",
    };
  }
  progress.maps.zhumu = { ...mapProgress(progress, "zhumu"), bossCleared: false };
  const missing = canEnterMap(WORLD_CONTENT_V1, progress, "zhumu", 5);
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "chapter-bosses");
  progress.chapterBossesCleared = ["boss_heifeng", "boss_swordtomb", "boss_meilin", "boss_blackmarket", "boss_stoneking"];
  assert.equal(canEnterMap(WORLD_CONTENT_V1, progress, "zhumu", 5).ok, true);
});

test("every map has one layer-10 boss and non-empty layers 1-9; level rises monotonically", () => {
  for (const map of WORLD_CONTENT_V1.maps) {
    for (let layer = 1; layer <= 9; layer += 1) {
      const encounter = generateEncounter(WORLD_CONTENT_V1, map.id, layer, 11);
      assert.notEqual(encounter.kind, "boss");
      assert.ok(encounter.enemyIds.length >= 1 && encounter.enemyIds.length <= 3);
      assert.ok(encounter.level > 0);
      if (layer > 1) {
        assert.ok(levelForLayer(map, layer) > levelForLayer(map, layer - 1));
      }
    }
    const boss = generateEncounter(WORLD_CONTENT_V1, map.id, 10, 11);
    assert.equal(boss.kind, "boss");
    assert.deepEqual(boss.enemyIds, [map.bossId]);
  }
});

test("elite chance increases with layer and tier; affixes come from the region pool and respect forbidden pairs", () => {
  const low = WORLD_CONTENT_V1.maps.find((map) => map.id === "luoyang")!;
  const high = WORLD_CONTENT_V1.maps.find((map) => map.id === "zhumu")!;
  assert.ok(eliteChanceFor(high, 1) > eliteChanceFor(low, 1));
  for (let layer = 1; layer < 9; layer += 1) {
    assert.ok(eliteChanceFor(high, layer + 1) > eliteChanceFor(high, layer));
  }
  const region = WORLD_CONTENT_V1.regions.find((entry) => entry.id === high.region)!;
  let eliteSeen = 0;
  for (const map of WORLD_CONTENT_V1.maps) {
    const mapRegion = WORLD_CONTENT_V1.regions.find((entry) => entry.id === map.region)!;
    for (let seed = 1; seed <= 30; seed += 1) {
      const encounter = generateEncounter(WORLD_CONTENT_V1, map.id, 9, seed);
      if (encounter.kind !== "elite") continue;
      eliteSeen += 1;
      assert.ok(encounter.eliteAffixIds.length >= 1);
      for (const id of encounter.eliteAffixIds) {
        assert.ok(mapRegion.eliteAffixPool.includes(id), `${id} not in ${mapRegion.id}`);
      }
      for (const [a, b] of WORLD_CONTENT_V1.eliteAffixForbiddenPairs) {
        assert.ok(!(encounter.eliteAffixIds.includes(a) && encounter.eliteAffixIds.includes(b)));
      }
    }
  }
  assert.ok(eliteSeen > 0);
  assert.ok(region.eliteAffixPool.length > 0);
});

test("same map/layer/seed produces the same encounter, and group size scales to 3", () => {
  const a = generateEncounter(WORLD_CONTENT_V1, "heishi", 8, 99);
  const b = generateEncounter(WORLD_CONTENT_V1, "heishi", 8, 99);
  assert.deepEqual(a, b);
  assert.equal(groupSizeFor(WORLD_CONTENT_V1.maps[0], 1), 1);
  assert.equal(groupSizeFor(WORLD_CONTENT_V1.maps[0], 10), 1);
  assert.ok(groupSizeFor(WORLD_CONTENT_V1.maps.find((map) => map.id === "zhumu")!, 9) <= 3);
});

test("boss phases trigger at thresholds, change patterns, and every action is telegraphed one round ahead", () => {
  const encounter = generateEncounter(WORLD_CONTENT_V1, "zhumu", 10, 7);
  const enemy = createEncounterBattle(encounter);
  assert.equal(enemy.phases.length, 3);
  assert.ok(enemy.phases[1].threshold < enemy.phases[0].threshold);
  assert.ok(enemy.phases[2].threshold < enemy.phases[1].threshold);

  const result = resolveBattle({
    player: {
      sheet: createBattleSheet("taiji", { level: 63, extraMods: { attackPct: 1, crit: 0 } }),
      loadout: starterLoadoutFor("taiji"),
      content: COMBAT_CONTENT,
    },
    enemy,
    objective: "clear",
    maxRounds: 30,
    seed: 3,
    modifiers: encounterBattleModifiers(encounter),
    captureEvents: true,
  });
  assert.ok(result.events.some((event) => event.category === "phase" && event.text.includes("王势")));
  assert.ok(result.events.some((event) => event.category === "phase" && event.text.includes("终势")));
  const rounds = new Map<number, string[]>();
  for (const event of result.events) {
    const list = rounds.get(event.round) ?? [];
    list.push(event.category);
    rounds.set(event.round, list);
  }
  for (const [round, categories] of rounds) {
    if (round === 0 || !categories.includes("action")) continue;
    const intentIndex = categories.indexOf("intent");
    const actionIndex = categories.indexOf("action");
    assert.ok(intentIndex >= 0 && intentIndex < actionIndex, `round ${round} action without intent`);
  }
});

test("first clear grants exactly once; repeat clears do not re-grant rewards", () => {
  const progress = createWorldProgress(WORLD_CONTENT_V1);
  const first = recordMapClear(WORLD_CONTENT_V1, progress, "luoyang", 10);
  assert.equal(first.granted, true);
  assert.equal(first.reward?.targetDropId, WORLD_CONTENT_V1.maps.find((map) => map.id === "luoyang")!.firstClear.targetDropId);
  const second = recordMapClear(WORLD_CONTENT_V1, first.progress, "luoyang", 10);
  assert.equal(second.granted, false);
  assert.equal(second.reward, undefined);
  assert.equal(mapProgress(second.progress, "luoyang").wins, 2);
});

test("target pity rises after threshold, caps, drops, resets and claims once", () => {
  const target = WORLD_CONTENT_V1.targetDrops.td_luoyang_belt;
  assert.equal(targetPityChance(target, 0), target.chance);
  assert.equal(targetPityChance(target, target.pityThreshold), target.chance + target.pityStep);
  assert.ok(targetPityChance(target, 999) <= target.maxChance);

  const rng = new Rng(3);
  let counter = target.pityThreshold - 1;
  let result = rollTargetDrop(target, counter, rng);
  for (let i = 0; i < 500 && !result.dropped; i += 1) {
    assert.equal(result.nextCounter, counter + 1);
    counter = result.nextCounter;
    result = rollTargetDrop(target, counter, rng);
  }
  assert.equal(result.dropped, true);
  assert.equal(result.nextCounter, 0);

  const forced = content();
  forced.targetDrops.td_luoyang_belt = { ...target, chance: 1, maxChance: 1, pityThreshold: 0, pityStep: 0 };
  let progress = createWorldProgress(forced);
  const award = rollTargetsForEncounter(forced, progress, "luoyang", "elite", 1);
  progress = award.progress;
  assert.equal(award.awarded.length, 1);
  const again = rollTargetsForEncounter(forced, progress, "luoyang", "elite", 2);
  assert.equal(again.awarded.length, 0);
  assert.equal(mapProgress(again.progress, "luoyang").targetClaimed.td_luoyang_belt, true);
  assert.ok(eligibleTargets(forced, "luoyang", "elite").length >= 1);
});

test("stop conditions cover boss failure, bag full, target/rare drop, time limit and manual", () => {
  const base = {
    win: true,
    boss: false,
    targetDrop: false,
    rareDrop: false,
    bagFull: false,
    manual: false,
    elapsedHours: 1,
  };
  assert.deepEqual(shouldStop(["bagFull"], { ...base, bagFull: true }), { stop: true, condition: "bagFull" });
  assert.deepEqual(shouldStop(["targetDrop"], { ...base, targetDrop: true }), { stop: true, condition: "targetDrop" });
  assert.deepEqual(shouldStop(["rareDrop"], { ...base, rareDrop: true }), { stop: true, condition: "rareDrop" });
  assert.deepEqual(shouldStop(["bossFailure"], { ...base, win: false, boss: true }), { stop: true, condition: "bossFailure" });
  assert.deepEqual(shouldStop(["timeLimit"], { ...base, elapsedHours: 9, timeLimitHours: 8 }), { stop: true, condition: "timeLimit" });
  assert.deepEqual(shouldStop(["manual"], { ...base, manual: true }), { stop: true, condition: "manual" });
  assert.deepEqual(shouldStop([], base), { stop: false });
});

test("offline progression advances only the current map and stops on the selected condition", () => {
  let progress = createWorldProgress(WORLD_CONTENT_V1);
  progress.currentLayer = 3;
  const winAll = advanceOffline({
    content: WORLD_CONTENT_V1,
    progress,
    mapId: "luoyang",
    hours: 8,
    fightsPerHour: 1,
    stopConditions: [],
    fight: () => ({ win: true, boss: false }),
  });
  assert.equal(winAll.fights, 8);
  assert.equal(winAll.changedMap, false);
  assert.equal(winAll.mapId, "luoyang");
  assert.equal(winAll.progress.currentMapId, "luoyang");
  assert.equal(winAll.progress.currentLayer, 10);

  progress = createWorldProgress(WORLD_CONTENT_V1);
  progress.currentLayer = 10;
  const bossFailure = advanceOffline({
    content: WORLD_CONTENT_V1,
    progress,
    mapId: "luoyang",
    hours: 8,
    fightsPerHour: 1,
    stopConditions: ["bossFailure"],
    fight: () => ({ win: false, boss: true }),
  });
  assert.equal(bossFailure.stoppedBy, "bossFailure");
  assert.equal(bossFailure.fights, 1);
  assert.equal(bossFailure.changedMap, false);
  assert.equal(bossFailure.progress.currentMapId, "luoyang");

  const bagFull = advanceOffline({
    content: WORLD_CONTENT_V1,
    progress: { ...progress, currentLayer: 2 },
    mapId: "luoyang",
    hours: 8,
    fightsPerHour: 1,
    stopConditions: ["bagFull"],
    fight: (_layer, index) => ({ win: true, boss: false, bagFull: index >= 1 }),
  });
  assert.equal(bagFull.stoppedBy, "bagFull");
  assert.equal(bagFull.fights, 2);

  const target = advanceOffline({
    content: WORLD_CONTENT_V1,
    progress: { ...progress, currentLayer: 2 },
    mapId: "luoyang",
    hours: 8,
    fightsPerHour: 1,
    stopConditions: ["targetDrop"],
    fight: () => ({ win: true, boss: false, targetDrop: true }),
  });
  assert.equal(target.stoppedBy, "targetDrop");
  assert.equal(target.fights, 1);

  const timed = advanceOffline({
    content: WORLD_CONTENT_V1,
    progress: { ...progress, currentLayer: 2 },
    mapId: "luoyang",
    hours: 10,
    fightsPerHour: 1,
    stopConditions: ["timeLimit"],
    timeLimitHours: 3,
    fight: () => ({ win: true, boss: false }),
  });
  assert.equal(timed.stoppedBy, "timeLimit");
  assert.equal(timed.fights, 3);
});

test("UI map helpers read the same content definitions (no duplicate tables)", () => {
  for (const region of WORLD_CONTENT_V1.regions) {
    const maps = mapsForRegion(region.id);
    assert.equal(maps.length, 3);
    for (const map of maps) {
      assert.deepEqual(enemiesForMap(map).map((enemy) => enemy.id), [...map.normalPool, ...map.eliteIds, map.bossId]);
      assert.deepEqual(targetDropsForMap(map).map((drop) => drop.id), map.targetDrops);
      assert.deepEqual(modifiersForMap(map).map((modifier) => modifier.id), map.modifiers);
    }
  }
});

test("every map is clearable by at least one starter kit at recommended realm; each kit clears a representative map", () => {
  const winsByBuild = new Map<BuildId, string[]>();
  for (const buildId of ["taiji", "pojun", "xuanyin"] as BuildId[]) winsByBuild.set(buildId, []);
  for (const map of WORLD_CONTENT_V1.maps) {
    const realm = recommendedRealmFor(map);
    const level = Math.max(1, realm * 9 + 5);
    const encounter = generateEncounter(WORLD_CONTENT_V1, map.id, 10, 31);
    const enemy = createEncounterBattle(encounter);
    const modifiers = encounterBattleModifiers(encounter);
    let anyWin = false;
    for (const buildId of ["taiji", "pojun", "xuanyin"] as BuildId[]) {
      const result = resolveBattle({
        player: {
          sheet: createBattleSheet(buildId, { level }),
          loadout: starterLoadoutFor(buildId),
          content: COMBAT_CONTENT,
        },
        enemy,
        objective: "clear",
        maxRounds: 30,
        seed: 31,
        modifiers,
        captureEvents: false,
      });
      if (result.win) {
        anyWin = true;
        winsByBuild.get(buildId)!.push(map.id);
      }
    }
    assert.ok(anyWin, `${map.name} is not clearable by any starter kit`);
  }
  for (const [buildId, maps] of winsByBuild) {
    assert.ok(maps.length > 0, `${buildId} did not clear any representative map`);
  }
  assert.ok(rewardPctForEncounter(generateEncounter(WORLD_CONTENT_V1, "huanghe", 1, 1)) >= 0);
});
