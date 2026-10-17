import type { RegionId } from "./types.ts";
import type { BattleModifier, BattleEnemyMove, Element } from "./combat-v1.ts";
import { Rng } from "./rng.ts";

// ---------------------------------------------------------------------------
// World & Encounter v1 contract
//
// Content is data. Encounter generation, unlock checks, first clears, target
// pity and offline stop conditions are pure functions over that data.
// ---------------------------------------------------------------------------

export type EnemyRank = "normal" | "elite" | "boss";
export type BossKind = "map" | "chapter" | "final";
export type MapModifierTone = "upside" | "downside" | "mixed";

export interface RegionDefV1 {
  id: RegionId;
  name: string;
  chapterIndex: number;
  maps: string[];
  eliteAffixPool: string[];
  modifierPool: string[];
}

export interface EnemyUnitDefV1 {
  id: string;
  name: string;
  region: RegionId;
  style: "gang" | "rou" | "kuai" | "gui";
  element: Element;
  rank: "normal" | "elite";
  hpMult: number;
  atkMult: number;
  defMult: number;
  speedMult: number;
}

export interface BossDefV1 {
  id: string;
  name: string;
  region: RegionId;
  style: "gang" | "rou" | "kuai" | "gui";
  element: Element;
  kind: BossKind;
  tier: number;
  signature: string;
  phases: BattleEnemyPhaseV1[];
  hpMult: number;
  atkMult: number;
  defMult: number;
  speedMult: number;
  damageCapPct?: number;
  reflectPct?: number;
  enrageAt?: number;
}

export interface BattleEnemyPhaseV1 {
  name: string;
  threshold: number;
  announcement: string;
  pattern: BattleEnemyMove[];
}

export interface MapModifierDefV1 extends BattleModifier {
  tone: MapModifierTone;
  rewardPct?: number;
  eliteChanceBonus?: number;
}

export interface EliteAffixDefV1 extends BattleModifier {
  /** These affix pairs are not generated together. */
  forbiddenWith: string[];
  eliteChanceBonus?: number;
}

export interface TargetDropDefV1 {
  id: string;
  name: string;
  source: "normal" | "elite" | "boss";
  /** Base chance per eligible fight. */
  chance: number;
  /** Rolls after which soft pity begins. */
  pityThreshold: number;
  /** Added chance per roll beyond the threshold. */
  pityStep: number;
  /** Maximum chance after pity. */
  maxChance: number;
}

export interface FirstClearRewardV1 {
  renown: number;
  silver: number;
  targetDropId: string;
  unlockMapId: string | null;
  log: string;
}

export interface WorldMapDefV1 {
  id: string;
  name: string;
  region: RegionId;
  orderInRegion: 1 | 2 | 3;
  tier: number;
  unlockRealm: number;
  previousMapId: string | null;
  normalPool: string[];
  eliteIds: [string, string];
  bossId: string;
  modifiers: string[];
  targetDrops: string[];
  firstClear: FirstClearRewardV1;
}

export interface WorldContentV1 {
  regions: RegionDefV1[];
  maps: WorldMapDefV1[];
  normals: Record<string, EnemyUnitDefV1>;
  elites: Record<string, EnemyUnitDefV1>;
  bosses: Record<string, BossDefV1>;
  eliteAffixes: Record<string, EliteAffixDefV1>;
  mapModifiers: Record<string, MapModifierDefV1>;
  targetDrops: Record<string, TargetDropDefV1>;
  startingMapIds: string[];
  eliteAffixForbiddenPairs: Array<[string, string]>;
}

export type EncounterKind = "normal" | "elite" | "boss";

export interface EncounterDefV1 {
  mapId: string;
  layer: number;
  kind: EncounterKind;
  enemyIds: string[];
  eliteAffixIds: string[];
  modifierIds: string[];
  level: number;
  droptableId: string;
  firstClear?: FirstClearRewardV1;
}

export interface WorldValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export type MapUnlockReason =
  | "starting"
  | "unlocked"
  | "missing-previous"
  | "realm"
  | "chapter-bosses"
  | "unknown-map";

export interface MapUnlockState {
  ok: boolean;
  reason: MapUnlockReason;
  message: string;
}

export interface MapProgressV1 {
  highestClearedLayer: number;
  bossCleared: boolean;
  firstClearClaimed: boolean;
  wins: number;
  losses: number;
  eliteWins: number;
  bossAttempts: number;
  targetPity: Record<string, number>;
  targetClaimed: Record<string, true>;
}

export interface WorldProgressV1 {
  maps: Record<string, MapProgressV1>;
  chapterBossesCleared: string[];
  currentMapId: string;
  currentLayer: number;
}

export function emptyMapProgress(): MapProgressV1 {
  return {
    highestClearedLayer: 0,
    bossCleared: false,
    firstClearClaimed: false,
    wins: 0,
    losses: 0,
    eliteWins: 0,
    bossAttempts: 0,
    targetPity: {},
    targetClaimed: {},
  };
}

export function createWorldProgress(content: WorldContentV1, currentMapId?: string): WorldProgressV1 {
  const maps: Record<string, MapProgressV1> = {};
  for (const map of content.maps) maps[map.id] = emptyMapProgress();
  return {
    maps,
    chapterBossesCleared: [],
    currentMapId: currentMapId ?? content.startingMapIds[0],
    currentLayer: 1,
  };
}

export function mapProgress(state: WorldProgressV1, mapId: string): MapProgressV1 {
  return state.maps[mapId] ?? emptyMapProgress();
}

export function recommendedRealmFor(map: WorldMapDefV1): number {
  return Math.max(0, Math.min(6, map.tier - 1));
}

/** Level rises monotonically inside a map: 1..10. */
export function levelForLayer(map: WorldMapDefV1, layer: number): number {
  return Math.max(1, (map.tier - 1) * 7 + layer + (map.orderInRegion - 1) * 2);
}

export function dangerFor(map: WorldMapDefV1, layer: number): number {
  return Math.max(1, levelForLayer(map, layer) - recommendedRealmFor(map) * 9);
}

export function eliteChanceFor(map: WorldMapDefV1, layer: number, bonus = 0): number {
  if (layer >= 10) return 0;
  const base = 0.06 + 0.018 * layer + 0.025 * (map.tier - 1);
  return Math.max(0, Math.min(0.65, base + bonus));
}

export function groupSizeFor(map: WorldMapDefV1, layer: number): number {
  if (layer >= 10) return 1;
  const number = 1 + Math.floor((layer - 1) / 3) + (map.tier >= 3 ? 1 : 0);
  return Math.max(1, Math.min(3, number));
}

function hashSeed(seed: number, mapId: string, layer: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < mapId.length; i += 1) {
    hash = (Math.imul(hash, 31) + mapId.charCodeAt(i)) >>> 0;
  }
  hash = (Math.imul(hash, 31) + layer) >>> 0;
  return hash || 1;
}

function drawAffixes(
  content: WorldContentV1,
  pool: string[],
  count: number,
  rng: Rng,
): string[] {
  const selected: string[] = [];
  const candidates = rng.shuffle(pool.filter((id) => content.eliteAffixes[id]));
  for (const id of candidates) {
    if (selected.length >= count) break;
    const forbidden = selected.some((picked) => {
      const def = content.eliteAffixes[picked];
      const other = content.eliteAffixes[id];
      return def?.forbiddenWith.includes(id)
        || other?.forbiddenWith.includes(picked)
        || content.eliteAffixForbiddenPairs.some(([a, b]) => (a === picked && b === id) || (a === id && b === picked));
    });
    if (!forbidden) selected.push(id);
  }
  return selected;
}

export function generateEncounter(
  content: WorldContentV1,
  mapId: string,
  layer: number,
  seed: number,
  progress?: WorldProgressV1,
): EncounterDefV1 {
  const map = content.maps.find((entry) => entry.id === mapId);
  if (!map) throw new Error(`Unknown map: ${mapId}`);
  if (!Number.isInteger(layer) || layer < 1 || layer > 10) throw new Error(`Invalid layer: ${layer}`);
  const rng = new Rng(hashSeed(seed, mapId, layer));
  const modifierIds = [...map.modifiers];
  const level = levelForLayer(map, layer);
  if (layer === 10) {
    const boss = content.bosses[map.bossId];
    if (!boss) throw new Error(`Unknown boss: ${map.bossId}`);
    const claimed = progress ? mapProgress(progress, mapId).firstClearClaimed : false;
    return {
      mapId,
      layer,
      kind: "boss",
      enemyIds: [boss.id],
      eliteAffixIds: [],
      modifierIds,
      level,
      droptableId: `${mapId}:boss`,
      firstClear: claimed ? undefined : map.firstClear,
    };
  }

  const eliteBonus = map.modifiers.reduce(
    (sum, id) => sum + (content.mapModifiers[id]?.eliteChanceBonus ?? 0),
    0,
  );
  const isElite = rng.chance(eliteChanceFor(map, layer, eliteBonus));
  const count = groupSizeFor(map, layer);
  const pool = rng.shuffle([...map.normalPool]);
  const enemyIds: string[] = [];
  if (isElite) {
    enemyIds.push(rng.pick(map.eliteIds));
    while (enemyIds.length < count && pool.length > 0) enemyIds.push(pool.shift()!);
  } else {
    while (enemyIds.length < count && pool.length > 0) enemyIds.push(pool.shift()!);
  }
  if (enemyIds.length === 0) enemyIds.push(map.normalPool[0]);
  const affixCount = isElite ? (map.tier >= 3 ? 2 : 1) : 0;
  const eliteAffixIds = isElite
    ? drawAffixes(content, content.regions.find((region) => region.id === map.region)?.eliteAffixPool ?? [], affixCount, rng)
    : [];
  return {
    mapId,
    layer,
    kind: isElite ? "elite" : "normal",
    enemyIds,
    eliteAffixIds,
    modifierIds,
    level,
    droptableId: `${mapId}:${isElite ? "elite" : "normal"}`,
  };
}

export function nextUnlockFor(content: WorldContentV1, mapId: string): string | null {
  return content.maps.find((map) => map.previousMapId === mapId)?.id ?? null;
}

export function canEnterMap(
  content: WorldContentV1,
  progress: WorldProgressV1,
  mapId: string,
  realm: number,
): MapUnlockState {
  const map = content.maps.find((entry) => entry.id === mapId);
  if (!map) return { ok: false, reason: "unknown-map", message: `未知地图：${mapId}` };
  if (content.startingMapIds.includes(map.id)) {
    return { ok: true, reason: "starting", message: `起始地图：${map.name}` };
  }
  if (realm < map.unlockRealm) {
    return { ok: false, reason: "realm", message: `需要境界 ${map.unlockRealm}，当前 ${realm}` };
  }
  if (map.previousMapId) {
    const previous = mapProgress(progress, map.previousMapId);
    if (!previous.bossCleared) {
      const previousMap = content.maps.find((entry) => entry.id === map.previousMapId);
      return {
        ok: false,
        reason: "missing-previous",
        message: `需先首通 ${previousMap?.name ?? map.previousMapId} 的第 10 层首领`,
      };
    }
  }
  const boss = content.bosses[map.bossId];
  if (boss?.kind === "final") {
    const chapterBosses = content.bosses;
    const required = Object.values(chapterBosses)
      .filter((entry) => entry.kind === "chapter")
      .map((entry) => entry.id);
    const missing = required.filter((id) => !progress.chapterBossesCleared.includes(id));
    if (missing.length > 0) {
      return { ok: false, reason: "chapter-bosses", message: `终局地图还需击败 ${missing.length} 位章节首领` };
    }
  }
  return { ok: true, reason: "unlocked", message: `已解锁：${map.name}` };
}

export interface FirstClearResultV1 {
  progress: WorldProgressV1;
  granted: boolean;
  reward?: FirstClearRewardV1;
  unlockedMapId: string | null;
}

export function recordMapClear(
  content: WorldContentV1,
  progress: WorldProgressV1,
  mapId: string,
  layer: number,
): FirstClearResultV1 {
  const map = content.maps.find((entry) => entry.id === mapId);
  if (!map) throw new Error(`Unknown map: ${mapId}`);
  const next = structuredClone(progress);
  const entry = next.maps[mapId] ?? emptyMapProgress();
  next.maps[mapId] = entry;
  entry.wins += 1;
  entry.highestClearedLayer = Math.max(entry.highestClearedLayer, layer);
  const boss = content.bosses[map.bossId];
  let granted = false;
  let reward: FirstClearRewardV1 | undefined;
  if (layer >= 10) {
    entry.bossAttempts += 1;
    entry.bossCleared = true;
    if (boss && !entry.firstClearClaimed) {
      entry.firstClearClaimed = true;
      granted = true;
      reward = map.firstClear;
      // The first-clear signature drop is guaranteed and consumes the target.
      entry.targetClaimed[map.firstClear.targetDropId] = true;
      if (boss.kind === "chapter" && !next.chapterBossesCleared.includes(boss.id)) {
        next.chapterBossesCleared.push(boss.id);
      }
    }
  }
  return {
    progress: next,
    granted,
    reward,
    unlockedMapId: granted ? nextUnlockFor(content, mapId) : null,
  };
}

export function recordMapLoss(progress: WorldProgressV1, mapId: string, layer: number): WorldProgressV1 {
  const next = structuredClone(progress);
  const entry = next.maps[mapId] ?? emptyMapProgress();
  next.maps[mapId] = entry;
  entry.losses += 1;
  if (layer >= 10) entry.bossAttempts += 1;
  return next;
}

// ---------------------------------------------------------------------------
// Target drops and pity
// ---------------------------------------------------------------------------

export interface TargetRollResult {
  dropped: boolean;
  chance: number;
  nextCounter: number;
}

export function targetPityChance(target: TargetDropDefV1, counter: number): number {
  if (counter < target.pityThreshold) return target.chance;
  const extra = (counter - target.pityThreshold + 1) * target.pityStep;
  return Math.min(target.maxChance, target.chance + extra);
}

export function rollTargetDrop(target: TargetDropDefV1, counter: number, rng: Rng): TargetRollResult {
  const chance = targetPityChance(target, counter);
  const dropped = rng.chance(chance);
  return {
    dropped,
    chance,
    nextCounter: dropped ? 0 : counter + 1,
  };
}

export function eligibleTargets(
  content: WorldContentV1,
  mapId: string,
  source: "normal" | "elite" | "boss",
): TargetDropDefV1[] {
  const map = content.maps.find((entry) => entry.id === mapId);
  if (!map) return [];
  return map.targetDrops
    .map((id) => content.targetDrops[id])
    .filter((target): target is TargetDropDefV1 => Boolean(target))
    .filter((target) => target.source === source);
}

export interface TargetAward {
  progress: WorldProgressV1;
  awarded: TargetDropDefV1[];
}

export function rollTargetsForEncounter(
  content: WorldContentV1,
  progress: WorldProgressV1,
  mapId: string,
  source: "normal" | "elite" | "boss",
  seed: number,
): TargetAward {
  const rng = new Rng(seed);
  const next = structuredClone(progress);
  const map = next.maps[mapId] ?? emptyMapProgress();
  next.maps[mapId] = map;
  const awarded: TargetDropDefV1[] = [];
  for (const target of eligibleTargets(content, mapId, source)) {
    if (map.targetClaimed[target.id]) continue;
    const counter = map.targetPity[target.id] ?? 0;
    const roll = rollTargetDrop(target, counter, rng);
    map.targetPity[target.id] = roll.nextCounter;
    if (roll.dropped) {
      map.targetClaimed[target.id] = true;
      awarded.push(target);
    }
  }
  return { progress: next, awarded };
}

// ---------------------------------------------------------------------------
// Stop conditions and offline progression
// ---------------------------------------------------------------------------

export type StopCondition =
  | "bossFailure"
  | "targetDrop"
  | "bagFull"
  | "rareDrop"
  | "timeLimit"
  | "manual";

export interface StopCheckInput {
  win: boolean;
  boss: boolean;
  targetDrop: boolean;
  rareDrop: boolean;
  bagFull: boolean;
  manual: boolean;
  elapsedHours: number;
  timeLimitHours?: number;
}

export interface StopDecision {
  stop: boolean;
  condition?: StopCondition;
}

export function shouldStop(conditions: StopCondition[], input: StopCheckInput): StopDecision {
  for (const condition of conditions) {
    if (condition === "bossFailure" && !input.win && input.boss) return { stop: true, condition };
    if (condition === "targetDrop" && input.targetDrop) return { stop: true, condition };
    if (condition === "bagFull" && input.bagFull) return { stop: true, condition };
    if (condition === "rareDrop" && input.rareDrop) return { stop: true, condition };
    if (condition === "manual" && input.manual) return { stop: true, condition };
    if (condition === "timeLimit" && input.timeLimitHours !== undefined && input.elapsedHours >= input.timeLimitHours) {
      return { stop: true, condition };
    }
  }
  return { stop: false };
}

export interface OfflineFight {
  win: boolean;
  boss: boolean;
  targetDrop?: boolean;
  rareDrop?: boolean;
  bagFull?: boolean;
}

export interface OfflineAdvanceInput {
  content: WorldContentV1;
  progress: WorldProgressV1;
  mapId: string;
  hours: number;
  fightsPerHour: number;
  stopConditions: StopCondition[];
  timeLimitHours?: number;
  fight: (layer: number, index: number) => OfflineFight;
}

export interface OfflineAdvanceResult {
  mapId: string;
  startLayer: number;
  endLayer: number;
  hoursUsed: number;
  fights: number;
  wins: number;
  losses: number;
  stoppedBy: StopCondition | null;
  progress: WorldProgressV1;
  changedMap: false;
}

/**
 * Offline only advances the current map. It never travels, never changes
 * loadout, and never re-claims first-clear rewards.
 */
export function advanceOffline(input: OfflineAdvanceInput): OfflineAdvanceResult {
  const map = input.content.maps.find((entry) => entry.id === input.mapId);
  if (!map) throw new Error(`Unknown map: ${input.mapId}`);
  const startLayer = input.progress.currentLayer;
  let layer = startLayer;
  let progress = structuredClone(input.progress);
  progress.currentMapId = input.mapId;
  let fights = 0;
  let wins = 0;
  let losses = 0;
  let hoursUsed = 0;
  let stoppedBy: StopCondition | null = null;
  const maxFights = Math.max(0, Math.floor(input.hours * input.fightsPerHour));
  const hoursPerFight = input.fightsPerHour > 0 ? 1 / input.fightsPerHour : input.hours;

  for (let index = 0; index < maxFights; index += 1) {
    if (input.hours - hoursUsed < hoursPerFight - 1e-9) break;
    const fight = input.fight(layer, index);
    fights += 1;
    hoursUsed += hoursPerFight;
    if (fight.win) {
      wins += 1;
      const clear = recordMapClear(input.content, progress, input.mapId, layer);
      progress = clear.progress;
      if (fight.boss) {
        // Stay on the boss layer. Unlock is explicit, never automatic during offline.
        layer = 10;
      } else if (layer < 10) {
        layer = Math.min(10, layer + 1);
      }
    } else {
      losses += 1;
      progress = recordMapLoss(progress, input.mapId, layer);
      if (fight.boss) {
        // Boss failure always halts offline progression; it never travels or
        // auto-retries into a different map.
        stoppedBy = "bossFailure";
        break;
      } else {
        layer = Math.max(1, layer - 1);
      }
    }
    const decision = shouldStop(input.stopConditions, {
      win: fight.win,
      boss: fight.boss,
      targetDrop: Boolean(fight.targetDrop),
      rareDrop: Boolean(fight.rareDrop),
      bagFull: Boolean(fight.bagFull),
      manual: false,
      elapsedHours: hoursUsed,
      timeLimitHours: input.timeLimitHours,
    });
    if (decision.stop) {
      stoppedBy = decision.condition ?? null;
      break;
    }
  }
  progress.currentLayer = layer;
  return {
    mapId: input.mapId,
    startLayer,
    endLayer: layer,
    hoursUsed,
    fights,
    wins,
    losses,
    stoppedBy,
    progress,
    changedMap: false,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateWorldContent(content: WorldContentV1): WorldValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mapIds = new Set(content.maps.map((map) => map.id));
  if (content.regions.length !== 5) errors.push(`必须恰好 5 个地区，当前 ${content.regions.length}`);
  if (content.maps.length !== 15) errors.push(`必须恰好 15 张地图，当前 ${content.maps.length}`);
  if (Object.keys(content.normals).length < 30) errors.push(`普通怪至少 30 种，当前 ${Object.keys(content.normals).length}`);
  if (Object.keys(content.elites).length < 10) errors.push(`精英至少 10 种，当前 ${Object.keys(content.elites).length}`);
  if (Object.keys(content.bosses).length !== 15) errors.push(`必须恰好 15 个首领，当前 ${Object.keys(content.bosses).length}`);
  if (Object.keys(content.eliteAffixes).length !== 10) errors.push(`必须恰好 10 个精英词缀，当前 ${Object.keys(content.eliteAffixes).length}`);

  const startIds = new Set(content.startingMapIds);
  if (startIds.size === 0) errors.push("至少需要一张起始地图");
  for (const start of startIds) if (!mapIds.has(start)) errors.push(`起始地图不存在：${start}`);

  const chapter = Object.values(content.bosses).filter((boss) => boss.kind === "chapter").length;
  const final = Object.values(content.bosses).filter((boss) => boss.kind === "final").length;
  const normalBosses = Object.values(content.bosses).filter((boss) => boss.kind === "map").length;
  if (chapter !== 5) errors.push(`章节首领必须恰好 5 个，当前 ${chapter}`);
  if (final !== 1) errors.push(`终局首领必须恰好 1 个，当前 ${final}`);
  if (normalBosses !== 9) errors.push(`地图级首领必须恰好 9 个，当前 ${normalBosses}`);

  const regionNames = new Set<RegionId>();
  for (const region of content.regions) {
    if (regionNames.has(region.id)) errors.push(`地区重复：${region.id}`);
    regionNames.add(region.id);
    if (region.maps.length !== 3) errors.push(`地区 ${region.name} 必须有 3 张地图，当前 ${region.maps.length}`);
    for (const id of region.maps) if (!mapIds.has(id)) errors.push(`地区 ${region.name} 引用了未知地图：${id}`);
    for (const id of region.eliteAffixPool) {
      if (!content.eliteAffixes[id]) errors.push(`地区 ${region.name} 引用了未知精英词缀：${id}`);
    }
    for (const id of region.modifierPool) {
      if (!content.mapModifiers[id]) errors.push(`地区 ${region.name} 引用了未知地图词缀：${id}`);
    }
  }

  const previousEdges = new Map<string, string | null>();
  for (const map of content.maps) {
    if (map.normalPool.length < 4 || map.normalPool.length > 6) {
      errors.push(`${map.name} 普通怪池必须 4–6 种，当前 ${map.normalPool.length}`);
    }
    if (map.eliteIds.length !== 2) errors.push(`${map.name} 必须恰好 2 种精英`);
    if (new Set(map.eliteIds).size !== 2) errors.push(`${map.name} 精英不能重复`);
    for (const id of map.normalPool) if (!content.normals[id]) errors.push(`${map.name} 引用未知普通怪：${id}`);
    for (const id of map.eliteIds) if (!content.elites[id]) errors.push(`${map.name} 引用未知精英：${id}`);
    if (!content.bosses[map.bossId]) errors.push(`${map.name} 引用未知首领：${map.bossId}`);
    if (map.modifiers.length < 2 || map.modifiers.length > 3) {
      errors.push(`${map.name} 必须有 2–3 个地图词缀，当前 ${map.modifiers.length}`);
    }
    const tones = map.modifiers.map((id) => content.mapModifiers[id]?.tone).filter(Boolean);
    if (!tones.some((tone) => tone === "upside" || tone === "mixed")) errors.push(`${map.name} 缺少增益向词缀`);
    if (!tones.some((tone) => tone === "downside" || tone === "mixed")) errors.push(`${map.name} 缺少代价/约束向词缀`);
    if (map.targetDrops.length < 2 || map.targetDrops.length > 3) {
      errors.push(`${map.name} 必须有 2–3 个目标掉落，当前 ${map.targetDrops.length}`);
    }
    for (const id of map.targetDrops) if (!content.targetDrops[id]) errors.push(`${map.name} 引用未知目标掉落：${id}`);
    if (!content.targetDrops[map.firstClear.targetDropId]) {
      errors.push(`${map.name} 首通目标掉落不存在：${map.firstClear.targetDropId}`);
    }
    if (map.firstClear.unlockMapId && !mapIds.has(map.firstClear.unlockMapId)) {
      errors.push(`${map.name} 首通解锁了未知地图：${map.firstClear.unlockMapId}`);
    }
    if (map.previousMapId) {
      if (!mapIds.has(map.previousMapId)) errors.push(`${map.name} 的前置地图不存在：${map.previousMapId}`);
      if (map.previousMapId === map.id) errors.push(`${map.name} 不能以自己为前置`);
    } else if (!startIds.has(map.id)) {
      errors.push(`${map.name} 既不是起始地图，也没有前置地图`);
    }
    previousEdges.set(map.id, map.previousMapId);
  }

  // Reachability and cycle detection.
  const reachable = new Set<string>(content.startingMapIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const map of content.maps) {
      if (reachable.has(map.id)) continue;
      if (map.previousMapId && reachable.has(map.previousMapId)) {
        reachable.add(map.id);
        changed = true;
      }
    }
  }
  for (const map of content.maps) {
    if (!reachable.has(map.id)) errors.push(`${map.name} 不可达`);
  }
  for (const map of content.maps) {
    const seen = new Set<string>();
    let cursor: string | null | undefined = map.id;
    while (cursor) {
      if (seen.has(cursor)) {
        errors.push(`解锁链存在环：${cursor}`);
        break;
      }
      seen.add(cursor);
      cursor = previousEdges.get(cursor);
    }
  }

  const mapBossIds = new Set(content.maps.map((map) => map.bossId));
  for (const bossId of mapBossIds) {
    if (!content.bosses[bossId]) errors.push(`地图首领不存在：${bossId}`);
  }
  for (const boss of Object.values(content.bosses)) {
    if (boss.phases.length < 2 || boss.phases.length > 3) {
      errors.push(`${boss.name} 必须有 2–3 个阶段，当前 ${boss.phases.length}`);
    }
    let lastThreshold = 1.01;
    for (const phase of boss.phases) {
      if (phase.pattern.length === 0) errors.push(`${boss.name} 的阶段 ${phase.name} 没有意图`);
      if (phase.threshold > lastThreshold) errors.push(`${boss.name} 的阶段阈值必须递减`);
      lastThreshold = phase.threshold;
    }
    if (boss.phases[0]?.threshold !== 1) errors.push(`${boss.name} 第一阶段阈值必须为 1`);
  }

  for (const affix of Object.values(content.eliteAffixes)) {
    for (const pair of affix.forbiddenWith) {
      if (!content.eliteAffixes[pair]) errors.push(`精英词缀 ${affix.id} 引用了未知禁用对：${pair}`);
    }
  }
  for (const [a, b] of content.eliteAffixForbiddenPairs) {
    if (!content.eliteAffixes[a]) errors.push(`禁用词缀对引用了未知词缀：${a}`);
    if (!content.eliteAffixes[b]) errors.push(`禁用词缀对引用了未知词缀：${b}`);
  }
  for (const modifier of Object.values(content.mapModifiers)) {
    if (!modifier.description) warnings.push(`地图词缀 ${modifier.id} 缺少说明`);
  }

  return { ok: errors.length === 0, errors, warnings };
}
