import type { BuildId, GearSlot } from "../core/types.ts";
import { GEAR_SLOTS } from "../core/types.ts";
import type {
  AffixDefV1,
  GearAffixV1,
  GearItemV1,
  ItemizationContent,
  LegendaryDefV1,
  SetDefV1,
} from "../core/itemization.ts";
import { RARITY_NAMES } from "../core/itemization.ts";
import type { CombatMods, Loadout, WeaponType } from "../core/combat-v1.ts";
import { STARTER_GEAR } from "./combat-v1.ts";
import { COMBAT_CONTENT } from "./combat-v1.ts";

function affix(
  id: string,
  name: string,
  stat: keyof CombatMods,
  slots: GearSlot[],
  kind: "pct" | "flat",
  base: number,
): AffixDefV1 {
  return { id, name, stat, slots, kind, base };
}

export const AFFIXES_V1: AffixDefV1[] = [
  affix("af_attack", "攻击", "attackPct", ["weapon", "wrist"], "pct", 0.02),
  affix("af_hp", "气血", "hpPct", ["head", "body"], "pct", 0.03),
  affix("af_defense", "防御", "defensePct", ["head", "body", "feet"], "pct", 0.03),
  affix("af_speed", "身法", "speedPct", ["wrist", "feet"], "pct", 0.02),
  affix("af_innerMax", "内力上限", "innerMaxPct", ["head", "jade"], "pct", 0.03),
  affix("af_crit", "会心", "crit", ["weapon", "wrist", "jade"], "pct", 0.012),
  affix("af_critDamage", "会心伤害", "critDamage", ["weapon", "jade"], "pct", 0.05),
  affix("af_damagePct", "伤害", "damagePct", ["weapon", "jade"], "pct", 0.018),
  affix("af_typeDamage", "武学伤害", "typeDamagePct", ["weapon", "jade"], "pct", 0.022),
  affix("af_guard", "招架减伤", "guardReduction", ["body", "feet"], "pct", 0.015),
  affix("af_break", "破招增伤", "breakDamage", ["weapon", "wrist"], "pct", 0.02),
  affix("af_combo", "连招增伤", "comboDamage", ["wrist", "feet"], "pct", 0.02),
  affix("af_counter", "反击增伤", "counterDamage", ["weapon", "wrist"], "pct", 0.03),
  affix("af_statusHit", "状态命中", "statusHit", ["wrist", "jade"], "pct", 0.02),
  affix("af_statusResist", "状态抵抗", "statusResist", ["head", "jade"], "pct", 0.02),
  affix("af_damageReduction", "伤害减免", "damageReduction", ["head", "body"], "pct", 0.01),
  affix("af_innerRegen", "内力回复", "innerRegen", ["jade"], "flat", 1.5),
  affix("af_reflect", "反伤", "reflect", ["body", "jade"], "pct", 0.02),
  affix("af_healBonus", "治疗加成", "healBonus", ["head", "jade"], "pct", 0.03),
  affix("af_lifesteal", "吸血", "lifesteal", ["weapon", "jade"], "pct", 0.01),
  affix("af_poison", "毒伤", "poisonDamage", ["wrist", "jade"], "pct", 0.03),
  affix("af_hit", "命中", "hit", ["feet", "jade"], "pct", 0.02),
  affix("af_evade", "闪避", "evade", ["feet", "jade"], "pct", 0.02),
];

export const SETS_V1: Record<string, SetDefV1> = {
  set_taiji: {
    id: "set_taiji",
    name: "太极套",
    buildId: "taiji",
    region: "wudang",
    description: "以柔克刚：招架与反伤。",
    two: { defensePct: 0.1, guardReduction: 0.05 },
    four: { reflect: 0.15, damageReduction: 0.03 },
  },
  set_pojun: {
    id: "set_pojun",
    name: "破军套",
    buildId: "pojun",
    region: "zhongyuan",
    description: "破甲爆发：攻击与破招。",
    two: { attackPct: 0.1, crit: 0.05 },
    four: { breakDamage: 0.1, damagePct: 0.1 },
  },
  set_xuanyin: {
    id: "set_xuanyin",
    name: "玄阴套",
    buildId: "xuanyin",
    region: "hanyue",
    description: "封穴叠毒：状态与连招。",
    two: { speedPct: 0.1, poisonDamage: 0.1 },
    four: { statusHit: 0.1, comboDamage: 0.1 },
  },
  set_zhongyuan: {
    id: "set_zhongyuan",
    name: "中原豪侠",
    region: "zhongyuan",
    description: "擂台扬名：反击与伤害。",
    two: { attackPct: 0.06, counterDamage: 0.1 },
    four: { damagePct: 0.1 },
  },
  set_wudang: {
    id: "set_wudang",
    name: "武当清修",
    region: "wudang",
    description: "守中致柔：招架与内力。",
    two: { guardReduction: 0.06, innerRegen: 1.5 },
    four: { typeDamagePct: 0.12 },
  },
  set_xihu: {
    id: "set_xihu",
    name: "西湖烟雨",
    region: "xihu",
    description: "轻身会心：闪避与身法。",
    two: { evade: 0.05, speedPct: 0.06 },
    four: { crit: 0.08 },
  },
  set_yangzhou: {
    id: "set_yangzhou",
    name: "扬州商路",
    region: "yangzhou",
    description: "以战养战：状态与吸血。",
    two: { statusHit: 0.06, lifesteal: 0.03 },
    four: { poisonDamage: 0.15 },
  },
  set_hanyue: {
    id: "set_hanyue",
    name: "汉越守墓",
    region: "hanyue",
    description: "墓中余烬：反伤与减伤。",
    two: { reflect: 0.06, hpPct: 0.08 },
    four: { damageReduction: 0.06 },
  },
};

function legendary(
  id: string,
  name: string,
  description: string,
  slots: GearSlot[],
  effect: Partial<CombatMods>,
  rule: LegendaryDefV1["rule"],
): LegendaryDefV1 {
  return { id, name, description, slots, effect, rule };
}

export const LEGENDARIES_V1: Record<string, LegendaryDefV1> = {
  leg_guard_inner: legendary("leg_guard_inner", "守中", "招架成功后回复内力。", ["body", "jade"], { guardReduction: 0.03, innerRegen: 2 }, "guardInner"),
  leg_counter: legendary("leg_counter", "借力", "反击伤害提高，招架仍是答案。", ["weapon", "wrist"], { counterDamage: 0.25 }, "counter"),
  leg_light_crit: legendary("leg_light_crit", "踏雪", "轻功后下一招更容易会心。", ["feet", "wrist"], { crit: 0.03 }, "lightCrit"),
  leg_poison_burst: legendary("leg_poison_burst", "蛊爆", "毒发时可引爆层数。", ["jade", "wrist"], { poisonDamage: 0.15 }, "poisonBurst"),
  leg_fengxue_boss: legendary("leg_fengxue_boss", "点穴", "封穴对首领有效，但持续减半。", ["weapon", "jade"], { statusHit: 0.05 }, "fengxueBoss"),
  leg_guard_heal: legendary("leg_guard_heal", "回春", "招架成功时恢复气血。", ["body", "head"], { healBonus: 0.08 }, "guardHeal"),
  leg_combo_break: legendary("leg_combo_break", "断势", "连招终结附加破甲。", ["weapon", "wrist"], { breakDamage: 0.1 }, "comboBreak"),
  leg_reflect_guard: legendary("leg_reflect_guard", "反震", "护体时反伤更高。", ["body", "feet"], { reflect: 0.08, guardReduction: 0.03 }, "reflectGuard"),
  leg_inner_surge: legendary("leg_inner_surge", "内息", "每回合额外回复内力。", ["jade", "head"], { innerRegen: 3 }, "innerSurge"),
  leg_first_strike: legendary("leg_first_strike", "先声", "先手时命中与身法提高。", ["feet", "head"], { hit: 0.05, speedPct: 0.05 }, "firstStrike"),
  leg_lowhp: legendary("leg_lowhp", "背水", "低气血时伤害提高。", ["weapon", "body"], { damagePct: 0.08 }, "lowHp"),
  leg_dot_amp: legendary("leg_dot_amp", "蚀骨", "持续伤害更难抵抗。", ["jade", "wrist"], { poisonDamage: 0.2 }, "dotAmp"),
  leg_dispel: legendary("leg_dispel", "清心", "受到的负面更容易被驱散。", ["head", "jade"], { statusResist: 0.08 }, "dispel"),
  leg_recovery: legendary("leg_recovery", "回元", "治疗与吸血更有效。", ["head", "jade"], { healBonus: 0.1, lifesteal: 0.02 }, "recovery"),
  leg_boss_hunter: legendary("leg_boss_hunter", "屠龙", "对首领的伤害提高。", ["weapon", "jade"], { damagePct: 0.06 }, "bossHunter"),
};

export const MAIN_STATS_V1: Record<GearSlot, keyof CombatMods> = {
  weapon: "attackPct",
  head: "defensePct",
  body: "defensePct",
  wrist: "attackPct",
  feet: "speedPct",
  jade: "innerMaxPct",
};

export const ITEMIZATION_CONTENT: ItemizationContent = {
  affixes: AFFIXES_V1,
  sets: SETS_V1,
  legendaries: LEGENDARIES_V1,
  mainStats: MAIN_STATS_V1,
};

function affixForStat(stat: keyof CombatMods, value: number, slot: GearSlot): GearAffixV1 {
  const def = AFFIXES_V1.find((entry) => entry.stat === stat && entry.slots.includes(slot))
    ?? AFFIXES_V1.find((entry) => entry.stat === stat);
  return {
    defId: def?.id ?? `starter_${String(stat)}`,
    stat,
    value,
    tier: 1,
    label: def?.name ?? String(stat),
    kind: def?.kind ?? (stat === "innerRegen" ? "flat" : "pct"),
  };
}

export function starterGearItems(buildId: BuildId): GearItemV1[] {
  return GEAR_SLOTS.map((slot) => {
    const def = STARTER_GEAR[`${buildId}_${slot}`];
    if (!def) throw new Error(`Missing starter gear: ${buildId}_${slot}`);
    const stats = { ...def.stats };
    const mainStatKey = MAIN_STATS_V1[slot];
    const mainValue = stats[mainStatKey] ?? 0.02;
    delete stats[mainStatKey];
    const affixes = Object.entries(stats)
      .filter(([, value]) => typeof value === "number")
      .map(([stat, value]) => affixForStat(stat as keyof CombatMods, value as number, slot));
    return {
      id: def.id,
      name: def.name,
      slot,
      weaponType: def.weaponType ?? null,
      rarity: def.rarity,
      tier: def.tier,
      itemLevel: 1,
      mainStat: { stat: mainStatKey, value: mainValue, label: AFFIXES_V1.find((entry) => entry.stat === mainStatKey)?.name ?? String(mainStatKey) },
      affixes,
      setId: def.setId ?? null,
      legendaryId: null,
      refine: 0,
      locked: false,
    };
  });
}

export function weaponTypesForLoadout(loadout: Loadout): WeaponType[] {
  const skills = [
    ...loadout.moves.map((id) => COMBAT_CONTENT.skills[id]),
    COMBAT_CONTENT.skills[loadout.ultimateId],
    COMBAT_CONTENT.skills[loadout.lightSkillId],
  ].filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));
  const groups = skills.map((skill) => skill.weaponTypes).filter((group) => group.length > 0);
  if (groups.length === 0) return ["sword", "blade", "fist", "spear", "hidden"];
  let allowed = [...groups[0]];
  for (const group of groups.slice(1)) {
    allowed = allowed.filter((type) => group.includes(type));
  }
  return allowed;
}

export function rarityLabel(rarity: GearItemV1["rarity"]): string {
  return RARITY_NAMES[rarity];
}
