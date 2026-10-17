import type { ArtCategory, ArtUnlockDef, BuildProgressionContent, MasteryVariant, MeridianNodeDef } from "../core/progression.ts";
import { COMBAT_CONTENT } from "./combat-v1.ts";

function unlock(
  artId: string,
  category: ArtCategory,
  sources: ArtUnlockDef["sources"],
  realm = 0,
  renown = 0,
  pagesRequired?: number,
): ArtUnlockDef {
  return { artId, category, sources, realm, renown, pagesRequired };
}

const STARTER_ONLY: ArtUnlockDef["sources"] = ["starter"];
const OPEN: ArtUnlockDef["sources"] = ["trainer", "boss", "event", "pages"];

export const ART_UNLOCKS_V1: Record<string, ArtUnlockDef> = Object.fromEntries([
  // 太极
  unlock("taiji_yunshou", "move", STARTER_ONLY),
  unlock("taiji_lanque", "move", STARTER_ONLY),
  unlock("taiji_baihe", "move", STARTER_ONLY),
  unlock("taiji_tuishou", "move", STARTER_ONLY),
  unlock("taiji_siliang", "ultimate", STARTER_ONLY),
  unlock("light_taiji_tiyun", "light", STARTER_ONLY),
  // 破军
  unlock("pojun_lipi", "move", STARTER_ONLY),
  unlock("pojun_hengsao", "move", STARTER_ONLY),
  unlock("pojun_zhan", "move", STARTER_ONLY),
  unlock("pojun_xuezhan", "move", STARTER_ONLY),
  unlock("pojun_wanjun", "ultimate", STARTER_ONLY),
  unlock("light_pojun_tapo", "light", STARTER_ONLY),
  // 玄阴
  unlock("xuanyin_zhi", "move", ["boss", "event", "pages"], 0, 0, 3),
  unlock("xuanyin_fengxue", "move", STARTER_ONLY),
  unlock("xuanyin_shigu", "move", STARTER_ONLY),
  unlock("xuanyin_yinfeng", "move", STARTER_ONLY),
  unlock("xuanyin_wangu", "ultimate", STARTER_ONLY),
  unlock("light_xuanyin_guibian", "light", STARTER_ONLY),
  // 内功
  unlock("inner_taiji", "inner", STARTER_ONLY),
  unlock("inner_pojun", "inner", STARTER_ONLY),
  unlock("inner_xuanyin", "inner", STARTER_ONLY),
  // 心法
  unlock("hm_jieli", "heart", STARTER_ONLY),
  unlock("hm_huiqi", "heart", STARTER_ONLY),
  unlock("hm_shouzhuo", "heart", STARTER_ONLY),
  unlock("hm_lianmian", "heart", STARTER_ONLY),
  unlock("hm_liejia", "heart", STARTER_ONLY),
  unlock("hm_zhuifeng", "heart", STARTER_ONLY),
  unlock("hm_shixin", "heart", STARTER_ONLY),
  unlock("hm_kuangyi", "heart", STARTER_ONLY),
  unlock("hm_shixin_yin", "heart", STARTER_ONLY),
  unlock("hm_liejia_yin", "heart", STARTER_ONLY),
  unlock("hm_huiqi_yin", "heart", STARTER_ONLY),
  unlock("hm_lianmian_yin", "heart", STARTER_ONLY),
  // 奇穴
  unlock("ks_yirou", "keystone", STARTER_ONLY),
  unlock("ks_guben", "keystone", STARTER_ONLY),
  unlock("ks_jianqi", "keystone", STARTER_ONLY),
  unlock("ks_gongfa", "keystone", STARTER_ONLY),
  unlock("ks_taxue", "keystone", STARTER_ONLY),
  unlock("ks_dujing", "keystone", STARTER_ONLY),
  // 同伴（v1 只做战斗助战）
  unlock("comp_liuqing", "companion", STARTER_ONLY),
  unlock("comp_guchangfeng", "companion", STARTER_ONLY),
  unlock("comp_moya", "companion", STARTER_ONLY),
  unlock("comp_suwan", "companion", ["event", "trainer"], 1, 30),
  unlock("comp_yanshisan", "companion", ["event", "boss"], 2, 80),
  unlock("comp_heiqiu", "companion", ["event", "trainer", "pages"], 2, 80, 5),
].map((entry) => [entry.artId, entry]));

function variantsFor(name: string, tag: string, type: string): MasteryVariant[] {
  const tagLine = tag === "starter" ? "起手" : tag === "chase" ? "追击" : tag === "finisher" ? "终结" : "功能";
  const typeLine = type === "jia" ? "架招" : type === "xu" ? "虚招" : type === "qi" ? "气招" : "实招";
  return [
    {
      level: 3,
      name: `${name}·熟`,
      description: `3 层：${tagLine}${typeLine}的内力循环更顺。`,
      mods: tag === "utility" ? { innerRegen: 1 } : { comboDamage: 0.03 },
    },
    {
      level: 6,
      name: `${name}·精`,
      description: `6 层：${typeLine}的破招/状态更稳。`,
      mods: type === "xu" ? { breakDamage: 0.04 } : type === "jia" ? { guardReduction: 0.03 } : { statusHit: 0.03 },
    },
    {
      level: 9,
      name: `${name}·化`,
      description: `9 层：${tagLine}的伤害或资源上限提高。`,
      mods: tag === "finisher" ? { critDamage: 0.06 } : { damagePct: 0.04 },
    },
  ];
}

export const MASTERY_VARIANTS_V1: Record<string, MasteryVariant[]> = Object.fromEntries(
  Object.values(COMBAT_CONTENT.skills).map((skill) => [
    skill.id,
    variantsFor(skill.name, skill.tag, skill.type),
  ]),
);

export const INNER_LEVEL_EFFECTS_V1: BuildProgressionContent["innerLevelEffects"] = {
  inner_taiji: [
    { level: 3, description: "3 层：招架减伤 +3%，回合回内力 +1。", mods: { guardReduction: 0.03, innerRegen: 1 } },
    { level: 6, description: "6 层：招架减伤 +5%，回合回内力 +2。", mods: { guardReduction: 0.05, innerRegen: 2 } },
    { level: 9, description: "9 层：招架减伤 +8%，回合回内力 +3。", mods: { guardReduction: 0.08, innerRegen: 3 } },
  ],
  inner_pojun: [
    { level: 3, description: "3 层：攻击 +4%，破招增伤 +2%。", mods: { attackPct: 0.04, breakDamage: 0.02 } },
    { level: 6, description: "6 层：攻击 +8%，破招增伤 +5%。", mods: { attackPct: 0.08, breakDamage: 0.05 } },
    { level: 9, description: "9 层：攻击 +12%，破招增伤 +8%。", mods: { attackPct: 0.12, breakDamage: 0.08 } },
  ],
  inner_xuanyin: [
    { level: 3, description: "3 层：状态命中 +4%，毒伤 +5%。", mods: { statusHit: 0.04, poisonDamage: 0.05 } },
    { level: 6, description: "6 层：状态命中 +8%，毒伤 +10%。", mods: { statusHit: 0.08, poisonDamage: 0.1 } },
    { level: 9, description: "9 层：状态命中 +12%，毒伤 +15%。", mods: { statusHit: 0.12, poisonDamage: 0.15 } },
  ],
};

const BRANCH_NAMES: Record<MeridianNodeDef["branch"], string> = {
  gongfa: "攻伐",
  guben: "固本",
  shenfa: "身法",
};

function meridianNodes(): Record<string, MeridianNodeDef> {
  const nodes: Record<string, MeridianNodeDef> = {};
  for (const branch of ["gongfa", "guben", "shenfa"] as const) {
    for (let index = 1; index <= 12; index += 1) {
      const id = `mer_${branch}_${index}`;
      const cost = index <= 4 ? 1 : index <= 8 ? 2 : 3;
      const mods: MeridianNodeDef["mods"] = branch === "gongfa"
        ? { attackPct: 0.01 * index, breakDamage: index % 3 === 0 ? 0.01 : 0 }
        : branch === "guben"
          ? { hpPct: 0.015 * index, defensePct: 0.01 * index, damageReduction: index % 4 === 0 ? 0.01 : 0 }
          : { speedPct: 0.008 * index, evade: index % 3 === 0 ? 0.01 : 0, hit: index % 4 === 0 ? 0.01 : 0 };
      nodes[id] = {
        id,
        name: `${BRANCH_NAMES[branch]}·${index}`,
        branch,
        cost,
        description: `${BRANCH_NAMES[branch]}第 ${index} 节点。`,
        mods,
      };
    }
  }
  return nodes;
}

export const MERIDIAN_NODES_V1 = meridianNodes();

export const BUILD_PROGRESSION_CONTENT: BuildProgressionContent = {
  artUnlocks: ART_UNLOCKS_V1,
  masteryVariants: MASTERY_VARIANTS_V1,
  innerLevelEffects: INNER_LEVEL_EFFECTS_V1,
  meridianNodes: MERIDIAN_NODES_V1,
  respecCost: { silver: 300, pills: 1 },
  pagePityThreshold: 3,
};
