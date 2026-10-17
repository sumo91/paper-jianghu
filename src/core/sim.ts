import type {
  CharacterState,
  EnemyDef,
  FightRewards,
  GearItem,
  MapDef,
  MapProgress,
  SimOptions,
  SimResult,
  SimSnapshot,
  LootSource,
} from "./types.ts";
import { GEAR_SLOTS, REALM_NAMES } from "./types.ts";
import { Rng } from "./rng.ts";
import {
  bestItemForSlot,
  breakthroughRenownCost,
  computeGearScore,
  computeSheet,
  countSetPieces,
  initialCharacter,
  isRealmCap,
  levelToRealm,
  levelToLayer,
  rarityRank,
  xpToNext,
} from "./stats.ts";
import { describeItem, dropChance, generateItem, salvageValue } from "./loot.ts";
import { simulateFight } from "./combat.ts";
import { getBuild } from "../data/builds.ts";
import { ENEMIES, getEnemy } from "../data/enemies.ts";
import { MAPS, getMap } from "../data/maps.ts";

const DEFAULT_SNAPSHOT_HOURS = [1, 4, 8, 12, 24, 48, 72, 100];

function availableMaps(realm: number): MapDef[] {
  return MAPS.filter((map) => map.unlockRealm <= realm);
}

function progressFor(progress: Map<string, MapProgress>, mapId: string): MapProgress {
  let entry = progress.get(mapId);
  if (!entry) {
    entry = {
      highestClearedLayer: 0,
      bossCleared: false,
      wins: 0,
      losses: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
    };
    progress.set(mapId, entry);
  }
  return entry;
}

function nextUnclearedMapIndex(realm: number, progress: Map<string, MapProgress>): number {
  const available = availableMaps(realm);
  for (const map of available) {
    const p = progressFor(progress, map.id);
    if (!p.bossCleared) return MAPS.findIndex((m) => m.id === map.id);
  }
  return Math.max(0, MAPS.findIndex((m) => m.id === available[available.length - 1].id));
}

function enemyFor(map: MapDef, layer: number, rng: Rng): { enemy: EnemyDef; source: LootSource } {
  if (layer >= 10) return { enemy: getEnemy(map.bossId), source: "boss" };
  if (rng.chance(0.14)) return { enemy: getEnemy(map.eliteId), source: "elite" };
  return { enemy: getEnemy(rng.pick(map.enemyIds)), source: "normal" };
}

function rewardsFor(
  map: MapDef,
  layer: number,
  source: LootSource,
  firstClear: boolean,
  rounds: number,
): FightRewards {
  const sourceMult = source === "normal" ? 1 : source === "elite" ? 1.8 : 4.5;
  // v0.2: per-fight rewards get a small duration factor so a slow tank is not
  // double-punished by clearing fewer fights per hour.
  const durationFactor = 1 + 0.02 * Math.max(0, rounds);
  const xp = Math.round(8 * (1 + 0.22 * map.tier) * (1 + 0.12 * layer) * sourceMult * durationFactor);
  const silver = Math.round(5 * (1 + 0.3 * map.tier) * (1 + 0.1 * layer) * sourceMult * durationFactor);
  const baseRenown = source === "normal" ? 1 : source === "elite" ? 3 : 20;
  const renown = baseRenown + (firstClear ? 80 : 0);
  return { xp, silver, renown, firstClear };
}

function equipItem(character: CharacterState, item: GearItem): { equipped: boolean; salvage: number } {
  if (!bestItemForSlot(character, item)) {
    return { equipped: false, salvage: salvageValue(item) };
  }
  const old = character.gear[item.slot];
  character.gear[item.slot] = item;
  return { equipped: true, salvage: old ? salvageValue(old) : 0 };
}

function updateDerived(character: CharacterState): void {
  character.realm = levelToRealm(character.level);
  character.layer = levelToLayer(character.level);
  character.companionBond = Math.max(1, Math.min(10, 1 + Math.floor((character.level - 1) / 7)));
  character.innerArtLevel = Math.max(1, Math.min(10, 1 + Math.floor((character.level - 1) / 6)));
  character.artMastery = Math.max(1, Math.min(8, 1 + Math.floor((character.level - 1) / 8)));
}

function gainXp(character: CharacterState, amount: number): void {
  character.xp += amount;
  // Level automatically until the realm cap; a ninth layer needs a breakthrough.
  let guard = 0;
  while (
    character.level < 63 &&
    character.layer < 9 &&
    character.xp >= xpToNext(character.level) &&
    guard < 30
  ) {
    character.xp -= xpToNext(character.level);
    character.level += 1;
    updateDerived(character);
    guard += 1;
  }
}

function snapshot(
  character: CharacterState,
  map: MapDef,
  layer: number,
  hours: number,
  totalFights: number,
  deaths: number,
  recentResults: boolean[],
  recentRounds: number[],
  progress: Map<string, MapProgress>,
): SimSnapshot {
  const sheet = computeSheet(character);
  const wins = recentResults.filter(Boolean).length;
  const winRate = recentResults.length > 0 ? wins / recentResults.length : 0;
  const roundsAvg = recentRounds.length > 0
    ? recentRounds.reduce((a, b) => a + b, 0) / recentRounds.length
    : 0;
  const allProgress = [...progress.values()];
  const maxTier = Math.max(
    0,
    ...availableMaps(character.realm).filter((m) => progressFor(progress, m.id).highestClearedLayer > 0).map((m) => m.tier),
  );
  const maxLayer = Math.max(0, ...allProgress.map((p) => p.highestClearedLayer));
  return {
    hours,
    level: character.level,
    realm: character.realm,
    layer: character.layer,
    gearScore: Math.round(sheet.gearScore),
    gearRarity: GEAR_SLOTS.map((slot) => character.gear[slot]?.rarity ?? "none").join("/"),
    refineLevel: character.refineLevel,
    silver: Math.round(character.silver),
    renown: Math.round(character.renown),
    winRate,
    roundsAvg,
    mapId: map.id,
    mapLayer: layer,
    highestMapTier: maxTier,
    highestLayer: maxLayer,
    innerArtLevel: character.innerArtLevel,
    artMastery: character.artMastery,
    companionBond: character.companionBond,
    xp: Math.round(character.xp),
    totalFights,
    deaths,
  };
}

export function simulate(options: SimOptions): SimResult {
  const build = getBuild(options.buildId);
  const rng = new Rng(options.seed);
  const character = initialCharacter(build.id);
  updateDerived(character);
  const progress = new Map<string, MapProgress>();
  const snapshotHours = [...(options.snapshotHours ?? DEFAULT_SNAPSHOT_HOURS)].sort((a, b) => a - b);
  const snapshots: SimSnapshot[] = [];
  let snapshotIndex = 0;
  const targetSeconds = options.hours * 3600;
  const aggressive = options.aggressive ?? false;
  const pushThreshold = aggressive ? 3 : 4;
  const fallbackLosses = aggressive ? 4 : 3;

  let mapIndex = 0;
  let currentMap = MAPS[0];
  let layer = 1;
  let winsInRow = 0;
  let lossesInRow = 0;
  let totalFights = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalXp = 0;
  let totalSilver = 0;
  let totalRenown = 0;
  let survivalFights = 0;
  let survivalWins = 0;
  let timeSeconds = 0;
  const recentResults: boolean[] = [];
  const recentRounds: number[] = [];
  const winsByStyle: Record<string, number> = {};
  const fightsByStyle: Record<string, number> = {};
  const fightsAtLayer: Record<string, number> = {};
  const lossesAtLayer: Record<string, number> = {};
  const realmTimes: Record<string, number | null> = { "0": 0 };
  const bossClearTimes: Record<string, number | null> = {};
  const notes: string[] = [];
  let lastUpgradeSeconds = 0;
  let maxStallSeconds = 0;
  let lastLevel = character.level;
  let lastGearScore = 0;
  let nextTrialAtSeconds = 0;
  let trialInsight = 0;

  function markUpgrade(): void {
    const gap = timeSeconds - lastUpgradeSeconds;
    if (gap > maxStallSeconds) maxStallSeconds = gap;
    lastUpgradeSeconds = timeSeconds;
  }

  function pushSnapshot(): void {
    const hours = timeSeconds / 3600;
    snapshots.push(
      snapshot(
        character,
        currentMap,
        layer,
        hours,
        totalFights,
        totalLosses,
        recentResults,
        recentRounds,
        progress,
      ),
    );
  }

  function maybeSnapshot(): void {
    while (snapshotIndex < snapshotHours.length && timeSeconds >= snapshotHours[snapshotIndex] * 3600) {
      pushSnapshot();
      snapshotIndex += 1;
    }
  }

  function chooseNextMap(): void {
    mapIndex = nextUnclearedMapIndex(character.realm, progress);
    currentMap = getMap(MAPS[mapIndex].id);
    layer = 1;
    winsInRow = 0;
    lossesInRow = 0;
  }

  function maybeBreakthrough(): void {
    if (character.level >= 63 || character.layer !== 9) return;
    if (character.xp < xpToNext(character.level)) return;
    const cost = breakthroughRenownCost(character.realm);
    if (character.renown < cost) return;

    if (timeSeconds < nextTrialAtSeconds) return;

    const trialMap = availableMaps(character.realm)[availableMaps(character.realm).length - 1] ?? currentMap;
    const baseTrial = getEnemy(trialMap.bossId);
    // A breakthrough trial is a gear/skill check, not a full endgame boss.
    // Anti-frustration: each failed breakthrough teaches insight, easing the next trial.
    const insightScale = Math.max(0.5, 1 - 0.1 * trialInsight);
    const trial = {
      ...baseTrial,
      hpMult: baseTrial.hpMult * 0.72 * insightScale,
      atkMult: baseTrial.atkMult * 0.9 * insightScale,
      defMult: baseTrial.defMult * 0.9 * insightScale,
      // Trials test build readiness, not the high-tier anti-burst rules.
      reflectPct: 0,
      damageCapPct: 0.3,
    };
    const trialLevel = character.level + 1;
    const trialResult = simulateFight(computeSheet(character), trial, {
      enemyLevel: trialLevel,
      rng,
      maxRounds: 40,
    });
    timeSeconds += 20 + trialResult.rounds * 2;
    totalFights += 1;
    if (trialResult.win) {
      character.renown -= cost;
      character.level += 1;
      character.xp = 0;
      updateDerived(character);
      realmTimes[String(character.realm)] = timeSeconds / 3600;
      notes.push(`第 ${character.realm} 境突破「${REALM_NAMES[character.realm]}」`);
      nextTrialAtSeconds = 0;
      trialInsight = 0;
      markUpgrade();
      chooseNextMap();
    } else {
      trialInsight = Math.min(5, trialInsight + 1);
      notes.push(`突破「${REALM_NAMES[Math.min(6, character.realm + 1)]}」失败，试炼难度下降（感悟 ${trialInsight}/5）`);
      nextTrialAtSeconds = timeSeconds + 90;
      layer = Math.max(1, layer - 1);
    }
  }

  function tryRefine(): void {
    if (character.refineLevel >= 10) return;
    const cost = Math.round(300 * Math.pow(2.0, character.refineLevel));
    if (character.silver < cost * 3) return;
    character.silver -= cost;
    character.refineLevel += 1;
    markUpgrade();
  }

  // Initial route: the first map in the list is the intended starter.
  // Keep the bot simple but not suicidal: it pushes after wins and drops after losses.
  while (timeSeconds < targetSeconds) {
    maybeBreakthrough();
    if (character.level < 63 && character.layer === 9 && character.xp >= xpToNext(character.level)) {
      // At the cap without enough renown: farm the current map; do not silently skip the gate.
      // The next loop will retry the breakthrough when renown arrives.
    }

    const mapProgress = progressFor(progress, currentMap.id);
    const layerKey = `${currentMap.id}:${layer}`;
    fightsAtLayer[layerKey] = (fightsAtLayer[layerKey] ?? 0) + 1;

    // v0.2: 守关 is the tank's independent activity. Non-tank bots stay on clear.
    const survivalCadence = character.buildId === "taiji" ? 5 : 0;
    const isSurvival = survivalCadence > 0 && totalFights > 0 && totalFights % survivalCadence === 0;

    const { enemy, source } = isSurvival
      ? { enemy: getEnemy(currentMap.eliteId), source: "elite" as LootSource }
      : enemyFor(currentMap, layer, rng);
    const levelInTier = character.level - (currentMap.tier - 1) * 9;
    const safeLayerCap = Math.max(1, Math.min(10, levelInTier + (aggressive ? 4 : 2)));
    if (layer > safeLayerCap) {
      layer = safeLayerCap;
      winsInRow = 0;
    }
    const enemyLevel = Math.max(1, (currentMap.tier - 1) * 9 + layer);
    const fight = simulateFight(computeSheet(character), enemy, {
      enemyLevel,
      rng,
      maxRounds: isSurvival ? 20 : 40,
      objective: isSurvival ? "survive" : "clear",
      surviveRounds: 20,
    });
    totalFights += 1;
    recentRounds.push(fight.rounds);
    if (recentRounds.length > 50) recentRounds.shift();
    fightsByStyle[enemy.style] = (fightsByStyle[enemy.style] ?? 0) + 1;

    const fightSeconds = 10 + fight.rounds * 2 + (enemy.boss && !isSurvival ? 20 : 0);
    timeSeconds += fightSeconds;

    if (isSurvival) {
      survivalFights += 1;
      if (fight.win) {
        survivalWins += 1;
        totalWins += 1;
        recentResults.push(true);
        // A 守关 success should not reset the clear-layer push counter.
        const hpFactor = 0.7 + 0.6 * fight.playerHpPct;
        const baseXp = 8 * (1 + 0.22 * currentMap.tier) * (1 + 0.12 * layer);
        const baseSilver = 5 * (1 + 0.3 * currentMap.tier) * (1 + 0.1 * layer);
        const xp = Math.round(baseXp * 0.7 * hpFactor);
        const silver = Math.round(baseSilver * 1.0 * hpFactor);
        const renown = 4;
        character.xp += 0;
        gainXp(character, xp);
        character.silver += silver;
        character.renown += renown;
        totalXp += xp;
        totalSilver += silver;
        totalRenown += renown;
        if (character.level !== lastLevel) {
          lastLevel = character.level;
          markUpgrade();
        }
        if (rng.chance(0.4 + 0.005 * fight.rounds)) {
          const item = generateItem(currentMap, layer, "elite", character.buildId, rng);
          const equipped = equipItem(character, item);
          character.silver += equipped.salvage;
          if (equipped.equipped) {
            const newScore = computeGearScore(character).total;
            if (newScore > lastGearScore + 0.5) {
              lastGearScore = newScore;
              markUpgrade();
            }
          }
        }
        if (totalFights % 7 === 0) tryRefine();
      } else {
        totalLosses += 1;
        recentResults.push(false);
        lossesInRow += 1;
        winsInRow = 0;
        // Do not advance map progress from a failed 守关.
      }
      updateDerived(character);
      maybeSnapshot();
      continue;
    }

    if (fight.win) {
      totalWins += 1;
      winsByStyle[enemy.style] = (winsByStyle[enemy.style] ?? 0) + 1;
      recentResults.push(true);
      winsInRow += 1;
      lossesInRow = 0;
      mapProgress.wins += 1;
      mapProgress.consecutiveWins += 1;
      mapProgress.consecutiveLosses = 0;
      mapProgress.highestClearedLayer = Math.max(mapProgress.highestClearedLayer, layer);

      const firstClear = layer >= 10 && !mapProgress.bossCleared;
      if (firstClear) {
        mapProgress.bossCleared = true;
        bossClearTimes[currentMap.id] = timeSeconds / 3600;
      }

      const reward = rewardsFor(currentMap, layer, source, firstClear, fight.rounds);
      character.xp += 0;
      gainXp(character, reward.xp);
      character.silver += reward.silver;
      character.renown += reward.renown;
      totalXp += reward.xp;
      totalSilver += reward.silver;
      totalRenown += reward.renown;

      if (character.level !== lastLevel) {
        lastLevel = character.level;
        markUpgrade();
      }

      const adjustedDrop = Math.min(1, dropChance(source) * (1 + 0.01 * fight.rounds));
      if (rng.chance(adjustedDrop)) {
        const item = generateItem(currentMap, layer, source, character.buildId, rng);
        const equipped = equipItem(character, item);
        character.silver += equipped.salvage;
        if (equipped.equipped) {
          notes.push(`获得 ${describeItem(item)}`);
          const newScore = computeGearScore(character).total;
          if (newScore > lastGearScore + 0.5) {
            lastGearScore = newScore;
            markUpgrade();
          }
        }
      }

      // Deterministic 神装 entry: first clear of a high-tier boss.
      if (firstClear && currentMap.tier >= 5 && layer >= 10) {
        const divine = generateItem(currentMap, layer, "boss", character.buildId, rng, "divine", true);
        const equipped = equipItem(character, divine);
        character.silver += equipped.salvage;
        if (equipped.equipped) {
          notes.push(`深层首通神装：${describeItem(divine)}`);
          const newScore = computeGearScore(character).total;
          if (newScore > lastGearScore + 0.5) {
            lastGearScore = newScore;
            markUpgrade();
          }
        }
      }

      if (totalFights % 7 === 0) tryRefine();

      if (mapProgress.bossCleared && layer >= 10) {
        const nextIndex = nextUnclearedMapIndex(character.realm, progress);
        if (nextIndex !== mapIndex) {
          chooseNextMap();
        }
      } else if (winsInRow >= pushThreshold && layer < 10) {
        layer += 1;
        winsInRow = 0;
      }
    } else {
      totalLosses += 1;
      recentResults.push(false);
      lossesInRow += 1;
      winsInRow = 0;
      mapProgress.losses += 1;
      mapProgress.consecutiveLosses += 1;
      mapProgress.consecutiveWins = 0;
      lossesAtLayer[layerKey] = (lossesAtLayer[layerKey] ?? 0) + 1;
      if (layer > 1) {
        layer -= 1;
      } else if (lossesInRow >= fallbackLosses) {
        const available = availableMaps(character.realm);
        const currentAvailableIndex = available.findIndex((m) => m.id === currentMap.id);
        if (currentAvailableIndex > 0) {
          const fallback = available[currentAvailableIndex - 1];
          mapIndex = MAPS.findIndex((m) => m.id === fallback.id);
          currentMap = fallback;
          layer = Math.max(1, progressFor(progress, fallback.id).highestClearedLayer || 1);
          lossesInRow = 0;
        }
      }
    }

    if (recentResults.length > 50) recentResults.shift();

    // Keep the character sheet in sync after level-ups/drops.
    updateDerived(character);

    // New realm: prefer the newly available map.
    if (character.realm > 0 && currentMap.unlockRealm > character.realm) {
      chooseNextMap();
    }

    maybeSnapshot();
  }

  // Final snapshot at the exact end.
  pushSnapshot();
  const final = snapshots[snapshots.length - 1];
  const maxMapTier = Math.max(
    0,
    ...MAPS.filter((m) => progressFor(progress, m.id).highestClearedLayer > 0).map((m) => m.tier),
  );
  const maxMapLayer = Math.max(0, ...[...progress.values()].map((p) => p.highestClearedLayer));

  for (const [realm, time] of Object.entries(realmTimes)) {
    if (time === null) notes.push(`未到达境界 ${realm}`);
  }
  if (maxMapTier === 0) notes.push("没有清过任何地图层");
  if (character.level >= 63) notes.push("已达到传说 9 层");
  if (snapshots.length < snapshotHours.length) notes.push("部分快照未生成（模拟提前结束）");

  if (notes.length > 40) {
    notes.splice(0, notes.length - 40);
  }

  const gear: Record<string, string> = {};
  for (const slot of GEAR_SLOTS) {
    const item = character.gear[slot];
    gear[slot] = item ? describeItem(item) : "—";
  }

  return {
    buildId: character.buildId,
    buildName: build.name,
    seed: options.seed,
    hours: timeSeconds / 3600,
    snapshots,
    final,
    realmTimes,
    bossClearTimes,
    totalFights,
    totalWins,
    totalLosses,
    totalXp,
    totalSilver,
    totalRenown,
    survivalFights,
    survivalWins,
    policy: aggressive ? "aggressive" : "balanced",
    winsByStyle,
    fightsByStyle,
    fightsAtLayer,
    lossesAtLayer,
    maxMapTier,
    maxMapLayer,
    timeStalledHours: maxStallSeconds / 3600,
    gear,
    notes,
  };
}

export function simulateMany(
  buildId: string,
  seeds: number[],
  hours: number,
  verbose = false,
): SimResult[] {
  const results: SimResult[] = [];
  for (const seed of seeds) {
    if (verbose) console.log(`sim ${buildId} seed ${seed}...`);
    results.push(simulate({ buildId, seed, hours, verbose }));
  }
  return results;
}
