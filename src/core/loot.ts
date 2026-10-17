import type {
  BuildId,
  GearItem,
  GearSlot,
  MapDef,
  Rarity,
  StatMods,
} from "./types.ts";
import { GEAR_SLOTS } from "./types.ts";
import { Rng } from "./rng.ts";
import { BUILD_SET_IDS, SETS } from "../data/arts.ts";

const RARITY_INDEX: Record<Rarity, number> = {
  common: 0,
  fine: 1,
  superb: 2,
  peerless: 3,
  divine: 4,
};

const RARITY_NAMES: Record<Rarity, string> = {
  common: "凡",
  fine: "良",
  superb: "上",
  peerless: "绝",
  divine: "神",
};

const SLOT_NAMES: Record<GearSlot, string> = {
  weapon: "兵器",
  head: "头冠",
  body: "衣袍",
  wrist: "护腕",
  feet: "鞋履",
  jade: "玉佩",
};

const WEAPON_NAMES = ["青锋剑", "雁翎刀", "铁骨扇", "断水枪", "乌木棍", "柳叶飞刀"];
const ARMOR_NAMES: Record<GearSlot, string[]> = {
  weapon: WEAPON_NAMES,
  head: ["束发冠", "斗笠", "玉簪", "铁盔"],
  body: ["夜行衣", "云纹袍", "软猬甲", "道袍"],
  wrist: ["护腕", "缠手", "铁护臂", "布绑手"],
  feet: ["踏云靴", "草鞋", "快靴", "铁履"],
  jade: ["听雨佩", "平安扣", "古玉", "血玉"],
};

const AFFIX_POOLS: Record<GearSlot, Array<keyof StatMods>> = {
  weapon: ["attackPct", "damagePct", "typeDamagePct", "crit", "armorBreakPct"],
  head: ["hpPct", "defensePct", "innerMaxPct", "damageReductionPct"],
  body: ["hpPct", "defensePct", "damageReductionPct", "parryPct"],
  wrist: ["attackPct", "crit", "comboPct", "speedPct", "armorBreakPct"],
  feet: ["speedPct", "comboPct", "parryPct", "controlPct"],
  jade: ["innerMaxPct", "typeDamagePct", "reflectPct", "poisonPct", "crit"],
};

const AFFIX_LABELS: Partial<Record<keyof StatMods, string>> = {
  hpPct: "气血",
  attackPct: "攻击",
  defensePct: "防御",
  speedPct: "身法",
  crit: "会心",
  innerMaxPct: "内力上限",
  innerRegen: "内力回复",
  damagePct: "伤害",
  typeDamagePct: "武学伤害",
  parryPct: "招架",
  reflectPct: "反伤",
  armorBreakPct: "破甲",
  poisonPct: "毒伤",
  controlPct: "控制",
  comboPct: "连招",
  damageReductionPct: "减伤",
};

export type LootSource = "normal" | "elite" | "boss";

export function dropChance(source: LootSource): number {
  return { normal: 0.06, elite: 0.18, boss: 0.55 }[source];
}

export function rarityWeights(source: LootSource): Array<[Rarity, number]> {
  if (source === "normal") {
    return [["common", 75], ["fine", 23], ["superb", 2], ["peerless", 0], ["divine", 0]];
  }
  if (source === "elite") {
    return [["common", 35], ["fine", 48], ["superb", 15], ["peerless", 1.8], ["divine", 0.2]];
  }
  return [["common", 0], ["fine", 25], ["superb", 60], ["peerless", 13.5], ["divine", 1.5]];
}

export function rollRarity(source: LootSource, rng: Rng): Rarity {
  const table = rarityWeights(source);
  return rng.weighted(table.map(([r]) => r), table.map(([, w]) => w));
}

export function generateItem(
  map: MapDef,
  layer: number,
  source: LootSource,
  buildId: BuildId,
  rng: Rng,
  forcedRarity?: Rarity,
): GearItem {
  let rarity = forcedRarity ?? rollRarity(source, rng);
  // v0.3: high-end gear is gated by content depth, not just luck.
  if (rarity === "divine" && !(source === "boss" && map.tier >= 5 && layer >= 9)) {
    rarity = "peerless";
  }
  if (rarity === "peerless" && map.tier < 3) {
    rarity = "superb";
  }
  const rarityIndex = RARITY_INDEX[rarity];
  const slot = rng.pick(GEAR_SLOTS);
  const tier = Math.min(6, map.tier + (layer >= 9 ? 1 : 0));
  const setChance = source === "boss" ? 0.25 : rarityIndex >= 2 ? 0.1 : 0.03;
  const isSet = rng.chance(setChance);
  const setId = isSet ? BUILD_SET_IDS[buildId] : undefined;
  const baseSet = setId ? SETS[setId] : undefined;

  const affixCount = Math.min(4, 1 + rarityIndex);
  const pool = [...AFFIX_POOLS[slot]];
  const stats: Partial<StatMods> = {};
  const chosen = rng.shuffle(pool).slice(0, affixCount);
  const powerBase = 0.010 + 0.006 * rarityIndex + 0.004 * tier;

  for (const key of chosen) {
    let value = powerBase * (0.8 + rng.next() * 0.5);
    if (key === "innerRegen") value = Math.round(value * 100) / 10;
    else if (key === "crit") value *= 0.55;
    else if (key === "speedPct") value *= 0.7;
    else if (key === "parryPct" || key === "reflectPct" || key === "damageReductionPct") value *= 0.65;
    // Round to 4 decimals for readability and deterministic output.
    stats[key] = Math.round(value * 10000) / 10000;
  }

  const rarityLabel = RARITY_NAMES[rarity];
  const name = baseSet
    ? `${baseSet.name}·${SLOT_NAMES[slot]}`
    : `${rng.pick(ARMOR_NAMES[slot])}`;
  const suffix = [
    "",
    "",
    "·精",
    "·绝",
    "·神",
  ][rarityIndex];

  return {
    id: `${map.id}-${layer}-${source}-${slot}-${rarity}-${Math.round(rng.next() * 1e9)}`,
    name: `${rarityLabel}${name}${suffix}`,
    slot,
    rarity,
    tier,
    stats,
    setId,
    legendary: rarity === "divine",
  };
}

export function salvageValue(item: GearItem): number {
  return 4 + item.tier * 3 + RARITY_INDEX[item.rarity] * 8;
}

export function describeItem(item: GearItem): string {
  const stats = Object.entries(item.stats)
    .map(([key, value]) => {
      if (typeof value !== "number") return "";
      const label = AFFIX_LABELS[key as keyof StatMods] ?? key;
      const isFlat = key === "innerRegen";
      return `${label}${isFlat ? "+" + value.toFixed(1) : "+" + (value * 100).toFixed(1) + "%"}`;
    })
    .filter(Boolean)
    .join("，");
  return `${item.name}（${stats}）`;
}
