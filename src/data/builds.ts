import type { BuildDef, MoveDef, PriorityView } from "../core/types.ts";
import {
  COMPANIONS,
  heartsById,
  keystonesById,
  MOVES,
} from "./arts.ts";

function byId(moves: MoveDef[], id: string): MoveDef {
  const found = moves.find((m) => m.id === id);
  if (!found) throw new Error(`Move not in build: ${id}`);
  return found;
}

function ready(view: PriorityView, move: MoveDef): boolean {
  return (view.cooldowns[move.id] ?? 0) <= 0 && view.inner >= move.cost;
}

function fallback(view: PriorityView, moves: MoveDef[]): MoveDef {
  const available = moves.filter((m) => (view.cooldowns[m.id] ?? 0) <= 0 && view.inner >= m.cost);
  if (available.length > 0) {
    return [...available].sort((a, b) => a.cost - b.cost)[0];
  }
  return [...moves].sort((a, b) => a.cost - b.cost)[0];
}

// ---------------------------------------------------------------------------
// 太极反伤：用架招接实招，攒借力，再用揽雀尾/四两打回去
// ---------------------------------------------------------------------------
const taijiPriority = (view: PriorityView, moves: MoveDef[]): MoveDef => {
  const yun = byId(moves, "taiji_yunshou");
  const lan = byId(moves, "taiji_lanque");
  const bai = byId(moves, "taiji_baihe");
  const tui = byId(moves, "taiji_tuishou");
  const ult = byId(moves, "taiji_siliang");

  if (view.enemyIntent.type === "shi" && ready(view, yun) && view.borrow < 3) return yun;
  if (view.borrow >= 3 && ready(view, ult)) return ult;
  if (view.borrow >= 1 && ready(view, lan)) return lan;
  if (view.hpPct < 0.45 && ready(view, tui)) return tui;
  if (ready(view, bai)) return bai;
  if (ready(view, yun)) return yun;
  if (ready(view, tui)) return tui;
  return fallback(view, moves);
};

// ---------------------------------------------------------------------------
// 破军爆发：先破甲，再开血战，压低血线后斩杀
// ---------------------------------------------------------------------------
const pojunPriority = (view: PriorityView, moves: MoveDef[]): MoveDef => {
  const lipi = byId(moves, "pojun_lipi");
  const hengsao = byId(moves, "pojun_hengsao");
  const zhan = byId(moves, "pojun_zhan");
  const xuezhan = byId(moves, "pojun_xuezhan");
  const ult = byId(moves, "pojun_wanjun");

  if (view.armorBreak === 0 && ready(view, lipi)) return lipi;
  if (view.enemyIntent.type === "qi" && ready(view, lipi)) return lipi;
  if (view.attackBuff <= 0 && ready(view, xuezhan)) return xuezhan;
  if (view.enemyHpPct < 0.35 && ready(view, zhan)) return zhan;
  if (view.enemyHpPct < 0.5 && ready(view, ult)) return ult;
  if (ready(view, hengsao)) return hengsao;
  if (ready(view, lipi)) return lipi;
  if (ready(view, zhan)) return zhan;
  return fallback(view, moves);
};

// ---------------------------------------------------------------------------
// 玄阴封穴：先控住，再叠毒，最后引爆
// ---------------------------------------------------------------------------
const xuanyinPriority = (view: PriorityView, moves: MoveDef[]): MoveDef => {
  const zhi = byId(moves, "xuanyin_zhi");
  const fengxue = byId(moves, "xuanyin_fengxue");
  const shigu = byId(moves, "xuanyin_shigu");
  const yinfeng = byId(moves, "xuanyin_yinfeng");
  const ult = byId(moves, "xuanyin_wangu");

  if (!view.enemyStunned && ready(view, fengxue) && view.enemyStunned === false) {
    if (view.enemyIntent.type === "jia" || view.poison < 2) return fengxue;
  }
  if (view.poison < 3 && ready(view, shigu)) return shigu;
  if (view.attackBuff <= 0 && ready(view, yinfeng)) return yinfeng;
  if (view.poison >= 2 && ready(view, ult)) return ult;
  if (ready(view, zhi)) return zhi;
  if (ready(view, shigu)) return shigu;
  if (ready(view, fengxue)) return fengxue;
  return fallback(view, moves);
};

export const BUILDS: Record<string, BuildDef> = {
  taiji: {
    id: "taiji",
    name: "太极反伤",
    shortName: "太极",
    element: "taiji",
    base: {
      hp: 1200,
      attack: 108,
      defense: 100,
      speed: 52,
      crit: 0.05,
      innerMax: 120,
      innerRegen: 8,
    },
    growth: { hpPct: 0.075, attackPct: 0.052, defensePct: 0.06, speedPct: 0.008 },
    passives: {
      hpPct: 0.08,
      defensePct: 0.18,
      parryPct: 0.08,
      reflectPct: 0.06,
      damageReductionPct: 0.03,
    },
    moves: [
      MOVES.taiji_yunshou,
      MOVES.taiji_lanque,
      MOVES.taiji_baihe,
      MOVES.taiji_tuishou,
    ],
    ultimate: MOVES.taiji_siliang,
    heartMethods: heartsById(["hm_jieli", "hm_huiqi", "hm_shouzhuo", "hm_lianmian"]),
    keystones: keystonesById(["ks_yirou", "ks_guben"]),
    companionId: "comp_liuqing",
    setId: "set_taiji",
    priority: taijiPriority,
  },
  pojun: {
    id: "pojun",
    name: "破军爆发",
    shortName: "破军",
    element: "gang",
    base: {
      hp: 1060,
      attack: 102,
      defense: 66,
      speed: 62,
      crit: 0.07,
      innerMax: 100,
      innerRegen: 7,
    },
    growth: { hpPct: 0.06, attackPct: 0.07, defensePct: 0.04, speedPct: 0.01 },
    passives: {
      attackPct: 0.1,
      crit: 0.035,
      armorBreakPct: 0.12,
      damageReductionPct: 0.06,
    },
    moves: [
      MOVES.pojun_lipi,
      MOVES.pojun_hengsao,
      MOVES.pojun_zhan,
      MOVES.pojun_xuezhan,
    ],
    ultimate: MOVES.pojun_wanjun,
    heartMethods: heartsById(["hm_liejia", "hm_zhuifeng", "hm_shixin", "hm_kuangyi"]),
    keystones: keystonesById(["ks_jianqi", "ks_gongfa"]),
    companionId: "comp_guchangfeng",
    setId: "set_pojun",
    priority: pojunPriority,
  },
  xuanyin: {
    id: "xuanyin",
    name: "玄阴封穴",
    shortName: "玄阴",
    element: "yin",
    base: {
      hp: 1170,
      attack: 102,
      defense: 76,
      speed: 72,
      crit: 0.07,
      innerMax: 110,
      innerRegen: 9,
    },
    growth: { hpPct: 0.062, attackPct: 0.06, defensePct: 0.045, speedPct: 0.012 },
    passives: {
      speedPct: 0.1,
      poisonPct: 0.18,
      controlPct: 0.12,
      damageReductionPct: 0.04,
      poisonHealPct: 0.1,
    },
    moves: [
      MOVES.xuanyin_zhi,
      MOVES.xuanyin_fengxue,
      MOVES.xuanyin_shigu,
      MOVES.xuanyin_yinfeng,
    ],
    ultimate: MOVES.xuanyin_wangu,
    heartMethods: heartsById(["hm_shixin_yin", "hm_liejia_yin", "hm_huiqi_yin", "hm_lianmian_yin"]),
    keystones: keystonesById(["ks_taxue", "ks_dujing"]),
    companionId: "comp_moya",
    setId: "set_xuanyin",
    priority: xuanyinPriority,
  },
};

export const BUILD_IDS = Object.keys(BUILDS) as Array<keyof typeof BUILDS>;

export function getBuild(id: string): BuildDef {
  const build = BUILDS[id];
  if (!build) throw new Error(`Unknown build: ${id}`);
  return build;
}

export function getCompanion(build: BuildDef) {
  const companion = COMPANIONS[build.companionId];
  if (!companion) throw new Error(`Unknown companion: ${build.companionId}`);
  return companion;
}
