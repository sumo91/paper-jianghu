import type { BuildId } from "./types.ts";
import { REALM_NAMES } from "./types.ts";
import { levelToRealm, xpToNext } from "./stats.ts";
import { Rng } from "./rng.ts";
import type { BattleResult } from "./combat-v1.ts";
import { resolveBattle } from "./combat-v1.ts";
import { COMBAT_CONTENT, STARTER_KITS, createBattleSheet, starterLoadoutFor } from "../data/combat-v1.ts";
import type { GearSlot } from "./types.ts";
import { GEAR_SLOTS } from "./types.ts";
import type { GearItemV1, ItemizationState } from "./itemization.ts";
import { createItemization, createItemizationState, dropChance, rarityRank } from "./itemization.ts";
import { ITEMIZATION_CONTENT, starterGearItems, weaponTypesForLoadout } from "../data/item-v1.ts";
import { createBuildProgression } from "./progression.ts";
import { BUILD_PROGRESSION_CONTENT, MERIDIAN_NODES_V1 } from "../data/progression-v1.ts";
import {
  WORLD_CONTENT_V1,
  createEncounterBattle,
  encounterBattleModifiers,
  rewardPctForEncounter,
} from "../data/world-v1.ts";
import type { EncounterDefV1, WorldProgressV1 } from "./world-v1.ts";
import {
  canEnterMap,
  createWorldProgress,
  generateEncounter,
  levelForLayer,
  mapProgress,
  recordMapClear,
  recordMapLoss,
  rollTargetsForEncounter,
} from "./world-v1.ts";

export interface SimV1Options {
  buildId: BuildId;
  seed: number;
  hours: number;
  snapshotHours?: number[];
  aggressive?: boolean;
}

export interface SimV1Snapshot {
  hours: number;
  level: number;
  realm: number;
  layer: number;
  mapId: string;
  mapLayer: number;
  fights: number;
  wins: number;
  losses: number;
  winRate: number;
  roundsAvg: number;
  xp: number;
  silver: number;
  renown: number;
  mapsCleared: number;
  targetDrops: number;
  gearScore: number;
  divineItems: number;
}

export interface SimV1Result {
  buildId: BuildId;
  buildName: string;
  seed: number;
  hours: number;
  snapshots: SimV1Snapshot[];
  final: SimV1Snapshot;
  realmTimes: Record<string, number | null>;
  mapsCleared: string[];
  mapsVisited: string[];
  targetDrops: string[];
  firstClears: number;
  gearScore: number;
  divineItems: number;
  gearRarity: Record<string, number>;
  learnedArts: number;
  masteryMax: number;
  innerLevel: number;
  meridianSpent: number;
  meridianEarned: number;
  respecs: number;
  totalFights: number;
  totalWins: number;
  totalLosses: number;
  totalXp: number;
  totalSilver: number;
  totalRenown: number;
  avgRounds: number;
  timeoutLosses: number;
  notes: string[];
}

const DEFAULT_SNAPSHOTS = [1, 4, 8, 12, 24, 48, 72, 100];

function fightDuration(rounds: number, boss: boolean): number {
  return 18 + rounds * 2 + (boss ? 24 : 0);
}

function rewardsFor(
  encounter: EncounterDefV1,
  rounds: number,
  rewardPct: number,
): { xp: number; silver: number; renown: number } {
  const map = WORLD_CONTENT_V1.maps.find((entry) => entry.id === encounter.mapId)!;
  const sourceMult = encounter.kind === "boss" ? 4.5 : encounter.kind === "elite" ? 1.8 : 1;
  const durationFactor = 1 + 0.004 * Math.max(0, rounds);
  const scale = 1 + rewardPct;
  return {
    xp: Math.round(18 * (1 + 0.22 * map.tier) * (1 + 0.12 * encounter.layer) * sourceMult * durationFactor * scale),
    silver: Math.round(6 * (1 + 0.3 * map.tier) * (1 + 0.1 * encounter.layer) * sourceMult * durationFactor * scale),
    renown: Math.round((encounter.kind === "boss" ? 24 : encounter.layer >= 6 ? 3 : 1) * scale),
  };
}

export function simulateV1(options: SimV1Options): SimV1Result {
  const rng = new Rng(options.seed);
  const buildId = options.buildId;
  const kitName = STARTER_KITS[buildId].name;
  const targetSeconds = options.hours * 3600;
  const snapshotHours = [...(options.snapshotHours ?? DEFAULT_SNAPSHOTS)].sort((a, b) => a - b);
  const aggressive = options.aggressive ?? true;
  let progress: WorldProgressV1 = createWorldProgress(WORLD_CONTENT_V1, "luoyang");
  let currentMapId = progress.currentMapId;
  let layer = 1;
  let level = 1;
  let xp = 0;
  let silver = 0;
  let renown = 0;
  let winsInRow = 0;
  let lossesInRow = 0;
  let totalFights = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalXp = 0;
  let totalSilver = 0;
  let totalRenown = 0;
  let totalRounds = 0;
  let timeoutLosses = 0;
  let firstClears = 0;
  let timeSeconds = 0;
  const snapshots: SimV1Snapshot[] = [];
  const realmTimes: Record<string, number | null> = { "0": 0 };
  const mapsCleared: string[] = [];
  const mapsVisited = new Set<string>();
  const targetDrops: string[] = [];
  const notes: string[] = [];
  let snapshotIndex = 0;

  const itemization = createItemization(ITEMIZATION_CONTENT);
  const progression = createBuildProgression(COMBAT_CONTENT, BUILD_PROGRESSION_CONTENT);
  let buildState = progression.createInitialState(buildId);
  const loadout = () => buildState.loadout;
  const requiredWeaponTypes = weaponTypesForLoadout(loadout());
  const equipContext = { buildId, requiredWeaponTypes, scoreThreshold: 0 };
  let inventory: ItemizationState = createItemizationState();
  inventory.salvageFilter.rarityFloor = "fine";
  for (const item of starterGearItems(buildId)) {
    inventory = itemization.addItem(inventory, item);
    const equipped = itemization.equip(inventory, item.id, equipContext);
    inventory = equipped.state;
  }

  const currentMap = () => WORLD_CONTENT_V1.maps.find((entry) => entry.id === currentMapId)!;

  function equippedScore(): number {
    let total = 0;
    for (const slot of GEAR_SLOTS) {
      const id = inventory.equipped[slot];
      const item = id ? inventory.inventory[id] : undefined;
      if (item) total += itemization.score(item, { buildId, requiredWeaponTypes });
    }
    return Math.round(total);
  }

  function divineCount(): number {
    return Object.values(inventory.inventory).filter((item) => item.rarity === "divine").length;
  }

  function manageBag(): void {
    const capacity = inventory.bagCapacity;
    if (Object.keys(inventory.inventory).length < capacity - 8) return;
    const equippedIds = new Set(Object.values(inventory.equipped).filter((id): id is string => Boolean(id)));
    const candidates = Object.values(inventory.inventory)
      .filter((item) => !equippedIds.has(item.id) && !item.locked && item.rarity !== "divine")
      .sort((a, b) => itemization.score(a, { buildId, requiredWeaponTypes }) - itemization.score(b, { buildId, requiredWeaponTypes }));
    for (const item of candidates) {
      if (Object.keys(inventory.inventory).length < capacity - 12) break;
      inventory = itemization.salvage(inventory, item.id, true).state;
    }
  }

  function spendProgression(): void {
    const active = [...buildState.loadout.moves, buildState.loadout.ultimateId, buildState.loadout.lightSkillId];
    for (const id of active) {
      let guard = 0;
      while ((buildState.mastery[id] ?? 1) < 7 && guard < 12) {
        const result = progression.upgradeMastery(buildState, id);
        if (!result.ok) break;
        buildState = result.state;
        guard += 1;
      }
    }
    let innerGuard = 0;
    while ((buildState.innerLevels[buildState.loadout.innerArtId] ?? 1) < 7 && innerGuard < 12) {
      const result = progression.upgradeInner(buildState, buildState.loadout.innerArtId);
      if (!result.ok) break;
      buildState = result.state;
      innerGuard += 1;
    }
    for (const id of buildState.loadout.hearts) {
      let guard = 0;
      while ((buildState.heartLevels[id] ?? 1) < 5 && guard < 6) {
        const result = progression.upgradeHeart(buildState, id);
        if (!result.ok) break;
        buildState = result.state;
        guard += 1;
      }
    }
    for (const node of Object.values(MERIDIAN_NODES_V1)) {
      if (buildState.meridian.spent.length >= 24) break;
      const result = progression.spendMeridian(buildState, node.id);
      if (result.ok) buildState = result.state;
    }
  }

  function maybeLearn(): void {
    if (!buildState.owned.moves.includes("xuanyin_zhi") && buildId !== "xuanyin") {
      const page = progression.addPage(buildState, "xuanyin_zhi", rng.next());
      buildState = page.state;
      if ((buildState.pages.xuanyin_zhi ?? 0) >= 3) {
        const combined = progression.combinePages(buildState, "xuanyin_zhi");
        buildState = combined.state;
        if (combined.learned) notes.push(`${(timeSeconds / 3600).toFixed(1)}h：从残页悟出「玄阴指」`);
      }
    }
    if (buildState.realm >= 2 && buildState.renown >= 80) {
      const companion = progression.learn(buildState, "comp_yanshisan", { kind: "boss", id: currentMapId });
      if (companion.ok && !companion.alreadyOwned) {
        buildState = companion.state;
        notes.push(`${(timeSeconds / 3600).toFixed(1)}h：结识「燕十三」`);
      }
    }
    if (buildState.realm >= 2 && buildState.renown >= 80) {
      const companion = progression.learn(buildState, "comp_heiqiu", { kind: "event", id: currentMapId });
      if (companion.ok && !companion.alreadyOwned) {
        buildState = companion.state;
        notes.push(`${(timeSeconds / 3600).toFixed(1)}h：奇遇结识「黑七」`);
      }
    }
  }

  function snapshot(): SimV1Snapshot {
    return {
      hours: timeSeconds / 3600,
      level,
      realm: levelToRealm(level),
      layer,
      mapId: currentMapId,
      mapLayer: layer,
      fights: totalFights,
      wins: totalWins,
      losses: totalLosses,
      winRate: totalFights > 0 ? totalWins / totalFights : 0,
      roundsAvg: totalFights > 0 ? totalRounds / totalFights : 0,
      xp,
      silver,
      renown,
      mapsCleared: mapsCleared.length,
      targetDrops: targetDrops.length,
      gearScore: equippedScore(),
      divineItems: divineCount(),
    };
  }

  function maybeSnapshot(): void {
    while (snapshotIndex < snapshotHours.length && timeSeconds >= snapshotHours[snapshotIndex] * 3600) {
      snapshots.push(snapshot());
      snapshotIndex += 1;
    }
  }

  function gainXp(amount: number): void {
    xp += amount;
    let guard = 0;
    while (level < 63 && xp >= xpToNext(level) && guard < 50) {
      xp -= xpToNext(level);
      level += 1;
      realmTimes[String(levelToRealm(level))] = realmTimes[String(levelToRealm(level))] ?? timeSeconds / 3600;
      guard += 1;
    }
  }

  function chooseNextMap(): boolean {
    const current = currentMap();
    const direct = current.firstClear.unlockMapId;
    if (direct) {
      const unlock = canEnterMap(WORLD_CONTENT_V1, progress, direct, levelToRealm(level));
      if (unlock.ok) {
        currentMapId = direct;
        layer = 1;
        return true;
      }
    }
    // No direct next: travel to the first enterable map that is not cleared.
    for (const map of WORLD_CONTENT_V1.maps) {
      if (progress.maps[map.id]?.bossCleared) continue;
      const unlock = canEnterMap(WORLD_CONTENT_V1, progress, map.id, levelToRealm(level));
      if (unlock.ok) {
        currentMapId = map.id;
        layer = Math.max(1, Math.min(10, mapProgress(progress, map.id).highestClearedLayer || 1));
        return true;
      }
    }
    return false;
  }

  function capLayerToLevel(): void {
    const map = currentMap();
    let guard = 0;
    while (layer > 1 && levelForLayer(map, layer) > level + (aggressive ? 5 : 3) && guard < 10) {
      layer -= 1;
      guard += 1;
    }
  }

  while (timeSeconds < targetSeconds) {
    const map = currentMap();
    mapsVisited.add(map.id);
    capLayerToLevel();
    const encounter = generateEncounter(
      WORLD_CONTENT_V1,
      currentMapId,
      layer,
      Math.floor(rng.next() * 0x7fffffff),
      progress,
    );
    const enemy = createEncounterBattle(encounter);
    const modifiers = encounterBattleModifiers(encounter);
    const sheet = createBattleSheet(buildId, {
      level,
      gear: [],
      hearts: [],
      keystones: [],
      innerArtId: buildState.loadout.innerArtId,
      innerArtLevel: buildState.innerLevels[buildState.loadout.innerArtId] ?? 1,
      extraMods: {
        ...itemization.gearMods(inventory),
        ...progression.masteryMods(buildState),
        ...progression.heartMods(buildState),
        ...progression.meridianMods(buildState),
      },
      weaponType: itemization.weaponType(inventory) ?? undefined,
    });
    const result: BattleResult = resolveBattle({
      player: { sheet, loadout: loadout(), content: COMBAT_CONTENT },
      enemy,
      objective: "clear",
      maxRounds: 30,
      seed: Math.floor(rng.next() * 0x7fffffff),
      modifiers,
      captureEvents: false,
    });
    totalFights += 1;
    totalRounds += result.rounds;
    timeSeconds += fightDuration(result.rounds, encounter.kind === "boss");
    const rewardPct = rewardPctForEncounter(encounter);
    const source = encounter.kind === "boss" ? "boss" : encounter.kind === "elite" ? "elite" : "normal";

    if (result.win) {
      totalWins += 1;
      winsInRow += 1;
      lossesInRow = 0;
      const reward = rewardsFor(encounter, result.rounds, rewardPct);
      gainXp(reward.xp);
      silver += reward.silver;
      renown += reward.renown;
      totalXp += reward.xp;
      totalSilver += reward.silver;
      totalRenown += reward.renown;
      buildState.cultivation += Math.round(reward.xp * 0.6);
      buildState.silver += reward.silver;
      buildState.renown += reward.renown;
      buildState.annotations += 1;

      const targetRoll = rollTargetsForEncounter(
        WORLD_CONTENT_V1,
        progress,
        currentMapId,
        source,
        Math.floor(rng.next() * 0x7fffffff),
      );
      progress = targetRoll.progress;
      for (const drop of targetRoll.awarded) {
        if (!targetDrops.includes(drop.id)) targetDrops.push(drop.id);
        notes.push(`${(timeSeconds / 3600).toFixed(1)}h：目标掉落「${drop.name}」`);
      }

      if (rng.chance(dropChance(source))) {
        const item = itemization.roll({
          seed: Math.floor(rng.next() * 0x7fffffff),
          source,
          mapTier: map.tier,
          layer: encounter.layer,
          buildId,
          allowDivine: false,
        });
        const received = itemization.receive(inventory, item, equipContext);
        inventory = received.state;
        if (received.stored) {
          const policy = itemization.applyEquipPolicy(inventory, item, "upgradeUnlocked", equipContext);
          inventory = policy.state;
          if (policy.equipped) {
            notes.push(`${(timeSeconds / 3600).toFixed(1)}h：换装 ${item.name}`);
          }
        }
        manageBag();
      }

      if (encounter.kind === "boss") {
        const clear = recordMapClear(WORLD_CONTENT_V1, progress, currentMapId, 10);
        progress = clear.progress;
        if (clear.granted) {
          firstClears += 1;
          silver += clear.reward?.silver ?? 0;
          renown += clear.reward?.renown ?? 0;
          totalSilver += clear.reward?.silver ?? 0;
          totalRenown += clear.reward?.renown ?? 0;
          if (!mapsCleared.includes(currentMapId)) mapsCleared.push(currentMapId);
          const signature = clear.reward ? WORLD_CONTENT_V1.targetDrops[clear.reward.targetDropId] : undefined;
          if (signature && !targetDrops.includes(signature.id)) {
            targetDrops.push(signature.id);
            notes.push(`${(timeSeconds / 3600).toFixed(1)}h：首通奖励「${signature.name}」`);
          }
          notes.push(`${(timeSeconds / 3600).toFixed(1)}h：首通 ${map.name} · ${clear.reward?.log ?? ""}`);
          buildState.pills += 1;
          buildState.annotations += 3;
          maybeLearn();
          if (map.tier >= 5) {
            const divine = itemization.roll({
              seed: Math.floor(rng.next() * 0x7fffffff),
              source: "boss",
              mapTier: map.tier,
              layer: 10,
              buildId,
              allowDivine: true,
              rarity: "divine",
            });
            const received = itemization.receive(inventory, divine, equipContext);
            inventory = received.state;
            if (received.stored) {
              const policy = itemization.applyEquipPolicy(inventory, divine, "upgradeUnlocked", equipContext);
              inventory = policy.state;
              notes.push(`${(timeSeconds / 3600).toFixed(1)}h：首通神装 ${divine.name}`);
            }
          }
        }
        if (!chooseNextMap()) {
          layer = 10;
        }
      } else {
        const clear = recordMapClear(WORLD_CONTENT_V1, progress, currentMapId, layer);
        progress = clear.progress;
        if (winsInRow >= (aggressive ? 1 : 2) && layer < 10) {
          layer += 1;
          winsInRow = 0;
        }
      }
    } else {
      totalLosses += 1;
      winsInRow = 0;
      lossesInRow += 1;
      if (result.outcome === "timeout") timeoutLosses += 1;
      const consolation = Math.round(rewardsFor(encounter, result.rounds, rewardPct).xp * 0.3);
      gainXp(consolation);
      totalXp += consolation;
      progress = recordMapLoss(progress, currentMapId, layer);
      if (layer > 1) layer -= 1;
      if (encounter.kind === "boss") layer = Math.max(1, Math.min(9, layer));
      if (lossesInRow >= 4 && currentMap().tier > 1) {
        const previous = currentMap().previousMapId;
        if (previous) {
          const previousProgress = mapProgress(progress, previous);
          if (previousProgress.bossCleared) {
            const unlock = canEnterMap(WORLD_CONTENT_V1, progress, previous, levelToRealm(level));
            if (unlock.ok) {
              currentMapId = previous;
              layer = Math.max(1, Math.min(10, previousProgress.highestClearedLayer || 1));
              lossesInRow = 0;
              notes.push(`${(timeSeconds / 3600).toFixed(1)}h：退回 ${previous} 练级`);
            }
          }
        }
      }
    }
    buildState = progression.syncRealm(buildState, levelToRealm(level), ((level - 1) % 9) + 1);
    if (totalFights % 10 === 0) spendProgression();
    if (timeSeconds >= 50 * 3600 && buildState.respecs === 0 && buildState.silver >= 300 && buildState.pills >= 1) {
      const respec = progression.respecMeridian(buildState);
      if (respec.ok) {
        buildState = respec.state;
        notes.push(`${(timeSeconds / 3600).toFixed(1)}h：经脉洗点，重新分配 ${buildState.meridian.points} 点`);
        spendProgression();
      }
    }
    maybeSnapshot();
  }

  snapshots.push(snapshot());
  const final = snapshots[snapshots.length - 1];
  if (notes.length > 60) notes.splice(0, notes.length - 60);
  return {
    buildId,
    buildName: kitName,
    seed: options.seed,
    hours: timeSeconds / 3600,
    snapshots,
    final,
    realmTimes,
    mapsCleared,
    mapsVisited: [...mapsVisited],
    targetDrops,
    firstClears,
    gearScore: equippedScore(),
    divineItems: divineCount(),
    gearRarity: Object.values(inventory.inventory).reduce<Record<string, number>>((counts, item) => {
      counts[item.rarity] = (counts[item.rarity] ?? 0) + 1;
      return counts;
    }, {}),
    learnedArts: buildState.learnedLog.length,
    masteryMax: Math.max(1, ...Object.values(buildState.mastery)),
    innerLevel: buildState.innerLevels[buildState.loadout.innerArtId] ?? 1,
    meridianSpent: buildState.meridian.spent.length,
    meridianEarned: buildState.meridian.earned,
    respecs: buildState.respecs,
    totalFights,
    totalWins,
    totalLosses,
    totalXp,
    totalSilver,
    totalRenown,
    avgRounds: totalFights > 0 ? totalRounds / totalFights : 0,
    timeoutLosses,
    notes,
  };
}

export function simulateV1Many(buildId: BuildId, seeds: number[], hours: number): SimV1Result[] {
  return seeds.map((seed) => simulateV1({ buildId, seed, hours }));
}

export function realmName(realm: number): string {
  return REALM_NAMES[Math.max(0, Math.min(REALM_NAMES.length - 1, realm))];
}
