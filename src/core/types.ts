export type BuildId = "taiji" | "pojun" | "xuanyin";

export type Element = "yin" | "yang" | "gang" | "rou" | "taiji";

export type MoveType = "shi" | "xu" | "jia" | "qi";

export type ComboTag = "starter" | "chase" | "finisher" | "utility";

export type EnemyStyle = "gang" | "rou" | "kuai" | "gui";

export type Rarity = "common" | "fine" | "superb" | "peerless" | "divine";

export type GearSlot = "weapon" | "head" | "body" | "wrist" | "feet" | "jade";

export type RegionId = "zhongyuan" | "wudang" | "xihu" | "yangzhou" | "hanyue";

export const GEAR_SLOTS: GearSlot[] = ["weapon", "head", "body", "wrist", "feet", "jade"];

export const REALM_NAMES = [
  "初入江湖",
  "三流",
  "二流",
  "一流",
  "绝顶",
  "宗师",
  "传说",
] as const;

export interface CombatStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  crit: number;
  innerMax: number;
  innerRegen: number;
}

/**
 * Additive modifiers. Values are fractions unless the name says otherwise.
 * Keep this list short; everything else is a move effect or a combat special.
 */
export interface StatMods {
  hpPct: number;
  attackPct: number;
  defensePct: number;
  speedPct: number;
  crit: number;
  innerMaxPct: number;
  innerRegen: number;
  damagePct: number;
  typeDamagePct: number;
  parryPct: number;
  reflectPct: number;
  armorBreakPct: number;
  poisonPct: number;
  poisonDamageReductionPct: number;
  poisonHealPct: number;
  controlPct: number;
  comboPct: number;
  damageReductionPct: number;
  innerOnHit: number;
  innerOnParry: number;
  healOnHitPct: number;
  lowHpDamageReductionPct: number;
  lowHpAttackPct: number;
}

export function emptyMods(): StatMods {
  return {
    hpPct: 0,
    attackPct: 0,
    defensePct: 0,
    speedPct: 0,
    crit: 0,
    innerMaxPct: 0,
    innerRegen: 0,
    damagePct: 0,
    typeDamagePct: 0,
    parryPct: 0,
    reflectPct: 0,
    armorBreakPct: 0,
    poisonPct: 0,
    poisonDamageReductionPct: 0,
    poisonHealPct: 0,
    controlPct: 0,
    comboPct: 0,
    damageReductionPct: 0,
    innerOnHit: 0,
    innerOnParry: 0,
    healOnHitPct: 0,
    lowHpDamageReductionPct: 0,
    lowHpAttackPct: 0,
  };
}

export function addMods(target: StatMods, source: Partial<StatMods>): StatMods {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number" && key in target) {
      target[key as keyof StatMods] += value;
    }
  }
  return target;
}

export interface MoveEffects {
  /** Gain N stacks of 借力. */
  borrowGain?: number;
  /** Consume N stacks; 99 means all. */
  borrowConsume?: number;
  /** Damage reduction against 实招 this round (0..1). */
  parry?: number;
  /** Shield as fraction of max HP. */
  shieldPct?: number;
  /** Apply armor break stacks. */
  armorBreak?: number;
  /** Apply poison stacks. */
  poison?: number;
  /** Chance to stun (0..1), modified by controlPct. */
  stunChance?: number;
  /** Attack buff fraction for N rounds. */
  attackBuffPct?: number;
  /** Heal as fraction of max HP. */
  healPct?: number;
  /** Number of extra hits. */
  extraHits?: number;
  /** Gain inner energy. */
  innerGain?: number;
  /** Bonus damage against low-HP target. */
  executeBonusPct?: number;
  /** If the enemy is charging, interrupt it. */
  interrupt?: boolean;
}

export interface MoveDef {
  id: string;
  name: string;
  type: MoveType;
  element: Element;
  cost: number;
  cooldown: number;
  tag: ComboTag;
  coefficient: number;
  effects?: MoveEffects;
  isUltimate?: boolean;
}

export interface HeartMethodDef {
  id: string;
  name: string;
  description: string;
  mods: Partial<StatMods>;
}

export interface KeystoneDef {
  id: string;
  name: string;
  description: string;
  mods: Partial<StatMods>;
}

export interface CompanionDef {
  id: string;
  name: string;
  role: string;
  every: number;
  assist: "heal" | "damage" | "shield" | "poison";
  /** Fraction of the relevant stat: heal/shield = max HP; damage = attack; poison = 1 stack. */
  power: number;
  mods: Partial<StatMods>;
}

export interface PriorityView {
  round: number;
  hpPct: number;
  inner: number;
  innerMax: number;
  cooldowns: Record<string, number>;
  borrow: number;
  combo: number;
  armorBreak: number;
  poison: number;
  enemyHpPct: number;
  enemyStunned: boolean;
  attackBuff: number;
  poisonBuff: number;
  enemyIntent: EnemyMoveDef;
  lastTag?: ComboTag;
}

export type PriorityFn = (view: PriorityView, moves: MoveDef[]) => MoveDef | null;

export interface BuildDef {
  id: BuildId;
  name: string;
  shortName: string;
  element: Element;
  base: CombatStats;
  growth: {
    hpPct: number;
    attackPct: number;
    defensePct: number;
    speedPct: number;
  };
  passives: Partial<StatMods>;
  moves: MoveDef[];
  ultimate: MoveDef;
  heartMethods: HeartMethodDef[];
  keystones: KeystoneDef[];
  companionId: string;
  setId: string;
  priority: PriorityFn;
}

export type EnemyMoveEffect = "none" | "heavy" | "charge" | "poison" | "stun" | "guard";

export type FightObjective = "clear" | "survive";

export interface EnemyMoveDef {
  name: string;
  type: MoveType;
  element: Element;
  coef: number;
  effect: EnemyMoveEffect;
}

export interface EnemyDef {
  id: string;
  name: string;
  region: RegionId;
  style: EnemyStyle;
  element: Element;
  hpMult: number;
  atkMult: number;
  defMult: number;
  speedMult: number;
  moves: EnemyMoveDef[];
  boss?: boolean;
  /** Optional per-round damage cap as a fraction of max HP; used for anti-burst bosses. */
  damageCapPct?: number;
  /** Fraction of damage dealt reflected back to the player; anti-burst trait. */
  reflectPct?: number;
}

export interface MapDef {
  id: string;
  name: string;
  region: RegionId;
  tier: number;
  unlockRealm: number;
  enemyIds: string[];
  eliteId: string;
  bossId: string;
}

export interface GearItem {
  id: string;
  name: string;
  slot: GearSlot;
  rarity: Rarity;
  tier: number;
  stats: Partial<StatMods>;
  setId?: string;
  legendary?: boolean;
}

export interface SetDef {
  id: string;
  name: string;
  buildId: BuildId;
  two: Partial<StatMods>;
  four: Partial<StatMods>;
}

export interface CharacterState {
  buildId: BuildId;
  level: number;
  realm: number;
  layer: number;
  xp: number;
  silver: number;
  renown: number;
  gear: Record<GearSlot, GearItem | null>;
  refineLevel: number;
  companionBond: number;
  innerArtLevel: number;
  artMastery: number;
}

export interface GearScore {
  total: number;
  bySlot: Record<GearSlot, number>;
}

export interface SheetBuild {
  build: BuildDef;
  stats: CombatStats;
  mods: StatMods;
  moves: MoveDef[];
  ultimate: MoveDef;
  companion: CompanionDef;
  companionBond: number;
  setPieces: number;
  gearScore: number;
}

export interface FightResult {
  win: boolean;
  rounds: number;
  playerHpPct: number;
  enemyHpPct: number;
  damageDealt: number;
  damageTaken: number;
  log: string[];
  enemyName: string;
  enemyStyle: EnemyStyle;
  playerBuild: BuildId;
  objective: FightObjective;
}

export interface FightRewards {
  xp: number;
  silver: number;
  renown: number;
  item?: GearItem;
  firstClear: boolean;
}

export interface MapProgress {
  highestClearedLayer: number;
  bossCleared: boolean;
  wins: number;
  losses: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

export interface NameCount {
  name: string;
  count: number;
}

export interface SimSnapshot {
  hours: number;
  level: number;
  realm: number;
  layer: number;
  gearScore: number;
  gearRarity: string;
  refineLevel: number;
  silver: number;
  renown: number;
  winRate: number;
  roundsAvg: number;
  mapId: string;
  mapLayer: number;
  highestMapTier: number;
  highestLayer: number;
  innerArtLevel: number;
  artMastery: number;
  companionBond: number;
  xp: number;
  totalFights: number;
  deaths: number;
}

export interface SimOptions {
  buildId: string;
  seed: number;
  hours: number;
  snapshotHours?: number[];
  /** Push harder / earlier; default false. */
  aggressive?: boolean;
  verbose?: boolean;
}

export interface SimResult {
  buildId: BuildId;
  buildName: string;
  seed: number;
  hours: number;
  snapshots: SimSnapshot[];
  final: SimSnapshot;
  realmTimes: Record<string, number | null>;
  bossClearTimes: Record<string, number | null>;
  totalFights: number;
  totalWins: number;
  totalLosses: number;
  totalXp: number;
  totalSilver: number;
  totalRenown: number;
  survivalFights: number;
  survivalWins: number;
  policy: "balanced" | "aggressive";
  winsByStyle: Record<string, number>;
  fightsByStyle: Record<string, number>;
  fightsAtLayer: Record<string, number>;
  lossesAtLayer: Record<string, number>;
  maxMapTier: number;
  maxMapLayer: number;
  timeStalledHours: number;
  gear: Record<GearSlot, string>;
  notes: string[];
}
