import assert from "node:assert/strict";
import test from "node:test";
import {
  computeSheet,
  initialCharacter,
  levelToLayer,
  levelToRealm,
  xpToNext,
} from "../src/core/stats.ts";
import { generateItem } from "../src/core/loot.ts";
import { MAPS } from "../src/data/maps.ts";
import { Rng } from "../src/core/rng.ts";

test("realm/layer mapping covers 7 realms x 9 layers", () => {
  assert.equal(levelToRealm(1), 0);
  assert.equal(levelToLayer(1), 1);
  assert.equal(levelToRealm(9), 0);
  assert.equal(levelToLayer(9), 9);
  assert.equal(levelToRealm(10), 1);
  assert.equal(levelToLayer(10), 1);
  assert.equal(levelToRealm(63), 6);
  assert.equal(levelToLayer(63), 9);
});

test("xp curve is positive and monotonic", () => {
  let previous = 0;
  for (let level = 1; level <= 62; level += 1) {
    const next = xpToNext(level);
    assert.ok(Number.isFinite(next));
    assert.ok(next > 0);
    assert.ok(next > previous);
    previous = next;
  }
});

test("initial sheets have positive combat stats", () => {
  for (const buildId of ["taiji", "pojun", "xuanyin"]) {
    const sheet = computeSheet(initialCharacter(buildId));
    assert.ok(sheet.stats.hp > 0);
    assert.ok(sheet.stats.attack > 0);
    assert.ok(sheet.stats.defense > 0);
    assert.ok(sheet.stats.speed > 0);
    assert.ok(sheet.moves.length === 4);
    assert.ok(sheet.ultimate.isUltimate);
  }
});

test("loot generation is deterministic and typed", () => {
  const map = MAPS[0];
  const a = generateItem(map, 3, "boss", "taiji", new Rng(11), "superb");
  const b = generateItem(map, 3, "boss", "taiji", new Rng(11), "superb");
  assert.equal(a.slot, b.slot);
  assert.equal(a.rarity, b.rarity);
  assert.equal(a.tier, b.tier);
  assert.ok(Object.keys(a.stats).length > 0);
});

test("divine gear is gated behind an explicit allow flag", () => {
  const map = MAPS[MAPS.length - 1];
  const denied = generateItem(map, 10, "boss", "pojun", new Rng(21), "divine", false);
  assert.equal(denied.rarity, "peerless");
  const allowed = generateItem(map, 10, "boss", "pojun", new Rng(21), "divine", true);
  assert.equal(allowed.rarity, "divine");
});
