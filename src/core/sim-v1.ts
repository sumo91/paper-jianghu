import type { BuildId, EnemyDef, MapDef } from "./types.ts";
import { REALM_NAMES } from "./types.ts";
import { levelToRealm, xpToNext } from "./stats.ts";
import { Rng } from "./rng.ts";
import type { BattleEnemyDef, BattleEnemyMove, BattleEnemyPhase, BattleResult } from "./combat-v1.ts";
import { resolveBattle } from "./combat-v1.ts";
import { COMBAT_CONTENT, ENEMY_MOVE_PATTERNS, STARTER_KITS, createBattleSheet, enemyBattleDef, starterLoadoutFor } from "../data/combat-v1.ts";
import { getEnemy } from "../data/enemies.ts";
import { MAPS } from "../data/maps.ts";

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

function enemyLevelFor(map: MapDef, layer: number): number {
  return Math.max(1, (map.tier - 1) * 9 + layer);
}

function enemyBattleFor(def: EnemyDef, level: number): BattleEnemyDef {
  const pattern = ENEMY_MOVE_PATTERNS[def.style] ?? ENEMY_MOVE_PATTERNS.gang;
  const moves: BattleEnemyMove[] = pattern.map((move, index) => ({
    ...move,
    id: `${def.id}_${index}`,
  }));
  const hp = 420 * (1 + 0.13 * (level - 1)) * def.hpMult;
  const attack = 58 * (1 + 0.10 * (level - 1)) * def.atkMult;
  const defense = (22 + 2.4 * (level - 1)) * def.defMult;
  const speed = (40 + 1.2 * (level - 1)) * def.speedMult;
  const phases: BattleEnemyPhase[] = def.boss
    ? [
        {
          name: "起势",
          threshold: 1,
          pattern: moves,
          announcement: "首领起势，招法一变",
        },
        {
          name: "怒势",
          threshold: 0.5,
          pattern: [...moves.slice(1), ...moves.slice(0, 1)],
          announcement: "首领怒意上涌，出手更狠",
        },
      ]
    : [{ name: "常态", threshold: 1, pattern: moves, announcement: "气势一变" }];
  return enemyBattleDef({
    id: def.id,
    name: def.name,
    style: def.style,
    element: def.element,
    level,
    hp,
    attack,
    defense,
    speed,
    pattern: moves,
    phases,
    damageCapPct: def.damageCapPct,
    reflectPct: def.reflectPct,
    enrageAt: def.boss ? 0.35 : undefined,
    enrageAttackPct: def.boss ? 0.2 : undefined,
  });
}

function rewardsFor(map: MapDef, layer: number, boss: boolean, rounds: number): { xp: number; silver: number; renown: number } {
  const sourceMult = boss ? 4.5 : layer >= 6 ? 1.4 : 1;
  const durationFactor = 1 + 0.004 * Math.max(0, rounds);
  const xp = Math.round(10 * (1 + 0.22 * map.tier) * (1 + 0.12 * layer) * sourceMult * durationFactor);
  const silver = Math.round(6 * (1 + 0.3 * map.tier) * (1 + 0.1 * layer) * sourceMult * durationFactor);
  const renown = boss ? 24 : layer >= 6 ? 3 : 1;
  return { xp, silver, renown };
}

function fightDuration(rounds: number, boss: boolean): number {
  return 18 + rounds * 2 + (boss ? 24 : 0);
}

export function simulateV1(options: SimV1Options): SimV1Result {
  const rng = new Rng(options.seed);
  const buildId = options.buildId;
  const kit = STARTER_KITS[buildId];
  const targetSeconds = options.hours * 3600;
  const snapshotHours = [...(options.snapshotHours ?? DEFAULT_SNAPSHOTS)].sort((a, b) => a - b);
  const aggressive = options.aggressive ?? true;
  let level = 1;
  let xp = 0;
  let silver = 0;
  let renown = 0;
  let mapIndex = 0;
  let layer = 1;
  let map = MAPS[0];
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
  let timeSeconds = 0;
  const snapshots: SimV1Snapshot[] = [];
  const realmTimes: Record<string, number | null> = { "0": 0 };
  const mapsCleared: string[] = [];
  const mapsVisited = new Set<string>();
  const notes: string[] = [];
  let snapshotIndex = 0;

  const currentMap = (): MapDef => MAPS[mapIndex] ?? MAPS[MAPS.length - 1];

  function snapshot(): SimV1Snapshot {
    return {
      hours: timeSeconds / 3600,
      level,
      realm: levelToRealm(level),
      layer,
      mapId: currentMap().id,
      mapLayer: map === currentMap() ? layer : 1,
      fights: totalFights,
      wins: totalWins,
      losses: totalLosses,
      winRate: totalFights > 0 ? totalWins / totalFights : 0,
      roundsAvg: totalFights > 0 ? totalRounds / totalFights : 0,
      xp,
      silver,
      renown,
      mapsCleared: mapsCleared.length,
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

  function makeFight(isBoss: boolean, enemyDef: EnemyDef): BattleResult {
    const enemyLevel = enemyLevelFor(currentMap(), layer);
    const enemy = enemyBattleFor(enemyDef, enemyLevel);
    const sheet = createBattleSheet(buildId, { level });
    return resolveBattle({
      player: {
        sheet,
        loadout: starterLoadoutFor(buildId),
        content: COMBAT_CONTENT,
      },
      enemy,
      objective: "clear",
      maxRounds: isBoss ? 30 : 30,
      seed: Math.floor(rng.next() * 0x7fffffff),
      captureEvents: false,
    });
  }

  // A simple but not suicidal bot: push layers after wins, retreat after losses.
  while (timeSeconds < targetSeconds) {
    map = currentMap();
    mapsVisited.add(map.id);
    const isBoss = layer >= 10;
    const enemyDef = isBoss ? getEnemy(map.bossId) : getEnemy(layer >= 8 && rng.chance(0.18) ? map.eliteId : rng.pick(map.enemyIds));
    const result = makeFight(isBoss, enemyDef);
    totalFights += 1;
    totalRounds += result.rounds;
    timeSeconds += fightDuration(result.rounds, isBoss);

    if (result.win) {
      totalWins += 1;
      winsInRow += 1;
      lossesInRow = 0;
      const reward = rewardsFor(map, layer, isBoss, result.rounds);
      gainXp(reward.xp);
      silver += reward.silver;
      renown += reward.renown;
      totalXp += reward.xp;
      totalSilver += reward.silver;
      totalRenown += reward.renown;

      if (isBoss) {
        if (!mapsCleared.includes(map.id)) mapsCleared.push(map.id);
        const nextMap = MAPS[mapIndex + 1];
        const nextRealm = levelToRealm(level);
        if (nextMap && nextMap.unlockRealm <= nextRealm) {
          mapIndex += 1;
          layer = 1;
          winsInRow = 0;
          notes.push(`${(timeSeconds / 3600).toFixed(1)}h：首通 ${map.name}，前往 ${nextMap.name}`);
        } else {
          // Farm the boss until the realm gate opens.
          layer = 10;
        }
      } else if (winsInRow >= (aggressive ? 2 : 3) && layer < 10) {
        layer += 1;
        winsInRow = 0;
      }
    } else {
      totalLosses += 1;
      winsInRow = 0;
      lossesInRow += 1;
      if (result.outcome === "timeout") timeoutLosses += 1;
      // A loss still teaches something: partial cultivation, no loot/silver.
      const consolation = Math.round(rewardsFor(map, layer, isBoss, result.rounds).xp * 0.3);
      gainXp(consolation);
      totalXp += consolation;
      if (layer > 1) layer = Math.max(1, layer - 1);
      else if (layer === 1 && mapIndex > 0 && lossesInRow >= 3) {
        mapIndex = Math.max(0, mapIndex - 1);
        layer = 9;
        lossesInRow = 0;
        notes.push(`${(timeSeconds / 3600).toFixed(1)}h：退回 ${currentMap().name} 练级`);
      }
    }
    maybeSnapshot();
  }

  snapshots.push(snapshot());
  const final = snapshots[snapshots.length - 1];
  if (notes.length > 40) notes.splice(0, notes.length - 40);
  return {
    buildId,
    buildName: kit.name,
    seed: options.seed,
    hours: timeSeconds / 3600,
    snapshots,
    final,
    realmTimes,
    mapsCleared,
    mapsVisited: [...mapsVisited],
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
