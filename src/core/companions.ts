import type { RegionId } from "./types.ts";
import type { CombatMods, CompanionAssistInput } from "./combat-v1.ts";
import { Rng } from "./rng.ts";

// ---------------------------------------------------------------------------
// Companions & Bonds v1
//
// One pure seam for recruit/gift/bond/party/assist. Combat receives the active
// assist input and support mods; it never recruits or gifts.
// ---------------------------------------------------------------------------

export type CompanionRole = "damage" | "support" | "control" | "utility" | "tank";
export type RecruitSourceKind = "story" | "faction" | "event" | "ending";

export interface RecruitSource {
  kind: RecruitSourceKind;
  id: string;
}

export interface GiftDefV1 {
  id: string;
  name: string;
  description: string;
  value: number;
}

export interface CompanionAssistDefV1 {
  name: string;
  trigger: CompanionAssistInput["trigger"];
  cooldown: number;
  effect: CompanionAssistInput["effect"];
  description: string;
}

export interface CompanionSupportDefV1 {
  name: string;
  description: string;
  mods: Partial<CombatMods>;
}

export interface CompanionQuestDefV1 {
  id: string;
  title: string;
  description: string;
  requiredBond: number;
  flag: string;
  outcomes: Array<{ id: string; text: string; flag: string }>;
}

export interface CompanionDefV1 {
  id: string;
  name: string;
  role: CompanionRole;
  region: RegionId;
  description: string;
  sourceKinds: RecruitSourceKind[];
  requiredRealm: number;
  requiredFlag?: string;
  requiredFaction?: string;
  assist: CompanionAssistDefV1;
  support: CompanionSupportDefV1;
  giftPreferenceId: string;
  personalQuest: CompanionQuestDefV1;
  factionHook?: string;
  npcId?: string;
  major: boolean;
}

export interface CompanionContentV1 {
  companions: Record<string, CompanionDefV1>;
  gifts: Record<string, GiftDefV1>;
}

export interface CompanionLetterV1 {
  id: string;
  companionId: string;
  title: string;
  body: string;
  clock: number;
  read: boolean;
}

export interface CompanionStateV1 {
  roster: string[];
  party: { active: string | null; support: [string | null, string | null] };
  bondPoints: Record<string, number>;
  completedQuests: string[];
  questFlags: Record<string, true>;
  giftLog: Record<string, { day: number; count: number; lastClock: number }>;
  letters: CompanionLetterV1[];
  clock: number;
  realm: number;
  activeFactionId: string | null;
  flags: Record<string, true>;
  visitedRegions: string[];
}

export interface RecruitResult {
  state: CompanionStateV1;
  ok: boolean;
  alreadyRecruited: boolean;
  reason: string;
}

export interface PartyValidation {
  ok: boolean;
  errors: string[];
}

export interface PartyResult {
  state: CompanionStateV1;
  validation: PartyValidation;
}

export interface BondResult {
  state: CompanionStateV1;
  ok: boolean;
  points: number;
  level: number;
  gained: number;
  breakpoints: BondBreakpointV1[];
  reason: string;
}

export interface BondBreakpointV1 {
  level: 3 | 6 | 9;
  kind: "assistUpgrade" | "passiveUpgrade" | "personalQuest";
  description: string;
  unlocked: boolean;
}

export interface QuestResult {
  state: CompanionStateV1;
  ok: boolean;
  outcome?: string;
  reason: string;
}

export interface LetterResult {
  state: CompanionStateV1;
  letters: CompanionLetterV1[];
}

export interface AssistContext {
  round: number;
  hpPct: number;
  enemyCharging: boolean;
  allyDebuffed: boolean;
  enemyHpPct: number;
  lastCastRound: number;
}

export interface AssistResult {
  companionId: string;
  name: string;
  effect: CompanionAssistInput["effect"];
}

export interface CompanionValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompanionService {
  createState(realm?: number): CompanionStateV1;
  recruit(state: CompanionStateV1, companionId: string, source: RecruitSource): RecruitResult;
  setParty(state: CompanionStateV1, activeId: string, supportIds: [string, string]): PartyResult;
  validateParty(state: CompanionStateV1): PartyValidation;
  giveGift(state: CompanionStateV1, companionId: string, giftId: string): BondResult;
  addBond(state: CompanionStateV1, companionId: string, points: number, source: string): BondResult;
  bondLevel(state: CompanionStateV1, companionId: string): number;
  bondBreakpoints(state: CompanionStateV1, companionId: string): BondBreakpointV1[];
  completePersonalQuest(state: CompanionStateV1, companionId: string, outcomeId: string): QuestResult;
  assistFor(state: CompanionStateV1, context: AssistContext): AssistResult | null;
  activeAssistInput(state: CompanionStateV1): CompanionAssistInput | null;
  supportMods(state: CompanionStateV1): Partial<CombatMods>;
  queueOfflineLetters(state: CompanionStateV1, seed: number, max?: number): LetterResult;
  readLetter(state: CompanionStateV1, letterId: string): CompanionStateV1;
  validateContent(content: CompanionContentV1): CompanionValidation;
  save(state: CompanionStateV1): string;
  load(serialized: string): CompanionStateV1;
}

const BOND_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700];

export function bondLevelFor(points: number): number {
  let level = 1;
  for (let index = 0; index < BOND_THRESHOLDS.length; index += 1) {
    if (points >= BOND_THRESHOLDS[index]) level = index + 1;
  }
  return Math.min(10, level);
}

export function bondPointsToNext(points: number): number {
  const level = bondLevelFor(points);
  return level >= 10 ? 0 : Math.max(0, BOND_THRESHOLDS[level] - points);
}

function addMods(target: Partial<CombatMods>, source: Partial<CombatMods>, scale: number): void {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number") target[key as keyof CombatMods] = (target[key as keyof CombatMods] ?? 0) + value * scale;
  }
}

export function createCompanionService(content: CompanionContentV1): CompanionService {
  function createState(realm = 0): CompanionStateV1 {
    return {
      roster: [],
      party: { active: null, support: [null, null] },
      bondPoints: {},
      completedQuests: [],
      questFlags: {},
      giftLog: {},
      letters: [],
      clock: 0,
      realm,
      activeFactionId: null,
      flags: {},
      visitedRegions: [],
    };
  }

  function levelOf(state: CompanionStateV1, companionId: string): number {
    return bondLevelFor(state.bondPoints[companionId] ?? 0);
  }

  function addLetter(state: CompanionStateV1, companionId: string, title: string, body: string): void {
    const companion = content.companions[companionId];
    if (!companion) return;
    state.letters.push({
      id: `letter_${state.clock}_${state.letters.length}`,
      companionId,
      title,
      body,
      clock: state.clock,
      read: false,
    });
    if (state.letters.length > 20) state.letters.shift();
  }

  function recruit(state: CompanionStateV1, companionId: string, source: RecruitSource): RecruitResult {
    const companion = content.companions[companionId];
    if (!companion) return { state, ok: false, alreadyRecruited: false, reason: "未知同伴" };
    if (state.roster.includes(companionId)) {
      return { state, ok: true, alreadyRecruited: true, reason: "已入队" };
    }
    if (!companion.sourceKinds.includes(source.kind)) {
      return { state, ok: false, alreadyRecruited: false, reason: `来源不符：需要 ${companion.sourceKinds.join("/")}` };
    }
    if (state.realm < companion.requiredRealm) {
      return { state, ok: false, alreadyRecruited: false, reason: `境界不足：需要 ${companion.requiredRealm}` };
    }
    if (companion.requiredFlag && !state.flags[companion.requiredFlag]) {
      return { state, ok: false, alreadyRecruited: false, reason: `缺少前置 flag：${companion.requiredFlag}` };
    }
    if (companion.requiredFaction && state.activeFactionId !== companion.requiredFaction) {
      return { state, ok: false, alreadyRecruited: false, reason: `需要加入 ${companion.requiredFaction}` };
    }
    const next = structuredClone(state);
    next.roster.push(companionId);
    next.bondPoints[companionId] = 0;
    addLetter(next, companionId, `${companion.name}入队`, `${companion.name}把行囊放在你身边，说以后同行。`);
    return { state: next, ok: true, alreadyRecruited: false, reason: "已招募" };
  }

  function validateParty(state: CompanionStateV1): PartyValidation {
    const errors: string[] = [];
    const active = state.party.active;
    const supports = state.party.support;
    if (!active) errors.push("缺少主战同伴");
    if (supports[0] === null || supports[1] === null) errors.push("需要 2 名助威同伴");
    if (active && !state.roster.includes(active)) errors.push(`主战同伴未招募：${active}`);
    for (const id of supports) {
      if (id && !state.roster.includes(id)) errors.push(`助威同伴未招募：${id}`);
    }
    const ids = [active, ...supports].filter((id): id is string => Boolean(id));
    if (new Set(ids).size !== ids.length) errors.push("主战/助威同伴不能重复");
    return { ok: errors.length === 0, errors };
  }

  function setParty(state: CompanionStateV1, activeId: string, supportIds: [string, string]): PartyResult {
    const next = structuredClone(state);
    next.party = { active: activeId, support: [...supportIds] };
    const validation = validateParty(next);
    if (!validation.ok) {
      return { state, validation };
    }
    return { state: next, validation };
  }

  function breakpoints(state: CompanionStateV1, companionId: string): BondBreakpointV1[] {
    const companion = content.companions[companionId];
    if (!companion) return [];
    const level = levelOf(state, companionId);
    return [
      { level: 3, kind: "assistUpgrade", description: `${companion.assist.name}：助战触发/效果强化`, unlocked: level >= 3 },
      { level: 6, kind: "passiveUpgrade", description: `${companion.support.name}：助威被动强化`, unlocked: level >= 6 },
      { level: 9, kind: "personalQuest", description: companion.personalQuest.title, unlocked: level >= 9 },
    ];
  }

  function giveGift(state: CompanionStateV1, companionId: string, giftId: string): BondResult {
    const companion = content.companions[companionId];
    const gift = content.gifts[giftId];
    if (!companion) return { state, ok: false, points: 0, level: 0, gained: 0, breakpoints: [], reason: "未知同伴" };
    if (!state.roster.includes(companionId)) return { state, ok: false, points: 0, level: 0, gained: 0, breakpoints: [], reason: "尚未招募" };
    if (!gift) return { state, ok: false, points: 0, level: 0, gained: 0, breakpoints: [], reason: "未知礼物" };
    const day = Math.floor(state.clock / 24);
    const log = state.giftLog[companionId];
    if (log && log.lastClock > state.clock) return { state, ok: false, points: 0, level: 0, gained: 0, breakpoints: [], reason: "时间异常" };
    if (log && log.lastClock === state.clock) return { state, ok: false, points: 0, level: 0, gained: 0, breakpoints: [], reason: "同一时刻不能重复赠礼" };
    const countToday = log && log.day === day ? log.count : 0;
    if (countToday >= 3) {
      return { state, ok: false, points: state.bondPoints[companionId] ?? 0, level: levelOf(state, companionId), gained: 0, breakpoints: breakpoints(state, companionId), reason: "今日赠礼已达 3 次，明日再来" };
    }
    if (log && state.clock - log.lastClock < 1) {
      return { state, ok: false, points: state.bondPoints[companionId] ?? 0, level: levelOf(state, companionId), gained: 0, breakpoints: breakpoints(state, companionId), reason: "赠礼冷却中" };
    }
    const preferred = companion.giftPreferenceId === giftId;
    const base = preferred ? gift.value * 1.5 : gift.value;
    const multiplier = countToday >= 2 ? 0.5 : 1;
    const gained = Math.max(1, Math.round(base * multiplier));
    return addBondInternal(state, companionId, gained, "gift", { day, count: countToday + 1, lastClock: state.clock });
  }

  function addBondInternal(
    state: CompanionStateV1,
    companionId: string,
    gained: number,
    source: string,
    giftLog?: { day: number; count: number; lastClock: number },
  ): BondResult {
    const next = structuredClone(state);
    const before = next.bondPoints[companionId] ?? 0;
    const after = Math.min(BOND_THRESHOLDS[9], before + Math.max(0, gained));
    next.bondPoints[companionId] = after;
    if (giftLog) next.giftLog[companionId] = giftLog;
    const level = bondLevelFor(after);
    if (level >= 9 && !next.completedQuests.includes(content.companions[companionId]?.personalQuest.id ?? "")) {
      // The quest itself is completed by completePersonalQuest; reaching 9 only unlocks it.
    }
    return {
      state: next,
      ok: true,
      points: after,
      level,
      gained: after - before,
      breakpoints: breakpoints(next, companionId),
      reason: source === "gift" ? "赠礼已收下" : "羁绊增加",
    };
  }

  function addBond(state: CompanionStateV1, companionId: string, points: number, source: string): BondResult {
    if (!state.roster.includes(companionId)) return { state, ok: false, points: 0, level: 0, gained: 0, breakpoints: [], reason: "尚未招募" };
    return addBondInternal(state, companionId, points, source);
  }

  function completePersonalQuest(state: CompanionStateV1, companionId: string, outcomeId: string): QuestResult {
    const companion = content.companions[companionId];
    if (!companion) return { state, ok: false, reason: "未知同伴" };
    if (!state.roster.includes(companionId)) return { state, ok: false, reason: "尚未招募" };
    if (state.completedQuests.includes(companion.personalQuest.id)) {
      return { state, ok: false, reason: "个人任务已完成" };
    }
    if (levelOf(state, companionId) < companion.personalQuest.requiredBond) {
      return { state, ok: false, reason: `羁绊不足：需要 ${companion.personalQuest.requiredBond}` };
    }
    const outcome = companion.personalQuest.outcomes.find((entry) => entry.id === outcomeId);
    if (!outcome) return { state, ok: false, reason: "未知结局选项" };
    const next = structuredClone(state);
    next.completedQuests.push(companion.personalQuest.id);
    next.questFlags[outcome.flag] = true;
    next.flags[companion.personalQuest.flag] = true;
    addLetter(next, companionId, `${companion.personalQuest.title}·后续`, outcome.text);
    return { state: next, ok: true, outcome: outcome.id, reason: "个人任务完成" };
  }

  function assistFor(state: CompanionStateV1, context: AssistContext): AssistResult | null {
    const validation = validateParty(state);
    if (!validation.ok || !state.party.active) return null;
    const companion = content.companions[state.party.active];
    if (!companion) return null;
    const trigger = companion.assist.trigger;
    const triggerMet = trigger.kind === "everyRounds"
      ? context.round % Math.max(1, trigger.value) === 0
      : trigger.kind === "hpBelow"
        ? context.hpPct < trigger.value
        : trigger.kind === "enemyCharging"
          ? context.enemyCharging
          : trigger.kind === "allyDebuffed"
            ? context.allyDebuffed
            : context.enemyHpPct < trigger.value;
    if (!triggerMet) return null;
    if (context.round - context.lastCastRound < companion.assist.cooldown) return null;
    const level = levelOf(state, companion.id);
    const scale = 1 + 0.05 * (level - 1);
    return {
      companionId: companion.id,
      name: companion.name,
      effect: {
        ...companion.assist.effect,
        power: companion.assist.effect.power * scale,
      },
    };
  }

  function activeAssistInput(state: CompanionStateV1): CompanionAssistInput | null {
    if (!validateParty(state).ok || !state.party.active) return null;
    const companion = content.companions[state.party.active];
    if (!companion) return null;
    const scale = 1 + 0.05 * (levelOf(state, companion.id) - 1);
    return {
      id: companion.id,
      name: companion.name,
      trigger: companion.assist.trigger,
      cooldown: companion.assist.cooldown,
      effect: {
        ...companion.assist.effect,
        power: companion.assist.effect.power * scale,
      },
    };
  }

  function supportMods(state: CompanionStateV1): Partial<CombatMods> {
    const mods: Partial<CombatMods> = {};
    if (!validateParty(state).ok) return mods;
    for (const id of state.party.support) {
      if (!id) continue;
      const companion = content.companions[id];
      if (!companion) continue;
      addMods(mods, companion.support.mods, 1 + 0.08 * (levelOf(state, id) - 1));
    }
    return mods;
  }

  function queueOfflineLetters(state: CompanionStateV1, seed: number, max = 2): LetterResult {
    if (state.roster.length === 0) return { state, letters: [] };
    const existing = new Set(
      state.letters.filter((letter) => letter.title.includes("的来信")).map((letter) => letter.companionId),
    );
    const candidates = state.roster
      .filter((id) => !existing.has(id))
      .sort();
    const rng = new Rng(seed);
    const chosen = rng.shuffle(candidates).slice(0, Math.max(0, Math.min(2, max)));
    const next = structuredClone(state);
    for (const id of chosen) {
      const companion = content.companions[id];
      if (companion) addLetter(next, id, `${companion.name}的来信`, `你回来时，${companion.name}留了一封短短的信，说江湖路远，记得吃饭。`);
    }
    return { state: next, letters: next.letters };
  }

  function readLetter(state: CompanionStateV1, letterId: string): CompanionStateV1 {
    const next = structuredClone(state);
    const letter = next.letters.find((entry) => entry.id === letterId);
    if (letter) letter.read = true;
    return next;
  }

  function validateContent(companionContent: CompanionContentV1): CompanionValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const major = Object.values(companionContent.companions).filter((companion) => companion.major);
    if (major.length < 8) errors.push(`至少需要 8 名主要同伴，当前 ${major.length}`);
    const regions = new Set<string>();
    for (const companion of Object.values(companionContent.companions)) {
      if (!companion.assist?.effect) errors.push(`同伴 ${companion.id} 缺少助战技`);
      if (!companion.support?.mods) errors.push(`同伴 ${companion.id} 缺少助威被动`);
      if (!companion.personalQuest?.id) errors.push(`同伴 ${companion.id} 缺少个人任务`);
      if (!companionContent.gifts[companion.giftPreferenceId]) errors.push(`同伴 ${companion.id} 偏好礼物不存在`);
      if (companion.sourceKinds.length === 0) errors.push(`同伴 ${companion.id} 缺少招募来源`);
      if (!companion.personalQuest.outcomes.some((outcome) => outcome.flag)) errors.push(`同伴 ${companion.id} 的个人任务缺少结局 flag`);
      regions.add(companion.region);
    }
    if (regions.size < 5) errors.push(`同伴至少覆盖 5 个地区，当前 ${regions.size}`);
    if (major.length !== 8) warnings.push(`主要同伴目标为 8，当前 ${major.length}`);
    for (const gift of Object.values(companionContent.gifts)) {
      if (gift.value <= 0) errors.push(`礼物 ${gift.id} 价值非法`);
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  function save(state: CompanionStateV1): string {
    return JSON.stringify(state);
  }

  function load(serialized: string): CompanionStateV1 {
    return structuredClone(JSON.parse(serialized) as CompanionStateV1);
  }

  return {
    createState,
    recruit,
    setParty,
    validateParty,
    giveGift,
    addBond,
    bondLevel: levelOf,
    bondBreakpoints: breakpoints,
    completePersonalQuest,
    assistFor,
    activeAssistInput,
    supportMods,
    queueOfflineLetters,
    readLetter,
    validateContent,
    save,
    load,
  };
}
