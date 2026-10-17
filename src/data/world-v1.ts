import type { RegionId } from "../core/types.ts";
import type {
  BattleEnemyDef,
  BattleEnemyMove,
  BattleModifier,
  Element,
} from "../core/combat-v1.ts";
import { enemyBattleDef } from "./combat-v1.ts";
import type {
  BattleEnemyPhaseV1,
  BossDefV1,
  BossKind,
  EliteAffixDefV1,
  EncounterDefV1,
  EnemyUnitDefV1,
  MapModifierDefV1,
  RegionDefV1,
  TargetDropDefV1,
  WorldContentV1,
  WorldMapDefV1,
} from "../core/world-v1.ts";

// ---------------------------------------------------------------------------
// Region and map modifier pools
// ---------------------------------------------------------------------------

function modifier(
  id: string,
  name: string,
  description: string,
  tone: MapModifierDefV1["tone"],
  extras: Partial<MapModifierDefV1> = {},
): MapModifierDefV1 {
  return {
    id,
    name,
    description,
    tone,
    scope: "both",
    ...extras,
  };
}

export const MAP_MODIFIERS_V1: Record<string, MapModifierDefV1> = {
  // 中原
  mod_zhongyuan_arena: modifier(
    "mod_zhongyuan_arena",
    "车轮战",
    "连续挑战不回复：治疗效果 -20%。",
    "downside",
    { effects: [{ target: "player", stat: "healingPct", mode: "add", value: -0.2 }] },
  ),
  mod_zhongyuan_fame: modifier(
    "mod_zhongyuan_fame",
    "天下闻名",
    "擂台扬名：银两与名望 +15%。",
    "upside",
    { rewardPct: 0.15 },
  ),
  mod_zhongyuan_wind: modifier(
    "mod_zhongyuan_wind",
    "风急",
    "渡口风急：身法 -8%。",
    "downside",
    { effects: [{ target: "player", stat: "speed", mode: "scale", value: -0.08 }] },
  ),
  mod_zhongyuan_river: modifier(
    "mod_zhongyuan_river",
    "落水",
    "气血上限 -8%。",
    "downside",
    { effects: [{ target: "player", stat: "hp", mode: "scale", value: -0.08 }] },
  ),
  mod_zhongyuan_night: modifier(
    "mod_zhongyuan_night",
    "夜行",
    "会心 +8%，命中 -5%。",
    "mixed",
    {
      effects: [
        { target: "player", stat: "crit", mode: "add", value: 0.08 },
        { target: "player", stat: "hit", mode: "add", value: -0.05 },
      ],
    },
  ),
  mod_zhongyuan_hard: modifier(
    "mod_zhongyuan_hard",
    "硬桥硬马",
    "伤害 +10%，受到伤害 +10%。",
    "mixed",
    {
      effects: [
        { target: "player", stat: "damageDealtPct", mode: "add", value: 0.1 },
        { target: "player", stat: "damageTakenPct", mode: "add", value: 0.1 },
      ],
    },
  ),

  // 武当
  mod_wudang_cloud: modifier(
    "mod_wudang_cloud",
    "云海",
    "云雾遮眼：命中 -8%。",
    "downside",
    { effects: [{ target: "player", stat: "hit", mode: "add", value: -0.08 }] },
  ),
  mod_wudang_sword: modifier(
    "mod_wudang_sword",
    "剑阵",
    "剑意加身：伤害 +15%。",
    "upside",
    { effects: [{ target: "player", stat: "damageDealtPct", mode: "add", value: 0.15 }] },
  ),
  mod_wudang_quiet: modifier(
    "mod_wudang_quiet",
    "清修",
    "回合回内力 +30%。",
    "upside",
    { effects: [{ target: "player", stat: "innerRegen", mode: "scale", value: 0.3 }] },
  ),

  // 西湖
  mod_xihu_rain: modifier(
    "mod_xihu_rain",
    "烟雨",
    "雨幕掩护：闪避 +8%。",
    "upside",
    { effects: [{ target: "player", stat: "evade", mode: "add", value: 0.08 }] },
  ),
  mod_xihu_slippery: modifier(
    "mod_xihu_slippery",
    "湿滑",
    "身法判定更严：身法 -8%。",
    "downside",
    { effects: [{ target: "player", stat: "speed", mode: "scale", value: -0.08 }] },
  ),
  mod_xihu_elegance: modifier(
    "mod_xihu_elegance",
    "雅集",
    "声望与银两 +15%。",
    "upside",
    { rewardPct: 0.15 },
  ),

  // 扬州
  mod_yangzhou_patrol: modifier(
    "mod_yangzhou_patrol",
    "漕帮巡逻",
    "精英出现率提高。",
    "downside",
    { eliteChanceBonus: 0.08 },
  ),
  mod_yangzhou_trade: modifier(
    "mod_yangzhou_trade",
    "商路",
    "银两 +15%。",
    "upside",
    { rewardPct: 0.15 },
  ),
  mod_yangzhou_dark: modifier(
    "mod_yangzhou_dark",
    "无光",
    "命中 -8%。",
    "downside",
    { effects: [{ target: "player", stat: "hit", mode: "add", value: -0.08 }] },
  ),
  mod_yangzhou_salt: modifier(
    "mod_yangzhou_salt",
    "盐毒",
    "每 3 回合受一次毒伤。",
    "downside",
    { rules: [{ kind: "periodicDamage", every: 3, pctMaxHp: 0.02, target: "player", label: "盐毒" }] },
  ),

  // 汉越墓
  mod_hanyue_poison: modifier(
    "mod_hanyue_poison",
    "墓毒",
    "治疗效果 -20%。",
    "downside",
    { effects: [{ target: "player", stat: "healingPct", mode: "add", value: -0.2 }] },
  ),
  mod_hanyue_yin: modifier(
    "mod_hanyue_yin",
    "阴气",
    "阴属性武学伤害 +12%。",
    "upside",
    { effects: [{ target: "player", stat: "damageDealtPct", mode: "add", value: 0.12 }] },
  ),
  mod_hanyue_trap: modifier(
    "mod_hanyue_trap",
    "机关",
    "每 4 回合触发陷阱。",
    "downside",
    { rules: [{ kind: "periodicDamage", every: 4, pctMaxHp: 0.025, target: "player", label: "机关" }] },
  ),
};

// ---------------------------------------------------------------------------
// Elite affixes
// ---------------------------------------------------------------------------

function affix(
  id: string,
  name: string,
  description: string,
  effects: EliteAffixDefV1["effects"],
  forbiddenWith: string[] = [],
  extras: Partial<EliteAffixDefV1> = {},
): EliteAffixDefV1 {
  return {
    id,
    name,
    description,
    scope: "enemy",
    effects,
    forbiddenWith,
    ...extras,
  };
}

export const ELITE_AFFIXES_V1: Record<string, EliteAffixDefV1> = {
  affix_tiebi: affix("affix_tiebi", "铁壁", "防御 +30%，身法 -10%。", [
    { target: "enemy", stat: "defense", mode: "scale", value: 0.3 },
    { target: "enemy", stat: "speed", mode: "scale", value: -0.1 },
  ], ["affix_hufa"]),
  affix_kuangbao: affix("affix_kuangbao", "狂暴", "攻击 +20%，受到伤害 +8%。", [
    { target: "enemy", stat: "attack", mode: "scale", value: 0.2 },
    { target: "enemy", stat: "damageTakenPct", mode: "add", value: 0.08 },
  ], ["affix_fanzhen"]),
  affix_duwu: affix("affix_duwu", "毒雾", "每 2 回合毒伤 2% 气血。", [], [], {
    rules: [{ kind: "periodicDamage", every: 2, pctMaxHp: 0.02, target: "player", label: "毒雾" }],
  }),
  affix_fengxue: affix("affix_fengxue", "封穴", "状态命中 +15%。", [
    { target: "enemy", stat: "statusHit", mode: "add", value: 0.15 },
  ]),
  affix_fanzhen: affix("affix_fanzhen", "反震", "反伤 +10%。", [
    { target: "enemy", stat: "reflect", mode: "add", value: 0.1 },
  ], ["affix_kuangbao"]),
  affix_xunji: affix("affix_xunji", "迅捷", "身法 +20%。", [
    { target: "enemy", stat: "speed", mode: "scale", value: 0.2 },
  ]),
  affix_xixing: affix("affix_xixing", "吸星", "玩家回合回内力 -30%。", [
    { target: "player", stat: "innerRegen", mode: "scale", value: -0.3 },
  ]),
  affix_hufa: affix("affix_hufa", "护法", "减伤 +10%。", [
    { target: "enemy", stat: "damageReduction", mode: "add", value: 0.1 },
  ], ["affix_tiebi"]),
  affix_liejia: affix("affix_liejia", "裂甲", "玩家防御 -15%，敌方攻击 +5%。", [
    { target: "player", stat: "defense", mode: "scale", value: -0.15 },
    { target: "enemy", stat: "attack", mode: "scale", value: 0.05 },
  ]),
  affix_guiyuan: affix("affix_guiyuan", "归元", "每 3 回合回复 3% 气血。", [], [], {
    rules: [{ kind: "healing", every: 3, pct: 0.03, target: "enemy", label: "归元" }],
  }),
};

// ---------------------------------------------------------------------------
// Target drops
// ---------------------------------------------------------------------------

function target(
  id: string,
  name: string,
  source: TargetDropDefV1["source"],
  chance: number,
  pityThreshold: number,
  pityStep: number,
): TargetDropDefV1 {
  return { id, name, source, chance, pityThreshold, pityStep, maxChance: 0.5 };
}

const TARGETS: TargetDropDefV1[] = [
  target("td_luoyang_page", "破军刀法残页", "normal", 0.08, 8, 0.02),
  target("td_luoyang_belt", "擂台束带", "elite", 0.06, 10, 0.03),
  target("td_luoyang_seal", "擂主印", "boss", 0.05, 12, 0.04),

  target("td_huanghe_page", "铁布衫残页", "normal", 0.08, 8, 0.02),
  target("td_huanghe_jade", "渡口古玉", "elite", 0.06, 10, 0.03),
  target("td_huanghe_river", "河神鳞", "boss", 0.05, 12, 0.04),

  target("td_caoyun_page", "分筋错骨手残页", "normal", 0.08, 8, 0.02),
  target("td_caoyun_rope", "漕帮绳结", "elite", 0.06, 10, 0.03),
  target("td_caoyun_tally", "漕运令", "boss", 0.05, 12, 0.04),

  target("td_yanchang_page", "盐铁账册残页", "normal", 0.08, 8, 0.02),
  target("td_yanchang_badge", "盐场腰牌", "elite", 0.06, 10, 0.03),
  target("td_yanchang_salt", "雪盐精", "boss", 0.05, 12, 0.04),

  target("td_biaoju_page", "镖局密函", "normal", 0.08, 8, 0.02),
  target("td_biaoju_order", "劫镖令", "elite", 0.06, 10, 0.03),
  target("td_biaoju_flag", "黑风旗", "boss", 0.05, 12, 0.04),

  target("td_jinding_page", "纯阳无极功残页", "normal", 0.08, 8, 0.02),
  target("td_jinding_tassel", "金顶剑穗", "elite", 0.06, 10, 0.03),
  target("td_jinding_manual", "玄微剑谱", "boss", 0.05, 12, 0.04),

  target("td_jiejianchi_page", "太极剑残页", "normal", 0.08, 8, 0.02),
  target("td_jiejianchi_plaque", "解剑令", "elite", 0.06, 10, 0.03),
  target("td_jiejianchi_iron", "剑池寒铁", "boss", 0.05, 12, 0.04),

  target("td_duanqiao_page", "落英剑法残页", "normal", 0.08, 8, 0.02),
  target("td_duanqiao_umbrella", "油纸伞", "elite", 0.06, 10, 0.03),
  target("td_duanqiao_tassel", "湖心剑穗", "boss", 0.05, 12, 0.04),

  target("td_huxinting_page", "听雨心法残页", "normal", 0.08, 8, 0.02),
  target("td_huxinting_jade", "画舫玉佩", "elite", 0.06, 10, 0.03),
  target("td_huxinting_poem", "谢临诗帖", "boss", 0.05, 12, 0.04),

  target("td_heishi_page", "玄阴经残页", "normal", 0.08, 8, 0.02),
  target("td_heishi_token", "黑市令牌", "elite", 0.06, 10, 0.03),
  target("td_heishi_mask", "黑市面具", "boss", 0.05, 12, 0.04),

  target("td_jianzhong_page", "剑冢残页", "normal", 0.08, 8, 0.02),
  target("td_jianzhong_shard", "剑冢碎片", "elite", 0.06, 10, 0.03),
  target("td_jianzhong_soul", "守灵剑魄", "boss", 0.05, 12, 0.04),

  target("td_gushan_page", "听雨剑谱残页", "normal", 0.08, 8, 0.02),
  target("td_gushan_hairpin", "梅枝玉簪", "elite", 0.06, 10, 0.03),
  target("td_gushan_intent", "梅林剑意", "boss", 0.05, 12, 0.04),

  target("td_mudao_page", "封穴手残页", "normal", 0.08, 8, 0.02),
  target("td_mudao_lamp", "长明灯", "elite", 0.06, 10, 0.03),
  target("td_mudao_nail", "墓道铜钉", "boss", 0.05, 12, 0.04),

  target("td_digong_page", "地宫古谱残页", "normal", 0.08, 8, 0.02),
  target("td_digong_gear", "机关齿轮", "elite", 0.06, 10, 0.03),
  target("td_digong_seal", "石王印", "boss", 0.05, 12, 0.04),

  target("td_zhumu_page", "越王古谱残页", "normal", 0.08, 8, 0.02),
  target("td_zhumu_jade", "墓主玉佩", "elite", 0.06, 10, 0.03),
  target("td_zhumu_sword", "越王剑魄", "boss", 0.05, 12, 0.04),
];

export const TARGET_DROPS_V1: Record<string, TargetDropDefV1> = Object.fromEntries(
  TARGETS.map((entry) => [entry.id, entry]),
);

// ---------------------------------------------------------------------------
// 30 normal monsters, 10 elites
// ---------------------------------------------------------------------------

function unit(
  id: string,
  name: string,
  region: RegionId,
  style: EnemyUnitDefV1["style"],
  element: Element,
  rank: EnemyUnitDefV1["rank"] = "normal",
): EnemyUnitDefV1 {
  const elite = rank === "elite";
  return {
    id,
    name,
    region,
    style,
    element,
    rank,
    hpMult: elite ? 2.1 : 1,
    atkMult: elite ? 1.25 : 1,
    defMult: elite ? 1.15 : 1,
    speedMult: elite ? 1.02 : 1,
  };
}

export const NORMALS_V1: Record<string, EnemyUnitDefV1> = Object.fromEntries([
  // 中原
  unit("n_zhongyuan_blade", "刀客", "zhongyuan", "gang", "gang"),
  unit("n_zhongyuan_fist", "拳师", "zhongyuan", "gang", "gang"),
  unit("n_zhongyuan_escort", "镖师", "zhongyuan", "rou", "rou"),
  unit("n_zhongyuan_constable", "捕快", "zhongyuan", "kuai", "rou"),
  unit("n_zhongyuan_arena", "擂台打手", "zhongyuan", "gang", "gang"),
  unit("n_zhongyuan_bandit", "黑风喽啰", "zhongyuan", "kuai", "gang"),
  // 武当
  unit("n_wudang_sword", "道剑", "wudang", "rou", "rou"),
  unit("n_wudang_page", "剑僮", "wudang", "rou", "rou"),
  unit("n_wudang_wanderer", "云游客", "wudang", "rou", "yang"),
  unit("n_wudang_guard", "守山弟子", "wudang", "rou", "rou"),
  unit("n_wudang_swordsman", "入世剑客", "wudang", "kuai", "rou"),
  unit("n_wudang_puppet", "剑冢傀儡", "wudang", "rou", "rou"),
  // 西湖
  unit("n_xihu_guard", "护院", "xihu", "rou", "rou"),
  unit("n_xihu_assassin", "刺客", "xihu", "kuai", "rou"),
  unit("n_xihu_boatguard", "画舫护卫", "xihu", "kuai", "rou"),
  unit("n_xihu_servant", "世家家丁", "xihu", "rou", "rou"),
  unit("n_xihu_scholar", "书院剑生", "xihu", "rou", "yang"),
  unit("n_xihu_lakebandit", "湖匪", "xihu", "kuai", "rou"),
  // 扬州
  unit("n_yangzhou_water", "水匪", "yangzhou", "kuai", "rou"),
  unit("n_yangzhou_ghost", "水鬼", "yangzhou", "gui", "yin"),
  unit("n_yangzhou_river", "漕帮打手", "yangzhou", "gang", "gang"),
  unit("n_yangzhou_salt", "盐丁", "yangzhou", "gang", "gang"),
  unit("n_yangzhou_market", "黑市刀客", "yangzhou", "kuai", "rou"),
  unit("n_yangzhou_smuggler", "盐枭", "yangzhou", "gui", "yin"),
  // 汉越墓
  unit("n_hanyue_robber", "盗墓贼", "hanyue", "gui", "yin"),
  unit("n_hanyue_corpse", "尸傀", "hanyue", "gui", "yin"),
  unit("n_hanyue_keeper", "守墓人", "hanyue", "gang", "gang"),
  unit("n_hanyue_puppet", "地宫傀儡", "hanyue", "gui", "yin"),
  unit("n_hanyue_wraith", "阴煞", "hanyue", "gui", "yin"),
  unit("n_hanyue_worm", "墓道毒虫", "hanyue", "gui", "yin"),
].map((entry) => [entry.id, entry]));

export const ELITES_V1: Record<string, EnemyUnitDefV1> = Object.fromEntries([
  unit("e_elite_gold", "金牌打手", "zhongyuan", "gang", "gang", "elite"),
  unit("e_elite_river", "河鬼", "zhongyuan", "gui", "yin", "elite"),
  unit("e_elite_sword", "剑冢傀儡", "wudang", "rou", "rou", "elite"),
  unit("e_elite_court", "世家供奉", "xihu", "rou", "rou", "elite"),
  unit("e_elite_tomb", "无面守墓", "hanyue", "gui", "yin", "elite"),
  unit("e_elite_salt", "盐场管事", "yangzhou", "gang", "gang", "elite"),
  unit("e_elite_boat", "漕帮香主", "yangzhou", "gang", "gang", "elite"),
  unit("e_elite_ink", "书院执笔", "xihu", "rou", "yang", "elite"),
  unit("e_elite_wraith", "阴煞统领", "hanyue", "gui", "yin", "elite"),
  unit("e_elite_swordmaster", "入世剑首", "wudang", "kuai", "rou", "elite"),
].map((entry) => [entry.id, entry]));

// ---------------------------------------------------------------------------
// Bosses: 9 map-level + 5 chapter + 1 final
// ---------------------------------------------------------------------------

const BASE_PATTERNS: Record<string, BattleEnemyMove[]> = {
  gang: [
    { id: "b_heavy", name: "力劈华山", type: "shi", element: "gang", coefficient: 1.2, effect: "heavy" },
    { id: "b_sweep", name: "横扫千军", type: "shi", element: "gang", coefficient: 0.8 },
    { id: "b_guard", name: "铁壁", type: "jia", element: "gang", coefficient: 0.2, effect: "guard" },
    { id: "b_charge", name: "蓄势", type: "qi", element: "gang", coefficient: 0, effect: "charge" },
  ],
  rou: [
    { id: "b_sword", name: "白虹贯日", type: "shi", element: "rou", coefficient: 0.95 },
    { id: "b_softguard", name: "回风拂柳", type: "jia", element: "rou", coefficient: 0.2, effect: "guard" },
    { id: "b_step", name: "虚步探花", type: "xu", element: "rou", coefficient: 0.6 },
    { id: "b_softcharge", name: "蓄势", type: "qi", element: "rou", coefficient: 0, effect: "charge" },
  ],
  kuai: [
    { id: "b_thrust", name: "疾风刺", type: "shi", element: "rou", coefficient: 0.9 },
    { id: "b_shadow", name: "影步", type: "jia", element: "rou", coefficient: 0.2, effect: "guard" },
    { id: "b_kill", name: "夺命刺", type: "shi", element: "rou", coefficient: 1.25, effect: "heavy" },
    { id: "b_fastcharge", name: "蓄势", type: "qi", element: "rou", coefficient: 0, effect: "charge" },
  ],
  gui: [
    { id: "b_claw", name: "阴爪", type: "shi", element: "yin", coefficient: 1.0 },
    { id: "b_seal", name: "封穴", type: "xu", element: "yin", coefficient: 0.4, effect: "stun", statusChance: 0.45 },
    { id: "b_poison", name: "毒砂", type: "qi", element: "yin", coefficient: 0.5, effect: "poison", statusChance: 0.8 },
    { id: "b_ghost", name: "鬼影", type: "jia", element: "yin", coefficient: 0.2, effect: "guard" },
  ],
};

function basePattern(style: string, prefix: string): BattleEnemyMove[] {
  return (BASE_PATTERNS[style] ?? BASE_PATTERNS.gang).map((move) => ({
    ...move,
    id: `${prefix}_${move.id}`,
  }));
}

function signatureMove(
  id: string,
  name: string,
  type: BattleEnemyMove["type"],
  element: Element,
  coefficient: number,
  effect: BattleEnemyMove["effect"] = "none",
  statusChance?: number,
): BattleEnemyMove {
  return { id, name, type, element, coefficient, effect, statusChance, description: "首领标志招式" };
}

function phasesFor(
  style: string,
  prefix: string,
  signature: BattleEnemyMove,
  kind: BossKind,
): BattleEnemyPhaseV1[] {
  const base = basePattern(style, prefix);
  const phase1: BattleEnemyPhaseV1 = {
    name: "起势",
    threshold: 1,
    announcement: "首领起势，招式变缓，先看意图再出招",
    pattern: base,
  };
  if (kind === "map") {
    return [
      phase1,
      {
        name: "怒势",
        threshold: 0.5,
        announcement: "首领怒意上涌，标志招式即将出手",
        pattern: [signature, ...base.slice(0, 3)],
      },
    ];
  }
  if (kind === "chapter") {
    return [
      phase1,
      {
        name: "变势",
        threshold: 0.6,
        announcement: "首领换势，标志招式加入循环",
        pattern: [signature, ...base.slice(1)],
      },
      {
        name: "死势",
        threshold: 0.25,
        announcement: "首领拼命，招式更快更重",
        pattern: [signature, base[1], base[2], base[3]],
      },
    ];
  }
  return [
    phase1,
    {
      name: "王势",
      threshold: 0.65,
      announcement: "墓主苏醒，气机压过整座地宫",
      pattern: [signature, ...base.slice(1)],
    },
    {
      name: "终势",
      threshold: 0.3,
      announcement: "最后一段剑意，退无可退",
      pattern: [signature, base[2], signature, base[3]],
    },
  ];
}

function boss(
  id: string,
  name: string,
  region: RegionId,
  style: BossDefV1["style"],
  element: Element,
  kind: BossKind,
  tier: number,
  signature: BattleEnemyMove,
  signatureText: string,
  extras: Partial<BossDefV1> = {},
): BossDefV1 {
  const mult = kind === "final" ? { hp: 5.5, atk: 1.55, def: 1.45, speed: 1.1 }
    : kind === "chapter" ? { hp: 4.8, atk: 1.45, def: 1.35, speed: 1.08 }
      : { hp: 4.2, atk: 1.35, def: 1.25, speed: 1.05 };
  return {
    id,
    name,
    region,
    style,
    element,
    kind,
    tier,
    signature: signatureText,
    phases: phasesFor(style, id, signature, kind),
    hpMult: mult.hp,
    atkMult: mult.atk,
    defMult: mult.def,
    speedMult: mult.speed,
    damageCapPct: kind === "final" ? 0.15 : kind === "chapter" ? 0.16 : 0.18,
    reflectPct: kind === "final" ? 0.04 : kind === "chapter" ? 0.03 : 0.02,
    enrageAt: 0.35,
    ...extras,
  };
}

export const BOSSES_V1: Record<string, BossDefV1> = Object.fromEntries([
  boss("boss_lei", "擂主·雷震", "zhongyuan", "gang", "gang", "map", 1, signatureMove("sig_lei", "雷震八方", "shi", "gang", 1.4, "heavy"), "雷霆一击"),
  boss("boss_he", "河神·韩蛟", "zhongyuan", "gui", "yin", "map", 2, signatureMove("sig_he", "蛟龙出水", "qi", "yin", 0.9, "poison", 0.9), "河神怒潮"),
  boss("boss_chen", "漕帮舵主·陈四海", "yangzhou", "gang", "gang", "map", 1, signatureMove("sig_chen", "铁索横江", "jia", "gang", 0.3, "guard"), "铁索拦江"),
  boss("boss_qian", "盐商总管·钱万金", "yangzhou", "gui", "yin", "map", 2, signatureMove("sig_qian", "盐毒掌", "shi", "yin", 1.1, "poison", 0.9), "盐毒入骨"),
  boss("boss_heifeng", "黑风寨主", "zhongyuan", "gang", "gang", "chapter", 3, signatureMove("sig_heifeng", "黑风夺命", "shi", "gang", 1.5, "heavy"), "黑风夺命"),
  boss("boss_xuanwei", "执剑长老·玄微", "wudang", "rou", "rou", "map", 2, signatureMove("sig_xuanwei", "玄微剑罡", "shi", "rou", 1.35), "玄微剑罡"),
  boss("boss_swordpool", "剑池老人", "wudang", "rou", "rou", "map", 3, signatureMove("sig_pool", "万剑归池", "qi", "rou", 0.8, "charge"), "万剑归池"),
  boss("boss_swordtomb", "剑冢守灵", "wudang", "kuai", "rou", "chapter", 4, signatureMove("sig_tomb", "剑冢怨气", "qi", "rou", 0.9, "charge"), "剑冢怨气"),
  boss("boss_lake", "湖匪头目", "xihu", "kuai", "rou", "map", 2, signatureMove("sig_lake", "湖波暗涌", "xu", "rou", 0.8, "stun", 0.55), "湖波暗涌"),
  boss("boss_xie", "世家少主·谢临", "xihu", "rou", "rou", "map", 3, signatureMove("sig_xie", "世家剑意", "shi", "rou", 1.3), "世家剑意"),
  boss("boss_meilin", "梅林剑客", "xihu", "kuai", "rou", "chapter", 4, signatureMove("sig_meilin", "梅枝点穴", "xu", "rou", 0.7, "stun", 0.6), "梅林封穴"),
  boss("boss_blackmarket", "黑市之主", "yangzhou", "kuai", "rou", "chapter", 3, signatureMove("sig_market", "黑市毒砂", "qi", "yin", 0.8, "poison", 0.9), "黑市毒砂"),
  boss("boss_tombgeneral", "墓道守将", "hanyue", "gui", "yin", "map", 4, signatureMove("sig_general", "墓道断魂", "shi", "yin", 1.4, "heavy"), "墓道断魂"),
  boss("boss_stoneking", "地宫石王", "hanyue", "gang", "gang", "chapter", 5, signatureMove("sig_stone", "石王护体", "jia", "gang", 0.3, "guard"), "石王护体"),
  boss("boss_yuewang", "墓主·越王", "hanyue", "gui", "yin", "final", 6, signatureMove("sig_yue", "越王剑魄", "shi", "yin", 1.55, "heavy"), "越王剑魄"),
].map((entry) => [entry.id, entry]));

// ---------------------------------------------------------------------------
// Regions and 15 maps
// ---------------------------------------------------------------------------

function region(
  id: RegionId,
  name: string,
  chapterIndex: number,
  maps: string[],
  eliteAffixPool: string[],
  modifierPool: string[],
): RegionDefV1 {
  return { id, name, chapterIndex, maps, eliteAffixPool, modifierPool };
}

export const REGIONS_V1: RegionDefV1[] = [
  region("zhongyuan", "中原", 1,
    ["luoyang", "huanghe", "biaoju"],
    ["affix_tiebi", "affix_kuangbao", "affix_xunji", "affix_xixing"],
    ["mod_zhongyuan_arena", "mod_zhongyuan_fame", "mod_zhongyuan_wind", "mod_zhongyuan_river", "mod_zhongyuan_night", "mod_zhongyuan_hard"]),
  region("wudang", "武当", 2,
    ["jinding", "jiejianchi", "jianzhong"],
    ["affix_hufa", "affix_liejia", "affix_fanzhen", "affix_xunji"],
    ["mod_wudang_cloud", "mod_wudang_sword", "mod_wudang_quiet"]),
  region("xihu", "西湖", 3,
    ["duanqiao", "huxinting", "gushan"],
    ["affix_duwu", "affix_fengxue", "affix_xixing", "affix_hufa"],
    ["mod_xihu_rain", "mod_xihu_slippery", "mod_xihu_elegance"]),
  region("yangzhou", "扬州", 4,
    ["caoyun", "yanchang", "heishi"],
    ["affix_kuangbao", "affix_guiyuan", "affix_fengxue", "affix_duwu"],
    ["mod_yangzhou_patrol", "mod_yangzhou_trade", "mod_yangzhou_dark", "mod_yangzhou_salt"]),
  region("hanyue", "汉越墓", 5,
    ["mudao", "digong", "zhumu"],
    ["affix_fanzhen", "affix_liejia", "affix_guiyuan", "affix_tiebi"],
    ["mod_hanyue_poison", "mod_hanyue_yin", "mod_hanyue_trap"]),
];

interface MapSeed {
  id: string;
  name: string;
  region: RegionId;
  order: 1 | 2 | 3;
  tier: number;
  unlockRealm: number;
  previous: string | null;
  normals: string[];
  elites: [string, string];
  bossId: string;
  modifiers: string[];
  targets: [string, string, string];
  unlockMapId: string | null;
  firstClearLog: string;
}

const MAP_SEEDS: MapSeed[] = [
  {
    id: "luoyang", name: "洛阳擂台", region: "zhongyuan", order: 1, tier: 1, unlockRealm: 0, previous: null,
    normals: ["n_zhongyuan_blade", "n_zhongyuan_fist", "n_zhongyuan_arena", "n_zhongyuan_escort"],
    elites: ["e_elite_gold", "e_elite_river"], bossId: "boss_lei",
    modifiers: ["mod_zhongyuan_arena", "mod_zhongyuan_fame"],
    targets: ["td_luoyang_page", "td_luoyang_belt", "td_luoyang_seal"],
    unlockMapId: "huanghe", firstClearLog: "擂台易主，洛阳的江湖帖换了名字。",
  },
  {
    id: "huanghe", name: "黄河渡口", region: "zhongyuan", order: 2, tier: 1, unlockRealm: 0, previous: "luoyang",
    normals: ["n_zhongyuan_escort", "n_zhongyuan_bandit", "n_zhongyuan_constable", "n_zhongyuan_fist", "n_zhongyuan_blade"],
    elites: ["e_elite_river", "e_elite_boat"], bossId: "boss_he",
    modifiers: ["mod_zhongyuan_wind", "mod_zhongyuan_river", "mod_zhongyuan_fame"],
    targets: ["td_huanghe_page", "td_huanghe_jade", "td_huanghe_river"],
    unlockMapId: "biaoju", firstClearLog: "河神退去，渡口的船终于敢在夜里点灯。",
  },
  {
    id: "biaoju", name: "镖局古道", region: "zhongyuan", order: 3, tier: 2, unlockRealm: 1, previous: "huanghe",
    normals: ["n_zhongyuan_escort", "n_zhongyuan_bandit", "n_zhongyuan_blade", "n_zhongyuan_constable", "n_zhongyuan_arena"],
    elites: ["e_elite_gold", "e_elite_river"], bossId: "boss_heifeng",
    modifiers: ["mod_zhongyuan_night", "mod_zhongyuan_hard"],
    targets: ["td_biaoju_page", "td_biaoju_order", "td_biaoju_flag"],
    unlockMapId: "jinding", firstClearLog: "黑风旗倒下，中原的镖路重新通了。",
  },
  {
    id: "caoyun", name: "漕运码头", region: "yangzhou", order: 1, tier: 1, unlockRealm: 0, previous: null,
    normals: ["n_yangzhou_water", "n_yangzhou_river", "n_yangzhou_salt", "n_yangzhou_market"],
    elites: ["e_elite_boat", "e_elite_salt"], bossId: "boss_chen",
    modifiers: ["mod_yangzhou_patrol", "mod_yangzhou_trade"],
    targets: ["td_caoyun_page", "td_caoyun_rope", "td_caoyun_tally"],
    unlockMapId: "yanchang", firstClearLog: "漕帮让开码头，扬州的生意重新开张。",
  },
  {
    id: "yanchang", name: "扬州盐场", region: "yangzhou", order: 2, tier: 1, unlockRealm: 0, previous: "caoyun",
    normals: ["n_yangzhou_salt", "n_yangzhou_river", "n_yangzhou_smuggler", "n_yangzhou_water", "n_yangzhou_market"],
    elites: ["e_elite_salt", "e_elite_boat"], bossId: "boss_qian",
    modifiers: ["mod_yangzhou_dark", "mod_yangzhou_salt", "mod_yangzhou_trade"],
    targets: ["td_yanchang_page", "td_yanchang_badge", "td_yanchang_salt"],
    unlockMapId: "heishi", firstClearLog: "盐场的账册见光，钱万金的影子退进黑市。",
  },
  {
    id: "heishi", name: "黑市", region: "yangzhou", order: 3, tier: 3, unlockRealm: 2, previous: "yanchang",
    normals: ["n_yangzhou_market", "n_yangzhou_smuggler", "n_yangzhou_water", "n_yangzhou_ghost", "n_yangzhou_salt"],
    elites: ["e_elite_court", "e_elite_boat"], bossId: "boss_blackmarket",
    modifiers: ["mod_yangzhou_dark", "mod_yangzhou_patrol", "mod_yangzhou_trade"],
    targets: ["td_heishi_page", "td_heishi_token", "td_heishi_mask"],
    unlockMapId: "mudao", firstClearLog: "黑市换了主人，扬州的暗线第一次照到墓道。",
  },
  {
    id: "jinding", name: "武当金顶", region: "wudang", order: 1, tier: 2, unlockRealm: 1, previous: "biaoju",
    normals: ["n_wudang_sword", "n_wudang_page", "n_wudang_wanderer", "n_wudang_guard"],
    elites: ["e_elite_sword", "e_elite_swordmaster"], bossId: "boss_xuanwei",
    modifiers: ["mod_wudang_cloud", "mod_wudang_sword"],
    targets: ["td_jinding_page", "td_jinding_tassel", "td_jinding_manual"],
    unlockMapId: "jiejianchi", firstClearLog: "金顶钟声三响，玄微长老收剑入鞘。",
  },
  {
    id: "jiejianchi", name: "解剑池", region: "wudang", order: 2, tier: 3, unlockRealm: 2, previous: "jinding",
    normals: ["n_wudang_guard", "n_wudang_wanderer", "n_wudang_swordsman", "n_wudang_sword"],
    elites: ["e_elite_sword", "e_elite_swordmaster"], bossId: "boss_swordpool",
    modifiers: ["mod_wudang_sword", "mod_wudang_quiet", "mod_wudang_cloud"],
    targets: ["td_jiejianchi_page", "td_jiejianchi_plaque", "td_jiejianchi_iron"],
    unlockMapId: "jianzhong", firstClearLog: "剑池水冷，解下的剑里有一把认出了你。",
  },
  {
    id: "jianzhong", name: "后山剑冢", region: "wudang", order: 3, tier: 4, unlockRealm: 3, previous: "jiejianchi",
    normals: ["n_wudang_puppet", "n_wudang_swordsman", "n_wudang_page", "n_wudang_guard", "n_wudang_wanderer"],
    elites: ["e_elite_sword", "e_elite_swordmaster"], bossId: "boss_swordtomb",
    modifiers: ["mod_wudang_cloud", "mod_wudang_quiet", "mod_wudang_sword"],
    targets: ["td_jianzhong_page", "td_jianzhong_shard", "td_jianzhong_soul"],
    unlockMapId: "duanqiao", firstClearLog: "剑冢守灵散去，武当的旧债有了一个名字。",
  },
  {
    id: "duanqiao", name: "西湖断桥", region: "xihu", order: 1, tier: 2, unlockRealm: 1, previous: "jianzhong",
    normals: ["n_xihu_guard", "n_xihu_boatguard", "n_xihu_scholar", "n_xihu_lakebandit"],
    elites: ["e_elite_court", "e_elite_ink"], bossId: "boss_lake",
    modifiers: ["mod_xihu_rain", "mod_xihu_slippery"],
    targets: ["td_duanqiao_page", "td_duanqiao_umbrella", "td_duanqiao_tassel"],
    unlockMapId: "huxinting", firstClearLog: "断桥的雨停了，湖匪的船退进雾里。",
  },
  {
    id: "huxinting", name: "湖心亭", region: "xihu", order: 2, tier: 3, unlockRealm: 2, previous: "duanqiao",
    normals: ["n_xihu_scholar", "n_xihu_servant", "n_xihu_boatguard", "n_xihu_guard", "n_xihu_assassin"],
    elites: ["e_elite_court", "e_elite_ink"], bossId: "boss_xie",
    modifiers: ["mod_xihu_elegance", "mod_xihu_rain", "mod_xihu_slippery"],
    targets: ["td_huxinting_page", "td_huxinting_jade", "td_huxinting_poem"],
    unlockMapId: "gushan", firstClearLog: "画舫的灯还亮着，谢临的诗帖被人收进了袖中。",
  },
  {
    id: "gushan", name: "孤山梅林", region: "xihu", order: 3, tier: 4, unlockRealm: 3, previous: "huxinting",
    normals: ["n_xihu_lakebandit", "n_xihu_assassin", "n_xihu_scholar", "n_xihu_guard", "n_xihu_servant"],
    elites: ["e_elite_court", "e_elite_ink"], bossId: "boss_meilin",
    modifiers: ["mod_xihu_slippery", "mod_xihu_elegance", "mod_xihu_rain"],
    targets: ["td_gushan_page", "td_gushan_hairpin", "td_gushan_intent"],
    unlockMapId: null, firstClearLog: "梅林剑客折枝为剑，西湖这一章有了结尾。",
  },
  {
    id: "mudao", name: "汉越墓道", region: "hanyue", order: 1, tier: 4, unlockRealm: 3, previous: "heishi",
    normals: ["n_hanyue_robber", "n_hanyue_corpse", "n_hanyue_keeper", "n_hanyue_worm"],
    elites: ["e_elite_tomb", "e_elite_wraith"], bossId: "boss_tombgeneral",
    modifiers: ["mod_hanyue_poison", "mod_hanyue_yin"],
    targets: ["td_mudao_page", "td_mudao_lamp", "td_mudao_nail"],
    unlockMapId: "digong", firstClearLog: "墓道守将倒下，长明灯照出向下的台阶。",
  },
  {
    id: "digong", name: "地宫", region: "hanyue", order: 2, tier: 5, unlockRealm: 4, previous: "mudao",
    normals: ["n_hanyue_puppet", "n_hanyue_wraith", "n_hanyue_keeper", "n_hanyue_robber", "n_hanyue_corpse"],
    elites: ["e_elite_tomb", "e_elite_wraith"], bossId: "boss_stoneking",
    modifiers: ["mod_hanyue_trap", "mod_hanyue_poison", "mod_hanyue_yin"],
    targets: ["td_digong_page", "td_digong_gear", "td_digong_seal"],
    unlockMapId: "zhumu", firstClearLog: "石王印裂，地宫最深处传来剑鸣。",
  },
  {
    id: "zhumu", name: "主墓", region: "hanyue", order: 3, tier: 6, unlockRealm: 5, previous: "digong",
    normals: ["n_hanyue_wraith", "n_hanyue_puppet", "n_hanyue_corpse", "n_hanyue_worm", "n_hanyue_keeper"],
    elites: ["e_elite_tomb", "e_elite_wraith"], bossId: "boss_yuewang",
    modifiers: ["mod_hanyue_yin", "mod_hanyue_trap", "mod_hanyue_poison"],
    targets: ["td_zhumu_page", "td_zhumu_jade", "td_zhumu_sword"],
    unlockMapId: null, firstClearLog: "越王剑归鞘，五地区的旧事在墓门外合上。",
  },
];

function toMap(seed: MapSeed): WorldMapDefV1 {
  const boss = BOSSES_V1[seed.bossId];
  return {
    id: seed.id,
    name: seed.name,
    region: seed.region,
    orderInRegion: seed.order,
    tier: seed.tier,
    unlockRealm: seed.unlockRealm,
    previousMapId: seed.previous,
    normalPool: seed.normals,
    eliteIds: seed.elites,
    bossId: seed.bossId,
    modifiers: seed.modifiers,
    targetDrops: seed.targets,
    firstClear: {
      renown: 80 + boss.tier * 20,
      silver: 120 + boss.tier * 60,
      targetDropId: seed.targets[2],
      unlockMapId: seed.unlockMapId,
      log: seed.firstClearLog,
    },
  };
}

export const MAPS_V1: WorldMapDefV1[] = MAP_SEEDS.map(toMap);

export const WORLD_CONTENT_V1: WorldContentV1 = {
  regions: REGIONS_V1,
  maps: MAPS_V1,
  normals: NORMALS_V1,
  elites: ELITES_V1,
  bosses: BOSSES_V1,
  eliteAffixes: ELITE_AFFIXES_V1,
  mapModifiers: MAP_MODIFIERS_V1,
  targetDrops: TARGET_DROPS_V1,
  startingMapIds: ["luoyang", "caoyun"],
  eliteAffixForbiddenPairs: [
    ["affix_tiebi", "affix_hufa"],
    ["affix_kuangbao", "affix_fanzhen"],
  ],
};

// ---------------------------------------------------------------------------
// Battle adapter: encounters -> the Combat v1 enemy input.
// A 1–3 enemy encounter is composed into one battle enemy so the single
// resolveBattle seam stays the only combat engine.
// ---------------------------------------------------------------------------

function unitBattleStats(unit: EnemyUnitDefV1, level: number) {
  return {
    hp: 420 * (1 + 0.13 * (level - 1)) * unit.hpMult,
    attack: 58 * (1 + 0.10 * (level - 1)) * unit.atkMult,
    defense: (22 + 2.4 * (level - 1)) * unit.defMult,
    speed: (40 + 1.2 * (level - 1)) * unit.speedMult,
  };
}

function patternForStyle(style: string, prefix: string): BattleEnemyMove[] {
  return (BASE_PATTERNS[style] ?? BASE_PATTERNS.gang).map((move) => ({
    ...move,
    id: `${prefix}_${move.id}`,
  }));
}

export function encounterBattleModifiers(encounter: EncounterDefV1): BattleModifier[] {
  const modifiers: BattleModifier[] = [];
  for (const id of encounter.modifierIds) {
    const modifier = MAP_MODIFIERS_V1[id];
    if (modifier) modifiers.push(modifier);
  }
  for (const id of encounter.eliteAffixIds) {
    const affix = ELITE_AFFIXES_V1[id];
    if (affix) modifiers.push(affix);
  }
  return modifiers;
}

export function rewardPctForEncounter(encounter: EncounterDefV1): number {
  return encounter.modifierIds.reduce(
    (sum, id) => sum + (MAP_MODIFIERS_V1[id]?.rewardPct ?? 0),
    0,
  );
}

export function createEncounterBattle(encounter: EncounterDefV1): BattleEnemyDef {
  const level = encounter.level;
  const boss = encounter.kind === "boss" ? BOSSES_V1[encounter.enemyIds[0]] : undefined;
  if (boss) {
    const base = {
      hp: 420 * (1 + 0.13 * (level - 1)) * boss.hpMult,
      attack: 58 * (1 + 0.10 * (level - 1)) * boss.atkMult,
      defense: (22 + 2.4 * (level - 1)) * boss.defMult,
      speed: (40 + 1.2 * (level - 1)) * boss.speedMult,
    };
    return enemyBattleDef({
      id: boss.id,
      name: boss.name,
      style: boss.style,
      element: boss.element,
      level,
      ...base,
      pattern: boss.phases[0].pattern,
      phases: boss.phases,
      damageCapPct: boss.damageCapPct,
      reflectPct: boss.reflectPct,
      enrageAt: boss.enrageAt,
      enrageAttackPct: 0.2,
      affixIds: encounter.eliteAffixIds,
      statusResist: boss.kind === "final" ? 0.18 : boss.kind === "chapter" ? 0.14 : 0.1,
    });
  }

  const units: EnemyUnitDefV1[] = encounter.enemyIds.map((id) => {
    const unit = NORMALS_V1[id] ?? ELITES_V1[id];
    if (!unit) throw new Error(`Unknown encounter enemy: ${id}`);
    return unit;
  });
  if (units.length === 0) throw new Error("Encounter has no enemies");
  const stats = units.map((unit) => unitBattleStats(unit, level));
  const count = units.length;
  const hp = stats.reduce((sum, entry) => sum + entry.hp, 0) * (count > 1 ? 0.9 : 1);
  const attack = stats.reduce((sum, entry) => sum + entry.attack, 0) / count * (1 + 0.05 * (count - 1));
  const defense = stats.reduce((sum, entry) => sum + entry.defense, 0) / count;
  const speed = Math.max(...stats.map((entry) => entry.speed));
  const pattern: BattleEnemyMove[] = [];
  for (const [index, unit] of units.entries()) {
    pattern.push(...patternForStyle(unit.style, `${unit.id}_${index}`).slice(0, count > 1 ? 2 : 4));
  }
  const elite = encounter.kind === "elite";
  return enemyBattleDef({
    id: `${encounter.mapId}_${encounter.layer}`,
    name: units.map((unit) => unit.name).join("、"),
    style: units[0].style,
    element: units[0].element,
    level,
    hp,
    attack,
    defense,
    speed,
    pattern: pattern.length > 0 ? pattern : patternForStyle(units[0].style, units[0].id),
    statusResist: elite ? 0.1 : 0.03,
    affixIds: encounter.eliteAffixIds,
  });
}

export function mapById(id: string): WorldMapDefV1 {
  const map = MAPS_V1.find((entry) => entry.id === id);
  if (!map) throw new Error(`Unknown map: ${id}`);
  return map;
}

export function regionById(id: RegionId): RegionDefV1 {
  const region = REGIONS_V1.find((entry) => entry.id === id);
  if (!region) throw new Error(`Unknown region: ${id}`);
  return region;
}
