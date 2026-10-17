import assert from "node:assert/strict";
import test from "node:test";
import { initialCharacter, computeSheet } from "../src/core/stats.ts";
import { simulateFight } from "../src/core/combat.ts";
import { getEnemy } from "../src/data/enemies.ts";
import { MAPS } from "../src/data/maps.ts";
import { Rng } from "../src/core/rng.ts";

test("a common fight produces a finite, bounded result", () => {
  const character = initialCharacter("taiji");
  const sheet = computeSheet(character);
  const enemy = getEnemy(MAPS[0].enemyIds[0]);
  const result = simulateFight(sheet, enemy, { enemyLevel: 3, rng: new Rng(42) });
  assert.ok(result.rounds >= 1 && result.rounds <= 40);
  assert.ok(Number.isFinite(result.damageDealt));
  assert.ok(Number.isFinite(result.damageTaken));
  assert.ok(result.playerHpPct >= 0 && result.playerHpPct <= 1);
  assert.ok(result.enemyHpPct >= 0 && result.enemyHpPct <= 1);
  assert.ok(result.log.length > 0);
});

test("combat is deterministic with the same seed", () => {
  const sheet = computeSheet(initialCharacter("pojun"));
  const enemy = getEnemy(MAPS[0].bossId);
  const a = simulateFight(sheet, enemy, { enemyLevel: 9, rng: new Rng(7) });
  const b = simulateFight(sheet, enemy, { enemyLevel: 9, rng: new Rng(7) });
  assert.equal(a.win, b.win);
  assert.equal(a.rounds, b.rounds);
  assert.equal(a.damageDealt, b.damageDealt);
});

test("all three builds can complete the starter map's first layer", () => {
  for (const buildId of ["taiji", "pojun", "xuanyin"]) {
    const enemy = getEnemy(MAPS[0].enemyIds[0]);
    const result = simulateFight(computeSheet(initialCharacter(buildId)), enemy, {
      enemyLevel: 2,
      rng: new Rng(3),
    });
    assert.equal(result.playerBuild, buildId);
    assert.ok(result.rounds <= 40);
  }
});

test("survival objective runs the full target rounds and reports its objective", () => {
  const sheet = computeSheet(initialCharacter("taiji"));
  const enemy = getEnemy(MAPS[0].eliteId);
  const result = simulateFight(sheet, enemy, {
    enemyLevel: 9,
    rng: new Rng(13),
    objective: "survive",
    surviveRounds: 20,
  });
  assert.equal(result.objective, "survive");
  assert.equal(result.rounds, 20);
  assert.ok(result.playerHpPct >= 0 && result.playerHpPct <= 1);
});
