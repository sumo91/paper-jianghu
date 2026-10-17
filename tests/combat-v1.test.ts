import assert from "node:assert/strict";
import test from "node:test";
import type {
  BattleEnemyDef,
  BattleInput,
  BattleSheet,
  BattleSkill,
  CombatContent,
  Loadout,
  PriorityRule,
} from "../src/core/combat-v1.ts";
import {
  basicAttack,
  makeSecondary,
  resolveBattle,
  selectPriorityAction,
  skillUsable,
  validateLoadout,
} from "../src/core/combat-v1.ts";
import {
  COMBAT_CONTENT,
  STARTER_KITS,
  createBattleSheet,
  enemyBattleDef,
  starterLoadoutFor,
} from "../src/data/combat-v1.ts";
import type { BuildId } from "../src/core/types.ts";

function rules(...entries: PriorityRule[]): PriorityRule[] {
  return entries;
}

function always(skillId: string, id = `always_${skillId}`): PriorityRule {
  return { id, conditions: [{ kind: "always" }], action: { kind: "skill", skillId } };
}

function basicRule(id = "basic"): PriorityRule {
  return { id, conditions: [{ kind: "always" }], action: { kind: "basic" } };
}

function testEnemy(overrides: Partial<Parameters<typeof enemyBattleDef>[0]> = {}): BattleEnemyDef {
  return enemyBattleDef({
    id: "test_enemy",
    name: "试招傀儡",
    style: "gang",
    element: "gang",
    level: 5,
    hp: 800,
    attack: 60,
    defense: 20,
    speed: 40,
    pattern: [{ id: "e_shi", name: "劈掌", type: "shi", element: "gang", coefficient: 1 }],
    ...overrides,
  });
}

function battleInput(
  buildId: BuildId,
  options: {
    enemy?: BattleEnemyDef;
    rules?: PriorityRule[];
    loadout?: Loadout;
    sheet?: BattleSheet;
    content?: CombatContent;
    maxRounds?: number;
    seed?: number;
    objective?: "clear" | "survive";
    surviveRounds?: number;
    modifiers?: BattleInput["modifiers"];
  } = {},
): BattleInput {
  const loadout = options.loadout ?? starterLoadoutFor(buildId);
  return {
    player: {
      sheet: options.sheet ?? createBattleSheet(buildId, { level: 8 }),
      loadout,
      content: options.content ?? COMBAT_CONTENT,
      priorityRules: options.rules,
    },
    enemy: options.enemy ?? testEnemy(),
    objective: options.objective ?? "clear",
    maxRounds: options.maxRounds ?? 30,
    seed: options.seed ?? 1,
    modifiers: options.modifiers,
    surviveRounds: options.surviveRounds,
  };
}

function actionOrder(input: BattleInput): string[] {
  return input.player.priorityRules?.map((rule) => rule.id) ?? [];
}

test("loadout validation accepts exactly 6 active slots + 4 hearts and rejects missing/extra/duplicate slots", () => {
  const valid = starterLoadoutFor("taiji");
  assert.equal(validateLoadout(valid, COMBAT_CONTENT).ok, true, validateLoadout(valid, COMBAT_CONTENT).errors.join("; "));

  const missing = structuredClone(valid) as unknown as Loadout;
  (missing.moves as unknown as string[]).pop();
  assert.equal(validateLoadout(missing, COMBAT_CONTENT).ok, false);

  const extra = structuredClone(valid) as unknown as Loadout;
  (extra.moves as unknown as string[]).push("taiji_lanque");
  assert.equal(validateLoadout(extra, COMBAT_CONTENT).ok, false);

  const duplicate = structuredClone(valid);
  duplicate.moves[1] = duplicate.moves[0];
  assert.equal(validateLoadout(duplicate, COMBAT_CONTENT).ok, false);

  const missingGear = structuredClone(valid) as unknown as Loadout;
  delete (missingGear.gear as unknown as Record<string, unknown>).jade;
  assert.equal(validateLoadout(missingGear, COMBAT_CONTENT).ok, false);

  const duplicateHeartTarget = structuredClone(valid);
  duplicateHeartTarget.heartTargets = [duplicateHeartTarget.moves[0], duplicateHeartTarget.moves[0], null, null];
  assert.equal(validateLoadout(duplicateHeartTarget, COMBAT_CONTENT).ok, false);
});

test("priority engine: first match wins, unusable rules are skipped, no match falls back to basic", () => {
  const loadout = starterLoadoutFor("taiji");
  const state = {
    round: 1,
    hpPct: 0.8,
    inner: 100,
    innerMax: 120,
    combo: 2,
    cooldowns: {},
    statuses: [],
    enemyStatuses: [],
    enemyIntent: { id: "e", name: "劈掌", type: "shi" as const, element: "gang" as const, coefficient: 1 },
    enemyHpPct: 0.7,
    bossPhase: 0,
  };
  const first = selectPriorityAction({
    rules: rules(
      { id: "first", conditions: [{ kind: "enemyIntentType", type: "shi" }], action: { kind: "skill", skillId: "taiji_yunshou" } },
      { id: "second", conditions: [{ kind: "always" }], action: { kind: "skill", skillId: "taiji_baihe" } },
    ),
    content: COMBAT_CONTENT,
    loadout,
    state,
  });
  assert.equal(first.ruleId, "first");
  assert.equal(first.skill.id, "taiji_yunshou");

  const unusable = selectPriorityAction({
    rules: rules(
      { id: "expensive", conditions: [{ kind: "always" }], action: { kind: "skill", skillId: "taiji_siliang" } },
      basicRule(),
    ),
    content: COMBAT_CONTENT,
    loadout,
    state: { ...state, inner: 0, combo: 0 },
  });
  assert.equal(unusable.basic, true);
  assert.equal(unusable.skill.id, "basic");
  assert.equal(unusable.skipped[0]?.reason, "内力不足");

  const noMatch = selectPriorityAction({
    rules: rules({ id: "low", conditions: [{ kind: "hpBelow", pct: 0.1 }], action: { kind: "skill", skillId: "taiji_baihe" } }),
    content: COMBAT_CONTENT,
    loadout,
    state,
  });
  assert.equal(noMatch.basic, true);
  assert.equal(noMatch.ruleId, "fallback");
});

test("priority selection gates inner cost, cooldown, ultimate condition, and light cooldown", () => {
  const ultimate = COMBAT_CONTENT.skills.taiji_siliang;
  const light = COMBAT_CONTENT.skills.light_taiji_tiyun;
  assert.equal(skillUsable(ultimate, { inner: 20, innerMax: 100, cooldowns: {}, combo: 2 }).ok, false);
  assert.equal(skillUsable(ultimate, { inner: 50, innerMax: 100, cooldowns: {}, combo: 3 }).ok, true);
  assert.equal(skillUsable(ultimate, { inner: 60, innerMax: 100, cooldowns: {}, combo: 0 }).ok, true);
  assert.equal(skillUsable(ultimate, { inner: 100, innerMax: 100, cooldowns: { taiji_siliang: 2 }, combo: 5 }).ok, false);
  assert.equal(skillUsable(light, { inner: 12, innerMax: 100, cooldowns: { light_taiji_tiyun: 1 }, combo: 0 }).ok, false);
  assert.equal(skillUsable(light, { inner: 11, innerMax: 100, cooldowns: {}, combo: 0 }).ok, false);
});

test("speed order is real: a faster enemy acts first, but a 架 chosen at round start still guards and counters", () => {
  const enemy = testEnemy({ speed: 300 });
  const input = battleInput("taiji", {
    enemy,
    rules: rules({ id: "guard", conditions: [{ kind: "enemyIntentType", type: "shi" }], action: { kind: "skill", skillId: "taiji_yunshou" } }, basicRule()),
    maxRounds: 1,
    seed: 9,
  });
  const result = resolveBattle(input);
  assert.equal(result.outcome, "timeout");
  const events = result.events;
  const firstAction = events.find((event) => event.category === "action");
  assert.equal(firstAction?.actor, "enemy");
  const guard = events.findIndex((event) => event.category === "guard" && event.actor === "player");
  const hit = events.findIndex((event) => event.category === "hit" && event.actor === "enemy");
  assert.ok(guard >= 0);
  assert.ok(guard < hit, "guard must be active before the faster enemy hit");
  assert.ok(events.some((event) => event.category === "counter" && event.actor === "player"));
  assert.ok(result.damageBreakdown.counter > 0);
});

test("control that lands before the target's action cancels it", () => {
  const enemy = testEnemy({
    speed: 300,
    pattern: [{ id: "e_stun", name: "封穴", type: "xu", element: "yin", coefficient: 0.4, effect: "stun", statusChance: 1 }],
  });
  const input = battleInput("taiji", {
    enemy,
    rules: rules(always("taiji_baihe"), basicRule()),
    maxRounds: 3,
    seed: 5,
  });
  const result = resolveBattle(input);
  assert.ok(result.events.some((event) => event.category === "status_apply" && event.statusId === "fengxue"));
  assert.ok(result.events.some((event) => event.category === "interrupt" && event.actor === "player"));
});

test("type wheel: 实 interrupts 气, 虚 breaks 架, 架 counters 实", () => {
  const interrupt = resolveBattle(battleInput("taiji", {
    enemy: testEnemy({
      speed: 10,
      pattern: [{ id: "e_charge", name: "蓄势", type: "qi", element: "gang", coefficient: 0, effect: "charge" }],
    }),
    rules: rules(always("taiji_baihe"), basicRule()),
    maxRounds: 2,
    seed: 3,
  }));
  assert.ok(interrupt.events.some((event) => event.category === "interrupt" && event.actor === "player"));

  const breakGuard = resolveBattle(battleInput("xuanyin", {
    enemy: testEnemy({
      speed: 10,
      pattern: [{ id: "e_guard", name: "铁壁", type: "jia", element: "gang", coefficient: 0.2, effect: "guard" }],
    }),
    rules: rules(always("xuanyin_fengxue"), basicRule()),
    maxRounds: 1,
    seed: 3,
  }));
  assert.ok(breakGuard.events.some((event) => event.category === "guard_break"));

  const counter = resolveBattle(battleInput("taiji", {
    enemy: testEnemy({ speed: 300 }),
    rules: rules(always("taiji_yunshou"), basicRule()),
    maxRounds: 1,
    seed: 3,
  }));
  assert.ok(counter.events.some((event) => event.category === "counter"));
});

test("guard counters and reflect are separate, and neither counter nor reflect can crit", () => {
  const content = structuredClone(COMBAT_CONTENT) as CombatContent;
  const guardSkill: BattleSkill = {
    id: "test_guard",
    name: "试架",
    kind: "move",
    type: "jia",
    element: "taiji",
    weaponTypes: [],
    cost: 0,
    cooldown: 0,
    coefficient: 0,
    tag: "starter",
    effects: { guard: 0.8 },
  };
  content.skills.test_guard = guardSkill;
  const loadout = starterLoadoutFor("taiji");
  loadout.moves = ["test_guard", "taiji_lanque", "taiji_baihe", "taiji_tuishou"];

  const guarded = resolveBattle(battleInput("taiji", {
    content,
    loadout,
    enemy: testEnemy({ speed: 300, hp: 5000 }),
    rules: rules(always("test_guard"), basicRule()),
    maxRounds: 1,
    seed: 11,
  }));
  assert.ok(guarded.events.some((event) => event.category === "counter"));
  assert.equal(guarded.events.filter((event) => event.category === "crit" && event.actor === "player").length, 0);
  assert.ok(guarded.damageBreakdown.counter > 0);

  const reflectSheet = createBattleSheet("taiji", { level: 8, extraMods: { reflect: 0.5, crit: 0 } });
  const reflected = resolveBattle(battleInput("taiji", {
    sheet: reflectSheet,
    enemy: testEnemy({ speed: 300, hp: 5000 }),
    rules: rules(basicRule(), always("taiji_baihe")),
    maxRounds: 1,
    seed: 11,
  }));
  assert.ok(reflected.events.some((event) => event.category === "reflect" && event.actor === "player"));
  assert.ok(reflected.damageBreakdown.reflect > 0);
  assert.equal(reflected.events.filter((event) => event.category === "counter").length, 0);
});

test("crit is an independent roll; DoT and reflect are not multiplied", () => {
  const noCrit = resolveBattle(battleInput("pojun", {
    sheet: createBattleSheet("pojun", { level: 8, extraMods: { crit: -1 } }),
    rules: rules(always("pojun_lipi"), basicRule()),
    enemy: testEnemy({ hp: 5000, speed: 10 }),
    maxRounds: 1,
    seed: 13,
  }));
  const forcedCrit = resolveBattle(battleInput("pojun", {
    sheet: createBattleSheet("pojun", { level: 8, extraMods: { crit: 1 } }),
    rules: rules(always("pojun_lipi"), basicRule()),
    enemy: testEnemy({ hp: 5000, speed: 10 }),
    maxRounds: 1,
    seed: 13,
  }));
  assert.ok(forcedCrit.events.some((event) => event.category === "crit"));
  assert.ok(forcedCrit.damageDealt > noCrit.damageDealt);
  assert.ok(forcedCrit.damageBreakdown.critBonus > 0);
  assert.equal(noCrit.damageBreakdown.critBonus, 0);

  const content = structuredClone(COMBAT_CONTENT) as CombatContent;
  content.skills.test_poison = {
    id: "test_poison",
    name: "试毒",
    kind: "move",
    type: "shi",
    element: "yin",
    weaponTypes: [],
    cost: 0,
    cooldown: 0,
    coefficient: 0,
    tag: "utility",
    effects: { poison: 2 },
  };
  const loadout = starterLoadoutFor("xuanyin");
  loadout.moves = ["test_poison", "xuanyin_fengxue", "xuanyin_shigu", "xuanyin_yinfeng"];
  const dot = resolveBattle(battleInput("xuanyin", {
    content,
    loadout,
    sheet: createBattleSheet("xuanyin", { level: 8, extraMods: { crit: 1 } }),
    enemy: testEnemy({ hp: 5000, speed: 10, attack: 1 }),
    rules: rules(always("test_poison"), basicRule()),
    maxRounds: 3,
    seed: 7,
  }));
  assert.ok(dot.damageBreakdown.dot > 0);
  assert.equal(dot.events.filter((event) => event.category === "crit" && event.actor === "player").length, 0);
});

test("statuses apply, tick, expire, and can be resisted", () => {
  const content = structuredClone(COMBAT_CONTENT) as CombatContent;
  content.skills.test_poison = {
    id: "test_poison",
    name: "试毒",
    kind: "move",
    type: "shi",
    element: "yin",
    weaponTypes: [],
    cost: 0,
    coefficient: 0,
    cooldown: 99,
    tag: "utility",
    effects: { poison: 1 },
  };
  const loadout = starterLoadoutFor("xuanyin");
  loadout.moves = ["test_poison", "xuanyin_fengxue", "xuanyin_shigu", "xuanyin_yinfeng"];
  loadout.companions.active = "comp_suwan";
  const applied = resolveBattle(battleInput("xuanyin", {
    content,
    loadout,
    enemy: testEnemy({ hp: 5000, speed: 10, attack: 1 }),
    rules: rules(always("test_poison"), basicRule()),
    maxRounds: 5,
    seed: 4,
  }));
  assert.ok(applied.events.filter((event) => event.category === "status_tick").length >= 3);
  assert.ok(applied.events.some((event) => event.category === "status_expire" && event.statusId === "poison"));

  const resistance = resolveBattle(battleInput("taiji", {
    sheet: createBattleSheet("taiji", { level: 8, extraMods: { statusResist: 1 } }),
    enemy: testEnemy({
      hp: 5000,
      speed: 300,
      pattern: [{ id: "e_stun", name: "封穴", type: "xu", element: "yin", coefficient: 0.4, effect: "stun", statusChance: 1 }],
    }),
    rules: rules(always("taiji_baihe"), basicRule()),
    maxRounds: 2,
    seed: 4,
  }));
  assert.ok(resistance.events.some((event) => event.text.includes("抵抗了封穴")));
  assert.equal(resistance.events.filter((event) => event.category === "interrupt" && event.actor === "player").length, 0);
});

test("combo starter -> chase -> finisher builds stacks and ultimate resets them", () => {
  const content = structuredClone(COMBAT_CONTENT) as CombatContent;
  content.skills.test_starter = { id: "test_starter", name: "起", kind: "move", type: "shi", element: "gang", weaponTypes: [], cost: 0, cooldown: 0, coefficient: 0.2, tag: "starter" };
  content.skills.test_chase = { id: "test_chase", name: "追", kind: "move", type: "shi", element: "gang", weaponTypes: [], cost: 0, cooldown: 0, coefficient: 0.2, tag: "chase" };
  content.skills.test_finisher = { id: "test_finisher", name: "终", kind: "move", type: "shi", element: "gang", weaponTypes: [], cost: 0, cooldown: 0, coefficient: 0.2, tag: "finisher" };
  content.skills.test_ult = { id: "test_ult", name: "绝", kind: "ultimate", type: "shi", element: "gang", weaponTypes: [], cost: 0, cooldown: 0, coefficient: 0.2, tag: "finisher", ultimateCondition: "combo3_or_inner50" };
  const loadout = starterLoadoutFor("pojun");
  loadout.moves = ["test_starter", "test_chase", "test_finisher", "pojun_xuezhan"];
  loadout.ultimateId = "test_ult";

  const result = resolveBattle(battleInput("pojun", {
    content,
    loadout,
    sheet: createBattleSheet("pojun", { level: 12, extraMods: { speed: 3 } }),
    enemy: testEnemy({ hp: 100000, attack: 1, speed: 10 }),
    rules: rules(
      { id: "ult", conditions: [{ kind: "comboAtLeast", stacks: 3 }], action: { kind: "skill", skillId: "test_ult" } },
      { id: "chase", conditions: [{ kind: "lastTag", tag: "starter" }], action: { kind: "skill", skillId: "test_chase" } },
      { id: "finisher", conditions: [{ kind: "lastTag", tag: "chase" }], action: { kind: "skill", skillId: "test_finisher" } },
      always("test_starter"),
      basicRule(),
    ),
    maxRounds: 6,
    seed: 2,
  }));
  const combos = result.events.filter((event) => event.category === "combo" && event.actor === "player").map((event) => event.amount ?? -1);
  assert.ok(combos.includes(1));
  assert.ok(combos.includes(2));
  assert.ok(combos.includes(3));
  const ultIndex = result.actionTrace.findIndex((entry) => entry.skillId === "test_ult");
  assert.ok(ultIndex >= 0, "ultimate should fire once combo >= 3");
  const afterUlt = result.events.slice(result.events.findIndex((event) => event.category === "combo" && event.actor === "player" && event.amount === 3));
  assert.ok(afterUlt.some((event) => event.category === "combo" && event.amount === 0));
});

test("damage rises with attack/coefficient and falls with defense/damage reduction; never negative", () => {
  const baseSheet = createBattleSheet("pojun", { level: 8, extraMods: { crit: -1, hit: 1 } });
  const rule = rules(always("pojun_lipi"), basicRule());
  const run = (sheet: BattleSheet, enemy: BattleEnemyDef) => resolveBattle(battleInput("pojun", {
    sheet,
    enemy,
    rules: rule,
    maxRounds: 1,
    seed: 17,
  })).damageDealt;
  const normal = run(baseSheet, testEnemy({ hp: 100000 }));
  const stronger = run(createBattleSheet("pojun", { level: 8, extraMods: { crit: -1, hit: 1, attackPct: 1 } }), testEnemy({ hp: 100000 }));
  assert.ok(stronger > normal);
  const armored = run(baseSheet, testEnemy({ hp: 100000, defense: 500 }));
  assert.ok(armored < normal);
  const reduced = run(baseSheet, testEnemy({ hp: 100000, pattern: [{ id: "e", name: "劈", type: "shi", element: "gang", coefficient: 1 }] }),);
  assert.ok(reduced >= 0);
  const zero = run(createBattleSheet("pojun", { level: 8, extraMods: { crit: -1, hit: 1, attackPct: -0.99 } }), testEnemy({ hp: 100000, defense: 9999 }));
  assert.ok(zero >= 0);
});

test("same seed/input is identical; different seed changes crit outcomes but not deterministic rule selection", () => {
  const input = battleInput("pojun", {
    sheet: createBattleSheet("pojun", { level: 10, extraMods: { crit: 0.5 } }),
    enemy: testEnemy({ hp: 1000000, attack: 0 }),
    rules: rules(always("pojun_lipi"), always("pojun_hengsao", "sweep"), basicRule()),
    maxRounds: 12,
    seed: 21,
  });
  const a = resolveBattle(input);
  const b = resolveBattle(structuredClone(input));
  assert.deepEqual(a.events, b.events);
  assert.deepEqual(a.actionTrace, b.actionTrace);
  assert.deepEqual(a.damageBreakdown, b.damageBreakdown);

  const c = resolveBattle({ ...structuredClone(input), seed: 22 });
  assert.deepEqual(a.actionTrace, c.actionTrace, "priority selection must not depend on RNG");
  assert.notDeepEqual(a.rngTrace, c.rngTrace);
});

test("round cap produces a timeout loss with a clear reason", () => {
  const input = battleInput("taiji", {
    sheet: createBattleSheet("taiji", { level: 1, extraMods: { attackPct: -0.99 } }),
    enemy: testEnemy({ hp: 100000, attack: 1, defense: 10000 }),
    rules: rules(always("taiji_baihe"), basicRule()),
    maxRounds: 3,
    seed: 1,
  });
  const result = resolveBattle(input);
  assert.equal(result.outcome, "timeout");
  assert.equal(result.win, false);
  assert.match(result.reason, /回合上限/);
  assert.equal(result.rounds, 3);
});

test("starter kits each win at least one representative encounter and no single kit wins the whole matrix", () => {
  const encounters: BattleEnemyDef[] = [
    // A high-HP, low-defense dummy rewards burst (破军).
    testEnemy({ id: "dummy", name: "木人桩", level: 16, hp: 10000, attack: 25, defense: 40, speed: 40, pattern: [{ id: "e_light", name: "轻击", type: "shi", element: "gang", coefficient: 0.7 }] }),
    // A fast heavy hitter punishes glass cannons; guard/counter (太极) answers it.
    testEnemy({ id: "glass", name: "快刀客", level: 16, hp: 2500, attack: 260, defense: 40, speed: 120, pattern: [{ id: "e_heavy", name: "劈", type: "shi", element: "gang", coefficient: 1.5, effect: "heavy" }] }),
    // A fast control enemy rewards cleanse/speed/status play (玄阴).
    testEnemy({ id: "control", name: "封穴手", level: 16, hp: 5000, attack: 100, defense: 100, speed: 260, pattern: [{ id: "e_stun", name: "封穴", type: "xu", element: "yin", coefficient: 0.4, effect: "stun", statusChance: 1 }, { id: "e_claw", name: "阴爪", type: "shi", element: "yin", coefficient: 1 }] }),
  ];
  const wins = new Map<BuildId, boolean[]>();
  for (const buildId of ["taiji", "pojun", "xuanyin"] as BuildId[]) {
    wins.set(buildId, encounters.map((enemy) => {
      const result = resolveBattle(battleInput(buildId, {
        enemy,
        sheet: createBattleSheet(buildId, { level: 12 }),
        maxRounds: 30,
        seed: 31,
      }));
      return result.win;
    }));
  }
  for (const [buildId, results] of wins) {
    assert.ok(results.some(Boolean), `${buildId} should win at least one representative encounter`);
  }
  const all = [...wins.values()];
  const perfect = all.filter((results) => results.every(Boolean));
  assert.ok(perfect.length < all.length, "no single starter kit should win every encounter");
});

test("objective survive wins only after the target rounds", () => {
  const input = battleInput("taiji", {
    enemy: testEnemy({ hp: 100000, attack: 1, speed: 10 }),
    rules: rules(always("taiji_yunshou"), basicRule()),
    objective: "survive",
    surviveRounds: 5,
    maxRounds: 30,
    seed: 1,
  });
  const result = resolveBattle(input);
  assert.equal(result.outcome, "win");
  assert.equal(result.rounds, 5);
  assert.match(result.reason, /守关成功/);
});

test("armor break and guard expire on schedule", () => {
  const content = structuredClone(COMBAT_CONTENT) as CombatContent;
  content.skills.test_break = {
    id: "test_break",
    name: "试破甲",
    kind: "move",
    type: "shi",
    element: "yin",
    weaponTypes: [],
    cost: 0,
    cooldown: 99,
    coefficient: 0.5,
    tag: "utility",
    effects: { armorBreak: 1 },
  };
  const loadout = starterLoadoutFor("xuanyin");
  loadout.moves = ["test_break", "xuanyin_fengxue", "xuanyin_shigu", "xuanyin_yinfeng"];
  loadout.companions.active = "comp_suwan";
  const result = resolveBattle(battleInput("xuanyin", {
    content,
    loadout,
    enemy: testEnemy({ hp: 100000, speed: 10, attack: 1, defense: 100 }),
    rules: rules(always("test_break"), basicRule()),
    maxRounds: 5,
    seed: 6,
  }));
  assert.ok(result.events.some((event) => event.category === "status_apply" && event.statusId === "armorBreak"));
  assert.ok(result.events.some((event) => event.category === "status_expire" && event.statusId === "armorBreak"));

  content.skills.test_guard = {
    id: "test_guard",
    name: "试架",
    kind: "move",
    type: "jia",
    element: "taiji",
    weaponTypes: [],
    cost: 0,
    cooldown: 0,
    coefficient: 0,
    tag: "starter",
    effects: { guard: 0.6 },
  };
  const guardLoadout = starterLoadoutFor("taiji");
  guardLoadout.moves = ["test_guard", "taiji_lanque", "taiji_baihe", "taiji_tuishou"];
  const guarded = resolveBattle(battleInput("taiji", {
    content,
    loadout: guardLoadout,
    enemy: testEnemy({ hp: 100000, speed: 300, attack: 1 }),
    rules: rules(always("test_guard"), basicRule()),
    maxRounds: 3,
    seed: 8,
  }));
  assert.ok(guarded.events.filter((event) => event.category === "guard" && event.actor === "player").length >= 3);
  assert.ok(guarded.events.filter((event) => event.category === "status_expire" && event.statusId === "guard" && event.actor === "player").length >= 3);
});
