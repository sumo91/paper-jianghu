import type { EnemyDef, EnemyMoveDef, EnemyStyle, Element, RegionId } from "../core/types.ts";

const GANG_MOVES: EnemyMoveDef[] = [
  { name: "力劈华山", type: "shi", element: "gang", coef: 1.2, effect: "heavy" },
  { name: "横扫千军", type: "shi", element: "gang", coef: 0.8, effect: "none" },
  { name: "铁壁", type: "jia", element: "gang", coef: 0.2, effect: "guard" },
  { name: "蓄势", type: "qi", element: "gang", coef: 0, effect: "charge" },
];

const ROU_MOVES: EnemyMoveDef[] = [
  { name: "白虹贯日", type: "shi", element: "rou", coef: 0.95, effect: "none" },
  { name: "回风拂柳", type: "jia", element: "rou", coef: 0.2, effect: "guard" },
  { name: "虚步探花", type: "xu", element: "rou", coef: 0.6, effect: "none" },
  { name: "蓄势", type: "qi", element: "rou", coef: 0, effect: "charge" },
];

const KUAI_MOVES: EnemyMoveDef[] = [
  { name: "疾风刺", type: "shi", element: "rou", coef: 0.9, effect: "none" },
  { name: "影步", type: "jia", element: "rou", coef: 0.2, effect: "guard" },
  { name: "夺命刺", type: "shi", element: "rou", coef: 1.25, effect: "heavy" },
  { name: "蓄势", type: "qi", element: "rou", coef: 0, effect: "charge" },
];

const GUI_MOVES: EnemyMoveDef[] = [
  { name: "阴爪", type: "shi", element: "yin", coef: 1.0, effect: "none" },
  { name: "封穴", type: "xu", element: "yin", coef: 0.4, effect: "stun" },
  { name: "毒砂", type: "qi", element: "yin", coef: 0.5, effect: "poison" },
  { name: "鬼影", type: "jia", element: "yin", coef: 0.2, effect: "guard" },
];

const STYLE_MOVES: Record<EnemyStyle, EnemyMoveDef[]> = {
  gang: GANG_MOVES,
  rou: ROU_MOVES,
  kuai: KUAI_MOVES,
  gui: GUI_MOVES,
};

const STYLE_STATS: Record<EnemyStyle, { hp: number; atk: number; def: number; speed: number }> = {
  gang: { hp: 1.0, atk: 1.12, def: 1.0, speed: 0.95 },
  rou: { hp: 1.1, atk: 0.95, def: 1.15, speed: 0.92 },
  kuai: { hp: 0.92, atk: 1.02, def: 0.9, speed: 1.12 },
  gui: { hp: 1.0, atk: 1.05, def: 0.95, speed: 1.02 },
};

function normal(
  id: string,
  name: string,
  region: RegionId,
  style: EnemyStyle,
  element: Element,
): EnemyDef {
  const base = STYLE_STATS[style];
  return {
    id,
    name,
    region,
    style,
    element,
    hpMult: base.hp,
    atkMult: base.atk,
    defMult: base.def,
    speedMult: base.speed,
    moves: STYLE_MOVES[style],
  };
}

function elite(
  id: string,
  name: string,
  region: RegionId,
  style: EnemyStyle,
  element: Element,
): EnemyDef {
  const base = STYLE_STATS[style];
  return {
    id,
    name,
    region,
    style,
    element,
    hpMult: base.hp * 2.3,
    atkMult: base.atk * 1.35,
    defMult: base.def * 1.25,
    speedMult: base.speed * 1.02,
    moves: STYLE_MOVES[style],
  };
}

function boss(
  id: string,
  name: string,
  region: RegionId,
  style: EnemyStyle,
  element: Element,
): EnemyDef {
  const base = STYLE_STATS[style];
  return {
    id,
    name,
    region,
    style,
    element,
    hpMult: base.hp * 4.6,
    atkMult: base.atk * 1.6,
    defMult: base.def * 1.35,
    speedMult: base.speed * 1.05,
    moves: STYLE_MOVES[style],
    boss: true,
    damageCapPct: 0.18,
    reflectPct: 0.08,
  };
}

export const ENEMIES: Record<string, EnemyDef> = {
  // 普通怪
  e_gang_blade: normal("e_gang_blade", "刀客", "zhongyuan", "gang", "gang"),
  e_gang_brawler: normal("e_gang_brawler", "拳师", "zhongyuan", "gang", "gang"),
  e_rou_sword: normal("e_rou_sword", "道剑", "wudang", "rou", "rou"),
  e_rou_guard: normal("e_rou_guard", "护院", "xihu", "rou", "rou"),
  e_kuai_thief: normal("e_kuai_thief", "水匪", "yangzhou", "kuai", "rou"),
  e_kuai_assassin: normal("e_kuai_assassin", "刺客", "xihu", "kuai", "rou"),
  e_gui_water: normal("e_gui_water", "水鬼", "yangzhou", "gui", "yin"),
  e_gui_cultivator: normal("e_gui_cultivator", "盗墓贼", "hanyue", "gui", "yin"),
  e_gui_puppet: normal("e_gui_puppet", "尸傀", "hanyue", "gui", "yin"),

  // 精英
  e_elite_gold: elite("e_elite_gold", "金牌打手", "zhongyuan", "gang", "gang"),
  e_elite_river: elite("e_elite_river", "河鬼", "zhongyuan", "gui", "yin"),
  e_elite_sword: elite("e_elite_sword", "剑冢傀儡", "wudang", "rou", "rou"),
  e_elite_court: elite("e_elite_court", "世家供奉", "xihu", "rou", "rou"),
  e_elite_tomb: elite("e_elite_tomb", "无面守墓", "hanyue", "gui", "yin"),

  // 首领
  boss_lei: boss("boss_lei", "擂主·雷震", "zhongyuan", "gang", "gang"),
  boss_he: boss("boss_he", "河神·韩蛟", "zhongyuan", "gui", "yin"),
  boss_heifeng: boss("boss_heifeng", "黑风寨主", "zhongyuan", "gang", "gang"),
  boss_xuanwei: boss("boss_xuanwei", "执剑长老·玄微", "wudang", "rou", "rou"),
  boss_swordpool: boss("boss_swordpool", "剑池老人", "wudang", "rou", "rou"),
  boss_swordtomb: boss("boss_swordtomb", "剑冢守灵", "wudang", "kuai", "rou"),
  boss_lake: boss("boss_lake", "湖匪头目", "xihu", "kuai", "rou"),
  boss_xie: boss("boss_xie", "世家少主·谢临", "xihu", "rou", "rou"),
  boss_meilin: boss("boss_meilin", "梅林剑客", "xihu", "kuai", "rou"),
  boss_chen: boss("boss_chen", "漕帮舵主·陈四海", "yangzhou", "gang", "gang"),
  boss_qian: boss("boss_qian", "盐商总管·钱万金", "yangzhou", "gui", "yin"),
  boss_blackmarket: boss("boss_blackmarket", "黑市之主", "yangzhou", "kuai", "rou"),
  boss_tombgeneral: boss("boss_tombgeneral", "墓道守将", "hanyue", "gui", "yin"),
  boss_stoneking: boss("boss_stoneking", "地宫石王", "hanyue", "gang", "gang"),
  boss_yuewang: boss("boss_yuewang", "墓主·越王", "hanyue", "gui", "yin"),
};

export function getEnemy(id: string): EnemyDef {
  const enemy = ENEMIES[id];
  if (!enemy) throw new Error(`Unknown enemy: ${id}`);
  return enemy;
}
