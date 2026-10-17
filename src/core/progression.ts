import type { BuildId, GearSlot } from "./types.ts";
import { GEAR_SLOTS } from "./types.ts";
import type {
  CombatContent,
  CombatMods,
  HeartMethodDefV1,
  Loadout,
  LoadoutValidation,
  PriorityPreset,
  WeaponType,
} from "./combat-v1.ts";
import { validateLoadout } from "./combat-v1.ts";
import { STARTER_KITS } from "../data/combat-v1.ts";

// ---------------------------------------------------------------------------
// Build Acquisition & Progression v1
//
// One pure seam for learn/equip/validate/respec/preset. Combat consumes a
// validated Loadout; it never learns or respecs.
// ---------------------------------------------------------------------------

export type ArtCategory = "move" | "ultimate" | "light" | "inner" | "heart" | "keystone" | "companion";
export type LearnSourceKind = "starter" | "trainer" | "boss" | "event" | "pages";

export interface LearnSource {
  kind: LearnSourceKind;
  id: string;
}

export interface ArtUnlockDef {
  artId: string;
  category: ArtCategory;
  sources: LearnSourceKind[];
  realm: number;
  renown: number;
  pagesRequired?: number;
}

export interface MasteryVariant {
  level: 3 | 6 | 9;
  name: string;
  description: string;
  mods: Partial<CombatMods>;
}

export interface InnerLevelEffect {
  level: 3 | 6 | 9;
  description: string;
  mods: Partial<CombatMods>;
}

export type MeridianBranch = "gongfa" | "guben" | "shenfa";

export interface MeridianNodeDef {
  id: string;
  name: string;
  branch: MeridianBranch;
  cost: number;
  description: string;
  mods: Partial<CombatMods>;
}

export interface RespecCost {
  silver: number;
  pills: number;
}

export interface BuildProgressionContent {
  artUnlocks: Record<string, ArtUnlockDef>;
  masteryVariants: Record<string, MasteryVariant[]>;
  innerLevelEffects: Record<string, InnerLevelEffect[]>;
  meridianNodes: Record<string, MeridianNodeDef>;
  respecCost: RespecCost;
  pagePityThreshold: number;
}

export interface OwnedLibrary {
  moves: string[];
  ultimates: string[];
  lightSkills: string[];
  innerArts: string[];
  hearts: string[];
  keystones: string[];
  companions: string[];
  gear: string[];
}

export interface MeridianState {
  /** Total points earned from realm layers and events. */
  earned: number;
  /** Unspent points. */
  points: number;
  spent: string[];
  branches: Record<MeridianBranch, number>;
  keystones: [string, string];
}

export interface LoadoutPresetV1 {
  name: string;
  loadout: Loadout;
  priorityPresetId: string;
}

export interface BuildState {
  buildId: BuildId;
  realm: number;
  layer: number;
  renown: number;
  cultivation: number;
  silver: number;
  pills: number;
  annotations: number;
  essence: number;
  owned: OwnedLibrary;
  mastery: Record<string, number>;
  innerLevels: Record<string, number>;
  heartLevels: Record<string, number>;
  loadout: Loadout;
  presets: Array<LoadoutPresetV1 | null>;
  priorityPresets: PriorityPreset[];
  meridian: MeridianState;
  pages: Record<string, number>;
  pagePity: Record<string, number>;
  insight: number;
  respecs: number;
  learnedLog: string[];
}

export interface LearnResult {
  state: BuildState;
  ok: boolean;
  alreadyOwned: boolean;
  reason: string;
  category?: ArtCategory;
}

export interface EquipArtResult {
  state: BuildState;
  ok: boolean;
  reason: string;
  validation: LoadoutValidation;
}

export interface UpgradeResult {
  state: BuildState;
  ok: boolean;
  level: number;
  variant?: MasteryVariant | InnerLevelEffect;
  cost: number;
  reason: string;
}

export interface HeartAttachResult {
  state: BuildState;
  ok: boolean;
  reason: string;
  validation: LoadoutValidation;
}

export interface PageResult {
  state: BuildState;
  ok: boolean;
  page: boolean;
  duplicate: boolean;
  guaranteed: boolean;
  reason: string;
}

export interface CombineResult {
  state: BuildState;
  ok: boolean;
  learned: boolean;
  reason: string;
}

export interface MeridianResult {
  state: BuildState;
  ok: boolean;
  nodeId: string;
  reason: string;
}

export interface RespecResult {
  state: BuildState;
  ok: boolean;
  refunded: number;
  cost: RespecCost;
  reason: string;
}

export interface PresetResult {
  state: BuildState;
  ok: boolean;
  index: number;
  reason: string;
}

export interface CodexEntry {
  artId: string;
  category: ArtCategory;
  owned: boolean;
  mastery: number;
  innerLevel: number;
  heartLevel: number;
  sources: LearnSourceKind[];
  realm: number;
  renown: number;
  pagesRequired: number;
}

export interface ValidationResult extends LoadoutValidation {
  canStart: boolean;
}

export interface BuildProgressionService {
  createInitialState(buildId: BuildId): BuildState;
  learn(state: BuildState, artId: string, source: LearnSource): LearnResult;
  equip(state: BuildState, slot: string, artId: string, options?: { weaponType?: WeaponType; ownedGearIds?: string[] }): EquipArtResult;
  attachHeart(state: BuildState, heartId: string, moveId: string, slotIndex: number): HeartAttachResult;
  validate(state: BuildState, options?: { weaponType?: WeaponType; ownedGearIds?: string[] }): ValidationResult;
  upgradeMastery(state: BuildState, artId: string): UpgradeResult;
  upgradeInner(state: BuildState, artId: string): UpgradeResult;
  upgradeHeart(state: BuildState, heartId: string): UpgradeResult;
  addPage(state: BuildState, artId: string, roll: number): PageResult;
  combinePages(state: BuildState, artId: string): CombineResult;
  spendMeridian(state: BuildState, nodeId: string): MeridianResult;
  respecMeridian(state: BuildState): RespecResult;
  syncRealm(state: BuildState, realm: number, layer: number): BuildState;
  savePreset(state: BuildState, index: number): PresetResult;
  loadPreset(state: BuildState, index: number, options?: { weaponType?: WeaponType; ownedGearIds?: string[] }): PresetResult;
  savePriorityPreset(state: BuildState, index: number, preset: PriorityPreset): PresetResult;
  masteryVariant(artId: string, level: number): MasteryVariant | undefined;
  innerEffect(artId: string, level: number): InnerLevelEffect | undefined;
  meridianMods(state: BuildState): Partial<CombatMods>;
  heartMods(state: BuildState): Partial<CombatMods>;
  masteryMods(state: BuildState): Partial<CombatMods>;
  codex(state: BuildState): CodexEntry[];
  save(state: BuildState): string;
  load(serialized: string): BuildState;
}

function initialOwned(buildId: BuildId): OwnedLibrary {
  return {
    moves: [],
    ultimates: [],
    lightSkills: [],
    innerArts: [],
    hearts: [],
    keystones: [],
    companions: [],
    gear: [],
  };
}

function addUnique<T>(list: T[], value: T): void {
  if (!list.includes(value)) list.push(value);
}

function categoryOf(content: CombatContent, artId: string): ArtCategory | undefined {
  if (content.skills[artId]) {
    const kind = content.skills[artId].kind;
    return kind === "move" ? "move" : kind === "ultimate" ? "ultimate" : "light";
  }
  if (content.innerArts[artId]) return "inner";
  if (content.hearts[artId]) return "heart";
  if (content.keystones[artId]) return "keystone";
  if (content.companions[artId]) return "companion";
  return undefined;
}

function ownedForCategory(owned: OwnedLibrary, category: ArtCategory): string[] {
  switch (category) {
    case "move":
      return owned.moves;
    case "ultimate":
      return owned.ultimates;
    case "light":
      return owned.lightSkills;
    case "inner":
      return owned.innerArts;
    case "heart":
      return owned.hearts;
    case "keystone":
      return owned.keystones;
    case "companion":
      return owned.companions;
  }
}

function loadoutSlots(state: BuildState, slot: string): { get: () => string; set: (value: string) => void; category: ArtCategory } | null {
  if (/^move[0-3]$/.test(slot)) {
    const index = Number(slot.slice(4));
    return {
      get: () => state.loadout.moves[index],
      set: (value) => { state.loadout.moves[index] = value; },
      category: "move",
    };
  }
  if (slot === "ultimate") return { get: () => state.loadout.ultimateId, set: (value) => { state.loadout.ultimateId = value; }, category: "ultimate" };
  if (slot === "light") return { get: () => state.loadout.lightSkillId, set: (value) => { state.loadout.lightSkillId = value; }, category: "light" };
  if (slot === "inner") return { get: () => state.loadout.innerArtId, set: (value) => { state.loadout.innerArtId = value; }, category: "inner" };
  if (/^heart[0-3]$/.test(slot)) {
    const index = Number(slot.slice(5));
    return {
      get: () => state.loadout.hearts[index],
      set: (value) => {
        state.loadout.hearts[index] = value;
        if (state.loadout.heartTargets) state.loadout.heartTargets[index] = null;
      },
      category: "heart",
    };
  }
  if (slot === "keystone0" || slot === "keystone1") {
    const index = slot.endsWith("0") ? 0 : 1;
    return {
      get: () => state.loadout.keystones[index],
      set: (value) => { state.loadout.keystones[index] = value; },
      category: "keystone",
    };
  }
  if (slot === "companionActive") return { get: () => state.loadout.companions.active, set: (value) => { state.loadout.companions.active = value; }, category: "companion" };
  if (slot === "companionSupport0" || slot === "companionSupport1") {
    const index = slot.endsWith("0") ? 0 : 1;
    return {
      get: () => state.loadout.companions.support[index],
      set: (value) => { state.loadout.companions.support[index] = value; },
      category: "companion",
    };
  }
  return null;
}

export function meridianPointsForRealmLayer(realm: number, layer: number): number {
  return Math.floor((Math.max(0, realm) * 9 + Math.max(1, layer)) / 3);
}

function addMods(target: Partial<CombatMods>, source: Partial<CombatMods>): void {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number") target[key as keyof CombatMods] = (target[key as keyof CombatMods] ?? 0) + value;
  }
}

export function createBuildProgression(content: CombatContent, progression: BuildProgressionContent): BuildProgressionService {
  function createInitialState(buildId: BuildId): BuildState {
    const kit = progressionStarter(buildId);
    const loadout = structuredClone(kit.loadout);
    const owned = initialOwned(buildId);
    for (const id of loadout.moves) addUnique(owned.moves, id);
    addUnique(owned.ultimates, loadout.ultimateId);
    addUnique(owned.lightSkills, loadout.lightSkillId);
    addUnique(owned.innerArts, loadout.innerArtId);
    for (const id of loadout.hearts) addUnique(owned.hearts, id);
    for (const id of loadout.keystones) addUnique(owned.keystones, id);
    addUnique(owned.companions, loadout.companions.active);
    for (const id of loadout.companions.support) addUnique(owned.companions, id);
    for (const id of Object.values(loadout.gear)) if (id) addUnique(owned.gear, id);
    const mastery: Record<string, number> = {};
    for (const id of [...owned.moves, ...owned.ultimates, ...owned.lightSkills]) mastery[id] = 1;
    const innerLevels: Record<string, number> = {};
    for (const id of owned.innerArts) innerLevels[id] = 1;
    const heartLevels: Record<string, number> = {};
    for (const id of owned.hearts) heartLevels[id] = 1;
    const presets: Array<LoadoutPresetV1 | null> = [
      { name: "刷图", loadout: structuredClone({ ...loadout, priorityPresetId: kit.presetIds[0] }), priorityPresetId: kit.presetIds[0] },
      { name: "首领", loadout: structuredClone({ ...loadout, priorityPresetId: kit.presetIds[1] }), priorityPresetId: kit.presetIds[1] },
      { name: "守关", loadout: structuredClone({ ...loadout, priorityPresetId: kit.presetIds[2] }), priorityPresetId: kit.presetIds[2] },
    ];
    return {
      buildId,
      realm: 0,
      layer: 1,
      renown: 0,
      cultivation: 0,
      silver: 0,
      pills: 0,
      annotations: 0,
      essence: 0,
      owned,
      mastery,
      innerLevels,
      heartLevels,
      loadout: structuredClone({ ...loadout, priorityPresetId: kit.presetIds[0] }),
      presets,
      priorityPresets: kit.presetIds.map((id) => structuredClone(content.priorityPresets?.[id])).filter((preset): preset is PriorityPreset => Boolean(preset)),
      meridian: {
        earned: 0,
        points: 0,
        spent: [],
        branches: { gongfa: 0, guben: 0, shenfa: 0 },
        keystones: [...loadout.keystones],
      },
      pages: {},
      pagePity: {},
      insight: 0,
      respecs: 0,
      learnedLog: [],
    };
  }

  function progressionStarter(buildId: BuildId) {
    const kit = STARTER_KITS[buildId];
    return {
      loadout: kit.loadout,
      presetIds: kit.presetIds,
    };
  }

  function validate(state: BuildState, options: { weaponType?: WeaponType; ownedGearIds?: string[] } = {}): ValidationResult {
    const mergedOwned = [
      ...state.owned.moves,
      ...state.owned.ultimates,
      ...state.owned.lightSkills,
      ...state.owned.innerArts,
      ...state.owned.hearts,
      ...state.owned.keystones,
      ...state.owned.companions,
    ];
    const validation = validateLoadout(state.loadout, content, {
      requireOwned: true,
      ownedArtIds: mergedOwned,
      ownedGearIds: options.ownedGearIds ?? state.owned.gear,
      weaponType: options.weaponType,
    });
    return { ...validation, canStart: validation.ok };
  }

  function updateMaintenance(state: BuildState): void {
    state.meridian.keystones = [...state.loadout.keystones];
  }

  function learn(state: BuildState, artId: string, source: LearnSource): LearnResult {
    const unlock = progression.artUnlocks[artId];
    if (!unlock) return { state, ok: false, alreadyOwned: false, reason: `未知可学习条目：${artId}` };
    const category = unlock.category;
    const list = ownedForCategory(state.owned, category);
    if (list.includes(artId)) return { state, ok: true, alreadyOwned: true, reason: "已学会", category };
    if (!unlock.sources.includes(source.kind)) {
      return { state, ok: false, alreadyOwned: false, reason: `来源不符：需要 ${unlock.sources.join("/")}，当前 ${source.kind}`, category };
    }
    if (state.realm < unlock.realm) {
      return { state, ok: false, alreadyOwned: false, reason: `境界不足：需要 ${unlock.realm}`, category };
    }
    if (state.renown < unlock.renown) {
      return { state, ok: false, alreadyOwned: false, reason: `名望不足：需要 ${unlock.renown}`, category };
    }
    if (source.kind === "pages") {
      const required = unlock.pagesRequired ?? 0;
      if ((state.pages[artId] ?? 0) < required) {
        return { state, ok: false, alreadyOwned: false, reason: `残页不足：需要 ${required}`, category };
      }
    }
    const next = structuredClone(state);
    if (source.kind === "pages") {
      const required = unlock.pagesRequired ?? 0;
      next.pages[artId] = (next.pages[artId] ?? 0) - required;
    }
    const nextList = ownedForCategory(next.owned, category);
    addUnique(nextList, artId);
    if (category === "move" || category === "ultimate" || category === "light") next.mastery[artId] = next.mastery[artId] ?? 1;
    if (category === "inner") next.innerLevels[artId] = next.innerLevels[artId] ?? 1;
    if (category === "heart") next.heartLevels[artId] = next.heartLevels[artId] ?? 1;
    next.learnedLog.push(artId);
    if (next.learnedLog.length > 80) next.learnedLog.shift();
    return { state: next, ok: true, alreadyOwned: false, reason: "已学会", category };
  }

  function equip(
    state: BuildState,
    slot: string,
    artId: string,
    options: { weaponType?: WeaponType; ownedGearIds?: string[] } = {},
  ): EquipArtResult {
    const next = structuredClone(state);
    const target = loadoutSlots(next, slot);
    if (!target) return { state, ok: false, reason: `未知槽位：${slot}`, validation: validate(state, options) };
    const category = categoryOf(content, artId);
    if (!category) return { state, ok: false, reason: `未知武学：${artId}`, validation: validate(state, options) };
    if (category !== target.category) {
      return { state, ok: false, reason: `槽位类型不符：${slot} 需要 ${target.category}`, validation: validate(state, options) };
    }
    if (!ownedForCategory(next.owned, category).includes(artId)) {
      return { state, ok: false, reason: `尚未学会：${artId}`, validation: validate(state, options) };
    }
    if (/^move/.test(slot) || slot === "ultimate" || slot === "light") {
      const actives = [next.loadout.ultimateId, next.loadout.lightSkillId, ...next.loadout.moves];
      if (actives.includes(artId) && target.get() !== artId) {
        return { state, ok: false, reason: `主动武学不能重复装备：${artId}`, validation: validate(state, options) };
      }
    }
    if (category === "heart" && next.loadout.hearts.includes(artId) && target.get() !== artId) {
      return { state, ok: false, reason: `心法不能重复装备：${artId}`, validation: validate(state, options) };
    }
    if (category === "keystone" && next.loadout.keystones.includes(artId) && target.get() !== artId) {
      return { state, ok: false, reason: `奇穴不能重复装备：${artId}`, validation: validate(state, options) };
    }
    const old = target.get();
    if (target.category === "move" && old !== artId) {
      for (let i = 0; i < next.loadout.hearts.length; i += 1) {
        if (next.loadout.heartTargets?.[i] === old) next.loadout.heartTargets[i] = null;
      }
    }
    target.set(artId);
    updateMaintenance(next);
    const validation = validate(next, options);
    return { state: next, ok: validation.ok, reason: validation.ok ? "已装配" : validation.errors[0], validation };
  }

  function attachHeart(state: BuildState, heartId: string, moveId: string, slotIndex: number): HeartAttachResult {
    const next = structuredClone(state);
    if (slotIndex < 0 || slotIndex > 3) return { state, ok: false, reason: "心法槽索引无效", validation: validate(state) };
    if (!next.owned.hearts.includes(heartId)) return { state, ok: false, reason: `尚未获得心法：${heartId}`, validation: validate(state) };
    if (!next.loadout.moves.includes(moveId)) return { state, ok: false, reason: `招式未装备：${moveId}`, validation: validate(state) };
    if (next.loadout.hearts.some((id, index) => id === heartId && index !== slotIndex)) {
      return { state, ok: false, reason: `心法已装备：${heartId}`, validation: validate(state) };
    }
    const targetIndex = next.loadout.heartTargets?.findIndex((target, index) => target === moveId && index !== slotIndex) ?? -1;
    if (targetIndex >= 0) return { state, ok: false, reason: `该招式已绑定心法：${moveId}`, validation: validate(state) };
    next.loadout.hearts[slotIndex] = heartId;
    if (!next.loadout.heartTargets) next.loadout.heartTargets = [null, null, null, null];
    next.loadout.heartTargets[slotIndex] = moveId;
    const validation = validate(next);
    return { state: next, ok: validation.ok, reason: validation.ok ? "心法已绑定" : validation.errors[0], validation };
  }

  function upgradeMastery(state: BuildState, artId: string): UpgradeResult {
    if (state.mastery[artId] === undefined) return { state, ok: false, level: 0, cost: 0, reason: "尚未学会该武学" };
    const level = state.mastery[artId];
    if (level >= 10) return { state, ok: false, level, cost: 0, reason: "熟练已达上限" };
    const cost = Math.round(20 * Math.pow(1.28, level - 1));
    if (state.cultivation < cost) return { state, ok: false, level, cost, reason: "修为不足" };
    const next = structuredClone(state);
    next.cultivation -= cost;
    next.mastery[artId] = level + 1;
    const variant = progression.masteryVariants[artId]?.find((entry) => entry.level === next.mastery[artId]);
    return { state: next, ok: true, level: next.mastery[artId], variant, cost, reason: "熟练提升" };
  }

  function upgradeInner(state: BuildState, artId: string): UpgradeResult {
    if (state.innerLevels[artId] === undefined) return { state, ok: false, level: 0, cost: 0, reason: "尚未学会该内功" };
    const level = state.innerLevels[artId];
    if (level >= 10) return { state, ok: false, level, cost: 0, reason: "内功已达上限" };
    const cost = Math.round(30 * Math.pow(1.3, level - 1));
    if (state.cultivation < cost) return { state, ok: false, level, cost, reason: "修为不足" };
    const next = structuredClone(state);
    next.cultivation -= cost;
    next.innerLevels[artId] = level + 1;
    const effect = progression.innerLevelEffects[artId]?.find((entry) => entry.level === next.innerLevels[artId]);
    return { state: next, ok: true, level: next.innerLevels[artId], variant: effect, cost, reason: "内功提升" };
  }

  function upgradeHeart(state: BuildState, heartId: string): UpgradeResult {
    if (state.heartLevels[heartId] === undefined) return { state, ok: false, level: 0, cost: 0, reason: "尚未获得该心法" };
    const level = state.heartLevels[heartId];
    if (level >= 5) return { state, ok: false, level, cost: 0, reason: "心法已达上限" };
    const cost = 2 + level;
    if (state.annotations < cost) return { state, ok: false, level, cost, reason: "心法注解不足" };
    const next = structuredClone(state);
    next.annotations -= cost;
    next.heartLevels[heartId] = level + 1;
    return { state: next, ok: true, level: next.heartLevels[heartId], cost, reason: "心法提升" };
  }

  function addPage(state: BuildState, artId: string, roll: number): PageResult {
    const unlock = progression.artUnlocks[artId];
    if (!unlock) return { state, ok: false, page: false, duplicate: false, guaranteed: false, reason: "未知残页" };
    const next = structuredClone(state);
    if (next.owned.moves.includes(artId) || next.owned.ultimates.includes(artId) || next.owned.lightSkills.includes(artId)) {
      next.essence += 1;
      return { state: next, ok: true, page: false, duplicate: true, guaranteed: false, reason: "重复残页转化为武学精要" };
    }
    const pity = (next.pagePity[artId] ?? 0) + 1;
    next.pagePity[artId] = pity;
    const guaranteed = pity >= progression.pagePityThreshold;
    if (guaranteed) next.pagePity[artId] = 0;
    const page = guaranteed || roll >= 0.45;
    if (page) next.pages[artId] = (next.pages[artId] ?? 0) + 1;
    return {
      state: next,
      ok: true,
      page,
      duplicate: false,
      guaranteed,
      reason: page ? (guaranteed ? "保底残页" : "获得残页") : "未获得残页",
    };
    }

  function combinePages(state: BuildState, artId: string): CombineResult {
    const unlock = progression.artUnlocks[artId];
    if (!unlock) return { state, ok: false, learned: false, reason: "未知武学" };
    const required = unlock.pagesRequired ?? 0;
    if ((state.pages[artId] ?? 0) < required) {
      return { state, ok: false, learned: false, reason: `残页不足：${state.pages[artId] ?? 0}/${required}` };
    }
    if (state.owned.moves.includes(artId) || state.owned.ultimates.includes(artId) || state.owned.lightSkills.includes(artId)) {
      return { state, ok: true, learned: false, reason: "已学会" };
    }
    const learned = learn(state, artId, { kind: "pages", id: "combine" });
    return { state: learned.state, ok: learned.ok, learned: learned.ok && !learned.alreadyOwned, reason: learned.reason };
  }

  function syncRealm(state: BuildState, realm: number, layer: number): BuildState {
    const next = structuredClone(state);
    next.realm = Math.max(0, realm);
    next.layer = Math.max(1, layer);
    const earned = meridianPointsForRealmLayer(next.realm, next.layer);
    if (earned > next.meridian.earned) {
      next.meridian.points += earned - next.meridian.earned;
      next.meridian.earned = earned;
    }
    return next;
  }

  function spendMeridian(state: BuildState, nodeId: string): MeridianResult {
    const node = progression.meridianNodes[nodeId];
    if (!node) return { state, ok: false, nodeId, reason: "未知经脉节点" };
    if (state.meridian.spent.includes(nodeId)) return { state, ok: false, nodeId, reason: "已点出该节点" };
    if (state.meridian.points < node.cost) return { state, ok: false, nodeId, reason: "经脉点不足" };
    const next = structuredClone(state);
    next.meridian.points -= node.cost;
    next.meridian.spent.push(nodeId);
    next.meridian.branches[node.branch] += 1;
    return { state: next, ok: true, nodeId, reason: "经脉已点" };
  }

  function respecMeridian(state: BuildState): RespecResult {
    const cost = progression.respecCost;
    if (state.silver < cost.silver || state.pills < cost.pills) {
      return { state, ok: false, refunded: 0, cost, reason: "洗点资源不足" };
    }
    const next = structuredClone(state);
    next.silver -= cost.silver;
    next.pills -= cost.pills;
    const refunded = next.meridian.spent.reduce((sum, id) => sum + (progression.meridianNodes[id]?.cost ?? 0), 0);
    next.meridian.points = next.meridian.earned;
    next.meridian.spent = [];
    next.meridian.branches = { gongfa: 0, guben: 0, shenfa: 0 };
    next.respecs += 1;
    return { state: next, ok: true, refunded, cost, reason: "经脉已重置" };
  }

  function savePreset(state: BuildState, index: number): PresetResult {
    if (index < 0 || index > 2) return { state, ok: false, index, reason: "preset 索引必须为 0–2" };
    const next = structuredClone(state);
    next.presets[index] = {
      name: next.presets[index]?.name ?? `配置 ${index + 1}`,
      loadout: structuredClone(next.loadout),
      priorityPresetId: next.loadout.priorityPresetId,
    };
    return { state: next, ok: true, index, reason: "preset 已保存" };
  }

  function loadPreset(state: BuildState, index: number, options: { weaponType?: WeaponType; ownedGearIds?: string[] } = {}): PresetResult {
    if (index < 0 || index > 2) return { state, ok: false, index, reason: "preset 索引必须为 0–2" };
    const preset = state.presets[index];
    if (!preset) return { state, ok: false, index, reason: "preset 为空" };
    const next = structuredClone(state);
    next.loadout = structuredClone(preset.loadout);
    next.loadout.priorityPresetId = preset.priorityPresetId;
    next.meridian.keystones = [...next.loadout.keystones];
    const validation = validate(next, options);
    return { state: next, ok: validation.ok, index, reason: validation.ok ? "preset 已载入" : validation.errors[0] };
  }

  function savePriorityPreset(state: BuildState, index: number, preset: PriorityPreset): PresetResult {
    if (index < 0 || index > 2) return { state, ok: false, index, reason: "preset 索引必须为 0–2" };
    const next = structuredClone(state);
    next.priorityPresets[index] = structuredClone(preset);
    next.loadout.priorityPresetId = preset.id;
    return { state: next, ok: true, index, reason: "优先级 preset 已保存" };
  }

  function masteryVariant(artId: string, level: number): MasteryVariant | undefined {
    const variants = progression.masteryVariants[artId] ?? [];
    return [...variants].reverse().find((variant) => variant.level <= level);
  }

  function innerEffect(artId: string, level: number): InnerLevelEffect | undefined {
    const effects = progression.innerLevelEffects[artId] ?? [];
    return [...effects].reverse().find((effect) => effect.level <= level);
  }

  function meridianMods(state: BuildState): Partial<CombatMods> {
    const mods: Partial<CombatMods> = {};
    for (const id of state.meridian.spent) addMods(mods, progression.meridianNodes[id]?.mods ?? {});
    for (const id of state.loadout.keystones) addMods(mods, content.keystones[id]?.mods ?? {});
    return mods;
  }

  function heartMods(state: BuildState): Partial<CombatMods> {
    const mods: Partial<CombatMods> = {};
    for (const id of state.loadout.hearts) {
      const base = content.hearts[id]?.mods ?? {};
      const level = state.heartLevels[id] ?? 1;
      const scale = 1 + 0.12 * (level - 1);
      for (const [key, value] of Object.entries(base)) {
        if (typeof value === "number") addMods(mods, { [key]: value * scale } as Partial<CombatMods>);
      }
    }
    return mods;
  }

  function masteryMods(state: BuildState): Partial<CombatMods> {
    const mods: Partial<CombatMods> = {};
    for (const id of [...state.loadout.moves, state.loadout.ultimateId, state.loadout.lightSkillId]) {
      const variant = masteryVariant(id, state.mastery[id] ?? 1);
      if (variant) addMods(mods, variant.mods);
    }
    return mods;
  }

  function codex(state: BuildState): CodexEntry[] {
    return Object.values(progression.artUnlocks).map((unlock) => ({
      artId: unlock.artId,
      category: unlock.category,
      owned: ownedForCategory(state.owned, unlock.category).includes(unlock.artId),
      mastery: state.mastery[unlock.artId] ?? 0,
      innerLevel: state.innerLevels[unlock.artId] ?? 0,
      heartLevel: state.heartLevels[unlock.artId] ?? 0,
      sources: unlock.sources,
      realm: unlock.realm,
      renown: unlock.renown,
      pagesRequired: unlock.pagesRequired ?? 0,
    }));
  }

  function save(state: BuildState): string {
    return JSON.stringify(state);
  }

  function load(serialized: string): BuildState {
    return structuredClone(JSON.parse(serialized) as BuildState);
  }

  return {
    createInitialState,
    learn,
    equip,
    attachHeart,
    validate,
    upgradeMastery,
    upgradeInner,
    upgradeHeart,
    addPage,
    combinePages,
    spendMeridian,
    respecMeridian,
    syncRealm,
    savePreset,
    loadPreset,
    savePriorityPreset,
    masteryVariant,
    innerEffect,
    meridianMods,
    heartMods,
    masteryMods,
    codex,
    save,
    load,
  };
}
