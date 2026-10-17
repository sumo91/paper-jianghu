import type {
  BuildId,
  CombatStats,
  EnemyDef,
  EnemyMoveDef,
  EnemyStyle,
  FightResult,
  MoveDef,
  MoveType,
  PriorityView,
  SheetBuild,
  StatMods,
} from "./types.ts";
import { clamp } from "./stats.ts";
import { Rng } from "./rng.ts";

const COUNTERS: Record<MoveType, MoveType | null> = {
  shi: "xu",
  xu: "jia",
  jia: "shi",
  qi: null,
};

const MOVE_LABELS: Record<MoveType, string> = {
  shi: "实",
  xu: "虚",
  jia: "架",
  qi: "气",
};

const BASIC_MOVES: Record<BuildId, MoveDef> = {
  taiji: {
    id: "basic_taiji",
    name: "太极剑·基本式",
    type: "shi",
    element: "taiji",
    cost: 0,
    cooldown: 0,
    tag: "starter",
    coefficient: 0.55,
    effects: { innerGain: 5 },
  },
  pojun: {
    id: "basic_pojun",
    name: "破军刀·基本式",
    type: "shi",
    element: "gang",
    cost: 0,
    cooldown: 0,
    tag: "starter",
    coefficient: 0.55,
    effects: { innerGain: 5 },
  },
  xuanyin: {
    id: "basic_xuanyin",
    name: "玄阴指·基本式",
    type: "shi",
    element: "yin",
    cost: 0,
    cooldown: 0,
    tag: "starter",
    coefficient: 0.55,
    effects: { innerGain: 5 },
  },
};

function basicMove(buildId: BuildId): MoveDef {
  return BASIC_MOVES[buildId];
}

function beats(attacker: MoveType, defender: MoveType): boolean {
  return COUNTERS[attacker] === defender;
}

function defenseMitigation(defense: number, level: number, bonusK = 0): number {
  const k = 120 + 7 * level + bonusK;
  return defense / (defense + k);
}

function innerElementBonus(build: BuildId, move: MoveDef, playerMods: StatMods): number {
  const buildElement = build === "taiji" ? "taiji" : build === "pojun" ? "gang" : "yin";
  if (buildElement === "taiji") {
    const base = move.element === "taiji" ? 0.2 : 0.1;
    return base + playerMods.typeDamagePct;
  }
  if (move.element === buildElement) return 0.2 + playerMods.typeDamagePct;
  return 0;
}

interface EnemyCombatant {
  def: EnemyDef;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  level: number;
  patternIndex: number;
  nextMove: EnemyMoveDef;
  poison: number;
  armorBreak: number;
  stunned: number;
  guard: boolean;
  charged: boolean;
  enraged: boolean;
  style: EnemyStyle;
  element: string;
}

function makeEnemy(def: EnemyDef, level: number): EnemyCombatant {
  const hp = 500 * (1 + 0.20 * (level - 1)) * def.hpMult;
  const attack = 70 * (1 + 0.15 * (level - 1)) * def.atkMult;
  const defense = (24 + 4 * (level - 1)) * def.defMult;
  const speed = (40 + 1.4 * (level - 1)) * def.speedMult;
  return {
    def,
    hp,
    maxHp: hp,
    attack,
    defense,
    speed,
    level,
    patternIndex: 0,
    nextMove: def.moves[0],
    poison: 0,
    armorBreak: 0,
    stunned: 0,
    guard: false,
    charged: false,
    enraged: false,
    style: def.style,
    element: def.element,
  };
}

interface PlayerCombatant {
  sheet: SheetBuild;
  hp: number;
  maxHp: number;
  inner: number;
  innerMax: number;
  cooldowns: Record<string, number>;
  borrow: number;
  combo: number;
  lastTag?: MoveDef["tag"];
  attackBuff: number;
  attackBuffRounds: number;
  shieldPct: number;
  parryThisRound: number;
  poison: number;
  innerOnHitBonus: number;
  innerOnParryBonus: number;
}

function makePlayer(sheet: SheetBuild): PlayerCombatant {
  const cooldowns: Record<string, number> = {};
  for (const move of sheet.moves) cooldowns[move.id] = 0;
  cooldowns[sheet.ultimate.id] = 0;
  return {
    sheet,
    hp: sheet.stats.hp,
    maxHp: sheet.stats.hp,
    inner: sheet.stats.innerMax * 0.55,
    innerMax: sheet.stats.innerMax,
    cooldowns,
    borrow: 0,
    combo: 0,
    attackBuff: 0,
    attackBuffRounds: 0,
    shieldPct: 0,
    parryThisRound: 0,
    poison: 0,
    innerOnHitBonus: 0,
    innerOnParryBonus: 0,
  };
}

function priorityView(player: PlayerCombatant, enemy: EnemyCombatant, round = 0): PriorityView {
  return {
    round,
    hpPct: player.hp / player.maxHp,
    inner: player.inner,
    innerMax: player.innerMax,
    cooldowns: player.cooldowns,
    borrow: player.borrow,
    combo: player.combo,
    armorBreak: enemy.armorBreak,
    poison: enemy.poison,
    enemyHpPct: enemy.hp / enemy.maxHp,
    enemyStunned: enemy.stunned > 0,
    attackBuff: player.attackBuff,
    poisonBuff: 0,
    enemyIntent: enemy.nextMove,
    lastTag: player.lastTag,
  };
}

function usable(player: PlayerCombatant, move: MoveDef): boolean {
  return (player.cooldowns[move.id] ?? 0) <= 0 && player.inner >= move.cost;
}

function pickMove(player: PlayerCombatant, enemy: EnemyCombatant, round: number): MoveDef | null {
  const sheet = player.sheet;
  const all = [...sheet.moves, sheet.ultimate];
  const view = priorityView(player, enemy, round);
  const chosen = sheet.build.priority(view, all);
  if (chosen && usable(player, chosen)) return chosen;
  const available = all.filter((move) => usable(player, move));
  if (available.length === 0) return basicMove(player.sheet.build.id);
  return [...available].sort((a, b) => a.cost - b.cost)[0];
}

function cooldownStart(player: PlayerCombatant, move: MoveDef): void {
  player.cooldowns[move.id] = move.cooldown + 1;
}

function applyMoveEffects(
  player: PlayerCombatant,
  enemy: EnemyCombatant,
  move: MoveDef,
  rng: Rng,
  log: string[],
): void {
  const effects = move.effects;
  if (!effects) return;
  const mods = player.sheet.mods;

  if (effects.borrowGain) {
    player.borrow = clamp(player.borrow + effects.borrowGain, 0, 8);
    log.push(`借力 +${effects.borrowGain}（${player.borrow} 层）`);
  }
  if (effects.borrowConsume) {
    const toConsume = Math.min(player.borrow, effects.borrowConsume);
    player.borrow -= toConsume;
  }
  if (effects.shieldPct) {
    player.shieldPct = Math.max(player.shieldPct, effects.shieldPct);
  }
  if (effects.healPct) {
    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * effects.healPct);
  }
  if (effects.innerGain) {
    player.inner = Math.min(player.innerMax, player.inner + effects.innerGain);
  }
  if (effects.parry) {
    player.parryThisRound = Math.max(player.parryThisRound, effects.parry + mods.parryPct);
  }
  if (effects.armorBreak) {
    enemy.armorBreak = clamp(enemy.armorBreak + effects.armorBreak, 0, 3);
    log.push(`破甲 ${enemy.armorBreak} 层`);
  }
  if (effects.poison) {
    enemy.poison = clamp(enemy.poison + effects.poison, 0, 5);
    log.push(`毒 ${enemy.poison} 层`);
  }
  if (effects.attackBuffPct) {
    player.attackBuff = effects.attackBuffPct;
    player.attackBuffRounds = 3;
  }
  if (effects.stunChance) {
    const chance = clamp(effects.stunChance + mods.controlPct, 0, 0.95);
    if (rng.chance(chance)) {
      enemy.stunned = Math.max(enemy.stunned, 1);
      log.push(`封穴成功：${enemy.def.name} 下一回合无法行动`);
    }
  }
}

function playerDamage(
  player: PlayerCombatant,
  enemy: EnemyCombatant,
  move: MoveDef,
  counter: boolean,
  rng: Rng,
  log: string[],
): number {
  const mods = player.sheet.mods;
  const match = innerElementBonus(player.sheet.build.id, move, mods);
  let coefficient = move.coefficient;

  // Special scaling hooks for the three signature ults/consumers.
  if (move.id === "taiji_siliang") coefficient += 0.45 * player.borrow;
  if (move.id === "taiji_lanque") coefficient += 0.25 * player.borrow;
  if (move.id === "xuanyin_wangu") coefficient += 0.5 * enemy.poison;
  if (move.id === "pojun_wanjun") coefficient += 0.12 * player.combo;

  const lowHpAttack = mods.lowHpAttackPct > 0 && player.hp / player.maxHp < 0.5
    ? mods.lowHpAttackPct
    : 0;
  let raw = player.sheet.stats.attack
    * coefficient
    * (1 + mods.damagePct + match + player.attackBuff + lowHpAttack);

  if (counter) raw *= 1.2;
  if (move.effects?.executeBonusPct && enemy.hp / enemy.maxHp < 0.35) {
    raw *= 1 + move.effects.executeBonusPct;
  }

  const comboBonus = 1 + player.combo * (0.04 + mods.comboPct);
  raw *= comboBonus;

  const armorBonus = 1 + enemy.armorBreak * (0.1 + mods.armorBreakPct);
  raw *= armorBonus;

  if (enemy.guard) {
    if (move.type === "xu") {
      enemy.guard = false;
      raw *= 1.1;
      log.push(`虚招破架：${enemy.def.name} 的架势被打散`);
    } else {
      raw *= 0.75;
      enemy.guard = false;
    }
  }

  const hits = 1 + (move.effects?.extraHits ?? 0);
  let total = 0;
  for (let hit = 0; hit < hits; hit += 1) {
    let damage = raw;
    if (rng.chance(player.sheet.stats.crit)) {
      damage *= 1.5;
    }
    const mitigation = defenseMitigation(enemy.defense, enemy.level);
    damage *= 1 - mitigation;
    total += damage;
  }
  if (enemy.def.damageCapPct && enemy.def.damageCapPct > 0 && enemy.def.damageCapPct < 1) {
    const cap = enemy.maxHp * enemy.def.damageCapPct;
    if (total > cap) {
      total = cap;
      log.push(`${enemy.def.name} 护体：单回合伤害被封顶`);
    }
  }

  // Combo bookkeeping: starter -> chase/finisher, chase -> finisher.
  if (player.lastTag === "starter" && (move.tag === "chase" || move.tag === "finisher")) {
    player.combo = clamp(player.combo + 1, 0, 5);
  } else if (player.lastTag === "chase" && move.tag === "finisher") {
    player.combo = clamp(player.combo + 1, 0, 5);
  } else if (move.tag === "starter") {
    player.combo = Math.max(0, player.combo - 1);
  }

  if (move.isUltimate) {
    player.combo = 0;
  }

  return total;
}

function enemyDamage(
  player: PlayerCombatant,
  enemy: EnemyCombatant,
  move: EnemyMoveDef,
  rng: Rng,
  log: string[],
): number {
  const mods = player.sheet.mods;
  let coefficient = move.coef;
  if (move.effect === "heavy") coefficient *= 1.25;
  if (enemy.charged) {
    coefficient *= 1.5;
    enemy.charged = false;
    log.push(`${enemy.def.name} 蓄势爆发！`);
  }

  let raw = enemy.attack * coefficient;
  // Scale K with enemy level so defense stays useful without becoming invincible.
  const playerK = 120 + 7 * enemy.level;
  const realMitigation = player.sheet.stats.defense / (player.sheet.stats.defense + playerK);

  raw *= 1 - realMitigation;
  raw *= 1 - mods.damageReductionPct;
  if (mods.lowHpDamageReductionPct > 0 && player.hp / player.maxHp < 0.4) {
    raw *= 1 - mods.lowHpDamageReductionPct;
  }
  if (mods.poisonDamageReductionPct > 0 && enemy.poison > 0) {
    raw *= 1 - Math.min(0.3, mods.poisonDamageReductionPct * enemy.poison);
  }
  raw *= 1 - player.shieldPct;

  let parry = 0;
  if (move.type === "shi" && player.parryThisRound > 0) {
    parry = clamp(player.parryThisRound, 0, 0.85);
    raw *= 1 - parry;
    player.borrow = clamp(player.borrow + 1, 0, 8);
    player.innerOnParryBonus += mods.innerOnParry;
    if (mods.reflectPct > 0) {
      const reflected = raw * mods.reflectPct;
      enemy.hp = Math.max(0, enemy.hp - reflected);
      log.push(`借力反打：反弹 ${Math.round(reflected)} 伤害`);
    }
  }

  if (move.effect === "charge") {
    enemy.charged = true;
    log.push(`${enemy.def.name} 正在蓄力`);
    return 0;
  }
  if (move.effect === "guard") {
    log.push(`${enemy.def.name} 摆出架势`);
  }
  if (move.effect === "poison") {
    player.poison = clamp(player.poison + 1, 0, 5);
    log.push(`你中了毒（${player.poison} 层）`);
  }
  if (move.effect === "stun" && rng.chance(0.2)) {
    // Player stun is intentionally light in v0.1: it costs inner, not a turn.
    player.inner = Math.max(0, player.inner - 8);
    log.push(`你被封穴，内力 -8`);
  }

  return raw;
}

function companionAssist(
  player: PlayerCombatant,
  enemy: EnemyCombatant,
  round: number,
  log: string[],
): void {
  const companion = player.sheet.companion;
  if (!companion || round % companion.every !== 0) return;
  const bondScale = 1 + 0.1 * (player.sheet.companionBond - 1);
  const power = companion.power * bondScale;
  if (companion.assist === "heal") {
    const heal = player.maxHp * power;
    player.hp = Math.min(player.maxHp, player.hp + heal);
    log.push(`${companion.name} 施展回春，恢复 ${Math.round(heal)} 气血`);
  } else if (companion.assist === "damage") {
    const damage = player.sheet.stats.attack * power;
    enemy.hp = Math.max(0, enemy.hp - damage);
    log.push(`${companion.name} 出手，造成 ${Math.round(damage)} 伤害`);
  } else if (companion.assist === "shield") {
    player.shieldPct = Math.max(player.shieldPct, 0.15 * bondScale);
    log.push(`${companion.name} 为你护体`);
  } else {
    enemy.poison = clamp(enemy.poison + 1, 0, 5);
    log.push(`${companion.name} 布下毒砂，毒 +1`);
  }
}

function expireCooldowns(player: PlayerCombatant): void {
  for (const key of Object.keys(player.cooldowns)) {
    player.cooldowns[key] = Math.max(0, player.cooldowns[key] - 1);
  }
}

export interface FightOptions {
  /** Enemy level used for stat scaling. */
  enemyLevel: number;
  rng: Rng;
  maxRounds?: number;
  objective?: "clear" | "survive";
  surviveRounds?: number;
}

export function simulateFight(
  sheet: SheetBuild,
  enemyDef: EnemyDef,
  options: FightOptions,
): FightResult {
  const objective = options.objective ?? "clear";
  const surviveRounds = options.surviveRounds ?? 20;
  const maxRounds = objective === "survive" ? surviveRounds : (options.maxRounds ?? 40);
  const rng = options.rng;
  const player = makePlayer(sheet);
  const enemy = makeEnemy(enemyDef, options.enemyLevel);
  if (objective === "survive") {
    // 守关试炼：对手是“打不完”的守关者，目标是撑满回合。
    enemy.maxHp = 1_000_000_000_000;
    enemy.hp = enemy.maxHp;
  }
  const log: string[] = [];

  let damageDealt = 0;
  let damageTaken = 0;
  let rounds = 0;

  while (rounds < maxRounds && player.hp > 0 && (objective === "survive" || enemy.hp > 0)) {
    rounds += 1;
    player.parryThisRound = 0;
    player.shieldPct = Math.max(0, player.shieldPct - 0.04);
    // Enemy guard is telegraphed by its next move and protects against this round's attack.
    enemy.guard = enemy.nextMove.effect === "guard";
    if (player.attackBuffRounds > 0) {
      player.attackBuffRounds -= 1;
      if (player.attackBuffRounds === 0) player.attackBuff = 0;
    }

    const move = pickMove(player, enemy, rounds);
    if (!move) {
      player.inner = Math.min(player.innerMax, player.inner + player.sheet.stats.innerRegen);
      log.push(`第 ${rounds} 回合：内力不足，调息`);
      expireCooldowns(player);
      continue;
    }

    player.inner -= move.cost;
    cooldownStart(player, move);

    const intent = enemy.nextMove;
    const counter = beats(move.type, intent.type);
    const interruptQi = move.type === "shi" && intent.type === "qi";
    if (counter) log.push(`第 ${rounds} 回合：${move.name} 克制 ${intent.name}`);
    if (interruptQi) log.push(`第 ${rounds} 回合：${move.name} 打断 ${intent.name}`);

    const dealt = playerDamage(player, enemy, move, counter, rng, log);
    enemy.hp = Math.max(0, enemy.hp - dealt);
    damageDealt += dealt;
    player.inner = Math.min(player.innerMax, player.inner + player.sheet.mods.innerOnHit);
    if (player.sheet.mods.healOnHitPct > 0) {
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * player.sheet.mods.healOnHitPct);
    }
    log.push(`你以「${move.name}」（${MOVE_LABELS[move.type]}）造成 ${Math.round(dealt)} 伤害`);

    applyMoveEffects(player, enemy, move, rng, log);

    if (enemy.def.reflectPct && dealt > 0) {
      // Cap reflect so an anti-burst trait cannot one-shot a glass cannon.
      const reflected = Math.min(dealt * enemy.def.reflectPct, player.maxHp * 0.02);
      player.hp = Math.max(0, player.hp - reflected);
      damageTaken += reflected;
      log.push(`${enemy.def.name} 反震，受到 ${Math.round(reflected)} 伤害`);
      if (player.hp <= 0) {
        log.push("你被反震击倒");
        break;
      }
    }

    if (enemy.hp <= 0 && objective === "clear") {
      log.push(`${enemy.def.name} 败下阵来`);
      break;
    }
    if (enemy.hp <= 0 && objective === "survive") {
      // The guardian is effectively endless; refill if a burst build somehow
      // manages to carve through the huge HP pool.
      enemy.hp = enemy.maxHp;
    }

    // Boss enrage at half HP.
    if (enemy.def.boss && !enemy.enraged && enemy.hp / enemy.maxHp <= 0.5) {
      enemy.enraged = true;
      enemy.attack *= 1.25;
      log.push(`${enemy.def.name} 怒意上涌，攻击提高`);
    }

    if (enemy.stunned > 0) {
      enemy.stunned -= 1;
      log.push(`${enemy.def.name} 被封穴，无法行动`);
    } else if (interruptQi) {
      log.push(`${enemy.def.name} 的气招被打断`);
    } else {
      const taken = enemyDamage(player, enemy, intent, rng, log);
      player.hp = Math.max(0, player.hp - taken);
      damageTaken += taken;
      if (intent.coef > 0) log.push(`${enemy.def.name} 的「${intent.name}」造成 ${Math.round(taken)} 伤害`);
    }

    // Enemy poison tick.
    if (enemy.poison > 0) {
      const poisonDamage = player.sheet.stats.attack * 0.075 * enemy.poison * (1 + player.sheet.mods.poisonPct);
      enemy.hp = Math.max(0, enemy.hp - poisonDamage);
      damageDealt += poisonDamage;
      if (player.sheet.mods.poisonHealPct > 0) {
        const heal = poisonDamage * player.sheet.mods.poisonHealPct;
        player.hp = Math.min(player.maxHp, player.hp + heal);
      }
      log.push(`毒发：${Math.round(poisonDamage)} 伤害（${enemy.poison} 层）`);
    }

    // Player poison tick.
    if (player.poison > 0) {
      const poisonTaken = player.maxHp * 0.02 * player.poison;
      player.hp = Math.max(0, player.hp - poisonTaken);
      damageTaken += poisonTaken;
      log.push(`你毒发：${Math.round(poisonTaken)} 伤害`);
    }

    if (player.hp > 0) companionAssist(player, enemy, rounds, log);

    // Regen and cooldown tick.
    player.inner = Math.min(
      player.innerMax,
      player.inner + player.sheet.stats.innerRegen + player.innerOnHitBonus + player.innerOnParryBonus,
    );
    player.innerOnHitBonus = 0;
    player.innerOnParryBonus = 0;
    expireCooldowns(player);
    player.lastTag = move.tag;

    // Advance enemy pattern.
    enemy.patternIndex = (enemy.patternIndex + 1) % enemy.def.moves.length;
    enemy.nextMove = enemy.def.moves[enemy.patternIndex];

    if (enemy.hp <= 0 || player.hp <= 0) break;
  }

  const win = objective === "survive"
    ? player.hp > 0 && rounds >= surviveRounds
    : enemy.hp <= 0 && player.hp > 0;
  if (objective === "survive" && win) {
    log.push(`守关成功：撑满 ${rounds} 回合`);
  } else if (!win && player.hp > 0 && rounds >= maxRounds) {
    log.push("久战不下，只得退走");
  }
  if (player.hp <= 0) log.push("你气血耗尽，败下阵来");

  // Keep the log bounded; the report only needs the shape and key events.
  const compactLog = log.slice(-40);
  return {
    win,
    rounds,
    playerHpPct: Math.max(0, player.hp / player.maxHp),
    enemyHpPct: objective === "survive" ? 1 : Math.max(0, enemy.hp / enemy.maxHp),
    damageDealt: Math.round(damageDealt),
    damageTaken: Math.round(damageTaken),
    log: compactLog,
    enemyName: enemy.def.name,
    enemyStyle: enemy.def.style,
    playerBuild: sheet.build.id,
    objective,
  };
}
