import type {
  CompanionDef,
  HeartMethodDef,
  KeystoneDef,
  MoveDef,
  SetDef,
} from "../core/types.ts";

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

export const MOVES: Record<string, MoveDef> = {
  // 太极剑：以架招、借力、反伤为核心
  taiji_yunshou: {
    id: "taiji_yunshou",
    name: "云手",
    type: "jia",
    element: "rou",
    cost: 15,
    cooldown: 2,
    tag: "starter",
    coefficient: 0.45,
    effects: { parry: 0.55, borrowGain: 1, shieldPct: 0.04 },
  },
  taiji_lanque: {
    id: "taiji_lanque",
    name: "揽雀尾",
    type: "shi",
    element: "rou",
    cost: 25,
    cooldown: 1,
    tag: "chase",
    coefficient: 1.45,
    effects: { borrowConsume: 1 },
  },
  taiji_baihe: {
    id: "taiji_baihe",
    name: "白鹤亮翅",
    type: "shi",
    element: "rou",
    cost: 20,
    cooldown: 2,
    tag: "starter",
    coefficient: 1.18,
    effects: { shieldPct: 0.06, innerGain: 4 },
  },
  taiji_tuishou: {
    id: "taiji_tuishou",
    name: "太极推手",
    type: "qi",
    element: "taiji",
    cost: 30,
    cooldown: 3,
    tag: "utility",
    coefficient: 0.2,
    effects: { borrowGain: 2, shieldPct: 0.1, healPct: 0.04 },
  },
  taiji_siliang: {
    id: "taiji_siliang",
    name: "四两拨千斤",
    type: "qi",
    element: "taiji",
    cost: 40,
    cooldown: 4,
    tag: "finisher",
    coefficient: 2.0,
    effects: { borrowConsume: 99 },
    isUltimate: true,
  },

  // 破军刀：破甲、爆发、斩杀
  pojun_lipi: {
    id: "pojun_lipi",
    name: "力劈华山",
    type: "shi",
    element: "gang",
    cost: 30,
    cooldown: 2,
    tag: "starter",
    coefficient: 1.2,
    effects: { armorBreak: 1 },
  },
  pojun_hengsao: {
    id: "pojun_hengsao",
    name: "横扫千军",
    type: "shi",
    element: "gang",
    cost: 35,
    cooldown: 3,
    tag: "chase",
    coefficient: 0.75,
    effects: { extraHits: 1 },
  },
  pojun_zhan: {
    id: "pojun_zhan",
    name: "破军斩",
    type: "shi",
    element: "gang",
    cost: 45,
    cooldown: 4,
    tag: "finisher",
    coefficient: 1.35,
    effects: { executeBonusPct: 0.4 },
  },
  pojun_xuezhan: {
    id: "pojun_xuezhan",
    name: "血战八方",
    type: "qi",
    element: "gang",
    cost: 30,
    cooldown: 3,
    tag: "utility",
    coefficient: 0.1,
    effects: { attackBuffPct: 0.2, healPct: 0.02 },
  },
  pojun_wanjun: {
    id: "pojun_wanjun",
    name: "万军取首",
    type: "shi",
    element: "gang",
    cost: 60,
    cooldown: 4,
    tag: "finisher",
    coefficient: 1.65,
    effects: { armorBreak: 1, executeBonusPct: 0.3 },
    isUltimate: true,
  },

  // 玄阴经：封穴、毒、爆发
  xuanyin_zhi: {
    id: "xuanyin_zhi",
    name: "玄阴指",
    type: "shi",
    element: "yin",
    cost: 25,
    cooldown: 1,
    tag: "starter",
    coefficient: 1.0,
    effects: { stunChance: 0.25, poison: 1 },
  },
  xuanyin_fengxue: {
    id: "xuanyin_fengxue",
    name: "封穴手",
    type: "xu",
    element: "yin",
    cost: 20,
    cooldown: 2,
    tag: "utility",
    coefficient: 0.7,
    effects: { stunChance: 0.5, armorBreak: 1 },
  },
  xuanyin_shigu: {
    id: "xuanyin_shigu",
    name: "蚀骨掌",
    type: "shi",
    element: "yin",
    cost: 30,
    cooldown: 3,
    tag: "chase",
    coefficient: 0.8,
    effects: { poison: 1 },
  },
  xuanyin_yinfeng: {
    id: "xuanyin_yinfeng",
    name: "阴风透骨",
    type: "qi",
    element: "yin",
    cost: 25,
    cooldown: 3,
    tag: "utility",
    coefficient: 0.2,
    effects: { poison: 1, attackBuffPct: 0.15 },
  },
  xuanyin_wangu: {
    id: "xuanyin_wangu",
    name: "万蛊噬心",
    type: "qi",
    element: "yin",
    cost: 50,
    cooldown: 4,
    tag: "finisher",
    coefficient: 1.4,
    effects: {},
    isUltimate: true,
  },
};

export function movesById(ids: string[]): MoveDef[] {
  return ids.map((id) => {
    const move = MOVES[id];
    if (!move) throw new Error(`Unknown move: ${id}`);
    return move;
  });
}

// ---------------------------------------------------------------------------
// Heart methods (support-like modifiers)
// ---------------------------------------------------------------------------

export const HEART_METHODS: Record<string, HeartMethodDef> = {
  hm_jieli: {
    id: "hm_jieli",
    name: "借力",
    description: "招架成功后额外获得借力，反伤提高。",
    mods: { parryPct: 0.06, reflectPct: 0.05 },
  },
  hm_huiqi: {
    id: "hm_huiqi",
    name: "回气",
    description: "招架回内力，命中回少量内力。",
    mods: { innerOnParry: 5, innerOnHit: 2 },
  },
  hm_shouzhuo: {
    id: "hm_shouzhuo",
    name: "守拙",
    description: "低气血时减伤提高。",
    mods: { lowHpDamageReductionPct: 0.15 },
  },
  hm_lianmian: {
    id: "hm_lianmian",
    name: "连绵",
    description: "连招伤害提高，招架更稳。",
    mods: { comboPct: 0.1, parryPct: 0.03 },
  },
  hm_liejia: {
    id: "hm_liejia",
    name: "裂甲",
    description: "破甲效果提高。",
    mods: { armorBreakPct: 0.1 },
  },
  hm_zhuifeng: {
    id: "hm_zhuifeng",
    name: "追风",
    description: "身法提高，伤害略增。",
    mods: { speedPct: 0.12, damagePct: 0.05 },
  },
  hm_shixin: {
    id: "hm_shixin",
    name: "噬心",
    description: "会心提高，攻击附带毒。",
    mods: { crit: 0.06, poisonPct: 0.08 },
  },
  hm_kuangyi: {
    id: "hm_kuangyi",
    name: "狂意",
    description: "低气血时攻击提高。",
    mods: { lowHpAttackPct: 0.2 },
  },
  hm_shixin_yin: {
    id: "hm_shixin_yin",
    name: "噬心",
    description: "会心提高，毒伤提高。",
    mods: { crit: 0.05, poisonPct: 0.1 },
  },
  hm_liejia_yin: {
    id: "hm_liejia_yin",
    name: "裂甲",
    description: "破甲效果提高。",
    mods: { armorBreakPct: 0.08 },
  },
  hm_huiqi_yin: {
    id: "hm_huiqi_yin",
    name: "回气",
    description: "命中回内力。",
    mods: { innerOnHit: 3 },
  },
  hm_lianmian_yin: {
    id: "hm_lianmian_yin",
    name: "连绵",
    description: "连招伤害提高。",
    mods: { comboPct: 0.08 },
  },
};

export function heartsById(ids: string[]): HeartMethodDef[] {
  return ids.map((id) => {
    const heart = HEART_METHODS[id];
    if (!heart) throw new Error(`Unknown heart method: ${id}`);
    return heart;
  });
}

// ---------------------------------------------------------------------------
// Meridian keystones
// ---------------------------------------------------------------------------

export const KEYSTONES: Record<string, KeystoneDef> = {
  ks_yirou: {
    id: "ks_yirou",
    name: "以柔克刚",
    description: "招架和反伤提高。",
    mods: { parryPct: 0.08, reflectPct: 0.15 },
  },
  ks_guben: {
    id: "ks_guben",
    name: "固本",
    description: "气血和减伤提高。",
    mods: { hpPct: 0.1, damageReductionPct: 0.03 },
  },
  ks_jianqi: {
    id: "ks_jianqi",
    name: "剑气纵横",
    description: "连招伤害提高。",
    mods: { comboPct: 0.2 },
  },
  ks_gongfa: {
    id: "ks_gongfa",
    name: "攻伐",
    description: "攻击和会心提高。",
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
    description: "毒伤提高；敌人中毒时，每层毒提供减伤。",
    mods: { poisonPct: 0.2, poisonDamageReductionPct: 0.04 },
  },
};

export function keystonesById(ids: string[]): KeystoneDef[] {
  return ids.map((id) => {
    const keystone = KEYSTONES[id];
    if (!keystone) throw new Error(`Unknown keystone: ${id}`);
    return keystone;
  });
}

// ---------------------------------------------------------------------------
// Companions
// ---------------------------------------------------------------------------

export const COMPANIONS: Record<string, CompanionDef> = {
  comp_liuqing: {
    id: "comp_liuqing",
    name: "柳青",
    role: "医女",
    every: 4,
    assist: "heal",
    power: 0.07,
    mods: { hpPct: 0.05 },
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
    mods: { speedPct: 0.03, poisonPct: 0.05 },
  },
};

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

export const SETS: Record<string, SetDef> = {
  set_taiji: {
    id: "set_taiji",
    name: "太极套",
    buildId: "taiji",
    two: { defensePct: 0.1, parryPct: 0.05 },
    four: { reflectPct: 0.15, damageReductionPct: 0.03 },
  },
  set_pojun: {
    id: "set_pojun",
    name: "破军套",
    buildId: "pojun",
    two: { attackPct: 0.1, crit: 0.05 },
    four: { armorBreakPct: 0.1, damagePct: 0.1 },
  },
  set_xuanyin: {
    id: "set_xuanyin",
    name: "玄阴套",
    buildId: "xuanyin",
    two: { speedPct: 0.1, poisonPct: 0.1 },
    four: { controlPct: 0.1, comboPct: 0.1 },
  },
};

export const BUILD_SET_IDS: Record<string, string> = {
  taiji: "set_taiji",
  pojun: "set_pojun",
  xuanyin: "set_xuanyin",
};
