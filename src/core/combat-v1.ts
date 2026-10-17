import { Rng } from "./rng.ts";
import { clamp } from "./stats.ts";
import type { GearSlot } from "./types.ts";

// ---------------------------------------------------------------------------
// Combat v1 public contract
//
// One pure seam: resolveBattle(BattleInput) -> BattleResult.
// Callers (simulator, session, UI, tests) never inspect combatant internals.
// ---------------------------------------------------------------------------

export type MoveType = "shi" | "xu" | "jia" | "qi";
export type Element = "yin" | "yang" | "gang" | "rou" | "taiji";
export type WeaponType = "sword" | "blade" | "fist" | "spear" | "hidden";
export type SkillKind = "move" | "ultimate" | "light";
export type ComboTag = "starter" | "chase" | "finisher" | "utility";
export type BattleObjective = "clear" | "survive";
export type StatusId =
  | "fengxue"
  | "poison"
  | "armorBreak"
  | "guard"
  | "charge"
  | "attackBuff"
  | "evadeBuff"
  | "healBlock";

export const MOVE_TYPE_LABELS: Record<MoveType, string> = {
  shi: "实",
  xu: "虚",
  jia: "架",
  qi: "气",
};

export const ELEMENT_LABELS: Record<Element, string> = {
  yin: "阴",
  yang: "阳",
  gang: "刚",
  rou: "柔",
  taiji: "太极",
};

export const STATUS_LABELS: Record<StatusId, string> = {
  fengxue: "封穴",
  poison: "毒",
  armorBreak: "破甲",
  guard: "架势",
  charge: "蓄力",
  attackBuff: "蓄势",
  evadeBuff: "轻身",
  healBlock: "禁疗",
};

export interface PrimaryAttributes {
  hp: number;
  innerMax: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface SecondaryAttributes {
  /** Hit chance above the 90% baseline; fractions. */
  hit: number;
  /** Evasion subtracted from the attacker's hit; fractions. */
  evade: number;
  /** Critical chance; fractions. */
  crit: number;
  /** Critical damage bonus above the base 1.0 multiplier; fractions. */
  critDamage: number;
  /** Damage reduction while guarding against 实招; fractions. */
  guardReduction: number;
  /** Extra damage when the type wheel counters; fractions. */
  breakDamage: number;
  /** Extra combo damage per stack; fractions. */
  comboDamage: number;
  /** Extra counterattack damage; fractions. */
  counterDamage: number;
  /** Added to status application chance; fractions. */
  statusHit: number;
  /** Subtracted from incoming status chance; fractions. */
  statusResist: number;
  /** Flat percentage reduction applied after defense; fractions. */
  damageReduction: number;
  /** Inner recovered each round. */
  innerRegen: number;
  /** Fraction of direct damage taken reflected back; fractions. */
  reflect: number;
  /** Healing received bonus; fractions. */
  healBonus: number;
  /** Fraction of direct damage dealt healed back; fractions. */
  lifesteal: number;
  /** Poison damage bonus; fractions. */
  poisonDamage: number;
  /** Damage dealt bonus; fractions. */
  damagePct: number;
  /** Element-match damage bonus; fractions. */
  typeDamagePct: number;
}

export interface CombatMods extends PrimaryAttributes {
  hpPct: number;
  innerMaxPct: number;
  attackPct: number;
  defensePct: number;
  speedPct: number;
  hit: number;
  evade: number;
  crit: number;
  critDamage: number;
  guardReduction: number;
  breakDamage: number;
  comboDamage: number;
  counterDamage: number;
  statusHit: number;
  statusResist: number;
  damageReduction: number;
  innerRegen: number;
  reflect: number;
  healBonus: number;
  lifesteal: number;
  poisonDamage: number;
  damagePct: number;
  typeDamagePct: number;
}

export function emptyCombatMods(): CombatMods {
  return {
    hp: 0,
    innerMax: 0,
    attack: 0,
    defense: 0,
    speed: 0,
    hpPct: 0,
    innerMaxPct: 0,
    attackPct: 0,
    defensePct: 0,
    speedPct: 0,
    hit: 0,
    evade: 0,
    crit: 0,
    critDamage: 0,
    guardReduction: 0,
    breakDamage: 0,
    comboDamage: 0,
    counterDamage: 0,
    statusHit: 0,
    statusResist: 0,
    damageReduction: 0,
    innerRegen: 0,
    reflect: 0,
    healBonus: 0,
    lifesteal: 0,
    poisonDamage: 0,
    damagePct: 0,
    typeDamagePct: 0,
  };
}

export function addCombatMods(target: CombatMods, source: Partial<CombatMods>): CombatMods {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number" && key in target) {
      target[key as keyof CombatMods] += value;
    }
  }
  return target;
}

export interface BattleSheet {
  id: string;
  name: string;
  element: Element;
  weaponType: WeaponType;
  primary: PrimaryAttributes;
  secondary: SecondaryAttributes;
}

export interface SkillEffects {
  /** Gain inner on use (basic attack uses this as its resource engine). */
  innerGain?: number;
  /** Set guard reduction for this round (架招). */
  guard?: number;
  /** Apply poison stacks. */
  poison?: number;
  /** Apply armor-break stacks. */
  armorBreak?: number;
  /** Chance to apply 封穴; modified by status hit/resist. */
  fengxueChance?: number;
  /** Heal as a fraction of max HP. */
  healPct?: number;
  /** Cleanse N debuffs from self. */
  cleanse?: number;
  /** Attack buff fraction for N rounds. */
  attackBuffPct?: number;
  attackBuffRounds?: number;
  /** Extra hits; each hit rolls hit/crit separately. */
  extraHits?: number;
  /** Bonus damage against a low-HP target. */
  executeBonusPct?: number;
  /** Extra damage when the target is charging. */
  interruptBonusPct?: number;
  /** Damage reduction buff for this round (non-架). */
  evadeBuff?: number;
  /** Apply heal-block for N rounds. */
  healBlockRounds?: number;
}

export interface BattleSkill {
  id: string;
  name: string;
  kind: SkillKind;
  type: MoveType;
  element: Element;
  /** A loadout is invalid if the equipped weapon satisfies none of these. Empty = any. */
  weaponTypes: WeaponType[];
  cost: number;
  cooldown: number;
  coefficient: number;
  tag: ComboTag;
  effects?: SkillEffects;
  /** Ultimate gate: combo >= 3 OR inner >= 50% of max. */
  ultimateCondition?: "combo3_or_inner50";
  description?: string;
}

export interface InnerArtDef {
  id: string;
  name: string;
  element: Element;
  description: string;
  /** One signature rule; consumed by the sheet builder, not the battle loop. */
  signature: string;
  mods: Partial<CombatMods>;
}

export interface HeartMethodDefV1 {
  id: string;
  name: string;
  description: string;
  mods: Partial<CombatMods>;
}

export interface KeystoneDefV1 {
  id: string;
  name: string;
  description: string;
  mods: Partial<CombatMods>;
}

export interface CompanionDefV1 {
  id: string;
  name: string;
  role: string;
  every: number;
  assist: "heal" | "damage" | "shield" | "poison";
  power: number;
  mods: Partial<CombatMods>;
}

export interface CombatContent {
  skills: Record<string, BattleSkill>;
  innerArts: Record<string, InnerArtDef>;
  hearts: Record<string, HeartMethodDefV1>;
  keystones: Record<string, KeystoneDefV1>;
  companions: Record<string, CompanionDefV1>;
  /** IDs are enough for shape validation; itemization owns the data. */
  gearIds: Record<string, true>;
  priorityPresets?: Record<string, PriorityPreset>;
}

export interface Loadout {
  innerArtId: string;
  moves: [string, string, string, string];
  ultimateId: string;
  lightSkillId: string;
  hearts: [string, string, string, string];
  heartTargets?: [string | null, string | null, string | null, string | null];
  keystones: [string, string];
  companions: { active: string; support: [string, string] };
  gear: Record<GearSlot, string | null>;
  priorityPresetId: string;
}

export interface LoadoutValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface LoadoutValidationOptions {
  ownedArtIds?: string[];
  ownedGearIds?: string[];
  requireOwned?: boolean;
  weaponType?: WeaponType;
}

export function activeSkillIds(loadout: Loadout): string[] {
  return [...loadout.moves, loadout.ultimateId, loadout.lightSkillId];
}

export function validateLoadout(
  loadout: Loadout,
  content: CombatContent,
  options: LoadoutValidationOptions = {},
): LoadoutValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const owned = options.requireOwned && options.ownedArtIds
    ? new Set(options.ownedArtIds)
    : null;
  const ownedGear = options.requireOwned && options.ownedGearIds
    ? new Set(options.ownedGearIds)
    : null;

  if (!Array.isArray(loadout.moves) || loadout.moves.length !== 4) {
    errors.push("招式槽必须恰好 4 个");
  }
  if (!Array.isArray(loadout.hearts) || loadout.hearts.length !== 4) {
    errors.push("心法槽必须恰好 4 个");
  }
  if (!Array.isArray(loadout.keystones) || loadout.keystones.length !== 2) {
    errors.push("经脉奇穴必须恰好 2 个");
  }
  if (!loadout.companions || !Array.isArray(loadout.companions.support) || loadout.companions.support.length !== 2) {
    errors.push("同伴必须为 1 主战 + 2 助威");
  }
  if (loadout.companions?.active && loadout.companions.support?.includes(loadout.companions.active)) {
    errors.push("主战同伴不能同时作为助威同伴");
  }
  if (new Set(loadout.companions?.support ?? []).size !== (loadout.companions?.support ?? []).length) {
    errors.push("助威同伴不能重复");
  }

  const gearSlots: GearSlot[] = ["weapon", "head", "body", "wrist", "feet", "jade"];
  const gearKeys = Object.keys(loadout.gear ?? {});
  if (gearKeys.length !== 6 || !gearSlots.every((slot) => slot in (loadout.gear ?? {}))) {
    errors.push("装备槽必须恰好 6 个");
  }

  if (!content.innerArts[loadout.innerArtId]) errors.push(`未知内功：${loadout.innerArtId}`);
  const active = activeSkillIds(loadout);
  if (new Set(active).size !== active.length) errors.push("主动技能不能重复装备");

  loadout.moves.forEach((id, index) => {
    const skill = content.skills[id];
    if (!skill) errors.push(`未知招式：${id}`);
    else if (skill.kind !== "move") errors.push(`第 ${index + 1} 招不是普通招式：${id}`);
  });
  const ultimate = content.skills[loadout.ultimateId];
  if (!ultimate) errors.push(`未知绝技：${loadout.ultimateId}`);
  else if (ultimate.kind !== "ultimate") errors.push(`绝技槽不是绝技：${loadout.ultimateId}`);
  const light = content.skills[loadout.lightSkillId];
  if (!light) errors.push(`未知轻功：${loadout.lightSkillId}`);
  else if (light.kind !== "light") errors.push(`轻功槽不是轻功：${loadout.lightSkillId}`);

  if (new Set(loadout.hearts).size !== loadout.hearts.length) errors.push("心法不能重复装备");
  for (const id of loadout.hearts) {
    if (!content.hearts[id]) errors.push(`未知心法：${id}`);
  }
  if (!content.keystones[loadout.keystones[0]]) errors.push(`未知奇穴：${loadout.keystones[0]}`);
  if (!content.keystones[loadout.keystones[1]]) errors.push(`未知奇穴：${loadout.keystones[1]}`);
  if (loadout.keystones[0] === loadout.keystones[1]) errors.push("奇穴不能重复装备");
  if (!content.companions[loadout.companions?.active]) errors.push(`未知主战同伴：${loadout.companions?.active}`);
  for (const id of loadout.companions?.support ?? []) {
    if (!content.companions[id]) errors.push(`未知助威同伴：${id}`);
  }

  if (loadout.heartTargets) {
    if (loadout.heartTargets.length !== 4) errors.push("心法绑定必须与 4 个心法槽一一对应");
    const targets = loadout.heartTargets.filter((target): target is string => Boolean(target));
    if (new Set(targets).size !== targets.length) errors.push("每招最多绑定一个心法");
    for (const target of targets) {
      if (!loadout.moves.includes(target)) errors.push(`心法绑定了未装备的招式：${target}`);
    }
  }

  const ownedSkills = active.filter((id) => content.skills[id]);
  if (ownedSkills.length > 0 && !ownedSkills.some((id) => (content.skills[id]?.coefficient ?? 0) > 0)) {
    errors.push("至少需要一个有伤害的主动武学");
  }

  if (options.weaponType) {
    for (const id of ownedSkills) {
      const skill = content.skills[id];
      if (skill.weaponTypes.length > 0 && !skill.weaponTypes.includes(options.weaponType)) {
        errors.push(`招式「${skill.name}」需要 ${skill.weaponTypes.join("/")}，当前兵器不兼容`);
      }
    }
  }

  if (owned) {
    for (const id of active) {
      if (!owned.has(id)) errors.push(`尚未学会武学：${id}`);
    }
    for (const id of loadout.hearts) if (!owned.has(id)) errors.push(`尚未获得心法：${id}`);
    for (const id of loadout.keystones) if (!owned.has(id)) errors.push(`尚未点出奇穴：${id}`);
    if (!owned.has(loadout.innerArtId)) errors.push(`尚未学会内功：${loadout.innerArtId}`);
    if (!owned.has(loadout.companions.active)) errors.push(`尚未结识同伴：${loadout.companions.active}`);
    for (const id of loadout.companions.support) if (!owned.has(id)) errors.push(`尚未结识同伴：${id}`);
  }

  if (ownedGear) {
    for (const id of Object.values(loadout.gear)) {
      if (id && !ownedGear.has(id)) errors.push(`行囊中没有装备：${id}`);
    }
  }

  if (!loadout.priorityPresetId) warnings.push("未选择优先级预设；战斗会退化为普攻");
  else if (content.priorityPresets && !content.priorityPresets[loadout.priorityPresetId]) {
    warnings.push(`未知优先级预设：${loadout.priorityPresetId}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Priority rules: ordered condition -> action, first match wins.
// ---------------------------------------------------------------------------

export type PriorityCondition =
  | { kind: "always" }
  | { kind: "enemyIntentType"; type: MoveType }
  | { kind: "enemyIntentElement"; element: Element }
  | { kind: "enemyCharging" }
  | { kind: "hpBelow"; pct: number }
  | { kind: "hpAtLeast"; pct: number }
  | { kind: "innerAtLeast"; pct: number }
  | { kind: "comboAtLeast"; stacks: number }
  | { kind: "skillReady"; skillId: string }
  | { kind: "statusOnSelf"; status: StatusId }
  | { kind: "statusOnEnemy"; status: StatusId }
  | { kind: "enemyHpBelow"; pct: number }
  | { kind: "bossPhaseAtLeast"; phase: number }
  | { kind: "lastTag"; tag: ComboTag };

export interface PriorityRule {
  id: string;
  conditions: PriorityCondition[];
  action: { kind: "skill"; skillId: string } | { kind: "basic" };
  note?: string;
}

export interface PriorityPreset {
  id: string;
  name: string;
  rules: PriorityRule[];
}

export interface PriorityState {
  round: number;
  hpPct: number;
  inner: number;
  innerMax: number;
  combo: number;
  /** Remaining cooldown rounds; >0 means unavailable. */
  cooldowns: Record<string, number>;
  statuses: StatusId[];
  enemyStatuses: StatusId[];
  enemyIntent: BattleEnemyMove;
  enemyHpPct: number;
  bossPhase: number;
  lastTag?: ComboTag;
}

export interface PriorityDecision {
  skill: BattleSkill;
  ruleId: string;
  basic: boolean;
  skipped: Array<{ ruleId: string; skillId: string; reason: string }>;
}

export function basicAttack(element: Element): BattleSkill {
  return {
    id: "basic",
    name: "普攻",
    kind: "move",
    type: "shi",
    element,
    weaponTypes: [],
    cost: 0,
    cooldown: 0,
    coefficient: 0.55,
    tag: "starter",
    effects: { innerGain: 5 },
    description: "0 内力、无冷却，命中回 5 内力；可会心、可触发克制。",
  };
}

export function skillUsable(
  skill: BattleSkill,
  state: Pick<PriorityState, "inner" | "innerMax" | "cooldowns" | "combo">,
): { ok: boolean; reason?: string } {
  if ((state.cooldowns[skill.id] ?? 0) > 0) return { ok: false, reason: "冷却中" };
  if (state.inner < skill.cost) return { ok: false, reason: "内力不足" };
  if (skill.ultimateCondition === "combo3_or_inner50") {
    const innerPct = state.innerMax > 0 ? state.inner / state.innerMax : 0;
    if (state.combo < 3 && innerPct < 0.5) return { ok: false, reason: "绝技条件未满足（连击≥3或内力≥50%）" };
  }
  return { ok: true };
}

export function conditionMatches(condition: PriorityCondition, state: PriorityState): boolean {
  switch (condition.kind) {
    case "always":
      return true;
    case "enemyIntentType":
      return state.enemyIntent.type === condition.type;
    case "enemyIntentElement":
      return state.enemyIntent.element === condition.element;
    case "enemyCharging":
      return state.enemyStatuses.includes("charge");
    case "hpBelow":
      return state.hpPct < condition.pct;
    case "hpAtLeast":
      return state.hpPct >= condition.pct;
    case "innerAtLeast":
      return state.innerMax > 0 && state.inner / state.innerMax >= condition.pct;
    case "comboAtLeast":
      return state.combo >= condition.stacks;
    case "skillReady":
      return (state.cooldowns[condition.skillId] ?? 0) <= 0;
    case "statusOnSelf":
      return state.statuses.includes(condition.status);
    case "statusOnEnemy":
      return state.enemyStatuses.includes(condition.status);
    case "enemyHpBelow":
      return state.enemyHpPct < condition.pct;
    case "bossPhaseAtLeast":
      return state.bossPhase >= condition.phase;
    case "lastTag":
      return state.lastTag === condition.tag;
    default:
      return false;
  }
}

/**
 * Walk the ordered rule list. A matching rule whose skill is unusable is
 * skipped and the next matching rule is considered. No match -> basic attack.
 */
export function selectPriorityAction(input: {
  rules: PriorityRule[];
  content: CombatContent;
  loadout: Loadout;
  state: PriorityState;
}): PriorityDecision {
  const { rules, content, loadout, state } = input;
  const fallback = basicAttack(content.innerArts[loadout.innerArtId]?.element ?? "taiji");
  const skipped: PriorityDecision["skipped"] = [];
  for (const rule of rules) {
    if (!rule.conditions.every((condition) => conditionMatches(condition, state))) continue;
    if (rule.action.kind === "basic") {
      return { skill: fallback, ruleId: rule.id, basic: true, skipped };
    }
    const skill = content.skills[rule.action.skillId];
    if (!skill) {
      skipped.push({ ruleId: rule.id, skillId: rule.action.skillId, reason: "未知武学" });
      continue;
    }
    const usable = skillUsable(skill, state);
    if (!usable.ok) {
      skipped.push({ ruleId: rule.id, skillId: skill.id, reason: usable.reason ?? "不可用" });
      continue;
    }
    return { skill, ruleId: rule.id, basic: false, skipped };
  }
  return { skill: fallback, ruleId: "fallback", basic: true, skipped };
}

// ---------------------------------------------------------------------------
// Enemy + modifier input shapes
// ---------------------------------------------------------------------------

export type EnemyMoveEffect =
  | "none"
  | "heavy"
  | "charge"
  | "poison"
  | "stun"
  | "guard"
  | "armorBreak";

export interface BattleEnemyMove {
  id: string;
  name: string;
  type: MoveType;
  element: Element;
  coefficient: number;
  effect?: EnemyMoveEffect;
  /** Override the default status application chance. */
  statusChance?: number;
  description?: string;
}

export interface BattleEnemyPhase {
  name: string;
  /** Active when current HP / max HP is at or below this threshold. */
  threshold: number;
  pattern: BattleEnemyMove[];
  announcement: string;
}

export interface BattleEnemyDef {
  id: string;
  name: string;
  style: "gang" | "rou" | "kuai" | "gui";
  element: Element;
  level: number;
  primary: PrimaryAttributes;
  secondary: SecondaryAttributes;
  phases: BattleEnemyPhase[];
  damageCapPct?: number;
  reflectPct?: number;
  enrageAt?: number;
  enrageAttackPct?: number;
  affixIds?: string[];
}

export type BattleModifierStat =
  | keyof PrimaryAttributes
  | keyof SecondaryAttributes
  | "damageDealtPct"
  | "damageTakenPct"
  | "healingPct";

export interface BattleModifierEffect {
  target: "player" | "enemy";
  stat: BattleModifierStat;
  mode: "add" | "scale";
  value: number;
}

export type BattleModifierRule =
  | { kind: "periodicDamage"; every: number; pctMaxHp: number; target: "player" | "enemy"; label: string }
  | { kind: "healing"; pct: number; target: "player" | "enemy" };

export interface BattleModifier {
  id: string;
  name: string;
  scope: "player" | "enemy" | "both" | "rewards" | "environment";
  description: string;
  effects?: BattleModifierEffect[];
  rules?: BattleModifierRule[];
}

export interface BattleInput {
  player: {
    sheet: BattleSheet;
    loadout: Loadout;
    content: CombatContent;
    /** Overrides the preset's rules when supplied. */
    priorityRules?: PriorityRule[];
  };
  enemy: BattleEnemyDef;
  objective: BattleObjective;
  maxRounds: number;
  seed: number;
  modifiers?: BattleModifier[];
  /** UI/report needs events; long simulations can turn this off for speed. */
  captureEvents?: boolean;
  /** Survive objective target; defaults to maxRounds. */
  surviveRounds?: number;
}

export type BattleEventCategory =
  | "round_start"
  | "intent"
  | "phase"
  | "rule"
  | "action"
  | "hit"
  | "miss"
  | "crit"
  | "counter"
  | "guard"
  | "guard_break"
  | "reflect"
  | "status_apply"
  | "status_expire"
  | "status_tick"
  | "interrupt"
  | "combo"
  | "resource"
  | "heal"
  | "companion"
  | "enrage"
  | "damage_cap"
  | "defeat"
  | "timeout"
  | "end";

export interface BattleEvent {
  round: number;
  category: BattleEventCategory;
  actor: "player" | "enemy" | "system";
  text: string;
  skillId?: string;
  moveId?: string;
  statusId?: StatusId;
  damage?: number;
  amount?: number;
  ruleId?: string;
}

export interface DamageBreakdown {
  total: number;
  bySkill: Record<string, number>;
  direct: number;
  critBonus: number;
  counter: number;
  reflect: number;
  dot: number;
  companion: number;
}

export interface BattleRngTrace {
  round: number;
  kind: string;
  value: number;
  success?: boolean;
}

export interface BattleActionTrace {
  round: number;
  skillId: string;
  ruleId: string;
  basic: boolean;
}

export interface BattleResult {
  outcome: "win" | "loss" | "timeout";
  win: boolean;
  rounds: number;
  reason: string;
  objective: BattleObjective;
  roundsTarget: number;
  playerName: string;
  playerElement: Element;
  playerBuild?: string;
  enemyName: string;
  enemyStyle: string;
  playerHp: number;
  playerHpPct: number;
  playerInner: number;
  playerInnerMax: number;
  enemyHp: number;
  enemyHpPct: number;
  damageDealt: number;
  damageTaken: number;
  events: BattleEvent[];
  log: string[];
  damageBreakdown: DamageBreakdown;
  keyRounds: number[];
  actionTrace: BattleActionTrace[];
  rngTrace: BattleRngTrace[];
  finalPhase: number;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface StatusInstance {
  id: StatusId;
  stacks: number;
  rounds: number;
  appliedRound: number;
  sourceAttack?: number;
  sourcePoisonBonus?: number;
}

interface Fighter {
  sheet: BattleSheet;
  hp: number;
  inner: number;
  statuses: StatusInstance[];
  cooldowns: Record<string, number>;
  combo: number;
  lastTag?: ComboTag;
  attackBuffPct: number;
  attackBuffRounds: number;
  evadeBuff: number;
  healBlockRounds: number;
  guard: boolean;
  guardReduction: number;
  counterUsed: boolean;
  damageThisRound: number;
  damageDealtPct: number;
  damageTakenPct: number;
  healingPct: number;
}

interface SideModifierTotals {
  damageDealtPct: number;
  damageTakenPct: number;
  healingPct: number;
}

const TYPE_COUNTERS: Record<MoveType, MoveType | null> = {
  shi: "xu",
  xu: "jia",
  jia: "shi",
  qi: null,
};

function cloneSheet(sheet: BattleSheet): BattleSheet {
  return {
    ...sheet,
    primary: { ...sheet.primary },
    secondary: { ...sheet.secondary },
  };
}

function applyStat(
  target: Record<string, number>,
  stat: string,
  mode: "add" | "scale",
  value: number,
): void {
  if (mode === "scale") target[stat] = (target[stat] ?? 0) * (1 + value);
  else target[stat] = (target[stat] ?? 0) + value;
}

function applyBattleModifiers(
  sheet: BattleSheet,
  modifiers: BattleModifier[],
  target: "player" | "enemy",
): { sheet: BattleSheet; totals: SideModifierTotals; rules: BattleModifierRule[] } {
  const copy = cloneSheet(sheet);
  const totals: SideModifierTotals = { damageDealtPct: 0, damageTakenPct: 0, healingPct: 0 };
  const rules: BattleModifierRule[] = [];
  const primary = copy.primary as unknown as Record<string, number>;
  const secondary = copy.secondary as unknown as Record<string, number>;
  for (const modifier of modifiers) {
    for (const effect of modifier.effects ?? []) {
      if (effect.target !== target) continue;
      const stat = effect.stat as string;
      if (stat in primary) applyStat(primary, stat, effect.mode, effect.value);
      else if (stat in secondary) applyStat(secondary, stat, effect.mode, effect.value);
      else if (stat === "damageDealtPct") totals.damageDealtPct += effect.value;
      else if (stat === "damageTakenPct") totals.damageTakenPct += effect.value;
      else if (stat === "healingPct") totals.healingPct += effect.value;
    }
    for (const rule of modifier.rules ?? []) {
      if (rule.kind === "periodicDamage" && rule.target === target) rules.push(rule);
      if (rule.kind === "healing" && rule.target === target) rules.push(rule);
    }
  }
  return { sheet: copy, totals, rules };
}

function makeFighter(sheet: BattleSheet, totals: SideModifierTotals, startingInnerPct: number): Fighter {
  return {
    sheet,
    hp: sheet.primary.hp,
    inner: sheet.primary.innerMax * startingInnerPct,
    statuses: [],
    cooldowns: {},
    combo: 0,
    attackBuffPct: 0,
    attackBuffRounds: 0,
    evadeBuff: 0,
    healBlockRounds: 0,
    guard: false,
    guardReduction: sheet.secondary.guardReduction,
    counterUsed: false,
    damageThisRound: 0,
    damageDealtPct: totals.damageDealtPct,
    damageTakenPct: totals.damageTakenPct,
    healingPct: totals.healingPct,
  };
}

function status(fighter: Fighter, id: StatusId): StatusInstance | undefined {
  return fighter.statuses.find((entry) => entry.id === id);
}

function addStatus(
  fighter: Fighter,
  id: StatusId,
  stacks: number,
  rounds: number,
  appliedRound: number,
  sourceAttack?: number,
  sourcePoisonBonus?: number,
): void {
  const existing = status(fighter, id);
  if (existing) {
    existing.stacks = Math.min(10, existing.stacks + stacks);
    existing.rounds = Math.max(existing.rounds, rounds);
    existing.sourceAttack = sourceAttack ?? existing.sourceAttack;
    existing.sourcePoisonBonus = sourcePoisonBonus ?? existing.sourcePoisonBonus;
    return;
  }
  fighter.statuses.push({ id, stacks, rounds, appliedRound, sourceAttack, sourcePoisonBonus });
}

function removeStatus(fighter: Fighter, id: StatusId): boolean {
  const before = fighter.statuses.length;
  fighter.statuses = fighter.statuses.filter((entry) => entry.id !== id);
  return fighter.statuses.length !== before;
}

function hasStatus(fighter: Fighter, id: StatusId): boolean {
  return fighter.statuses.some((entry) => entry.id === id);
}

function statusIds(fighter: Fighter): StatusId[] {
  return fighter.statuses.map((entry) => entry.id);
}

function tickRoundStartStatuses(fighter: Fighter, round: number, emit: (event: Omit<BattleEvent, "round" | "actor"> & { actor?: BattleEvent["actor"] }) => void): void {
  const survivors: StatusInstance[] = [];
  for (const entry of fighter.statuses) {
    // 封穴 is consumed when it cancels an action, not by duration.
    if (entry.id === "fengxue" || entry.id === "guard" || entry.id === "charge") {
      survivors.push(entry);
      continue;
    }
    if (entry.appliedRound >= round) {
      survivors.push(entry);
      continue;
    }
    entry.rounds -= 1;
    if (entry.rounds > 0) {
      survivors.push(entry);
    } else {
      emit({ category: "status_expire", actor: "system", text: `${STATUS_LABELS[entry.id]}消退`, statusId: entry.id });
    }
  }
  fighter.statuses = survivors;
}

function mitigationFor(defense: number, level: number): number {
  const k = 120 + 7 * level;
  return defense / (defense + k);
}

function hitChance(attacker: BattleSheet, defender: BattleSheet): number {
  return clamp(0.90 + attacker.secondary.hit - defender.secondary.evade, 0.25, 1);
}

function critChance(fighter: Fighter): number {
  return clamp(fighter.sheet.secondary.crit, 0, 0.85);
}

function critMultiplier(fighter: Fighter): number {
  return 1 + fighter.sheet.secondary.critDamage;
}

function beats(attacker: MoveType, defender: MoveType): boolean {
  return TYPE_COUNTERS[attacker] === defender;
}

function effectiveDefense(
  defender: Fighter,
  attacker: Fighter,
): number {
  const broken = status(defender, "armorBreak");
  const breakStacks = broken?.stacks ?? 0;
  return Math.max(0, defender.sheet.primary.defense * (1 - breakStacks * 0.10));
}

function comboBonus(fighter: Fighter): number {
  return fighter.combo * (0.04 + fighter.sheet.secondary.comboDamage);
}

function elementBonus(fighter: Fighter, skillElement: Element): number {
  const inner = fighter.sheet.element;
  if (inner === skillElement) return 0.2 + fighter.sheet.secondary.typeDamagePct;
  if (inner === "taiji") return 0.1 + fighter.sheet.secondary.typeDamagePct;
  return 0;
}

function healAmount(target: Fighter, raw: number): number {
  if (target.healBlockRounds > 0) return 0;
  const bonus = 1 + target.sheet.secondary.healBonus + target.healingPct;
  return raw * Math.max(0, bonus);
}

function applyHeal(target: Fighter, raw: number): number {
  const healed = Math.max(0, Math.min(target.sheet.primary.hp - target.hp, healAmount(target, raw)));
  target.hp += healed;
  return healed;
}

function updateCombo(player: Fighter, skill: BattleSkill, round: number, emit: (event: Omit<BattleEvent, "round" | "actor"> & { actor?: BattleEvent["actor"] }) => void): void {
  if (skill.kind === "ultimate") {
    player.combo = 0;
    emit({ category: "combo", actor: "player", text: `绝技收势，连击清零`, amount: player.combo });
  } else if (skill.tag === "starter") {
    player.combo = player.lastTag === "starter" ? player.combo : Math.max(1, player.combo);
    emit({ category: "combo", actor: "player", text: `起手成势，连击 ${player.combo}`, amount: player.combo });
  } else if (skill.tag === "chase") {
    const gain = player.lastTag === "starter" || player.lastTag === "chase" ? 1 : 0;
    player.combo = clamp(player.combo + gain, 0, 5);
    emit({ category: "combo", actor: "player", text: `追击续势，连击 ${player.combo}`, amount: player.combo });
  } else if (skill.tag === "finisher") {
    const gain = player.lastTag === "starter" || player.lastTag === "chase" ? 1 : 1;
    player.combo = clamp(player.combo + gain, 0, 5);
    emit({ category: "combo", actor: "player", text: `终结定势，连击 ${player.combo}`, amount: player.combo });
  }
  player.lastTag = skill.tag;
  void round;
}

function phaseForEnemy(enemy: BattleEnemyDef, hpPct: number): number {
  let index = 0;
  for (let i = 1; i < enemy.phases.length; i += 1) {
    if (hpPct <= enemy.phases[i].threshold) index = i;
    else break;
  }
  return index;
}

// ---------------------------------------------------------------------------
// resolveBattle
// ---------------------------------------------------------------------------

export function resolveBattle(input: BattleInput): BattleResult {
  const capture = input.captureEvents ?? true;
  const content = input.player.content;
  const modifiers = input.modifiers ?? [];
  const playerMods = applyBattleModifiers(input.player.sheet, modifiers, "player");
  const enemyMods = applyBattleModifiers(
    {
      id: input.enemy.id,
      name: input.enemy.name,
      element: input.enemy.element,
      weaponType: "fist",
      primary: { ...input.enemy.primary },
      secondary: { ...input.enemy.secondary },
    },
    modifiers,
    "enemy",
  );
  const player = makeFighter(playerMods.sheet, playerMods.totals, 0.55);
  const enemy = makeFighter(enemyMods.sheet, enemyMods.totals, 0);
  const loadout = input.player.loadout;
  const rules = input.player.priorityRules
    ?? content.priorityPresets?.[loadout.priorityPresetId]?.rules
    ?? [];
  const activeCompanion = content.companions[loadout.companions.active];
  const startingHp = player.hp;
  const startingEnemyHp = enemy.hp;
  const rng = new Rng(input.seed);
  const events: BattleEvent[] = [];
  const log: string[] = [];
  const actionTrace: BattleActionTrace[] = [];
  const rngTrace: BattleRngTrace[] = [];
  const keyRounds: number[] = [];
  const damageBreakdown: DamageBreakdown = {
    total: 0,
    bySkill: {},
    direct: 0,
    critBonus: 0,
    counter: 0,
    reflect: 0,
    dot: 0,
    companion: 0,
  };
  const objective = input.objective;
  const roundsTarget = objective === "survive" ? (input.surviveRounds ?? input.maxRounds) : input.maxRounds;
  const maxRounds = objective === "survive" ? roundsTarget : input.maxRounds;
  let round = 0;
  let phaseIndex = 0;
  let patternIndex = 0;
  let intent: BattleEnemyMove | null = null;
  let playerStunnedThisRound = false;
  let enemyChargeInterrupted = false;
  let damageDealt = 0;
  let damageTaken = 0;
  let enraged = false;
  let timeout = false;
  let endReason = "";

  const emit = (
    category: BattleEventCategory,
    actor: BattleEvent["actor"],
    text: string,
    extra: Partial<Omit<BattleEvent, "round" | "category" | "actor" | "text">> = {},
  ): void => {
    if (capture) events.push({ round, category, actor, text, ...extra });
    log.push(text);
    if (log.length > 160) log.shift();
  };

  const addDamage = (skillId: string, amount: number, category: "direct" | "counter" | "reflect" | "dot" | "companion", critExtra = 0): void => {
    if (amount <= 0) return;
    damageBreakdown.total += amount;
    damageBreakdown.bySkill[skillId] = (damageBreakdown.bySkill[skillId] ?? 0) + amount;
    damageBreakdown[category] += amount;
    if (critExtra > 0) damageBreakdown.critBonus += critExtra;
  };

  const roll = (kind: string, chance: number): boolean => {
    const value = rng.next();
    const success = value < chance;
    if (capture) rngTrace.push({ round, kind, value, success });
    return success;
  };

  const dotDamage = (source: Fighter, target: Fighter, stacks: number): number => {
    const raw = source.sheet.primary.attack * 0.06 * stacks * (1 + source.sheet.secondary.poisonDamage);
    const mitigation = mitigationFor(effectiveDefense(target, source) * 0.5, 1);
    return Math.max(0, Math.round(raw * (1 - mitigation)));
  };

  const originalEnemyMax = enemy.sheet.primary.hp;
  const originalPlayerMax = player.sheet.primary.hp;

  // Start of round bookkeeping -------------------------------------------------
  const beginRound = (): void => {
    round += 1;
    player.damageThisRound = 0;
    enemy.damageThisRound = 0;
    player.counterUsed = false;
    player.guard = false;
    enemy.guard = false;
    playerStunnedThisRound = hasStatus(player, "fengxue");
    enemyChargeInterrupted = false;
    tickRoundStartStatuses(player, round, (event) => emit(event.category, event.actor ?? "player", event.text, { statusId: event.statusId }));
    tickRoundStartStatuses(enemy, round, (event) => emit(event.category, event.actor ?? "enemy", event.text, { statusId: event.statusId }));
    if (player.attackBuffRounds > 0) {
      player.attackBuffRounds -= 1;
      if (player.attackBuffRounds === 0) player.attackBuffPct = 0;
    }
    if (player.evadeBuff > 0) player.evadeBuff = 0;
    if (player.healBlockRounds > 0) player.healBlockRounds -= 1;
    if (enemy.healBlockRounds > 0) enemy.healBlockRounds -= 1;

    const hpPct = enemy.hp / originalEnemyMax;
    const nextPhase = phaseForEnemy(input.enemy, hpPct);
    if (nextPhase > phaseIndex) {
      phaseIndex = nextPhase;
      patternIndex = 0;
      const phase = input.enemy.phases[phaseIndex];
      emit("phase", "enemy", `【${input.enemy.name}】${phase.announcement}`);
      keyRounds.push(round);
    }
    const phase = input.enemy.phases[Math.min(phaseIndex, input.enemy.phases.length - 1)];
    intent = phase.pattern[patternIndex % phase.pattern.length];
    emit("round_start", "system", `第 ${round} 回合`);
    emit("intent", "enemy", `敌方意图：${input.enemy.name} 将用「${intent.name}」（${MOVE_TYPE_LABELS[intent.type]}）`, {
      moveId: intent.id,
    });
    if (input.enemy.phases.length > 1) {
      emit("phase", "system", `首领阶段 ${phaseIndex + 1}/${input.enemy.phases.length} · ${phase.name}`);
    }
    if (intent.effect === "guard") {
      enemy.guard = true;
      addStatus(enemy, "guard", 1, 1, round);
    }
    if (hasStatus(enemy, "charge")) {
      addStatus(enemy, "charge", 1, 1, round);
    }
    // Periodic map/environment damage.
    for (const rule of playerMods.rules) {
      if (rule.kind === "periodicDamage" && rule.target === "player" && round % rule.every === 0) {
        const amount = Math.max(1, Math.round(originalPlayerMax * rule.pctMaxHp));
        player.hp = Math.max(0, player.hp - amount);
        damageTaken += amount;
        emit("status_tick", "system", `${rule.label}：气血 -${amount}`);
      }
    }
    for (const rule of enemyMods.rules) {
      if (rule.kind === "periodicDamage" && rule.target === "enemy" && round % rule.every === 0) {
        const amount = Math.max(1, Math.round(originalEnemyMax * rule.pctMaxHp));
        enemy.hp = Math.max(0, enemy.hp - amount);
        damageDealt += amount;
        addDamage("environment", amount, "dot");
        emit("status_tick", "system", `${rule.label}：敌方气血 -${amount}`);
      }
    }
  };

  // Player action --------------------------------------------------------------
  const playerAction = (skill: BattleSkill, ruleId: string): void => {
    if (player.hp <= 0) return;
    if (hasStatus(player, "fengxue")) {
      removeStatus(player, "fengxue");
      emit("interrupt", "player", `你被封穴，${skill.name} 未能出手`, { skillId: skill.id });
      playerStunnedThisRound = true;
      return;
    }
    actionTrace.push({ round, skillId: skill.id, ruleId, basic: skill.id === "basic" });
    emit("action", "player", `你以「${skill.name}」（${MOVE_TYPE_LABELS[skill.type]}）出手`, {
      skillId: skill.id,
      ruleId,
    });
    if (skill.cost > 0) {
      player.inner = Math.max(0, player.inner - skill.cost);
      emit("resource", "player", `内力 -${skill.cost}（余 ${Math.round(player.inner)}）`, { skillId: skill.id });
    }
    if (skill.cooldown > 0) {
      player.cooldowns[skill.id] = skill.cooldown + 1;
    }
    // Determine type interaction before damage.
    let typeBonus = 1;
    let breakBonus = 1;
    let interrupted = false;
    if (intent && beats(skill.type, intent.type)) {
      typeBonus = 1.2;
      emit("hit", "player", `类型克制：${MOVE_TYPE_LABELS[skill.type]}克${MOVE_TYPE_LABELS[intent.type]}，伤害 +20%`, {
        skillId: skill.id,
      });
    }
    if (skill.type === "shi" && intent?.type === "qi") {
      interrupted = true;
      enemyChargeInterrupted = true;
      removeStatus(enemy, "charge");
      typeBonus *= 1.1;
      emit("interrupt", "player", `实招打断气招：${input.enemy.name} 的蓄力被打断`, { skillId: skill.id });
      keyRounds.push(round);
    } else if (skill.type === "shi" && hasStatus(enemy, "charge")) {
      enemyChargeInterrupted = true;
      removeStatus(enemy, "charge");
      typeBonus *= 1.1;
      emit("interrupt", "player", `实招截断蓄力：${input.enemy.name} 的气劲散去`, { skillId: skill.id });
      keyRounds.push(round);
    }
    if (enemy.guard) {
      if (skill.type === "xu") {
        enemy.guard = false;
        removeStatus(enemy, "guard");
        breakBonus = 1.15 + player.sheet.secondary.breakDamage;
        emit("guard_break", "player", `虚招破架：${input.enemy.name} 的架势被打散，破招增伤 ${Math.round((breakBonus - 1) * 100)}%`, {
          skillId: skill.id,
        });
        keyRounds.push(round);
      } else {
        breakBonus = 0.75;
        enemy.guard = false;
        removeStatus(enemy, "guard");
        emit("hit", "player", `${input.enemy.name} 以架势卸力，伤害降至 75%`, { skillId: skill.id });
      }
    }

    // Self effects that do not depend on hitting.
    if (skill.effects?.innerGain) {
      player.inner = Math.min(player.sheet.primary.innerMax, player.inner + skill.effects.innerGain);
      emit("resource", "player", `内力 +${skill.effects.innerGain}（余 ${Math.round(player.inner)}）`, { skillId: skill.id });
    }
    if (skill.effects?.healPct) {
      const healed = applyHeal(player, player.sheet.primary.hp * skill.effects.healPct);
      if (healed > 0) emit("heal", "player", `恢复 ${Math.round(healed)} 气血`, { skillId: skill.id, amount: Math.round(healed) });
    }
    if (skill.effects?.cleanse) {
      let left = skill.effects.cleanse;
      for (const debuff of ["fengxue", "poison", "armorBreak", "healBlock"] as StatusId[]) {
        if (left > 0 && removeStatus(player, debuff)) {
          left -= 1;
          emit("status_expire", "player", `驱散「${STATUS_LABELS[debuff]}」`, { skillId: skill.id, statusId: debuff });
        }
      }
    }
    if (skill.effects?.attackBuffPct) {
      player.attackBuffPct = Math.max(player.attackBuffPct, skill.effects.attackBuffPct);
      player.attackBuffRounds = Math.max(player.attackBuffRounds, skill.effects.attackBuffRounds ?? 3);
      emit("status_apply", "player", `蓄势：攻击 +${Math.round(skill.effects.attackBuffPct * 100)}%`, { skillId: skill.id, statusId: "attackBuff" });
    }
    if (skill.effects?.evadeBuff) {
      player.evadeBuff = skill.effects.evadeBuff;
      addStatus(player, "evadeBuff", 1, 1, round);
      emit("status_apply", "player", `轻身：本回合闪避提高`, { skillId: skill.id, statusId: "evadeBuff" });
    }

    // Hit checks. Utility/zero-coefficient skills skip the attack roll.
    const hits = 1 + (skill.effects?.extraHits ?? 0);
    const offensive = skill.coefficient > 0;
    let hitsLanded = 0;
    let critHits = 0;
    for (let hit = 0; hit < hits; hit += 1) {
      if (offensive) {
        const hitRoll = roll("hit", hitChance(player.sheet, enemy.sheet));
        if (!hitRoll) {
          emit("miss", "player", `${input.enemy.name} 闪开了「${skill.name}」`, { skillId: skill.id });
          continue;
        }
      }
      hitsLanded += 1;
      if (!offensive) continue;
      const isCrit = roll("crit", critChance(player));
      if (isCrit) critHits += 1;
      const combo = comboBonus(player);
      const attackBuff = player.attackBuffPct;
      const lowHp = skill.effects?.executeBonusPct && enemy.hp / originalEnemyMax < 0.35
        ? skill.effects.executeBonusPct
        : 0;
      const execute = skill.effects?.executeBonusPct && enemy.hp / originalEnemyMax < 0.35
        ? 1 + skill.effects.executeBonusPct
        : 1;
      const interruptBonus = interrupted && skill.effects?.interruptBonusPct
        ? 1 + skill.effects.interruptBonusPct
        : 1;
      const offense = 1
        + elementBonus(player, skill.element)
        + player.sheet.secondary.damagePct
        + player.damageDealtPct
        + combo
        + attackBuff
        + lowHp;
      const base = player.sheet.primary.attack * skill.coefficient;
      const crit = isCrit ? critMultiplier(player) : 1;
      const mitigation = mitigationFor(effectiveDefense(enemy, player), input.enemy.level);
      const raw = base
        * offense
        * typeBonus
        * breakBonus
        * crit
        * execute
        * interruptBonus
        * (1 - mitigation)
        * (1 - enemy.sheet.secondary.damageReduction)
        * (1 + enemy.damageTakenPct);
      const damage = Math.max(0, Math.round(raw));
      let capped = damage;
      if (input.enemy.damageCapPct && input.enemy.damageCapPct > 0) {
        const cap = originalEnemyMax * input.enemy.damageCapPct;
        if (enemy.damageThisRound + capped > cap) {
          capped = Math.max(0, cap - enemy.damageThisRound);
          emit("damage_cap", "enemy", `${input.enemy.name} 护体：单回合伤害被封顶`, { damage: 0 });
        }
      }
      enemy.damageThisRound += capped;
      if (capped > 0) {
        enemy.hp = Math.max(0, enemy.hp - capped);
        damageDealt += capped;
        addDamage(skill.id, capped, "direct", isCrit ? capped * (critMultiplier(player) - 1) : 0);
        emit(isCrit ? "crit" : "hit", "player", `${isCrit ? "会心！" : ""}「${skill.name}」命中，造成 ${capped} 伤害`, {
          skillId: skill.id,
          damage: capped,
        });
        if (isCrit) keyRounds.push(round);
        if (player.sheet.secondary.lifesteal > 0) {
          const healed = applyHeal(player, capped * player.sheet.secondary.lifesteal);
          if (healed > 0) emit("heal", "player", `吸血 ${Math.round(healed)}`, { skillId: skill.id, amount: Math.round(healed) });
        }
        if (input.enemy.reflectPct && input.enemy.reflectPct > 0) {
          const reflected = Math.round(capped * input.enemy.reflectPct);
          if (reflected > 0) {
            player.hp = Math.max(0, player.hp - reflected);
            damageTaken += reflected;
            addDamage("enemyReflect", reflected, "reflect");
            emit("reflect", "enemy", `${input.enemy.name} 反震，你受到 ${reflected} 伤害`, { damage: reflected });
          }
        }
      }
      if (enemy.hp <= 0) break;
    }
    if (offensive && hitsLanded > 0) {
      applyOffensiveEffects(skill, true);
      if (critHits > 0) emit("crit", "player", `本次「${skill.name}」共 ${hits} 段，其中 ${critHits} 段会心`, { skillId: skill.id });
    }
    if (!offensive) {
      applyOffensiveEffects(skill, true);
    }
    if (player.hp <= 0) {
      emit("defeat", "player", "反震之下，你气血耗尽");
    }
    if (enemy.hp <= 0) return;

    function applyOffensiveEffects(appliedSkill: BattleSkill, updateChain: boolean): void {
      const effects = appliedSkill.effects;
      if (!effects) {
        if (updateChain) updateCombo(player, appliedSkill, round, (event) => emit(event.category, event.actor ?? "player", event.text, { amount: event.amount }));
        return;
      }
      const applyStatus = (
        id: StatusId,
        stacks: number,
        rounds: number,
        chance: number,
        sourceAttack: number,
        sourceBonus: number,
      ): void => {
        const finalChance = clamp(chance + player.sheet.secondary.statusHit - enemy.sheet.secondary.statusResist, 0, 0.95);
        const success = roll(`status:${id}`, finalChance);
        if (!success) {
          emit("status_apply", "enemy", `${input.enemy.name} 抵抗了「${STATUS_LABELS[id]}」`, { skillId: appliedSkill.id, statusId: id });
          return;
        }
        addStatus(enemy, id, stacks, rounds, round, sourceAttack, sourceBonus);
        emit("status_apply", "enemy", `「${STATUS_LABELS[id]}」${stacks} 层落在 ${input.enemy.name} 身上`, {
          skillId: appliedSkill.id,
          statusId: id,
        });
        keyRounds.push(round);
      };
      if (effects.poison) applyStatus("poison", effects.poison, 3, 0.85, player.sheet.primary.attack, player.sheet.secondary.poisonDamage);
      if (effects.armorBreak) applyStatus("armorBreak", effects.armorBreak, 3, 0.9, 0, 0);
      if (effects.fengxueChance) applyStatus("fengxue", 1, 1, effects.fengxueChance, 0, 0);
      if (effects.healBlockRounds) {
        const finalChance = clamp(0.85 + player.sheet.secondary.statusHit - enemy.sheet.secondary.statusResist, 0, 0.95);
        if (roll("status:healBlock", finalChance)) {
          enemy.healBlockRounds = Math.max(enemy.healBlockRounds, effects.healBlockRounds);
          emit("status_apply", "enemy", `${input.enemy.name} 被禁疗 ${effects.healBlockRounds} 回合`, {
            skillId: appliedSkill.id,
            statusId: "healBlock",
          });
        }
      }
      if (updateChain) updateCombo(player, appliedSkill, round, (event) => emit(event.category, event.actor ?? "player", event.text, { amount: event.amount }));
    }
  };

  // Enemy action ---------------------------------------------------------------
  const enemyAction = (): void => {
    if (enemy.hp <= 0 || player.hp <= 0 || !intent) return;
    if (hasStatus(enemy, "fengxue")) {
      removeStatus(enemy, "fengxue");
      emit("interrupt", "enemy", `${input.enemy.name} 被封穴，无法行动`);
      playerStunnedThisRound = false;
      return;
    }
    if (enemyChargeInterrupted) {
      emit("interrupt", "enemy", `${input.enemy.name} 的气招已被打断`);
      return;
    }
    const move = intent;
    emit("action", "enemy", `${input.enemy.name} 施展「${move.name}」（${MOVE_TYPE_LABELS[move.type]}）`, { moveId: move.id });
    if (move.effect === "charge") {
      addStatus(enemy, "charge", 1, 1, round);
      emit("status_apply", "enemy", `${input.enemy.name} 正在蓄力`, { statusId: "charge", moveId: move.id });
      patternIndex += 1;
      return;
    }
    if (move.effect === "guard") {
      enemy.guard = true;
      addStatus(enemy, "guard", 1, 1, round);
      emit("guard", "enemy", `${input.enemy.name} 摆出架势`, { moveId: move.id });
      patternIndex += 1;
      return;
    }

    let coefficient = move.coefficient;
    if (move.effect === "heavy") coefficient *= 1.25;
    if (hasStatus(enemy, "charge")) {
      coefficient *= 1.5;
      removeStatus(enemy, "charge");
      emit("hit", "enemy", `${input.enemy.name} 蓄势爆发！`, { moveId: move.id });
    }
    const hitRoll = roll("hit", hitChance(enemy.sheet, player.sheet));
    if (!hitRoll) {
      emit("miss", "enemy", `你闪开了「${move.name}」`, { moveId: move.id });
      patternIndex += 1;
      return;
    }
    const combo = 0;
    const offense = 1
      + elementBonus(enemy, move.element)
      + enemy.sheet.secondary.damagePct
      + enemy.damageDealtPct
      + combo;
    const base = enemy.sheet.primary.attack * coefficient;
    const crit = roll("crit", critChance(enemy)) ? critMultiplier(enemy) : 1;
    let damage = base
      * offense
      * crit
      * (1 - mitigationFor(effectiveDefense(player, enemy), input.enemy.level))
      * (1 - player.sheet.secondary.damageReduction)
      * (1 + player.damageTakenPct);
    const evaded = player.evadeBuff > 0 ? 0.15 : 0;
    damage *= 1 - evaded;
    if (damage < 0) damage = 0;

    let guarded = false;
    if (player.guard && move.type === "shi" && !player.counterUsed) {
      damage *= 1 - player.guardReduction;
      guarded = true;
      player.counterUsed = true;
      emit("guard", "player", `架势生效：${MOVE_TYPE_LABELS[move.type]}招伤害减免 ${Math.round(player.guardReduction * 100)}%`, {
        moveId: move.id,
      });
    }
    const rounded = Math.max(0, Math.round(damage));
    player.hp = Math.max(0, player.hp - rounded);
    damageTaken += rounded;
    addDamage(input.enemy.id, rounded, "direct");
    emit("hit", "enemy", `${input.enemy.name} 的「${move.name}」造成 ${rounded} 伤害`, {
      moveId: move.id,
      damage: rounded,
    });

    if (player.sheet.secondary.reflect > 0 && rounded > 0) {
      const reflected = Math.max(0, Math.round(rounded * player.sheet.secondary.reflect));
      if (reflected > 0) {
        enemy.hp = Math.max(0, enemy.hp - reflected);
        damageDealt += reflected;
        addDamage("reflect", reflected, "reflect");
        emit("reflect", "player", `反伤：${input.enemy.name} 受到 ${reflected} 伤害`, { damage: reflected });
      }
    }

    if (guarded && player.hp > 0 && enemy.hp > 0) {
      const counterBase = player.sheet.primary.attack * 0.35 * (1 + player.sheet.secondary.counterDamage);
      const counterDamage = Math.max(
        0,
        Math.round(counterBase
          * (1 - mitigationFor(effectiveDefense(enemy, player), input.enemy.level))
          * (1 + enemy.damageTakenPct)),
      );
      enemy.hp = Math.max(0, enemy.hp - counterDamage);
      damageDealt += counterDamage;
      addDamage("counter", counterDamage, "counter");
      emit("counter", "player", `借力反打：反击造成 ${counterDamage} 伤害（不可会心）`, { damage: counterDamage });
      keyRounds.push(round);
    }

    if (move.effect === "poison") {
      const chance = clamp((move.statusChance ?? 0.75) + enemy.sheet.secondary.statusHit - player.sheet.secondary.statusResist, 0, 0.95);
      if (roll("status:poison", chance)) {
        addStatus(player, "poison", 1, 3, round, enemy.sheet.primary.attack, enemy.sheet.secondary.poisonDamage);
        emit("status_apply", "player", `你中了毒（${status(player, "poison")?.stacks ?? 1} 层）`, { statusId: "poison" });
      } else {
        emit("status_apply", "player", `你抵抗了毒`, { statusId: "poison" });
      }
    }
    if (move.effect === "stun") {
      const chance = clamp((move.statusChance ?? 0.35) + enemy.sheet.secondary.statusHit - player.sheet.secondary.statusResist, 0, 0.95);
      if (roll("status:fengxue", chance)) {
        addStatus(player, "fengxue", 1, 1, round);
        emit("status_apply", "player", `你被封穴`, { statusId: "fengxue" });
        keyRounds.push(round);
      } else {
        emit("status_apply", "player", `你抵抗了封穴`, { statusId: "fengxue" });
      }
    }
    if (move.effect === "armorBreak") {
      const chance = clamp((move.statusChance ?? 0.75) + enemy.sheet.secondary.statusHit - player.sheet.secondary.statusResist, 0, 0.95);
      if (roll("status:armorBreak", chance)) {
        addStatus(player, "armorBreak", 1, 3, round);
        emit("status_apply", "player", `你被破甲（${status(player, "armorBreak")?.stacks ?? 1} 层）`, { statusId: "armorBreak" });
      }
    }
    patternIndex += 1;
  };

  // End of round ---------------------------------------------------------------
  const endRound = (): void => {
    // Damage over time is not a direct hit, cannot crit, and uses half defense.
    const enemyPoison = status(enemy, "poison");
    if (enemyPoison && enemyPoison.stacks > 0 && enemy.hp > 0) {
      const damage = dotDamage(
        { ...player, sheet: { ...player.sheet, primary: { ...player.sheet.primary, attack: enemyPoison.sourceAttack ?? player.sheet.primary.attack }, secondary: { ...player.sheet.secondary, poisonDamage: enemyPoison.sourcePoisonBonus ?? player.sheet.secondary.poisonDamage } } },
        enemy,
        enemyPoison.stacks,
      );
      if (damage > 0) {
        enemy.hp = Math.max(0, enemy.hp - damage);
        damageDealt += damage;
        addDamage("poison", damage, "dot");
        emit("status_tick", "player", `毒发：${input.enemy.name} 受到 ${damage} 伤害（${enemyPoison.stacks} 层）`, { damage });
      }
    }
    const playerPoison = status(player, "poison");
    if (playerPoison && playerPoison.stacks > 0 && player.hp > 0) {
      const damage = dotDamage(
        { ...enemy, sheet: { ...enemy.sheet, primary: { ...enemy.sheet.primary, attack: playerPoison.sourceAttack ?? enemy.sheet.primary.attack }, secondary: { ...enemy.sheet.secondary, poisonDamage: playerPoison.sourcePoisonBonus ?? enemy.sheet.secondary.poisonDamage } } },
        player,
        playerPoison.stacks,
      );
      if (damage > 0) {
        player.hp = Math.max(0, player.hp - damage);
        damageTaken += damage;
        addDamage("enemyPoison", damage, "dot");
        emit("status_tick", "enemy", `你毒发：受到 ${damage} 伤害（${playerPoison.stacks} 层）`, { damage });
      }
    }

    // Active companion assist.
    if (activeCompanion && player.hp > 0 && enemy.hp > 0 && round % activeCompanion.every === 0) {
      const power = activeCompanion.power;
      if (activeCompanion.assist === "heal") {
        const healed = applyHeal(player, player.sheet.primary.hp * power);
        if (healed > 0) {
          emit("companion", "player", `${activeCompanion.name} 施展回春，恢复 ${Math.round(healed)} 气血`, { amount: Math.round(healed) });
        }
      } else if (activeCompanion.assist === "damage") {
        const damage = Math.max(0, Math.round(player.sheet.primary.attack * power * (1 - mitigationFor(effectiveDefense(enemy, player), input.enemy.level))));
        enemy.hp = Math.max(0, enemy.hp - damage);
        damageDealt += damage;
        addDamage(activeCompanion.id, damage, "companion");
        emit("companion", "player", `${activeCompanion.name} 出手，造成 ${damage} 伤害`, { damage });
      } else if (activeCompanion.assist === "shield") {
        player.evadeBuff = Math.max(player.evadeBuff, 0.1);
        emit("companion", "player", `${activeCompanion.name} 为你护体`);
      } else {
        addStatus(enemy, "poison", 1, 3, round, player.sheet.primary.attack, player.sheet.secondary.poisonDamage);
        emit("companion", "player", `${activeCompanion.name} 布下毒砂，毒 +1`, { statusId: "poison" });
      }
    }

    // Inner regeneration is a round-end resource.
    player.inner = Math.min(
      player.sheet.primary.innerMax,
      player.inner + player.sheet.secondary.innerRegen,
    );
    for (const key of Object.keys(player.cooldowns)) {
      if (player.cooldowns[key] > 0) player.cooldowns[key] -= 1;
    }
    // Guard expires at the end of the round.
    if (player.guard) emit("status_expire", "player", "你的架势散去", { statusId: "guard" });
    if (enemy.guard) emit("status_expire", "enemy", `${input.enemy.name} 的架势散去`, { statusId: "guard" });
    player.guard = false;
    enemy.guard = false;
    removeStatus(player, "guard");
    removeStatus(enemy, "guard");
    if (player.hp <= 0) {
      endReason = `${input.enemy.name} 击倒了${player.sheet.name}`;
      emit("defeat", "player", `你气血耗尽，败下阵来`);
    } else if (enemy.hp <= 0) {
      endReason = `${input.enemy.name} 败下阵来`;
      emit("defeat", "enemy", `${input.enemy.name} 败下阵来`);
    } else if (round >= maxRounds) {
      timeout = true;
      endReason = objective === "survive" ? `守关失败：未撑满 ${roundsTarget} 回合` : `久战不下，达到 ${maxRounds} 回合上限`;
      emit("timeout", "system", endReason);
    }
  };

  // Main loop ------------------------------------------------------------------
  while (round < maxRounds && player.hp > 0 && enemy.hp > 0) {
    beginRound();
    if (player.hp <= 0 || enemy.hp <= 0) break;

    // Enrage check before intent/action.
    if (input.enemy.enrageAt !== undefined && !enraged && enemy.hp / originalEnemyMax <= input.enemy.enrageAt) {
      enraged = true;
      enemy.sheet.primary.attack *= 1 + (input.enemy.enrageAttackPct ?? 0.25);
      emit("enrage", "enemy", `${input.enemy.name} 怒意上涌，攻击提高`);
      keyRounds.push(round);
    }

    const state: PriorityState = {
      round,
      hpPct: player.hp / player.sheet.primary.hp,
      inner: player.inner,
      innerMax: player.sheet.primary.innerMax,
      combo: player.combo,
      cooldowns: player.cooldowns,
      statuses: statusIds(player),
      enemyStatuses: statusIds(enemy),
      enemyIntent: intent!,
      enemyHpPct: enemy.hp / originalEnemyMax,
      bossPhase: phaseIndex,
      lastTag: player.lastTag,
    };
    const decision = selectPriorityAction({
      rules,
      content,
      loadout,
      state,
    });
    emit("rule", "system", `优先级：${decision.basic ? "兜底普攻" : `「${decision.skill.name}」`}（${decision.ruleId}）`, {
      ruleId: decision.ruleId,
      skillId: decision.skill.id,
    });

    // 封穴 at round start prevents guard selection as well.
    if (!hasStatus(player, "fengxue") && decision.skill.type === "jia") {
      player.guard = true;
      player.guardReduction = Math.max(player.sheet.secondary.guardReduction, decision.skill.effects?.guard ?? 0);
      addStatus(player, "guard", 1, 1, round);
      emit("guard", "player", `你摆出「${decision.skill.name}」架势，本回合招架减伤 ${Math.round(player.guardReduction * 100)}%`, {
        skillId: decision.skill.id,
      });
    }

    const playerSpeed = player.sheet.primary.speed * (player.evadeBuff > 0 ? 1.05 : 1);
    const enemySpeed = enemy.sheet.primary.speed;
    const playerFirst = playerSpeed >= enemySpeed;
    if (playerFirst) {
      playerAction(decision.skill, decision.ruleId);
      if (player.hp > 0 && enemy.hp > 0) enemyAction();
    } else {
      enemyAction();
      if (player.hp > 0 && enemy.hp > 0) playerAction(decision.skill, decision.ruleId);
    }
    endRound();
  }

  // Resolve outcome ------------------------------------------------------------
  let outcome: BattleResult["outcome"];
  if (objective === "survive") {
    if (player.hp > 0 && round >= roundsTarget) {
      outcome = "win";
      endReason = `守关成功：撑满 ${roundsTarget} 回合`;
    } else if (player.hp <= 0) {
      outcome = "loss";
    } else {
      outcome = "timeout";
      endReason = `守关失败：只撑了 ${round} 回合`;
    }
  } else if (enemy.hp <= 0 && player.hp > 0) {
    outcome = "win";
    endReason = `${input.enemy.name} 败下阵来`;
  } else if (player.hp <= 0) {
    outcome = "loss";
  } else {
    outcome = "timeout";
    endReason = timeout ? endReason : `达到 ${maxRounds} 回合上限`;
  }
  if (capture) {
    events.push({
      round,
      category: "end",
      actor: "system",
      text: outcome === "win" ? `胜：${endReason}` : outcome === "timeout" ? `限：${endReason}` : `败：${endReason}`,
    });
  }
  log.push(outcome === "win" ? `胜：${endReason}` : outcome === "timeout" ? `限：${endReason}` : `败：${endReason}`);

  return {
    outcome,
    win: outcome === "win",
    rounds: round,
    reason: endReason,
    objective,
    roundsTarget,
    playerName: player.sheet.name,
    playerElement: player.sheet.element,
    playerBuild: player.sheet.id.startsWith("build:") ? player.sheet.id.slice("build:".length) : player.sheet.id,
    enemyName: input.enemy.name,
    enemyStyle: input.enemy.style,
    playerHp: Math.max(0, Math.round(player.hp)),
    playerHpPct: clamp(player.hp / startingHp, 0, 1),
    playerInner: Math.max(0, Math.round(player.inner)),
    playerInnerMax: Math.round(player.sheet.primary.innerMax),
    enemyHp: Math.max(0, Math.round(enemy.hp)),
    enemyHpPct: clamp(enemy.hp / startingEnemyHp, 0, 1),
    damageDealt: Math.round(damageDealt),
    damageTaken: Math.round(damageTaken),
    events,
    log,
    damageBreakdown,
    keyRounds: [...new Set(keyRounds)].sort((a, b) => a - b),
    actionTrace,
    rngTrace,
    finalPhase: phaseIndex,
  };
}

// ---------------------------------------------------------------------------
// Sheet helpers shared by progression/itemization/simulation
// ---------------------------------------------------------------------------

export function makeSecondary(partial: Partial<SecondaryAttributes> = {}): SecondaryAttributes {
  return {
    hit: 0,
    evade: 0,
    crit: 0.05,
    critDamage: 0.5,
    guardReduction: 0.5,
    breakDamage: 0,
    comboDamage: 0,
    counterDamage: 0,
    statusHit: 0,
    statusResist: 0,
    damageReduction: 0,
    innerRegen: 0,
    reflect: 0,
    healBonus: 0,
    lifesteal: 0,
    poisonDamage: 0,
    damagePct: 0,
    typeDamagePct: 0,
    ...partial,
  };
}

export function makePrimary(partial: Partial<PrimaryAttributes> = {}): PrimaryAttributes {
  return {
    hp: 1000,
    innerMax: 100,
    attack: 100,
    defense: 80,
    speed: 60,
    ...partial,
  };
}

export function applyCombatMods(
  sheet: BattleSheet,
  mods: Partial<CombatMods>,
): BattleSheet {
  return {
    ...sheet,
    primary: {
      hp: sheet.primary.hp * (1 + (mods.hpPct ?? 0)) + (mods.hp ?? 0),
      innerMax: sheet.primary.innerMax * (1 + (mods.innerMaxPct ?? 0)) + (mods.innerMax ?? 0),
      attack: sheet.primary.attack * (1 + (mods.attackPct ?? 0)) + (mods.attack ?? 0),
      defense: sheet.primary.defense * (1 + (mods.defensePct ?? 0)) + (mods.defense ?? 0),
      speed: sheet.primary.speed * (1 + (mods.speedPct ?? 0)) + (mods.speed ?? 0),
    },
    secondary: {
      hit: sheet.secondary.hit + (mods.hit ?? 0),
      evade: sheet.secondary.evade + (mods.evade ?? 0),
      crit: clamp(sheet.secondary.crit + (mods.crit ?? 0), 0, 0.85),
      critDamage: sheet.secondary.critDamage + (mods.critDamage ?? 0),
      guardReduction: clamp(sheet.secondary.guardReduction + (mods.guardReduction ?? 0), 0, 0.9),
      breakDamage: sheet.secondary.breakDamage + (mods.breakDamage ?? 0),
      comboDamage: sheet.secondary.comboDamage + (mods.comboDamage ?? 0),
      counterDamage: sheet.secondary.counterDamage + (mods.counterDamage ?? 0),
      statusHit: sheet.secondary.statusHit + (mods.statusHit ?? 0),
      statusResist: sheet.secondary.statusResist + (mods.statusResist ?? 0),
      damageReduction: clamp(sheet.secondary.damageReduction + (mods.damageReduction ?? 0), 0, 0.9),
      innerRegen: sheet.secondary.innerRegen + (mods.innerRegen ?? 0),
      reflect: sheet.secondary.reflect + (mods.reflect ?? 0),
      healBonus: sheet.secondary.healBonus + (mods.healBonus ?? 0),
      lifesteal: sheet.secondary.lifesteal + (mods.lifesteal ?? 0),
      poisonDamage: sheet.secondary.poisonDamage + (mods.poisonDamage ?? 0),
      damagePct: sheet.secondary.damagePct + (mods.damagePct ?? 0),
      typeDamagePct: sheet.secondary.typeDamagePct + (mods.typeDamagePct ?? 0),
    },
  };
}
