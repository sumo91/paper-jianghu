import type {
  BuildDef,
  CharacterState,
  CombatStats,
  GearItem,
  GearScore,
  GearSlot,
  StatMods,
  SheetBuild,
  SetDef,
} from "./types.ts";
import { GEAR_SLOTS, REALM_NAMES, addMods, emptyMods } from "./types.ts";
import { BUILD_SET_IDS, COMPANIONS, SETS } from "../data/arts.ts";
import { getBuild } from "../data/builds.ts";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function levelToRealm(level: number): number {
  return clamp(Math.floor((level - 1) / 9), 0, 6);
}

export function levelToLayer(level: number): number {
  return ((level - 1) % 9) + 1;
}

export function realmName(realm: number): string {
  return REALM_NAMES[clamp(realm, 0, REALM_NAMES.length - 1)];
}

export function isRealmCap(level: number): boolean {
  return level >= 63 || levelToLayer(level) === 9;
}

export function xpToNext(level: number): number {
  if (level >= 63) return Number.POSITIVE_INFINITY;
  if (level <= 18) return Math.round(100 * Math.pow(1.12, level - 1));
  return Math.round(200 * Math.pow(1.14, level - 1));
}

export function breakthroughRenownCost(realm: number): number {
  const costs = [120, 400, 1000, 2400, 5000, 10000];
  return costs[clamp(realm, 0, costs.length - 1)];
}

export function emptyGear(): Record<GearSlot, GearItem | null> {
  return {
    weapon: null,
    head: null,
    body: null,
    wrist: null,
    feet: null,
    jade: null,
  };
}

export function initialCharacter(buildId: string): CharacterState {
  const build = getBuild(buildId);
  return {
    buildId: build.id,
    level: 1,
    realm: 0,
    layer: 1,
    xp: 0,
    silver: 0,
    renown: 0,
    gear: emptyGear(),
    refineLevel: 0,
    companionBond: 1,
    innerArtLevel: 1,
    artMastery: 1,
  };
}

export function baseStatsAt(build: BuildDef, level: number, realm: number): CombatStats {
  const scale = 1 + 0.06 * realm;
  const hp = build.base.hp * (1 + build.growth.hpPct * (level - 1)) * scale;
  const attack = build.base.attack * (1 + build.growth.attackPct * (level - 1)) * scale;
  const defense = build.base.defense * (1 + build.growth.defensePct * (level - 1)) * scale;
  const speed = build.base.speed * (1 + build.growth.speedPct * (level - 1)) * (1 + 0.012 * realm);
  const innerMax = build.base.innerMax * (1 + 0.045 * (level - 1)) * (1 + 0.04 * realm);
  return {
    hp,
    attack,
    defense,
    speed,
    crit: build.base.crit,
    innerMax,
    innerRegen: build.base.innerRegen + 0.15 * (level - 1) + 0.5 * realm,
  };
}

const SCORE_WEIGHTS: Record<string, Partial<Record<keyof StatMods, number>>> = {
  taiji: {
    hpPct: 1.1,
    attackPct: 0.5,
    defensePct: 1.1,
    parryPct: 1.6,
    reflectPct: 1.5,
    damageReductionPct: 1.6,
    typeDamagePct: 0.8,
    damagePct: 0.7,
    speedPct: 0.35,
    crit: 0.45,
    innerMaxPct: 0.3,
    innerRegen: 0.1,
    lowHpDamageReductionPct: 0.8,
  },
  pojun: {
    attackPct: 1.5,
    crit: 1.25,
    damagePct: 1.2,
    armorBreakPct: 1.0,
    speedPct: 0.55,
    comboPct: 0.6,
    hpPct: 0.45,
    defensePct: 0.4,
    typeDamagePct: 0.7,
    innerMaxPct: 0.25,
    innerRegen: 0.1,
    lowHpAttackPct: 0.7,
  },
  xuanyin: {
    speedPct: 0.9,
    poisonPct: 1.5,
    controlPct: 1.1,
    comboPct: 0.8,
    attackPct: 0.8,
    crit: 0.6,
    damagePct: 0.7,
    innerMaxPct: 0.35,
    innerRegen: 0.15,
    hpPct: 0.35,
    typeDamagePct: 0.6,
  },
};

export function itemScore(buildId: string, item: GearItem): number {
  const weights = SCORE_WEIGHTS[buildId] ?? {};
  let score = item.tier * 1.5;
  for (const [key, value] of Object.entries(item.stats)) {
    if (typeof value !== "number") continue;
    const weight = weights[key as keyof StatMods] ?? 0;
    score += value * 100 * weight;
  }
  const rarityBonus = { common: 0, fine: 2, superb: 5, peerless: 9, divine: 14 }[item.rarity];
  return score + rarityBonus;
}

export function computeMods(character: CharacterState, build: BuildDef): StatMods {
  const mods = emptyMods();
  addMods(mods, build.passives);

  for (const heart of build.heartMethods) addMods(mods, heart.mods);
  for (const keystone of build.keystones) addMods(mods, keystone.mods);

  const companion = COMPANIONS[build.companionId];
  if (companion) {
    const bondScale = 1 + 0.06 * (character.companionBond - 1);
    for (const [key, value] of Object.entries(companion.mods)) {
      if (typeof value === "number") {
        mods[key as keyof StatMods] += value * bondScale;
      }
    }
  }

  for (const slot of GEAR_SLOTS) {
    const item = character.gear[slot];
    if (!item) continue;
    addMods(mods, item.stats);
  }

  // Set bonuses: 2 pieces and 4 pieces.
  const setCounts = new Map<string, number>();
  for (const slot of GEAR_SLOTS) {
    const setId = character.gear[slot]?.setId;
    if (!setId) continue;
    setCounts.set(setId, (setCounts.get(setId) ?? 0) + 1);
  }
  for (const [setId, count] of setCounts) {
    const set: SetDef | undefined = SETS[setId];
    if (!set) continue;
    if (count >= 2) addMods(mods, set.two);
    if (count >= 4) addMods(mods, set.four);
  }

  // Global refinement (v0.1 simplification of per-slot refinement).
  mods.hpPct += 0.015 * character.refineLevel;
  mods.attackPct += 0.015 * character.refineLevel;
  mods.defensePct += 0.015 * character.refineLevel;
  mods.damagePct += 0.0075 * character.refineLevel;

  // Inner art and art mastery levels.
  mods.typeDamagePct += 0.018 * character.innerArtLevel;
  mods.damagePct += 0.012 * character.artMastery;

  return mods;
}

export function computeSheet(character: CharacterState): SheetBuild {
  const build = getBuild(character.buildId);
  const base = baseStatsAt(build, character.level, character.realm);
  const mods = computeMods(character, build);

  const stats: CombatStats = {
    hp: Math.max(1, base.hp * (1 + mods.hpPct)),
    attack: Math.max(1, base.attack * (1 + mods.attackPct)),
    defense: Math.max(0, base.defense * (1 + mods.defensePct)),
    speed: Math.max(1, base.speed * (1 + mods.speedPct)),
    crit: clamp(base.crit + mods.crit, 0, 0.85),
    innerMax: Math.max(1, base.innerMax * (1 + mods.innerMaxPct)),
    innerRegen: Math.max(0, base.innerRegen + mods.innerRegen),
  };

  const gearScore = computeGearScore(character);
  return {
    build,
    stats,
    mods,
    moves: build.moves,
    ultimate: build.ultimate,
    companion: COMPANIONS[build.companionId],
    companionBond: character.companionBond,
    setPieces: countSetPieces(character),
    gearScore: gearScore.total,
  };
}

export function computeGearScore(character: CharacterState): GearScore {
  const bySlot = {} as Record<GearSlot, number>;
  let total = 0;
  for (const slot of GEAR_SLOTS) {
    const item = character.gear[slot];
    const score = item ? itemScore(character.buildId, item) : 0;
    bySlot[slot] = score;
    total += score;
  }
  return { total, bySlot };
}

export function countSetPieces(character: CharacterState): number {
  const setId = BUILD_SET_IDS[character.buildId];
  return GEAR_SLOTS.filter((slot) => character.gear[slot]?.setId === setId).length;
}

export function bestItemForSlot(character: CharacterState, item: GearItem): boolean {
  const current = character.gear[item.slot];
  if (!current) return true;
  return itemScore(character.buildId, item) > itemScore(character.buildId, current);
}

export function rarityRank(rarity: GearItem["rarity"]): number {
  return { common: 0, fine: 1, superb: 2, peerless: 3, divine: 4 }[rarity];
}

export function statSummary(stats: CombatStats): string {
  return `气血 ${Math.round(stats.hp)} / 攻击 ${Math.round(stats.attack)} / 防御 ${Math.round(stats.defense)} / 身法 ${Math.round(stats.speed)}`;
}
