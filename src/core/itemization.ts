import type { BuildId } from "./types.ts";
import type { GearSlot } from "./types.ts";
import { GEAR_SLOTS } from "./types.ts";
import type { CombatMods, WeaponType } from "./combat-v1.ts";
import { Rng } from "./rng.ts";

// ---------------------------------------------------------------------------
// Itemization & Gear Agency v1
//
// One pure service: roll / score / equip / policy / salvage / refine / reforge.
// Combat consumes the resulting sheet/loadout, never item rules.
// ---------------------------------------------------------------------------

export type Rarity = "common" | "fine" | "superb" | "peerless" | "divine";
export type LootSource = "normal" | "elite" | "boss";
export type AutoEquipPolicy = "manual" | "emptyOnly" | "upgradeUnlocked";

export const RARITY_ORDER: Rarity[] = ["common", "fine", "superb", "peerless", "divine"];
export const RARITY_NAMES: Record<Rarity, string> = {
  common: "凡",
  fine: "良",
  superb: "上",
  peerless: "绝",
  divine: "神",
};
export const SLOT_NAMES: Record<GearSlot, string> = {
  weapon: "兵器",
  head: "头冠",
  body: "衣袍",
  wrist: "护腕",
  feet: "鞋履",
  jade: "玉佩",
};
export const AFFIX_COUNT: Record<Rarity, number> = {
  common: 1,
  fine: 2,
  superb: 3,
  peerless: 4,
  divine: 4,
};

export interface AffixDefV1 {
  id: string;
  name: string;
  stat: keyof CombatMods;
  slots: GearSlot[];
  kind: "pct" | "flat";
  /** Value at tier 1 before the seeded roll. */
  base: number;
}

export interface GearAffixV1 {
  defId: string;
  stat: keyof CombatMods;
  value: number;
  tier: number;
  label: string;
  kind: "pct" | "flat";
}

export interface GearMainStatV1 {
  stat: keyof CombatMods;
  value: number;
  label: string;
}

export interface GearItemV1 {
  id: string;
  name: string;
  slot: GearSlot;
  weaponType?: WeaponType | null;
  rarity: Rarity;
  tier: number;
  itemLevel: number;
  mainStat: GearMainStatV1;
  affixes: GearAffixV1[];
  setId?: string | null;
  legendaryId?: string | null;
  refine: number;
  locked?: boolean | null;
}

export interface SetDefV1 {
  id: string;
  name: string;
  buildId?: BuildId;
  region?: string;
  description: string;
  two: Partial<CombatMods>;
  four: Partial<CombatMods>;
}

export type LegendaryRule =
  | "guardInner"
  | "counter"
  | "lightCrit"
  | "poisonBurst"
  | "fengxueBoss"
  | "guardHeal"
  | "comboBreak"
  | "reflectGuard"
  | "innerSurge"
  | "firstStrike"
  | "lowHp"
  | "dotAmp"
  | "dispel"
  | "recovery"
  | "bossHunter";

export interface LegendaryDefV1 {
  id: string;
  name: string;
  description: string;
  slots: GearSlot[];
  effect: Partial<CombatMods>;
  rule: LegendaryRule;
}

export interface ItemizationContent {
  affixes: AffixDefV1[];
  sets: Record<string, SetDefV1>;
  legendaries: Record<string, LegendaryDefV1>;
  /** Slot identity for the guaranteed main stat. */
  mainStats: Record<GearSlot, keyof CombatMods>;
}

export interface SalvageFilter {
  /** Items below this rarity are auto-salvaged. */
  rarityFloor: Rarity;
  /** Item score floor; items below are auto-salvaged. */
  scoreFloor: number;
  /** Affix stat blacklist. */
  affixBlacklist: Array<keyof CombatMods>;
  /** Never auto-salvage locked or divine items, regardless of filters. */
  protectLocked: boolean;
}

export interface ItemizationState {
  inventory: Record<string, GearItemV1>;
  equipped: Record<GearSlot, string | null>;
  itemLocks: Record<string, true>;
  slotLocks: Partial<Record<GearSlot, true>>;
  bagCapacity: number;
  stashCapacity: number;
  overflow: string[];
  salvageFilter: SalvageFilter;
  reforgePity: Record<string, number>;
}

export interface RollInput {
  seed: number;
  source: LootSource;
  mapTier: number;
  layer: number;
  slot?: GearSlot;
  /** Force a rarity, used by first-clear divine guarantees and tests. */
  rarity?: Rarity;
  /** Set/legendary content selection context. */
  buildId?: BuildId;
  weaponType?: WeaponType;
  /** Divine can only be granted by an explicit source (first clear, etc.). */
  allowDivine?: boolean;
}

export interface ScoreContext {
  buildId: BuildId;
  requiredWeaponTypes?: WeaponType[];
  equipped?: Partial<Record<GearSlot, GearItemV1 | null>>;
}

export interface EquipContext {
  buildId: BuildId;
  requiredWeaponTypes: WeaponType[];
  scoreThreshold?: number;
}

export interface EquipResult {
  state: ItemizationState;
  equipped: boolean;
  itemId: string;
  replacedItemId: string | null;
  flagged: string[];
  reason: string;
}

export interface SalvageResult {
  state: ItemizationState;
  salvaged: boolean;
  itemId: string;
  materials: number;
  silver: number;
  reason: string;
}

export interface RefineResult {
  state: ItemizationState;
  refined: boolean;
  itemId: string;
  level: number;
  cost: { silver: number; materials: number };
  reason: string;
}

export interface ReforgeResult {
  state: ItemizationState;
  reforged: boolean;
  itemId: string;
  affixId: string;
  oldAffix: GearAffixV1 | null;
  newAffix: GearAffixV1 | null;
  cost: { silver: number; materials: number };
  reason: string;
}

export interface PresetRestoreResult {
  state: ItemizationState;
  complete: boolean;
  flagged: string[];
}

export interface ReceiveResult {
  state: ItemizationState;
  stored: boolean;
  salvaged: boolean;
  bagFull: boolean;
  item: GearItemV1;
  reason: string;
}

export interface ItemizationService {
  roll(input: RollInput): GearItemV1;
  score(item: GearItemV1, context: ScoreContext): number;
  itemMods(item: GearItemV1): Partial<CombatMods>;
  setMods(state: ItemizationState): Partial<CombatMods>;
  gearMods(state: ItemizationState): Partial<CombatMods>;
  weaponType(state: ItemizationState): WeaponType | null;
  addItem(state: ItemizationState, item: GearItemV1): ItemizationState;
  receive(state: ItemizationState, item: GearItemV1, context: EquipContext): ReceiveResult;
  equip(state: ItemizationState, itemId: string, context: EquipContext): EquipResult;
  unequip(state: ItemizationState, slot: GearSlot): ItemizationState;
  applyEquipPolicy(
    state: ItemizationState,
    item: GearItemV1,
    policy: AutoEquipPolicy,
    context: EquipContext,
  ): EquipResult;
  restoreEquipped(
    state: ItemizationState,
    equipped: Record<GearSlot, string | null>,
    context: EquipContext,
  ): PresetRestoreResult;
  salvage(state: ItemizationState, itemId: string, confirmed: boolean): SalvageResult;
  refine(state: ItemizationState, itemId: string): RefineResult;
  reforge(state: ItemizationState, itemId: string, affixId: string, seed: number, accept?: boolean): ReforgeResult;
  shouldAutosalvage(state: ItemizationState, item: GearItemV1, context: EquipContext): boolean;
  save(state: ItemizationState): string;
  load(serialized: string): ItemizationState;
}

export function createItemizationState(): ItemizationState {
  return {
    inventory: {},
    equipped: {
      weapon: null,
      head: null,
      body: null,
      wrist: null,
      feet: null,
      jade: null,
    },
    itemLocks: {},
    slotLocks: {},
    bagCapacity: 60,
    stashCapacity: 120,
    overflow: [],
    salvageFilter: {
      rarityFloor: "common",
      scoreFloor: -1e12,
      affixBlacklist: [],
      protectLocked: true,
    },
    reforgePity: {},
  };
}

export function rarityRank(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

export function itemTierFor(mapTier: number, layer: number): number {
  const bonus = layer >= 9 ? 1 : 0;
  return Math.max(1, Math.min(5, Math.max(1, mapTier) + bonus));
}

export function maxAffixTier(mapTier: number, layer: number): number {
  return Math.max(1, Math.min(5, 1 + Math.floor((mapTier - 1) / 1.25) + (layer >= 8 ? 1 : 0)));
}

export function dropChance(source: LootSource): number {
  return { normal: 0.08, elite: 0.22, boss: 0.65 }[source];
}

export function rarityWeights(source: LootSource, allowDivine = false): Array<[Rarity, number]> {
  if (source === "normal") {
    return [["common", 70], ["fine", 27], ["superb", 3], ["peerless", 0], ["divine", 0]];
  }
  if (source === "elite") {
    return [["common", 18], ["fine", 34], ["superb", 40], ["peerless", 7.5], ["divine", allowDivine ? 0.5 : 0]];
  }
  return [["common", 0], ["fine", 0], ["superb", 55], ["peerless", 40], ["divine", allowDivine ? 5 : 0]];
}

export function rollRarity(source: LootSource, rng: Rng, allowDivine = false): Rarity {
  const table = rarityWeights(source, allowDivine);
  return rng.weighted(table.map(([rarity]) => rarity), table.map(([, weight]) => weight));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function addMod(target: Partial<CombatMods>, key: keyof CombatMods, value: number): void {
  target[key] = (target[key] ?? 0) + value;
}

function affixValue(def: AffixDefV1, tier: number, rng: Rng): number {
  const tierScale = 1 + 0.32 * (tier - 1);
  const roll = 0.85 + rng.next() * 0.3;
  const value = def.base * tierScale * roll;
  return def.kind === "flat" ? Math.round(value * 10) / 10 : Math.round(value * 10000) / 10000;
}

function itemName(slot: GearSlot, rarity: Rarity, setId: string | undefined, setName: string | undefined, rng: Rng): string {
  const base: Record<GearSlot, string[]> = {
    weapon: ["青锋剑", "雁翎刀", "乌木拳套", "断水枪", "柳叶飞刀"],
    head: ["束发冠", "斗笠", "玉簪", "铁盔"],
    body: ["夜行衣", "云纹袍", "软猬甲", "道袍"],
    wrist: ["护腕", "缠手", "铁护臂", "布绑手"],
    feet: ["踏云靴", "草鞋", "快靴", "铁履"],
    jade: ["听雨佩", "平安扣", "古玉", "血玉"],
  };
  const chosen = base[slot][rng.int(0, base[slot].length - 1)];
  if (setId && setName) return `${RARITY_NAMES[rarity]}${setName}·${SLOT_NAMES[slot]}`;
  const suffix = ["", "", "·精", "·绝", "·神"][rarityRank(rarity)];
  return `${RARITY_NAMES[rarity]}${chosen}${suffix}`;
}

function weaponForSlot(slot: GearSlot, rng: Rng, forced?: WeaponType): WeaponType | undefined {
  if (slot !== "weapon") return undefined;
  if (forced) return forced;
  return rng.pick(["sword", "blade", "fist", "spear", "hidden"] as WeaponType[]);
}

function chooseAffixes(
  content: ItemizationContent,
  slot: GearSlot,
  count: number,
  maxTier: number,
  rng: Rng,
  forced?: string,
): GearAffixV1[] {
  const pool = content.affixes.filter((def) => def.slots.includes(slot));
  const selected: GearAffixV1[] = [];
  const usedStats = new Set<keyof CombatMods>();
  const candidates = rng.shuffle(pool);
  if (forced) {
    const forcedDef = pool.find((def) => def.id === forced);
    if (forcedDef) {
      const tier = Math.max(1, Math.min(maxTier, forcedDef.id === "af_innerRegen" ? maxTier : maxTier));
      selected.push({
        defId: forcedDef.id,
        stat: forcedDef.stat,
        value: affixValue(forcedDef, tier, rng),
        tier,
        label: forcedDef.name,
        kind: forcedDef.kind,
      });
      usedStats.add(forcedDef.stat);
    }
  }
  for (const def of candidates) {
    if (selected.length >= count) break;
    if (usedStats.has(def.stat)) continue;
    const tier = Math.max(1, Math.min(maxTier, 1 + rng.int(0, Math.max(0, maxTier - 1))));
    const entry: GearAffixV1 = {
      defId: def.id,
      stat: def.stat,
      value: affixValue(def, tier, rng),
      tier,
      label: def.name,
      kind: def.kind,
    };
    selected.push(entry);
    usedStats.add(def.stat);
  }
  return selected;
}

export function createItemization(content: ItemizationContent): ItemizationService {
  function roll(input: RollInput): GearItemV1 {
    const rng = new Rng(input.seed);
    let rarity = input.rarity ?? rollRarity(input.source, rng, input.allowDivine);
    if (rarity === "divine" && !input.allowDivine) rarity = "peerless";
    const slot = input.slot ?? rng.pick(GEAR_SLOTS);
    const tier = itemTierFor(input.mapTier, input.layer);
    const itemLevel = Math.max(1, input.mapTier * 10 + input.layer);
    const maxTier = maxAffixTier(input.mapTier, input.layer);
    const weaponType = weaponForSlot(slot, rng, input.weaponType);
    const mainStat = content.mainStats[slot];
    const mainDef = content.affixes.find((def) => def.stat === mainStat && def.slots.includes(slot));
    const mainValue = mainDef
      ? Math.round(mainDef.base * (1 + 0.32 * (tier - 1)) * (1 + 0.1 * rarityRank(rarity)) * 10000) / 10000
      : 0.02;
    const setId = rng.chance(input.source === "boss" ? 0.35 : input.source === "elite" ? 0.16 : 0.05)
      ? rng.pick(Object.keys(content.sets))
      : undefined;
    const legendaryId = rarity === "divine"
      ? rng.pick(Object.values(content.legendaries).filter((legendary) => legendary.slots.includes(slot)).map((legendary) => legendary.id))
      : undefined;
    const affixes = chooseAffixes(
      content,
      slot,
      AFFIX_COUNT[rarity],
      maxTier,
      rng,
      undefined,
    );
    const setName = setId ? content.sets[setId]?.name : undefined;
    return {
      id: `gear_${input.seed}_${Math.round(rng.next() * 1e9)}`,
      name: itemName(slot, rarity, setId, setName, rng),
      slot,
      weaponType: weaponType ?? null,
      rarity,
      tier,
      itemLevel,
      mainStat: {
        stat: mainStat,
        value: mainValue,
        label: content.affixes.find((def) => def.id === mainDef?.id)?.name ?? String(mainStat),
      },
      affixes,
      setId: setId ?? null,
      legendaryId: legendaryId ?? null,
      refine: 0,
      locked: false,
    };
  }

  function itemMods(item: GearItemV1): Partial<CombatMods> {
    const mods: Partial<CombatMods> = {};
    addMod(mods, item.mainStat.stat, item.mainStat.value);
    for (const affix of item.affixes) addMod(mods, affix.stat, affix.value);
    const legendary = item.legendaryId ? content.legendaries[item.legendaryId] : undefined;
    if (legendary) {
      for (const [key, value] of Object.entries(legendary.effect)) {
        if (typeof value === "number") addMod(mods, key as keyof CombatMods, value);
      }
    }
    // Refine adds base stats only: main stat + a small flat attack/defense/hp package.
    if (item.refine > 0) {
      addMod(mods, "hpPct", 0.01 * item.refine);
      addMod(mods, "attackPct", 0.008 * item.refine);
      addMod(mods, "defensePct", 0.008 * item.refine);
    }
    return mods;
  }

  function setMods(state: ItemizationState): Partial<CombatMods> {
    const counts = new Map<string, number>();
    for (const slot of GEAR_SLOTS) {
      const item = state.equipped[slot] ? state.inventory[state.equipped[slot]!] : undefined;
      if (!item?.setId) continue;
      counts.set(item.setId, (counts.get(item.setId) ?? 0) + 1);
    }
    const mods: Partial<CombatMods> = {};
    for (const [setId, count] of counts) {
      const set = content.sets[setId];
      if (!set) continue;
      if (count >= 2) {
        for (const [key, value] of Object.entries(set.two)) {
          if (typeof value === "number") addMod(mods, key as keyof CombatMods, value);
        }
      }
      if (count >= 4) {
        for (const [key, value] of Object.entries(set.four)) {
          if (typeof value === "number") addMod(mods, key as keyof CombatMods, value);
        }
      }
    }
    return mods;
  }

  function gearMods(state: ItemizationState): Partial<CombatMods> {
    const mods: Partial<CombatMods> = {};
    for (const slot of GEAR_SLOTS) {
      const id = state.equipped[slot];
      const item = id ? state.inventory[id] : undefined;
      if (!item) continue;
      for (const [key, value] of Object.entries(itemMods(item))) {
        if (typeof value === "number") addMod(mods, key as keyof CombatMods, value);
      }
    }
    for (const [key, value] of Object.entries(setMods(state))) {
      if (typeof value === "number") addMod(mods, key as keyof CombatMods, value);
    }
    return mods;
  }

  function score(item: GearItemV1, context: ScoreContext): number {
    const weights: Record<string, number> = {
      hpPct: 60,
      attackPct: 150,
      defensePct: 70,
      speedPct: 80,
      innerMaxPct: 40,
      innerRegen: 3,
      crit: 300,
      critDamage: 120,
      damagePct: 220,
      typeDamagePct: 180,
      guardReduction: 260,
      breakDamage: 160,
      comboDamage: 180,
      counterDamage: 220,
      statusHit: 140,
      statusResist: 120,
      damageReduction: 260,
      reflect: 200,
      healBonus: 100,
      lifesteal: 160,
      poisonDamage: 160,
      hit: 180,
      evade: 180,
    };
    const bonus: Record<BuildId, Partial<Record<keyof CombatMods, number>>> = {
      taiji: { guardReduction: 1.4, reflect: 1.5, damageReduction: 1.3, hpPct: 1.1, defensePct: 1.2 },
      pojun: { attackPct: 1.5, crit: 1.3, critDamage: 1.2, breakDamage: 1.2, speedPct: 0.7 },
      xuanyin: { statusHit: 1.4, poisonDamage: 1.5, speedPct: 0.9, comboDamage: 1.1 },
    };
    let total = item.tier * 4 + rarityRank(item.rarity) * 8;
    const add = (stat: keyof CombatMods, value: number) => {
      const weight = (weights[stat] ?? 20) * (bonus[context.buildId]?.[stat] ?? 1);
      total += value * weight;
    };
    add(item.mainStat.stat, item.mainStat.value);
    for (const affix of item.affixes) add(affix.stat, affix.value);
    if (item.setId) total += 12;
    if (item.legendaryId) total += 20;
    if (item.weaponType && context.requiredWeaponTypes && context.requiredWeaponTypes.length > 0
      && !context.requiredWeaponTypes.includes(item.weaponType)) {
      total -= 1000;
    }
    return Math.round(total * 100) / 100;
  }

  function compatible(item: GearItemV1, context: EquipContext): string[] {
    const flags: string[] = [];
    if (item.weaponType && context.requiredWeaponTypes.length > 0 && !context.requiredWeaponTypes.includes(item.weaponType)) {
      flags.push(`兵器和武学不兼容：${item.weaponType}`);
    }
    return flags;
  }

  function addItem(state: ItemizationState, item: GearItemV1): ItemizationState {
    const next = structuredClone(state);
    if (Object.keys(next.inventory).length < next.bagCapacity) {
      next.inventory[item.id] = item;
    } else if (next.overflow.length < next.stashCapacity) {
      next.overflow.push(item.id);
      next.inventory[item.id] = item;
    }
    return next;
  }

  function canAutoSalvage(state: ItemizationState, item: GearItemV1): boolean {
    const filter = state.salvageFilter;
    if (item.locked && filter.protectLocked) return false;
    if (item.rarity === "divine") return false;
    if (rarityRank(item.rarity) < rarityRank(filter.rarityFloor)) return true;
    if (item.affixes.some((affix) => filter.affixBlacklist.includes(affix.stat))) return true;
    return false;
  }

  function receive(state: ItemizationState, item: GearItemV1, context: EquipContext): ReceiveResult {
    let next = structuredClone(state);
    if (canAutoSalvage(next, item)) {
      return { state: next, stored: false, salvaged: true, bagFull: false, item, reason: "自动分解" };
    }
    if (Object.keys(next.inventory).length >= next.bagCapacity) {
      if ((item.rarity === "divine" || item.rarity === "peerless" || item.locked) && next.overflow.length < next.stashCapacity) {
        next = addItem(next, item);
        return { state: next, stored: true, salvaged: false, bagFull: true, item, reason: "背包已满，稀有物进入暂存" };
      }
      return { state: next, stored: false, salvaged: false, bagFull: true, item, reason: "背包已满" };
    }
    next = addItem(next, item);
    return { state: next, stored: true, salvaged: false, bagFull: false, item, reason: "已入行囊" };
  }

  function equip(state: ItemizationState, itemId: string, context: EquipContext): EquipResult {
    const next = structuredClone(state);
    const item = next.inventory[itemId];
    if (!item) return { state, equipped: false, itemId, replacedItemId: null, flagged: [], reason: "行囊中没有该装备" };
    if (next.slotLocks[item.slot]) {
      return { state, equipped: false, itemId, replacedItemId: null, flagged: [], reason: "该槽位已锁定" };
    }
    const flags = compatible(item, context);
    if (flags.length > 0) return { state, equipped: false, itemId, replacedItemId: null, flagged: flags, reason: flags[0] };
    const previous = next.equipped[item.slot];
    next.equipped[item.slot] = itemId;
    return { state: next, equipped: true, itemId, replacedItemId: previous, flagged: [], reason: "已装备" };
  }

  function unequip(state: ItemizationState, slot: GearSlot): ItemizationState {
    const next = structuredClone(state);
    next.equipped[slot] = null;
    return next;
  }

  function applyEquipPolicy(
    state: ItemizationState,
    item: GearItemV1,
    policy: AutoEquipPolicy,
    context: EquipContext,
  ): EquipResult {
    if (policy === "manual") {
      return { state, equipped: false, itemId: item.id, replacedItemId: null, flagged: [], reason: "手动策略" };
    }
    if (state.slotLocks[item.slot] || item.locked) {
      return { state, equipped: false, itemId: item.id, replacedItemId: null, flagged: [], reason: "槽位或装备已锁定" };
    }
    const flags = compatible(item, context);
    if (flags.length > 0) {
      return { state, equipped: false, itemId: item.id, replacedItemId: null, flagged: flags, reason: flags[0] };
    }
    const currentId = state.equipped[item.slot];
    if (policy === "emptyOnly" && currentId) {
      return { state, equipped: false, itemId: item.id, replacedItemId: null, flagged: [], reason: "槽位已有装备" };
    }
    if (policy === "upgradeUnlocked" && currentId) {
      const current = state.inventory[currentId];
      if (current) {
        const threshold = context.scoreThreshold ?? 0;
        const currentScore = score(current, { buildId: context.buildId, requiredWeaponTypes: context.requiredWeaponTypes });
        const candidateScore = score(item, { buildId: context.buildId, requiredWeaponTypes: context.requiredWeaponTypes });
        if (candidateScore < currentScore + threshold) {
          return { state, equipped: false, itemId: item.id, replacedItemId: null, flagged: [], reason: "评分未超过阈值" };
        }
      }
    }
    return equip(state, item.id, context);
  }

  function restoreEquipped(
    state: ItemizationState,
    equipped: Record<GearSlot, string | null>,
    context: EquipContext,
  ): PresetRestoreResult {
    const next = structuredClone(state);
    const flagged: string[] = [];
    for (const slot of GEAR_SLOTS) {
      const id = equipped[slot] ?? null;
      next.equipped[slot] = null;
      if (!id) continue;
      const item = next.inventory[id];
      if (!item) {
        flagged.push(`${SLOT_NAMES[slot]}缺失：${id}`);
        continue;
      }
      if (next.slotLocks[slot]) {
        flagged.push(`${SLOT_NAMES[slot]}已锁定，未套用 preset`);
        continue;
      }
      const flags = compatible(item, context);
      if (flags.length > 0) {
        flagged.push(...flags);
        continue;
      }
      next.equipped[slot] = id;
    }
    return { state: next, complete: flagged.length === 0, flagged };
  }

  function salvage(state: ItemizationState, itemId: string, confirmed: boolean): SalvageResult {
    const next = structuredClone(state);
    const item = next.inventory[itemId];
    if (!item) return { state, salvaged: false, itemId, materials: 0, silver: 0, reason: "行囊中没有该装备" };
    if ((item.locked || next.itemLocks[itemId]) && !confirmed) {
      return { state, salvaged: false, itemId, materials: 0, silver: 0, reason: "锁定装备需要确认" };
    }
    if (item.rarity === "divine" && !confirmed) {
      return { state, salvaged: false, itemId, materials: 0, silver: 0, reason: "神装需要确认" };
    }
    delete next.inventory[itemId];
    for (const slot of GEAR_SLOTS) if (next.equipped[slot] === itemId) next.equipped[slot] = null;
    next.overflow = next.overflow.filter((id) => id !== itemId);
    const materials = 1 + item.tier + rarityRank(item.rarity) * 2;
    const silver = 4 + item.tier * 3 + rarityRank(item.rarity) * 8;
    return { state: next, salvaged: true, itemId, materials, silver, reason: "已回收" };
  }

  function refine(state: ItemizationState, itemId: string): RefineResult {
    const next = structuredClone(state);
    const item = next.inventory[itemId];
    if (!item) return { state, refined: false, itemId, level: 0, cost: { silver: 0, materials: 0 }, reason: "行囊中没有该装备" };
    const maxRefine = Math.min(10, 5 + item.tier);
    const cost = {
      silver: Math.round(80 * Math.pow(1.36, item.refine) * (1 + item.tier * 0.2)),
      materials: 1 + Math.floor(item.refine / 3),
    };
    if (item.refine >= maxRefine) {
      return { state, refined: false, itemId, level: item.refine, cost: { silver: 0, materials: 0 }, reason: `已达淬炼上限 +${maxRefine}` };
    }
    item.refine += 1;
    return { state: next, refined: true, itemId, level: item.refine, cost, reason: "淬炼成功，不碎装" };
  }

  function reforge(
    state: ItemizationState,
    itemId: string,
    affixId: string,
    seed: number,
    accept = true,
  ): ReforgeResult {
    const next = structuredClone(state);
    const item = next.inventory[itemId];
    if (!item) return { state, reforged: false, itemId, affixId, oldAffix: null, newAffix: null, cost: { silver: 0, materials: 0 }, reason: "行囊中没有该装备" };
    const index = item.affixes.findIndex((affix) => affix.defId === affixId);
    if (index < 0) return { state, reforged: false, itemId, affixId, oldAffix: null, newAffix: null, cost: { silver: 0, materials: 0 }, reason: "没有该词条" };
    const oldAffix = item.affixes[index];
    const pity = (next.reforgePity[itemId] ?? 0) + 1;
    next.reforgePity[itemId] = pity;
    const rng = new Rng(seed);
    const def = content.affixes.find((entry) => entry.id === oldAffix.defId);
    if (!def) return { state, reforged: false, itemId, affixId, oldAffix, newAffix: null, cost: { silver: 0, materials: 0 }, reason: "未知词条定义" };
    const tier = oldAffix.tier;
    const value = affixValue(def, tier, rng);
    const newAffix: GearAffixV1 = { ...oldAffix, value };
    const cost = { silver: 120 + item.tier * 40, materials: 1 + item.tier };
    if (!accept) {
      return { state: next, reforged: false, itemId, affixId, oldAffix, newAffix, cost, reason: "保留旧词条" };
    }
    item.affixes[index] = newAffix;
    return { state: next, reforged: true, itemId, affixId, oldAffix, newAffix, cost, reason: "洗练成功" };
  }

  function shouldAutosalvage(state: ItemizationState, item: GearItemV1, _context: EquipContext): boolean {
    return canAutoSalvage(state, item);
  }

  function weaponType(state: ItemizationState): WeaponType | null {
    const id = state.equipped.weapon;
    return id ? state.inventory[id]?.weaponType ?? null : null;
  }

  function save(state: ItemizationState): string {
    return JSON.stringify(state);
  }

  function load(serialized: string): ItemizationState {
    const parsed = JSON.parse(serialized) as ItemizationState;
    return structuredClone(parsed);
  }

  return {
    roll,
    score,
    itemMods,
    setMods,
    gearMods,
    weaponType,
    addItem,
    receive,
    equip,
    unequip,
    applyEquipPolicy,
    restoreEquipped,
    salvage,
    refine,
    reforge,
    shouldAutosalvage,
    save,
    load,
  };
}

export function itemScoreSummary(item: GearItemV1): string {
  const affixes = item.affixes.map((affix) => {
    const value = affix.kind === "flat" ? affix.value.toFixed(1) : `${(affix.value * 100).toFixed(1)}%`;
    return `${affix.label}+${value}`;
  }).join("，");
  return `${item.name}（${SLOT_NAMES[item.slot]}·${RARITY_NAMES[item.rarity]}·T${item.tier}${affixes ? ` · ${affixes}` : ""}）`;
}

void clamp01;
