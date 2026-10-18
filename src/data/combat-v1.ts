import type {
  BattleEnemyDef,
  BattleEnemyMove,
  BattleSheet,
  BattleSkill,
  CombatContent,
  CombatMods,
  CompanionDefV1,
  Element,
  HeartMethodDefV1,
  InnerArtDef,
  KeystoneDefV1,
  Loadout,
  PriorityPreset,
  PriorityRule,
  SecondaryAttributes,
  WeaponType,
} from "../core/combat-v1.ts";
import {
  addCombatMods,
  applyCombatMods,
  emptyCombatMods,
  makePrimary,
  makeSecondary,
} from "../core/combat-v1.ts";
import type { BuildId, GearSlot, StatMods } from "../core/types.ts";
import { GEAR_SLOTS } from "../core/types.ts";
import { BUILDS } from "./builds.ts";
import { baseStatsAt, levelToRealm } from "../core/stats.ts";

// ---------------------------------------------------------------------------
// Skills: 4 moves + 1 ultimate + 1 light skill per starter kit.
// The basic attack is universal and never occupies a slot.
// ---------------------------------------------------------------------------

function skill(entry: BattleSkill): BattleSkill {
  return entry;
}

export const COMBAT_SKILLS: Record<string, BattleSkill> = {
  // 太极反伤
  taiji_yunshou: skill({
    id: "taiji_yunshou",
    name: "云手",
    kind: "move",
    type: "jia",
    element: "rou",
    weaponTypes: ["sword", "fist"],
    cost: 15,
    cooldown: 2,
    coefficient: 0.55,
    tag: "starter",
    effects: { guard: 0.55, innerGain: 3 },
    description: "架招：本回合招架减伤，成功招架后借力反打。",
  }),
  taiji_lanque: skill({
    id: "taiji_lanque",
    name: "揽雀尾",
    kind: "move",
    type: "shi",
    element: "rou",
    weaponTypes: ["sword", "fist"],
    cost: 25,
    cooldown: 1,
    coefficient: 1.6,
    tag: "chase",
    description: "追击：高系数实招，维持连击。",
  }),
  taiji_baihe: skill({
    id: "taiji_baihe",
    name: "白鹤亮翅",
    kind: "move",
    type: "shi",
    element: "rou",
    weaponTypes: ["sword", "fist"],
    cost: 20,
    cooldown: 2,
    coefficient: 1.3,
    tag: "starter",
    effects: { innerGain: 4 },
    description: "起手实招；可打断气招。",
  }),
  taiji_tuishou: skill({
    id: "taiji_tuishou",
    name: "太极推手",
    kind: "move",
    type: "qi",
    element: "taiji",
    weaponTypes: ["sword", "fist"],
    cost: 30,
    cooldown: 3,
    coefficient: 0.2,
    tag: "utility",
    effects: { guard: 0.1, healPct: 0.04, cleanse: 1, innerGain: 4 },
    description: "气招：调息、护体、驱散一个负面。",
  }),
  taiji_siliang: skill({
    id: "taiji_siliang",
    name: "四两拨千斤",
    kind: "ultimate",
    type: "qi",
    element: "taiji",
    weaponTypes: ["sword", "fist"],
    cost: 40,
    cooldown: 4,
    coefficient: 2.15,
    tag: "finisher",
    ultimateCondition: "combo3_or_inner50",
    description: "绝技：借力打力，收势后连击清零。",
  }),

  // 通用可学招式：不绑定 starter，作为首个挂机循环的“获得招式”目标。
  common_liuhe: skill({
    id: "common_liuhe",
    name: "六合式",
    kind: "move",
    type: "shi",
    element: "gang",
    weaponTypes: ["sword", "blade", "fist"],
    cost: 25,
    cooldown: 2,
    coefficient: 1.45,
    tag: "chase",
    effects: { armorBreak: 1 },
    description: "通用追击：中段实招，破甲并维持连击。",
  }),
  common_guixi: skill({
    id: "common_guixi",
    name: "归息式",
    kind: "move",
    type: "qi",
    element: "rou",
    weaponTypes: ["sword", "blade", "fist"],
    cost: 20,
    cooldown: 3,
    coefficient: 0.15,
    tag: "utility",
    effects: { guard: 0.2, healPct: 0.05, innerGain: 6 },
    description: "通用气招：调息、护体、回内力；适合长线挂机。",
  }),

  // 破军爆发
  pojun_lipi: skill({
    id: "pojun_lipi",
    name: "力劈华山",
    kind: "move",
    type: "shi",
    element: "gang",
    weaponTypes: ["blade", "spear"],
    cost: 30,
    cooldown: 2,
    coefficient: 1.2,
    tag: "starter",
    effects: { armorBreak: 1 },
    description: "起手实招，叠加破甲。",
  }),
  pojun_hengsao: skill({
    id: "pojun_hengsao",
    name: "横扫千军",
    kind: "move",
    type: "shi",
    element: "gang",
    weaponTypes: ["blade", "spear"],
    cost: 35,
    cooldown: 3,
    coefficient: 0.75,
    tag: "chase",
    effects: { extraHits: 1 },
    description: "两段追击，每段独立命中/会心。",
  }),
  pojun_zhan: skill({
    id: "pojun_zhan",
    name: "破军斩",
    kind: "move",
    type: "shi",
    element: "gang",
    weaponTypes: ["blade", "spear"],
    cost: 45,
    cooldown: 4,
    coefficient: 1.35,
    tag: "finisher",
    effects: { executeBonusPct: 0.4 },
    description: "终结实招，对残血目标增伤。",
  }),
  pojun_xuezhan: skill({
    id: "pojun_xuezhan",
    name: "血战八方",
    kind: "move",
    type: "qi",
    element: "gang",
    weaponTypes: ["blade", "spear"],
    cost: 30,
    cooldown: 3,
    coefficient: 0.1,
    tag: "utility",
    effects: { attackBuffPct: 0.2, attackBuffRounds: 3, healPct: 0.02 },
    description: "气招：蓄势提高攻击。",
  }),
  pojun_wanjun: skill({
    id: "pojun_wanjun",
    name: "万军取首",
    kind: "ultimate",
    type: "shi",
    element: "gang",
    weaponTypes: ["blade", "spear"],
    cost: 60,
    cooldown: 4,
    coefficient: 2.0,
    tag: "finisher",
    effects: { armorBreak: 1, executeBonusPct: 0.3 },
    ultimateCondition: "combo3_or_inner50",
    description: "绝技：破甲斩杀，收势后连击清零。",
  }),

  // 玄阴封穴
  xuanyin_zhi: skill({
    id: "xuanyin_zhi",
    name: "玄阴指",
    kind: "move",
    type: "shi",
    element: "yin",
    weaponTypes: ["fist", "hidden"],
    cost: 25,
    cooldown: 1,
    coefficient: 1.0,
    tag: "starter",
    effects: { fengxueChance: 0.25, poison: 1 },
    description: "起手实招，封穴并叠毒。",
  }),
  xuanyin_fengxue: skill({
    id: "xuanyin_fengxue",
    name: "封穴手",
    kind: "move",
    type: "xu",
    element: "yin",
    weaponTypes: ["fist", "hidden"],
    cost: 20,
    cooldown: 2,
    coefficient: 0.7,
    tag: "utility",
    effects: { fengxueChance: 0.5, armorBreak: 1 },
    description: "虚招：破架、封穴、破甲。",
  }),
  xuanyin_shigu: skill({
    id: "xuanyin_shigu",
    name: "蚀骨掌",
    kind: "move",
    type: "shi",
    element: "yin",
    weaponTypes: ["fist", "hidden"],
    cost: 30,
    cooldown: 3,
    coefficient: 0.8,
    tag: "chase",
    effects: { poison: 1 },
    description: "追击叠毒。",
  }),
  xuanyin_yinfeng: skill({
    id: "xuanyin_yinfeng",
    name: "阴风透骨",
    kind: "move",
    type: "qi",
    element: "yin",
    weaponTypes: ["fist", "hidden"],
    cost: 25,
    cooldown: 3,
    coefficient: 0.2,
    tag: "utility",
    effects: { poison: 1, attackBuffPct: 0.15, attackBuffRounds: 3 },
    description: "气招：续毒并蓄势。",
  }),
  xuanyin_wangu: skill({
    id: "xuanyin_wangu",
    name: "万蛊噬心",
    kind: "ultimate",
    type: "qi",
    element: "yin",
    weaponTypes: ["fist", "hidden"],
    cost: 50,
    cooldown: 4,
    coefficient: 1.8,
    tag: "finisher",
    effects: { armorBreak: 2, fengxueChance: 0.35 },
    ultimateCondition: "combo3_or_inner50",
    description: "绝技：引爆蛊毒，收势后连击清零。",
  }),

  // 轻功：低频功能位，不占普攻循环
  light_taiji_tiyun: skill({
    id: "light_taiji_tiyun",
    name: "梯云纵",
    kind: "light",
    type: "qi",
    element: "taiji",
    weaponTypes: ["sword", "fist"],
    cost: 12,
    cooldown: 4,
    coefficient: 0,
    tag: "utility",
    effects: { cleanse: 2, evadeBuff: 0.15, innerGain: 8 },
    description: "轻功：驱散负面并提高本回合闪避。",
  }),
  light_pojun_tapo: skill({
    id: "light_pojun_tapo",
    name: "踏破山河",
    kind: "light",
    type: "qi",
    element: "gang",
    weaponTypes: ["blade", "spear"],
    cost: 15,
    cooldown: 4,
    coefficient: 0,
    tag: "utility",
    effects: { cleanse: 1, attackBuffPct: 0.2, attackBuffRounds: 2 },
    description: "轻功：驱散并蓄势，给下一轮爆发让路。",
  }),
  light_xuanyin_guibian: skill({
    id: "light_xuanyin_guibian",
    name: "鬼影迷踪",
    kind: "light",
    type: "qi",
    element: "yin",
    weaponTypes: ["fist", "hidden"],
    cost: 12,
    cooldown: 3,
    coefficient: 0,
    tag: "utility",
    effects: { cleanse: 2, evadeBuff: 0.2 },
    description: "轻功：驱散并提高闪避，重置身法节奏。",
  }),
};

// ---------------------------------------------------------------------------
// Inner arts, hearts, keystones, companions
// ---------------------------------------------------------------------------

export const INNER_ARTS: Record<string, InnerArtDef> = {
  inner_taiji: {
    id: "inner_taiji",
    name: "纯阳无极功",
    element: "taiji",
    description: "以柔克刚，招架与调息更稳。",
    signature: "3/6/9 层：招架减伤与回合回内力提高。",
    mods: { defensePct: 0.08, guardReduction: 0.05, innerRegen: 2 },
  },
  inner_pojun: {
    id: "inner_pojun",
    name: "破军心诀",
    element: "gang",
    description: "刚猛直进，会心伤害与攻击更高。",
    signature: "3/6/9 层：会心伤害与破甲增伤提高。",
    mods: { attackPct: 0.08, critDamage: 0.1, breakDamage: 0.03 },
  },
  inner_xuanyin: {
    id: "inner_xuanyin",
    name: "玄阴真经",
    element: "yin",
    description: "阴毒封穴，状态命中与毒伤更高。",
    signature: "3/6/9 层：状态命中与毒伤提高。",
    mods: { statusHit: 0.08, poisonDamage: 0.1, speedPct: 0.03 },
  },
};

export const HEART_METHODS_V1: Record<string, HeartMethodDefV1> = {
  hm_jieli: {
    id: "hm_jieli",
    name: "借力",
    description: "招架成功后反伤提高。",
    mods: { guardReduction: 0.04, reflect: 0.05 },
  },
  hm_huiqi: {
    id: "hm_huiqi",
    name: "回气",
    description: "回合回内力提高。",
    mods: { innerRegen: 3 },
  },
  hm_shouzhuo: {
    id: "hm_shouzhuo",
    name: "守拙",
    description: "减伤提高，低气血时更稳。",
    mods: { damageReduction: 0.03 },
  },
  hm_lianmian: {
    id: "hm_lianmian",
    name: "连绵",
    description: "连招伤害与招架更稳。",
    mods: { comboDamage: 0.1, guardReduction: 0.02 },
  },
  hm_liejia: {
    id: "hm_liejia",
    name: "裂甲",
    description: "破招增伤提高。",
    mods: { breakDamage: 0.05 },
  },
  hm_zhuifeng: {
    id: "hm_zhuifeng",
    name: "追风",
    description: "身法提高，伤害略增。",
    mods: { speedPct: 0.08, damagePct: 0.03 },
  },
  hm_shixin: {
    id: "hm_shixin",
    name: "噬心",
    description: "会心与毒伤提高。",
    mods: { crit: 0.04, poisonDamage: 0.08 },
  },
  hm_kuangyi: {
    id: "hm_kuangyi",
    name: "狂意",
    description: "伤害提高。",
    mods: { damagePct: 0.05 },
  },
  hm_shixin_yin: {
    id: "hm_shixin_yin",
    name: "噬心·阴",
    description: "会心与毒伤提高。",
    mods: { crit: 0.04, poisonDamage: 0.1 },
  },
  hm_liejia_yin: {
    id: "hm_liejia_yin",
    name: "裂甲·阴",
    description: "破招增伤提高。",
    mods: { breakDamage: 0.04 },
  },
  hm_huiqi_yin: {
    id: "hm_huiqi_yin",
    name: "回气·阴",
    description: "回合回内力提高。",
    mods: { innerRegen: 0.5 },
  },
  hm_lianmian_yin: {
    id: "hm_lianmian_yin",
    name: "连绵·阴",
    description: "连招伤害提高。",
    mods: { comboDamage: 0.08 },
  },
};

export const KEYSTONES_V1: Record<string, KeystoneDefV1> = {
  ks_yirou: {
    id: "ks_yirou",
    name: "以柔克刚",
    description: "招架与反伤提高。",
    mods: { guardReduction: 0.06, reflect: 0.15 },
  },
  ks_guben: {
    id: "ks_guben",
    name: "固本",
    description: "气血与减伤提高。",
    mods: { hpPct: 0.1, damageReduction: 0.03 },
  },
  ks_jianqi: {
    id: "ks_jianqi",
    name: "剑气纵横",
    description: "连招伤害提高。",
    mods: { comboDamage: 0.2 },
  },
  ks_gongfa: {
    id: "ks_gongfa",
    name: "攻伐",
    description: "攻击与会心提高。",
    mods: { attackPct: 0.1, crit: 0.05 },
  },
  ks_taxue: {
    id: "ks_taxue",
    name: "踏雪无痕",
    description: "身法提高。",
    mods: { speedPct: 0.15 },
  },
  ks_dujing: {
    id: "ks_dujing",
    name: "毒经",
    description: "毒伤与吸血提高。",
    mods: { poisonDamage: 0.2, lifesteal: 0.05 },
  },
};

export const COMPANIONS_V1: Record<string, CompanionDefV1> = {
  comp_liuqing: {
    id: "comp_liuqing",
    name: "柳青",
    role: "医女",
    every: 4,
    assist: "heal",
    power: 0.07,
    mods: { hpPct: 0.05, healBonus: 0.05 },
  },
  comp_guchangfeng: {
    id: "comp_guchangfeng",
    name: "顾长风",
    role: "剑客",
    every: 4,
    assist: "damage",
    power: 0.75,
    mods: { attackPct: 0.05 },
  },
  comp_moya: {
    id: "comp_moya",
    name: "墨鸦",
    role: "机关师",
    every: 4,
    assist: "poison",
    power: 1,
    mods: { speedPct: 0.03, poisonDamage: 0.05 },
  },
  comp_suwan: {
    id: "comp_suwan",
    name: "苏晚",
    role: "药师",
    every: 4,
    assist: "heal",
    power: 0.04,
    mods: { statusResist: 0.08, healBonus: 0.1, innerRegen: 0.5 },
  },
  comp_yanshisan: {
    id: "comp_yanshisan",
    name: "燕十三",
    role: "游侠",
    every: 4,
    assist: "damage",
    power: 0.5,
    mods: { crit: 0.04, counterDamage: 0.1 },
  },
  comp_heiqiu: {
    id: "comp_heiqiu",
    name: "黑七",
    role: "暗器手",
    every: 4,
    assist: "poison",
    power: 1,
    mods: { reflect: 0.05, poisonDamage: 0.08 },
  },
  comp_yushi: {
    id: "comp_yushi",
    name: "雨师",
    role: "说书人",
    every: 4,
    assist: "heal",
    power: 0.05,
    mods: { statusResist: 0.06, innerRegen: 0.5 },
  },
  comp_shenqing: {
    id: "comp_shenqing",
    name: "沈青",
    role: "捕快",
    every: 4,
    assist: "damage",
    power: 0.5,
    mods: { hit: 0.03, crit: 0.02 },
  },
  comp_ayuan: {
    id: "comp_ayuan",
    name: "阿沅",
    role: "船娘",
    every: 4,
    assist: "shield",
    power: 0.15,
    mods: { evade: 0.04, speedPct: 0.03 },
  },
  comp_cangbo: {
    id: "comp_cangbo",
    name: "苍伯",
    role: "守墓人",
    every: 4,
    assist: "heal",
    power: 0.06,
    mods: { defensePct: 0.08, guardReduction: 0.04 },
  },
};

// ---------------------------------------------------------------------------
// Starter gear. The itemization service owns the full GearItem type; these
// seeds keep the starter kits playable before any loot is rolled.
// ---------------------------------------------------------------------------

export interface StarterGearDef {
  id: string;
  name: string;
  slot: GearSlot;
  weaponType?: WeaponType;
  rarity: "common" | "fine" | "superb" | "peerless" | "divine";
  tier: number;
  setId?: string;
  stats: Partial<CombatMods>;
}

function starterGear(
  prefix: string,
  weaponType: WeaponType,
  weaponName: string,
  extras: Partial<CombatMods> = {},
): Record<GearSlot, StarterGearDef> {
  const base: Record<GearSlot, StarterGearDef> = {
    weapon: {
      id: `${prefix}_weapon`,
      name: weaponName,
      slot: "weapon",
      weaponType,
      rarity: "fine",
      tier: 1,
      setId: `set_${prefix}`,
      stats: { attackPct: 0.03, crit: 0.01, ...extras },
    },
    head: {
      id: `${prefix}_head`,
      name: "束发冠",
      slot: "head",
      rarity: "common",
      tier: 1,
      setId: `set_${prefix}`,
      stats: { defensePct: 0.02, hpPct: 0.02 },
    },
    body: {
      id: `${prefix}_body`,
      name: "云纹袍",
      slot: "body",
      rarity: "common",
      tier: 1,
      setId: `set_${prefix}`,
      stats: { defensePct: 0.04, hpPct: 0.03 },
    },
    wrist: {
      id: `${prefix}_wrist`,
      name: "护腕",
      slot: "wrist",
      rarity: "common",
      tier: 1,
      stats: { attackPct: 0.02, speedPct: 0.02 },
    },
    feet: {
      id: `${prefix}_feet`,
      name: "踏云靴",
      slot: "feet",
      rarity: "common",
      tier: 1,
      stats: { speedPct: 0.03 },
    },
    jade: {
      id: `${prefix}_jade`,
      name: "听雨佩",
      slot: "jade",
      rarity: "common",
      tier: 1,
      stats: { innerMaxPct: 0.03, crit: 0.01 },
    },
  };
  return base;
}

export const STARTER_GEAR: Record<string, StarterGearDef> = Object.fromEntries(
  [
    ...Object.values(starterGear("taiji", "sword", "青锋剑", { guardReduction: 0.02 })),
    ...Object.values(starterGear("pojun", "blade", "雁翎刀", { breakDamage: 0.02 })),
    ...Object.values(starterGear("xuanyin", "fist", "乌木拳套", { statusHit: 0.02 })),
  ].map((item) => [item.id, item]),
);

export const STARTER_GEAR_IDS: Record<string, true> = Object.fromEntries(
  Object.keys(STARTER_GEAR).map((id) => [id, true as const]),
);

// ---------------------------------------------------------------------------
// Priority presets: data, not code. Three per starter kit.
// ---------------------------------------------------------------------------

function rule(
  id: string,
  conditions: PriorityRule["conditions"],
  action: PriorityRule["action"],
  note?: string,
): PriorityRule {
  return { id, conditions, action, note };
}

function alwaysBasic(id: string): PriorityRule {
  return rule(id, [{ kind: "always" }], { kind: "basic" }, "无匹配则普攻");
}

function taijiPreset(id: string, name: string, boss = false): PriorityPreset {
  return {
    id,
    name,
    rules: [
      rule(`${id}_common_guard`, [{ kind: "hpBelow", pct: 0.55 }, { kind: "skillReady", skillId: "common_guixi" }], { kind: "skill", skillId: "common_guixi" }, "通用调息"),
      rule(`${id}_common_chase`, [{ kind: "skillReady", skillId: "common_liuhe" }], { kind: "skill", skillId: "common_liuhe" }, "通用追击"),
      rule(`${id}_interrupt`, [{ kind: "enemyCharging" }, { kind: "skillReady", skillId: "taiji_baihe" }], { kind: "skill", skillId: "taiji_baihe" }, "敌方蓄力→实招打断"),
      rule(`${id}_guard`, [{ kind: "enemyIntentType", type: "shi" }, { kind: "skillReady", skillId: "taiji_yunshou" }], { kind: "skill", skillId: "taiji_yunshou" }, "敌方实招→架招"),
      rule(`${id}_ult`, [{ kind: "comboAtLeast", stacks: 3 }, { kind: "skillReady", skillId: "taiji_siliang" }], { kind: "skill", skillId: "taiji_siliang" }, "连击≥3→绝技"),
      rule(`${id}_save`, [{ kind: "hpBelow", pct: 0.4 }, { kind: "skillReady", skillId: "light_taiji_tiyun" }], { kind: "skill", skillId: "light_taiji_tiyun" }, "气血<40%→轻功保命"),
      ...(boss ? [rule(`${id}_ult_floor`, [{ kind: "innerAtLeast", pct: 0.5 }, { kind: "skillReady", skillId: "taiji_siliang" }], { kind: "skill", skillId: "taiji_siliang" }, "内力≥50%→绝技")] : []),
      rule(`${id}_chase`, [{ kind: "skillReady", skillId: "taiji_lanque" }], { kind: "skill", skillId: "taiji_lanque" }, "追击"),
      rule(`${id}_starter`, [{ kind: "skillReady", skillId: "taiji_baihe" }], { kind: "skill", skillId: "taiji_baihe" }, "起手"),
      alwaysBasic(`${id}_basic`),
    ],
  };
}

function pojunPreset(id: string, name: string, boss = false): PriorityPreset {
  return {
    id,
    name,
    rules: [
      rule(`${id}_common_guard`, [{ kind: "hpBelow", pct: 0.55 }, { kind: "skillReady", skillId: "common_guixi" }], { kind: "skill", skillId: "common_guixi" }, "通用调息"),
      rule(`${id}_common_chase`, [{ kind: "skillReady", skillId: "common_liuhe" }], { kind: "skill", skillId: "common_liuhe" }, "通用追击"),
      rule(`${id}_interrupt`, [{ kind: "enemyCharging" }, { kind: "skillReady", skillId: "pojun_lipi" }], { kind: "skill", skillId: "pojun_lipi" }, "敌方蓄力→实招打断"),
      rule(`${id}_ult`, [{ kind: "comboAtLeast", stacks: 3 }, { kind: "skillReady", skillId: "pojun_wanjun" }], { kind: "skill", skillId: "pojun_wanjun" }, "连击≥3→绝技"),
      rule(`${id}_save`, [{ kind: "hpBelow", pct: 0.4 }, { kind: "skillReady", skillId: "light_pojun_tapo" }], { kind: "skill", skillId: "light_pojun_tapo" }, "气血<40%→轻功"),
      ...(boss ? [rule(`${id}_break`, [{ kind: "statusOnEnemy", status: "armorBreak" }, { kind: "skillReady", skillId: "pojun_zhan" }], { kind: "skill", skillId: "pojun_zhan" }, "破甲后→终结")] : []),
      rule(`${id}_buff`, [{ kind: "skillReady", skillId: "pojun_xuezhan" }], { kind: "skill", skillId: "pojun_xuezhan" }, "蓄势"),
      rule(`${id}_chase`, [{ kind: "skillReady", skillId: "pojun_hengsao" }], { kind: "skill", skillId: "pojun_hengsao" }, "追击"),
      rule(`${id}_starter`, [{ kind: "skillReady", skillId: "pojun_lipi" }], { kind: "skill", skillId: "pojun_lipi" }, "起手"),
      alwaysBasic(`${id}_basic`),
    ],
  };
}

function xuanyinPreset(id: string, name: string, boss = false): PriorityPreset {
  return {
    id,
    name,
    rules: [
      rule(`${id}_common_guard`, [{ kind: "hpBelow", pct: 0.55 }, { kind: "skillReady", skillId: "common_guixi" }], { kind: "skill", skillId: "common_guixi" }, "通用调息"),
      rule(`${id}_common_chase`, [{ kind: "skillReady", skillId: "common_liuhe" }], { kind: "skill", skillId: "common_liuhe" }, "通用追击"),
      rule(`${id}_interrupt`, [{ kind: "enemyCharging" }, { kind: "skillReady", skillId: "xuanyin_zhi" }], { kind: "skill", skillId: "xuanyin_zhi" }, "敌方蓄力→实招打断"),
      rule(`${id}_break`, [{ kind: "enemyIntentType", type: "jia" }, { kind: "skillReady", skillId: "xuanyin_fengxue" }], { kind: "skill", skillId: "xuanyin_fengxue" }, "敌方架招→虚招破架"),
      rule(`${id}_ult`, [{ kind: "comboAtLeast", stacks: 3 }, { kind: "skillReady", skillId: "xuanyin_wangu" }], { kind: "skill", skillId: "xuanyin_wangu" }, "连击≥3→绝技"),
      rule(`${id}_save`, [{ kind: "hpBelow", pct: 0.4 }, { kind: "skillReady", skillId: "light_xuanyin_guibian" }], { kind: "skill", skillId: "light_xuanyin_guibian" }, "气血<40%→轻功"),
      ...(boss ? [rule(`${id}_ult_floor`, [{ kind: "innerAtLeast", pct: 0.5 }, { kind: "skillReady", skillId: "xuanyin_wangu" }], { kind: "skill", skillId: "xuanyin_wangu" }, "内力≥50%→绝技")] : []),
      rule(`${id}_poison`, [{ kind: "statusOnEnemy", status: "poison" }, { kind: "skillReady", skillId: "xuanyin_shigu" }], { kind: "skill", skillId: "xuanyin_shigu" }, "续毒"),
      rule(`${id}_buff`, [{ kind: "skillReady", skillId: "xuanyin_yinfeng" }], { kind: "skill", skillId: "xuanyin_yinfeng" }, "蓄势续毒"),
      rule(`${id}_starter`, [{ kind: "skillReady", skillId: "xuanyin_zhi" }], { kind: "skill", skillId: "xuanyin_zhi" }, "起手"),
      alwaysBasic(`${id}_basic`),
    ],
  };
}

export const PRIORITY_PRESETS: Record<string, PriorityPreset> = {
  priority_taiji_farm: taijiPreset("priority_taiji_farm", "太极·刷图"),
  priority_taiji_boss: taijiPreset("priority_taiji_boss", "太极·首领", true),
  priority_taiji_survival: taijiPreset("priority_taiji_survival", "太极·守关"),
  priority_pojun_farm: pojunPreset("priority_pojun_farm", "破军·刷图"),
  priority_pojun_boss: pojunPreset("priority_pojun_boss", "破军·首领", true),
  priority_pojun_survival: pojunPreset("priority_pojun_survival", "破军·守关"),
  priority_xuanyin_farm: xuanyinPreset("priority_xuanyin_farm", "玄阴·刷图"),
  priority_xuanyin_boss: xuanyinPreset("priority_xuanyin_boss", "玄阴·首领", true),
  priority_xuanyin_survival: xuanyinPreset("priority_xuanyin_survival", "玄阴·守关"),
};

export const COMBAT_CONTENT: CombatContent = {
  skills: COMBAT_SKILLS,
  innerArts: INNER_ARTS,
  hearts: HEART_METHODS_V1,
  keystones: KEYSTONES_V1,
  companions: COMPANIONS_V1,
  gearIds: STARTER_GEAR_IDS,
  priorityPresets: PRIORITY_PRESETS,
};

// ---------------------------------------------------------------------------
// Starter kits + sheet builder
// ---------------------------------------------------------------------------

export interface StarterKit {
  buildId: BuildId;
  name: string;
  innerArtId: string;
  weaponType: WeaponType;
  loadout: Loadout;
  presetIds: [string, string, string];
}

function starterLoadout(
  buildId: BuildId,
  innerArtId: string,
  moves: [string, string, string, string],
  ultimateId: string,
  lightSkillId: string,
  hearts: [string, string, string, string],
  keystones: [string, string],
  activeCompanion: string,
  supports: [string, string],
  priorityPresetId: string,
): Loadout {
  const gear = {} as Record<GearSlot, string>;
  for (const slot of GEAR_SLOTS) gear[slot] = `${buildId}_${slot}`;
  return {
    innerArtId,
    moves,
    ultimateId,
    lightSkillId,
    hearts,
    heartTargets: [moves[0], moves[1], moves[2], moves[3]],
    keystones,
    companions: { active: activeCompanion, support: supports },
    gear,
    priorityPresetId,
  };
}

export const STARTER_KITS: Record<BuildId, StarterKit> = {
  taiji: {
    buildId: "taiji",
    name: "太极反伤",
    innerArtId: "inner_taiji",
    weaponType: "sword",
    presetIds: ["priority_taiji_farm", "priority_taiji_boss", "priority_taiji_survival"],
    loadout: starterLoadout(
      "taiji",
      "inner_taiji",
      ["taiji_yunshou", "taiji_lanque", "taiji_baihe", "taiji_tuishou"],
      "taiji_siliang",
      "light_taiji_tiyun",
      ["hm_jieli", "hm_huiqi", "hm_shouzhuo", "hm_lianmian"],
      ["ks_yirou", "ks_guben"],
      "comp_liuqing",
      ["comp_suwan", "comp_yanshisan"],
      "priority_taiji_farm",
    ),
  },
  pojun: {
    buildId: "pojun",
    name: "破军爆发",
    innerArtId: "inner_pojun",
    weaponType: "blade",
    presetIds: ["priority_pojun_farm", "priority_pojun_boss", "priority_pojun_survival"],
    loadout: starterLoadout(
      "pojun",
      "inner_pojun",
      ["pojun_lipi", "pojun_hengsao", "pojun_zhan", "pojun_xuezhan"],
      "pojun_wanjun",
      "light_pojun_tapo",
      ["hm_liejia", "hm_zhuifeng", "hm_shixin", "hm_kuangyi"],
      ["ks_jianqi", "ks_gongfa"],
      "comp_guchangfeng",
      ["comp_suwan", "comp_heiqiu"],
      "priority_pojun_farm",
    ),
  },
  xuanyin: {
    buildId: "xuanyin",
    name: "玄阴封穴",
    innerArtId: "inner_xuanyin",
    weaponType: "fist",
    presetIds: ["priority_xuanyin_farm", "priority_xuanyin_boss", "priority_xuanyin_survival"],
    loadout: starterLoadout(
      "xuanyin",
      "inner_xuanyin",
      ["xuanyin_zhi", "xuanyin_fengxue", "xuanyin_shigu", "xuanyin_yinfeng"],
      "xuanyin_wangu",
      "light_xuanyin_guibian",
      ["hm_shixin_yin", "hm_liejia_yin", "hm_huiqi_yin", "hm_lianmian_yin"],
      ["ks_taxue", "ks_dujing"],
      "comp_moya",
      ["comp_suwan", "comp_yanshisan"],
      "priority_xuanyin_farm",
    ),
  },
};

function legacyToCombat(mods: Partial<StatMods>): Partial<CombatMods> {
  return {
    hpPct: mods.hpPct ?? 0,
    attackPct: mods.attackPct ?? 0,
    defensePct: mods.defensePct ?? 0,
    speedPct: mods.speedPct ?? 0,
    crit: mods.crit ?? 0,
    innerMaxPct: mods.innerMaxPct ?? 0,
    innerRegen: mods.innerRegen ?? 0,
    damagePct: (mods.damagePct ?? 0) + 0.3 * (mods.lowHpAttackPct ?? 0),
    typeDamagePct: mods.typeDamagePct ?? 0,
    guardReduction: mods.parryPct ?? 0,
    reflect: mods.reflectPct ?? 0,
    breakDamage: mods.armorBreakPct ?? 0,
    poisonDamage: mods.poisonPct ?? 0,
    statusHit: mods.controlPct ?? 0,
    comboDamage: mods.comboPct ?? 0,
    damageReduction: (mods.damageReductionPct ?? 0) + 0.2 * (mods.lowHpDamageReductionPct ?? 0),
    lifesteal: mods.healOnHitPct ?? 0,
  };
}

export interface BattleSheetOptions {
  level?: number;
  realm?: number;
  innerArtLevel?: number;
  innerArtId?: string;
  hearts?: string[];
  keystones?: string[];
  supports?: string[];
  gear?: Array<{ stats?: Partial<CombatMods>; weaponType?: WeaponType; setId?: string }>;
  weaponType?: WeaponType;
  extraMods?: Partial<CombatMods>;
}

export function createBattleSheet(buildId: BuildId, options: BattleSheetOptions = {}): BattleSheet {
  const kit = STARTER_KITS[buildId];
  const build = BUILDS[buildId];
  const level = options.level ?? 1;
  const realm = options.realm ?? levelToRealm(level);
  const base = baseStatsAt(build, level, realm);
  const mods = emptyCombatMods();
  const add = (source: Partial<CombatMods> | undefined) => {
    if (source) addCombatMods(mods, source);
  };

  add(legacyToCombat(build.passives));
  add(INNER_ARTS[options.innerArtId ?? kit.innerArtId]?.mods);
  const innerLevel = options.innerArtLevel ?? 1;
  if (innerLevel >= 3) add({ guardReduction: 0.02, innerRegen: 1 });
  if (innerLevel >= 6) add({ guardReduction: 0.03, innerRegen: 1 });
  if (innerLevel >= 9) add({ guardReduction: 0.05, innerRegen: 2 });
  for (const id of options.hearts ?? kit.loadout.hearts) add(HEART_METHODS_V1[id]?.mods);
  for (const id of options.keystones ?? kit.loadout.keystones) add(KEYSTONES_V1[id]?.mods);
  for (const id of options.supports ?? kit.loadout.companions.support) add(COMPANIONS_V1[id]?.mods);

  const gear = options.gear ?? GEAR_SLOTS.map((slot) => STARTER_GEAR[kit.loadout.gear[slot] ?? ""]);
  for (const item of gear) add(item?.stats);
  add(options.extraMods);

  const weaponType = options.weaponType
    ?? options.gear?.find((item) => item.weaponType)?.weaponType
    ?? STARTER_GEAR[kit.loadout.gear.weapon ?? ""]?.weaponType
    ?? kit.weaponType;

  const sheet: BattleSheet = {
    id: `build:${buildId}`,
    name: build.name,
    element: INNER_ARTS[options.innerArtId ?? kit.innerArtId]?.element ?? build.element,
    weaponType,
    primary: makePrimary({
      hp: base.hp,
      attack: base.attack,
      defense: base.defense,
      speed: base.speed,
      innerMax: base.innerMax,
    }),
    secondary: makeSecondary({
      crit: base.crit,
      innerRegen: base.innerRegen,
    }),
  };
  const applied = applyCombatMods(sheet, mods);
  applied.primary = {
    hp: Math.max(1, applied.primary.hp),
    innerMax: Math.max(1, applied.primary.innerMax),
    attack: Math.max(1, applied.primary.attack),
    defense: Math.max(0, applied.primary.defense),
    speed: Math.max(1, applied.primary.speed),
  };
  return applied;
}

export function starterLoadoutFor(buildId: BuildId): Loadout {
  return structuredClone(STARTER_KITS[buildId].loadout);
}

// ---------------------------------------------------------------------------
// Enemy battle definitions. World content supplies levels, affixes and phases;
// this module keeps the reusable intent patterns.
// ---------------------------------------------------------------------------

function enemyMove(
  id: string,
  name: string,
  type: BattleEnemyMove["type"],
  element: Element,
  coefficient: number,
  effect: BattleEnemyMove["effect"] = "none",
  description = "",
): BattleEnemyMove {
  return { id, name, type, element, coefficient, effect, description };
}

export const ENEMY_MOVE_PATTERNS: Record<string, BattleEnemyMove[]> = {
  gang: [
    enemyMove("e_heavy", "力劈华山", "shi", "gang", 1.2, "heavy"),
    enemyMove("e_sweep", "横扫千军", "shi", "gang", 0.8),
    enemyMove("e_guard", "铁壁", "jia", "gang", 0.2, "guard"),
    enemyMove("e_charge", "蓄势", "qi", "gang", 0, "charge"),
  ],
  rou: [
    enemyMove("e_sword", "白虹贯日", "shi", "rou", 0.95),
    enemyMove("e_soft_guard", "回风拂柳", "jia", "rou", 0.2, "guard"),
    enemyMove("e_step", "虚步探花", "xu", "rou", 0.6),
    enemyMove("e_soft_charge", "蓄势", "qi", "rou", 0, "charge"),
  ],
  kuai: [
    enemyMove("e_thrust", "疾风刺", "shi", "rou", 0.9),
    enemyMove("e_shadow", "影步", "jia", "rou", 0.2, "guard"),
    enemyMove("e_kill", "夺命刺", "shi", "rou", 1.25, "heavy"),
    enemyMove("e_fast_charge", "蓄势", "qi", "rou", 0, "charge"),
  ],
  gui: [
    enemyMove("e_claw", "阴爪", "shi", "yin", 1.0),
    enemyMove("e_seal", "封穴", "xu", "yin", 0.4, "stun"),
    enemyMove("e_poison", "毒砂", "qi", "yin", 0.5, "poison"),
    enemyMove("e_ghost", "鬼影", "jia", "yin", 0.2, "guard"),
  ],
};

export function enemyBattleDef(input: {
  id: string;
  name: string;
  style: BattleEnemyDef["style"];
  element: Element;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  pattern: BattleEnemyMove[];
  phases?: BattleEnemyDef["phases"];
  damageCapPct?: number;
  reflectPct?: number;
  enrageAt?: number;
  enrageAttackPct?: number;
  affixIds?: string[];
  statusResist?: number;
  crit?: number;
}): BattleEnemyDef {
  const secondary: SecondaryAttributes = makeSecondary({
    crit: input.crit ?? 0.05,
    statusResist: input.statusResist ?? 0,
    guardReduction: 0.35,
    damageReduction: 0,
  });
  return {
    id: input.id,
    name: input.name,
    style: input.style,
    element: input.element,
    level: input.level,
    primary: makePrimary({
      hp: input.hp,
      attack: input.attack,
      defense: input.defense,
      speed: input.speed,
      innerMax: 1,
    }),
    secondary,
    phases: input.phases ?? [{
      name: "常态",
      threshold: 1,
      pattern: input.pattern,
      announcement: "气势一变",
    }],
    damageCapPct: input.damageCapPct,
    reflectPct: input.reflectPct,
    enrageAt: input.enrageAt,
    enrageAttackPct: input.enrageAttackPct,
    affixIds: input.affixIds,
  };
}
