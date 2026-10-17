import type { BattleResult, CombatMods, Element } from "./combat-v1.ts";
import type { FactionEventService, FactionEventStateV1 } from "./factions-events.ts";
import { Rng } from "./rng.ts";

// ---------------------------------------------------------------------------
// Survival, Feng Shui & Offline Events v1
//
// One activity seam over Combat v1. Survival waves and escort legs consume
// BattleResult; feng shui is data; offline events delegate to #7.
// ---------------------------------------------------------------------------

export type ActivityKind = "survival" | "escort";
export type ActivityStatus = "active" | "completed" | "failed" | "stopped";

export type FengShuiTag = "mountain" | "forest" | "water" | "cave" | "snow" | "market";

export interface ActivityRewards {
  silver: number;
  materials: number;
  renown: number;
}

export interface SurvivalWaveDefV1 {
  wave: number;
  objective: "clear" | "survive";
  levelOffset: number;
  surviveRounds?: number;
  pressure: number;
  reward: ActivityRewards;
}

export interface EscortLegDefV1 {
  leg: number;
  encounters: 1 | 2;
  ambushChance: number;
  cartHp: number;
  levelOffset: number;
  finalBoss?: boolean;
  reward: ActivityRewards;
}

export interface FengShuiTagEffectV1 {
  cultivationPct: number;
  offlinePct: number;
  silverPct?: number;
  healingPct?: number;
  elementAffinity: Partial<Record<Element, number>>;
  combatMods?: Partial<CombatMods>;
}

export interface ActivityContentV1 {
  mapIds: string[];
  waves: SurvivalWaveDefV1[];
  legs: EscortLegDefV1[];
  mapTags: Record<string, FengShuiTag[]>;
  tagEffects: Record<FengShuiTag, FengShuiTagEffectV1>;
  survivalClearBonus: ActivityRewards;
  escortClearBonus: ActivityRewards;
  offlineEventCap: 3;
}

export interface FengShuiModifierV1 {
  mapId: string;
  tags: FengShuiTag[];
  cultivationPct: number;
  offlinePct: number;
  silverPct: number;
  healingPct: number;
  elementAffinity: Partial<Record<Element, number>>;
  combatMods: Partial<CombatMods>;
  label: string;
}

export interface ActivityStateV1 {
  kind: ActivityKind;
  mapId: string;
  status: ActivityStatus;
  wave: number;
  waveCount: number;
  leg: number;
  legCount: number;
  encounter: number;
  encountersInLeg: number;
  cartHp: number;
  cartMaxHp: number;
  playerHpPct: number;
  playerInnerPct: number;
  clearedWaves: number;
  clearedLegs: number;
  rewards: ActivityRewards;
  seed: number;
  log: string[];
  reason: string;
}

export interface ActivityBattleSpec {
  kind: ActivityKind;
  mapId: string;
  wave?: number;
  leg?: number;
  encounter?: number;
  objective: "clear" | "survive";
  levelOffset: number;
  surviveRounds?: number;
  pressure: number;
  ambush: boolean;
  enemySeed: number;
  finalBoss: boolean;
}

export interface ActivityStopInput {
  manual?: boolean;
  bagFull?: boolean;
  targetDrop?: boolean;
  rareDrop?: boolean;
  elapsedHours?: number;
  timeLimitHours?: number;
}

export interface ActivityResult {
  state: ActivityStateV1;
  advanced: boolean;
  status: ActivityStatus;
  rewards: ActivityRewards;
  reason: string;
}

export interface OfflineEventResult {
  state: FactionEventStateV1;
  events: unknown[];
  count: number;
}

export interface ActivityValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ActivityService {
  startSurvival(mapId: string, seed: number): ActivityStateV1;
  startEscort(mapId: string, seed: number): ActivityStateV1;
  nextBattle(state: ActivityStateV1): ActivityBattleSpec | null;
  advance(state: ActivityStateV1, battle: BattleResult, stop?: ActivityStopInput, cartDamagePct?: number): ActivityResult;
  stopActivity(state: ActivityStateV1, reason: string): ActivityResult;
  fengShui(mapId: string): FengShuiModifierV1;
  offlineEventCount(elapsedHours: number): number;
  queueOfflineEvents(
    factionService: FactionEventService,
    factionState: FactionEventStateV1,
    elapsedHours: number,
    seed: number,
  ): OfflineEventResult;
  validateContent(content: ActivityContentV1): ActivityValidation;
  save(state: ActivityStateV1): string;
  load(serialized: string): ActivityStateV1;
}

const COMBAT_MOD_KEYS = new Set<string>([
  "hp", "innerMax", "attack", "defense", "speed",
  "hpPct", "innerMaxPct", "attackPct", "defensePct", "speedPct",
  "hit", "evade", "crit", "critDamage", "guardReduction", "breakDamage",
  "comboDamage", "counterDamage", "statusHit", "statusResist", "damageReduction",
  "innerRegen", "reflect", "healBonus", "lifesteal", "poisonDamage", "damagePct", "typeDamagePct",
]);

function emptyRewards(): ActivityRewards {
  return { silver: 0, materials: 0, renown: 0 };
}

function addRewards(target: ActivityRewards, source: ActivityRewards): void {
  target.silver += source.silver;
  target.materials += source.materials;
  target.renown += source.renown;
}

function hash(seed: number, ...values: number[]): number {
  let value = seed >>> 0;
  for (const entry of values) value = (Math.imul(value, 31) + entry) >>> 0;
  return value || 1;
}

export function createActivityService(content: ActivityContentV1): ActivityService {
  function startSurvival(mapId: string, seed: number): ActivityStateV1 {
    const waveCount = content.waves.length;
    return {
      kind: "survival",
      mapId,
      status: "active",
      wave: 1,
      waveCount,
      leg: 0,
      legCount: 0,
      encounter: 0,
      encountersInLeg: 0,
      cartHp: 0,
      cartMaxHp: 0,
      playerHpPct: 1,
      playerInnerPct: 0.55,
      clearedWaves: 0,
      clearedLegs: 0,
      rewards: emptyRewards(),
      seed,
      log: ["守关开始：五波守势"],
      reason: "",
    };
  }

  function startEscort(mapId: string, seed: number): ActivityStateV1 {
    const firstLeg = content.legs[0];
    return {
      kind: "escort",
      mapId,
      status: "active",
      wave: 0,
      waveCount: 0,
      leg: 1,
      legCount: content.legs.length,
      encounter: 1,
      encountersInLeg: firstLeg?.encounters ?? 1,
      cartHp: firstLeg?.cartHp ?? 100,
      cartMaxHp: firstLeg?.cartHp ?? 100,
      playerHpPct: 1,
      playerInnerPct: 0.55,
      clearedWaves: 0,
      clearedLegs: 0,
      rewards: emptyRewards(),
      seed,
      log: ["护镖开始：三段路程"],
      reason: "",
    };
  }

  function nextBattle(state: ActivityStateV1): ActivityBattleSpec | null {
    if (state.status !== "active") return null;
    if (state.kind === "survival") {
      const wave = content.waves[state.wave - 1];
      if (!wave) return null;
      return {
        kind: "survival",
        mapId: state.mapId,
        wave: state.wave,
        objective: wave.objective,
        levelOffset: wave.levelOffset,
        surviveRounds: wave.surviveRounds,
        pressure: wave.pressure,
        ambush: false,
        enemySeed: hash(state.seed, state.wave),
        finalBoss: wave.wave === state.waveCount,
      };
    }
    const leg = content.legs[state.leg - 1];
    if (!leg) return null;
    const rng = new Rng(hash(state.seed, state.leg, state.encounter));
    return {
      kind: "escort",
      mapId: state.mapId,
      leg: state.leg,
      encounter: state.encounter,
      objective: "clear",
      levelOffset: leg.levelOffset,
      pressure: 1 + 0.1 * (state.leg - 1) + 0.05 * (state.encounter - 1),
      ambush: rng.chance(leg.ambushChance),
      enemySeed: hash(state.seed, state.leg, state.encounter),
      finalBoss: Boolean(leg.finalBoss && state.encounter === leg.encounters),
    };
  }

  function stopActivity(state: ActivityStateV1, reason: string): ActivityResult {
    if (state.status !== "active") {
      return { state, advanced: false, status: state.status, rewards: state.rewards, reason: state.reason };
    }
    const next = structuredClone(state);
    next.status = "stopped";
    next.reason = reason;
    next.log.push(`停止：${reason}`);
    return { state: next, advanced: false, status: next.status, rewards: next.rewards, reason };
  }

  function advance(
    state: ActivityStateV1,
    battle: BattleResult,
    stop: ActivityStopInput = {},
    cartDamagePct?: number,
  ): ActivityResult {
    if (state.status !== "active") {
      return { state, advanced: false, status: state.status, rewards: state.rewards, reason: "活动已结束" };
    }
    if (stop.manual) return stopActivity(state, "手动停止");
    if (stop.bagFull) return stopActivity(state, "背包已满");
    if (stop.targetDrop) return stopActivity(state, "目标掉落达成");
    if (stop.rareDrop) return stopActivity(state, "稀有掉落达成");
    if (stop.timeLimitHours !== undefined && (stop.elapsedHours ?? 0) >= stop.timeLimitHours) {
      return stopActivity(state, "达到时间上限");
    }

    const next = structuredClone(state);
    if (state.kind === "survival") {
      if (!battle.win) {
        next.status = "failed";
        next.reason = `第 ${state.wave} 波失守`;
        next.log.push(`第 ${state.wave} 波失守，保留 ${state.clearedWaves} 波奖励`);
        return { state: next, advanced: false, status: next.status, rewards: next.rewards, reason: next.reason };
      }
      const waveDef = content.waves[state.wave - 1];
      if (waveDef) addRewards(next.rewards, waveDef.reward);
      next.clearedWaves += 1;
      next.playerHpPct = Math.min(1, battle.playerHpPct + 0.15);
      next.playerInnerPct = Math.min(1, (battle.playerInnerMax > 0 ? battle.playerInner / battle.playerInnerMax : 0) + 0.25);
      next.log.push(`第 ${state.wave} 波守住`);
      next.wave += 1;
      if (next.wave > next.waveCount) {
        next.status = "completed";
        next.reason = "五波守关完成";
        addRewards(next.rewards, content.survivalClearBonus);
        next.log.push("守关完成，获得通关奖励");
      }
      return { state: next, advanced: true, status: next.status, rewards: next.rewards, reason: next.reason || "推进到下一波" };
    }

    // Escort: a lost battle or a destroyed cart ends the run with partial rewards.
    const cartDamage = cartDamagePct ?? Math.max(0, Math.round((1 - battle.playerHpPct) * 40 + (battle.win ? 0 : 100)));
    next.cartHp = Math.max(0, state.cartHp - cartDamage);
    if (!battle.win || next.cartHp <= 0) {
      next.status = "failed";
      next.reason = !battle.win ? "护镖遭遇战失败" : "镖车被毁";
      next.log.push(`${next.reason}，保留 ${state.clearedLegs} 段奖励`);
      return { state: next, advanced: false, status: next.status, rewards: next.rewards, reason: next.reason };
    }
    const legDef = content.legs[state.leg - 1];
    if (state.encounter >= state.encountersInLeg) {
      if (legDef) addRewards(next.rewards, legDef.reward);
      next.clearedLegs += 1;
      next.log.push(`第 ${state.leg} 段护镖完成`);
      next.leg += 1;
      next.encounter = 1;
      if (next.leg > next.legCount) {
        next.status = "completed";
        next.reason = "三段护镖完成";
        addRewards(next.rewards, content.escortClearBonus);
        next.log.push("护镖完成，获得通关奖励");
      } else {
        const nextLeg = content.legs[next.leg - 1];
        next.encountersInLeg = nextLeg?.encounters ?? 1;
        next.cartHp = Math.min(next.cartHp, nextLeg?.cartHp ?? next.cartHp);
        next.cartMaxHp = nextLeg?.cartHp ?? next.cartMaxHp;
      }
    } else {
      next.encounter += 1;
      next.log.push(`第 ${state.leg} 段第 ${state.encounter} 战结束`);
    }
    return { state: next, advanced: true, status: next.status, rewards: next.rewards, reason: next.reason || "推进到下一战" };
  }

  function fengShui(mapId: string): FengShuiModifierV1 {
    const tags = content.mapTags[mapId] ?? [];
    const modifier: FengShuiModifierV1 = {
      mapId,
      tags,
      cultivationPct: 0,
      offlinePct: 0,
      silverPct: 0,
      healingPct: 0,
      elementAffinity: {},
      combatMods: {},
      label: tags.join("·"),
    };
    for (const tag of tags) {
      const effect = content.tagEffects[tag];
      if (!effect) continue;
      modifier.cultivationPct += effect.cultivationPct;
      modifier.offlinePct += effect.offlinePct;
      modifier.silverPct += effect.silverPct ?? 0;
      modifier.healingPct += effect.healingPct ?? 0;
      for (const [element, value] of Object.entries(effect.elementAffinity)) {
        const key = element as Element;
        modifier.elementAffinity[key] = (modifier.elementAffinity[key] ?? 0) + (value ?? 0);
      }
      for (const [key, value] of Object.entries(effect.combatMods ?? {})) {
        if (typeof value !== "number") continue;
        modifier.combatMods[key as keyof CombatMods] = (modifier.combatMods[key as keyof CombatMods] ?? 0) + value;
      }
    }
    return modifier;
  }

  function offlineEventCount(elapsedHours: number): number {
    if (elapsedHours < 1) return 0;
    if (elapsedHours < 8) return 1;
    if (elapsedHours < 24) return 2;
    return Math.min(3, content.offlineEventCap);
  }

  function queueOfflineEvents(
    factionService: FactionEventService,
    factionState: FactionEventStateV1,
    elapsedHours: number,
    seed: number,
  ): OfflineEventResult {
    const max = offlineEventCount(elapsedHours);
    if (max === 0) return { state: factionState, events: [], count: 0 };
    const queued = factionService.queueOfflineEvents(factionState, seed, max);
    return { state: queued.state, events: queued.events, count: queued.events.length };
  }

  function validateContent(activityContent: ActivityContentV1): ActivityValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (activityContent.waves.length !== 5) errors.push(`守关必须有 5 波，当前 ${activityContent.waves.length}`);
    if (activityContent.legs.length !== 3) errors.push(`护镖必须有 3 段，当前 ${activityContent.legs.length}`);
    if (activityContent.offlineEventCap > 3) errors.push("离线事件上限不能超过 3");
    for (const wave of activityContent.waves) {
      if (wave.wave < 1 || !wave.objective) errors.push(`第 ${wave.wave} 波配置非法`);
      if (wave.surviveRounds !== undefined && wave.surviveRounds <= 0) errors.push(`第 ${wave.wave} 波生存回合非法`);
      if (wave.reward.silver < 0 || wave.reward.materials < 0 || wave.reward.renown < 0) errors.push(`第 ${wave.wave} 波奖励为负`);
    }
    for (const wave of activityContent.waves.slice(1)) {
      const previous = activityContent.waves[wave.wave - 2];
      if (previous && wave.levelOffset < previous.levelOffset) warnings.push(`第 ${wave.wave} 波等级偏移未递增`);
    }
    for (const leg of activityContent.legs) {
      if (leg.encounters < 1 || leg.encounters > 2) errors.push(`第 ${leg.leg} 段遭遇数必须为 1–2`);
      if (leg.cartHp <= 0) errors.push(`第 ${leg.leg} 段镖车 HP 必须为正`);
      if (leg.ambushChance < 0 || leg.ambushChance > 1) errors.push(`第 ${leg.leg} 段伏击率非法`);
      if (leg.reward.silver < 0 || leg.reward.materials < 0 || leg.reward.renown < 0) errors.push(`第 ${leg.leg} 段奖励为负`);
    }
    for (const mapId of activityContent.mapIds) {
      const tags = activityContent.mapTags[mapId];
      if (!tags || tags.length < 1 || tags.length > 2) errors.push(`地图 ${mapId} 必须有 1–2 个风水标签`);
      for (const tag of tags ?? []) {
        if (!activityContent.tagEffects[tag]) errors.push(`地图 ${mapId} 引用未知风水标签 ${tag}`);
      }
    }
    for (const [tag, effect] of Object.entries(activityContent.tagEffects)) {
      for (const value of Object.values(effect.elementAffinity)) {
        if (typeof value !== "number" || !Number.isFinite(value)) errors.push(`风水 ${tag} 属性亲和非法`);
      }
      for (const key of Object.keys(effect.combatMods ?? {})) {
        if (!COMBAT_MOD_KEYS.has(key)) errors.push(`风水 ${tag} 使用了 Combat v1 之外的属性 ${key}`);
      }
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  function save(state: ActivityStateV1): string {
    return JSON.stringify(state);
  }

  function load(serialized: string): ActivityStateV1 {
    return structuredClone(JSON.parse(serialized) as ActivityStateV1);
  }

  return {
    startSurvival,
    startEscort,
    nextBattle,
    advance,
    stopActivity,
    fengShui,
    offlineEventCount,
    queueOfflineEvents,
    validateContent,
    save,
    load,
  };
}
