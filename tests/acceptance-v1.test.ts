import assert from "node:assert/strict";
import test from "node:test";
import { simulateV1 } from "../src/core/sim-v1.ts";

test("Combat v1 100h acceptance: all starter kits reach 宗师, level/time spread is bounded, and resolveBattle drives every fight", () => {
  const results = (["taiji", "pojun", "xuanyin"] as const).map((buildId) =>
    simulateV1({ buildId, seed: 1, hours: 100 }),
  );
  for (const result of results) {
    assert.ok(result.final.realm >= 5, `${result.buildId} only reached realm ${result.final.realm}`);
    assert.ok(result.realmTimes["5"] !== null, `${result.buildId} has no 宗师 time`);
    assert.ok(result.mapsCleared.length === 15, `${result.buildId} cleared ${result.mapsCleared.length}/15 maps`);
    assert.equal(result.mapsVisited.length, 15, `${result.buildId} visited ${result.mapsVisited.length}/15 maps`);
    assert.ok(result.targetDrops.length > 0, `${result.buildId} saw no target drops`);
    assert.ok(result.firstClears >= 15, `${result.buildId} got ${result.firstClears} first clears`);
    assert.ok(result.gearScore > 100, `${result.buildId} gear score ${result.gearScore}`);
    assert.ok(result.divineItems >= 1 && result.divineItems <= 3, `${result.buildId} divine count ${result.divineItems}`);
    assert.ok(result.totalFights > 0);
    assert.ok(Number.isFinite(result.final.winRate));
  }
  const levels = results.map((result) => result.final.level);
  const levelSpread = (Math.max(...levels) - Math.min(...levels)) / Math.max(...levels);
  assert.ok(levelSpread <= 0.1, `level spread ${levelSpread}`);
  const times = results.map((result) => result.realmTimes["5"] as number);
  assert.ok(Math.max(...times) - Math.min(...times) <= 24, `宗师 time spread ${Math.max(...times) - Math.min(...times)}h`);
  assert.ok(results.every((result) => result.final.winRate < 1), "no preset may win every fight in the acceptance run");
});
