import type { BuildId } from "./types.ts";
import type { Loadout, WeaponType } from "./combat-v1.ts";
import { validateLoadout } from "./combat-v1.ts";
import { validateWorldContent } from "./world-v1.ts";
import { createEconomy } from "./economy.ts";
import { createFactionEvent } from "./factions-events.ts";
import { createCompanionService } from "./companions.ts";
import { createActivityService } from "./activities.ts";
import { createEndgame } from "./endgame.ts";
import type { GameContentBundle } from "../data/content-bundle.ts";
import { createBattleSheet } from "../data/combat-v1.ts";
import { createEncounterBattle, encounterBattleModifiers } from "../data/world-v1.ts";
import { generateEncounter, recommendedRealmFor } from "./world-v1.ts";
import { resolveBattle } from "./combat-v1.ts";

// ---------------------------------------------------------------------------
// Content Pipeline, Validation & Simulator v1
//
// One pure content seam: validateContent(bundle) -> ContentReport.
// It composes the domain validators; the balance matrix is a headless consumer
// of resolveBattle and the authored content, not a second rules engine.
// ---------------------------------------------------------------------------

export interface ContentCheckV1 {
  name: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ContentValidationReportV1 {
  ok: boolean;
  contentVersion: string;
  checks: ContentCheckV1[];
  errors: string[];
  warnings: string[];
}

export interface MatrixRowV1 {
  mapId: string;
  mapName: string;
  build: string;
  win: boolean;
  rounds: number;
  hpPct: number;
}

export interface ContentMatrixReportV1 {
  ok: boolean;
  rows: MatrixRowV1[];
  perBuild: Record<string, { wins: number; total: number; rate: number }>;
  totalWins: number;
  dominantBuild: string;
  dominantShare: number;
  unwinnableMaps: string[];
  hybridValid: boolean;
}

const COMBAT_MOD_KEYS = new Set<string>([
  "hp", "innerMax", "attack", "defense", "speed",
  "hpPct", "innerMaxPct", "attackPct", "defensePct", "speedPct",
  "hit", "evade", "crit", "critDamage", "guardReduction", "breakDamage",
  "comboDamage", "counterDamage", "statusHit", "statusResist", "damageReduction",
  "innerRegen", "reflect", "healBonus", "lifesteal", "poisonDamage", "damagePct", "typeDamagePct",
]);

function check(name: string, errors: string[], warnings: string[] = []): ContentCheckV1 {
  return { name, ok: errors.length === 0, errors, warnings };
}

function validateCombat(bundle: GameContentBundle): ContentCheckV1 {
  const errors: string[] = [];
  const warnings: string[] = [];
  const content = bundle.combat;
  for (const [id, skill] of Object.entries(content.skills)) {
    if (skill.id !== id) errors.push(`武学 key/id 不一致：${id}`);
    if (!skill.name || !skill.kind || !skill.type || !skill.element) errors.push(`武学 ${id} 缺少必填字段`);
    if (skill.cost < 0 || skill.cooldown < 0 || skill.coefficient < 0) errors.push(`武学 ${id} 数值非法`);
    if (!Array.isArray(skill.weaponTypes)) errors.push(`武学 ${id} 缺少 weaponTypes`);
  }
  if (Object.keys(content.skills).filter((id) => content.skills[id].kind === "light").length < 3) {
    errors.push("至少需要 3 个轻功");
  }
  if (Object.keys(content.innerArts).length < 3) errors.push("至少需要 3 门内功");
  if (Object.keys(content.hearts).length < 12) errors.push("至少需要 12 个心法");
  if (Object.keys(content.keystones).length < 6) errors.push("至少需要 6 个奇穴");
  if (Object.keys(bundle.starterKits).length !== 3) errors.push("必须恰好 3 套 starter kit");
  for (const [buildId, kit] of Object.entries(bundle.starterKits)) {
    const validation = validateLoadout(kit.loadout, content);
    if (!validation.ok) errors.push(`starter ${buildId} 无效：${validation.errors.join("；")}`);
    for (const gearId of Object.values(kit.loadout.gear)) {
      if (gearId && !content.gearIds[gearId]) errors.push(`starter ${buildId} 引用未知装备 ${gearId}`);
    }
    const preset = content.priorityPresets?.[kit.loadout.priorityPresetId];
    if (!preset) errors.push(`starter ${buildId} 缺少优先级 preset`);
  }
  if (Object.keys(content.priorityPresets ?? {}).length < 9) warnings.push("优先级 preset 少于 9 个（3 套 × 3 种）");
  return check("combat", errors, warnings);
}

function validateItemization(bundle: GameContentBundle): ContentCheckV1 {
  const errors: string[] = [];
  const warnings: string[] = [];
  const content = bundle.itemization;
  if (Object.keys(content.sets).length !== 8) errors.push(`必须恰好 8 套套装，当前 ${Object.keys(content.sets).length}`);
  for (const set of Object.values(content.sets)) {
    if (Object.keys(set.two).length === 0 || Object.keys(set.four).length === 0) errors.push(`套装 ${set.id} 缺少 2/4 件效果`);
  }
  const legendaries = Object.values(content.legendaries);
  if (legendaries.length < 12 || legendaries.length > 20) errors.push(`传奇数量必须 12–20，当前 ${legendaries.length}`);
  for (const legendary of legendaries) {
    if (!legendary.rule) errors.push(`传奇 ${legendary.id} 缺少 rule`);
    if (Object.keys(legendary.effect).length === 0) errors.push(`传奇 ${legendary.id} 缺少效果`);
  }
  for (const affix of content.affixes) {
    if (!COMBAT_MOD_KEYS.has(affix.stat)) errors.push(`词条 ${affix.id} 使用 Combat v1 外属性 ${affix.stat}`);
    if (affix.slots.length === 0) errors.push(`词条 ${affix.id} 没有合法槽位`);
  }
  if (Object.keys(content.mainStats).length !== 6) errors.push("主属性必须覆盖 6 槽");
  const builds: BuildId[] = ["taiji", "pojun", "xuanyin"];
  for (const buildId of builds) {
    const gear = Object.values(bundle.starterGear).filter((item) => item.id.startsWith(`${buildId}_`));
    if (gear.length !== 6) errors.push(`${buildId} starter gear 必须 6 件，当前 ${gear.length}`);
    for (const item of gear) {
      if (item.setId && !content.sets[item.setId]) errors.push(`starter gear ${item.id} 引用未知套装 ${item.setId}`);
      for (const key of Object.keys(item.stats)) {
        if (!COMBAT_MOD_KEYS.has(key)) errors.push(`starter gear ${item.id} 使用 Combat v1 外属性 ${key}`);
      }
    }
  }
  return check("itemization", errors, warnings);
}

function validateProgression(bundle: GameContentBundle): ContentCheckV1 {
  const errors: string[] = [];
  const warnings: string[] = [];
  const content = bundle.progression;
  const artIds = new Set([
    ...Object.keys(bundle.combat.skills),
    ...Object.keys(bundle.combat.innerArts),
    ...Object.keys(bundle.combat.hearts),
    ...Object.keys(bundle.combat.keystones),
    ...Object.keys(bundle.combat.companions),
  ]);
  for (const id of artIds) {
    const unlock = content.artUnlocks[id];
    if (!unlock) errors.push(`缺少学习来源：${id}`);
    else if (unlock.sources.length === 0) errors.push(`学习来源为空：${id}`);
  }
  for (const id of Object.keys(content.artUnlocks)) {
    if (!artIds.has(id)) errors.push(`学习条目引用未知 art：${id}`);
  }
  for (const skillId of Object.keys(bundle.combat.skills)) {
    const variants = content.masteryVariants[skillId] ?? [];
    if (variants.map((variant) => variant.level).join(",") !== "3,6,9") {
      errors.push(`武学 ${skillId} 熟练突破点必须为 3/6/9`);
    }
  }
  for (const innerId of Object.keys(bundle.combat.innerArts)) {
    if (!content.innerLevelEffects[innerId]) errors.push(`内功 ${innerId} 缺少 3/6/9 效果`);
  }
  const nodes = Object.values(content.meridianNodes);
  if (nodes.length !== 36) errors.push(`经脉节点必须 36，当前 ${nodes.length}`);
  for (const branch of ["gongfa", "guben", "shenfa"]) {
    if (nodes.filter((node) => node.branch === branch).length !== 12) errors.push(`经脉分支 ${branch} 必须 12 节点`);
  }
  if (content.respecCost.silver < 0 || content.respecCost.pills < 0) errors.push("洗点费用非法");
  if (content.pagePityThreshold <= 0) warnings.push("残页保底阈值未设置");
  return check("progression", errors, warnings);
}

function validateCrossReferences(bundle: GameContentBundle): ContentCheckV1 {
  const errors: string[] = [];
  const warnings: string[] = [];
  const npcIds = new Set(Object.keys(bundle.factions.npcs));
  for (const companion of Object.values(bundle.companions.companions)) {
    if (companion.npcId && !npcIds.has(companion.npcId)) errors.push(`同伴 ${companion.id} 引用未知 NPC ${companion.npcId}`);
    if (companion.factionHook && !bundle.factions.factions[companion.factionHook]) {
      errors.push(`同伴 ${companion.id} 引用未知门派 ${companion.factionHook}`);
    }
    if (!bundle.companions.gifts[companion.giftPreferenceId]) errors.push(`同伴 ${companion.id} 偏好礼物不存在`);
  }
  for (const mapId of Object.keys(bundle.activities.mapTags)) {
    if (!bundle.world.maps.some((map) => map.id === mapId)) errors.push(`风水引用未知地图 ${mapId}`);
  }
  for (const map of bundle.world.maps) {
    if (!bundle.activities.mapTags[map.id]) errors.push(`地图 ${map.id} 缺少风水标签`);
  }
  const catalogArts = new Set(bundle.factions.catalog.arts);
  for (const artId of [...Object.keys(bundle.combat.skills), ...Object.keys(bundle.combat.innerArts), ...Object.keys(bundle.combat.hearts), ...Object.keys(bundle.combat.keystones)]) {
    if (!catalogArts.has(artId)) errors.push(`事件 catalog 缺少武学 ${artId}`);
  }
  for (const codex of bundle.endgame.codex) {
    if (!codex.sourceHint) errors.push(`江湖志 ${codex.id} 缺少来源提示`);
  }
  return check("cross-references", errors, warnings);
}

export function validateContent(bundle: GameContentBundle): ContentValidationReportV1 {
  const world = validateWorldContent(bundle.world);
  const economy = createEconomy(bundle.economy).validateContent(bundle.economy);
  const factions = createFactionEvent(bundle.factions).validateContent(bundle.factions);
  const companions = createCompanionService(bundle.companions).validateContent(bundle.companions);
  const activities = createActivityService(bundle.activities).validateContent(bundle.activities);
  const endgame = createEndgame(bundle.endgame).validateContent(bundle.endgame);
  const checks: ContentCheckV1[] = [
    validateCombat(bundle),
    validateItemization(bundle),
    validateProgression(bundle),
    check("world", world.errors, world.warnings),
    check("economy", economy.errors),
    check("factions", factions.errors, factions.warnings),
    check("companions", companions.errors, companions.warnings),
    check("activities", activities.errors, activities.warnings),
    check("endgame", endgame.errors, endgame.warnings),
    validateCrossReferences(bundle),
  ];
  const errors = checks.flatMap((entry) => entry.errors.map((error) => `${entry.name}: ${error}`));
  const warnings = checks.flatMap((entry) => entry.warnings.map((warning) => `${entry.name}: ${warning}`));
  return {
    ok: errors.length === 0,
    contentVersion: bundle.contentVersion,
    checks,
    errors,
    warnings,
  };
}

export function runContentMatrix(bundle: GameContentBundle, seed = 31): ContentMatrixReportV1 {
  const hybridLoadout: Loadout = structuredClone(bundle.starterKits.taiji.loadout);
  hybridLoadout.moves[3] = "xuanyin_zhi";
  if (hybridLoadout.heartTargets) hybridLoadout.heartTargets[3] = null;
  const hybridValidation = validateLoadout(hybridLoadout, bundle.combat, { weaponType: "fist" });
  const builds: Array<{ id: string; buildId: BuildId; loadout: Loadout; weaponType?: WeaponType }> = [
    { id: "taiji", buildId: "taiji", loadout: bundle.starterKits.taiji.loadout },
    { id: "pojun", buildId: "pojun", loadout: bundle.starterKits.pojun.loadout },
    { id: "xuanyin", buildId: "xuanyin", loadout: bundle.starterKits.xuanyin.loadout },
    { id: "hybrid", buildId: "taiji", loadout: hybridLoadout, weaponType: "fist" },
  ];
  const rows: MatrixRowV1[] = [];
  const perBuild: Record<string, { wins: number; total: number; rate: number }> = {};
  const mapWins = new Map<string, number>();
  for (const build of builds) perBuild[build.id] = { wins: 0, total: 0, rate: 0 };
  for (const map of bundle.world.maps) {
    const encounter = generateEncounter(bundle.world, map.id, 10, seed);
    const enemy = createEncounterBattle(encounter);
    const modifiers = encounterBattleModifiers(encounter);
    const level = Math.max(1, recommendedRealmFor(map) * 9 + 5);
    for (const build of builds) {
      const result = resolveBattle({
        player: {
          sheet: createBattleSheet(build.buildId, { level, weaponType: build.weaponType }),
          loadout: build.loadout,
          content: bundle.combat,
        },
        enemy,
        objective: "clear",
        maxRounds: 30,
        seed,
        modifiers,
        captureEvents: false,
      });
      rows.push({ mapId: map.id, mapName: map.name, build: build.id, win: result.win, rounds: result.rounds, hpPct: result.playerHpPct });
      perBuild[build.id].total += 1;
      if (result.win) {
        perBuild[build.id].wins += 1;
        mapWins.set(map.id, (mapWins.get(map.id) ?? 0) + 1);
      }
    }
  }
  for (const build of Object.values(perBuild)) build.rate = build.total > 0 ? build.wins / build.total : 0;
  const totalWins = rows.filter((row) => row.win).length;
  const dominant = Object.entries(perBuild).sort((a, b) => b[1].wins - a[1].wins)[0];
  const dominantShare = totalWins > 0 ? (dominant?.[1].wins ?? 0) / totalWins : 0;
  const unwinnableMaps = bundle.world.maps.filter((map) => (mapWins.get(map.id) ?? 0) === 0).map((map) => map.id);
  const allBuildsWin = Object.values(perBuild).every((entry) => entry.wins > 0);
  return {
    ok: hybridValidation.ok && unwinnableMaps.length === 0 && allBuildsWin && dominantShare <= 0.6,
    rows,
    perBuild,
    totalWins,
    dominantBuild: dominant?.[0] ?? "—",
    dominantShare,
    unwinnableMaps,
    hybridValid: hybridValidation.ok,
  };
}
