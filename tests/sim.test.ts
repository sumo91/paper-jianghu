import assert from "node:assert/strict";
import test from "node:test";
import { simulate } from "../src/core/sim.ts";

test("a short simulation is deterministic and returns snapshots", () => {
  const a = simulate({ buildId: "xuanyin", seed: 5, hours: 2, snapshotHours: [1, 2] });
  const b = simulate({ buildId: "xuanyin", seed: 5, hours: 2, snapshotHours: [1, 2] });
  assert.equal(a.totalFights, b.totalFights);
  assert.equal(a.final.level, b.final.level);
  assert.equal(a.final.gearScore, b.final.gearScore);
  assert.ok(a.snapshots.length >= 1);
  assert.ok(a.final.level >= 1);
  assert.ok(Number.isFinite(a.final.gearScore));
});

test("all builds progress through at least one realm in 3 hours", () => {
  for (const buildId of ["taiji", "pojun", "xuanyin"]) {
    const result = simulate({ buildId, seed: 9, hours: 3, snapshotHours: [3] });
    assert.ok(result.final.level >= 9, `${buildId} level ${result.final.level}`);
    assert.ok(result.totalFights > 0);
  }
});

test("taiji uses the 守关 activity; non-tank builds stay on clear", () => {
  const taiji = simulate({ buildId: "taiji", seed: 4, hours: 3, snapshotHours: [3], aggressive: true });
  assert.ok(taiji.survivalFights > 0);
  assert.ok(taiji.survivalWins > 0);
  assert.equal(taiji.policy, "aggressive");
  const pojun = simulate({ buildId: "pojun", seed: 4, hours: 2, snapshotHours: [2], aggressive: true });
  assert.equal(pojun.survivalFights, 0);
  assert.equal(pojun.survivalWins, 0);
});

test("pojun is not hard-locked at level 9 under the v0.3 aggressive policy", () => {
  const result = simulate({ buildId: "pojun", seed: 1, hours: 24, snapshotHours: [24], aggressive: true });
  assert.ok(result.final.level > 9, `pojun stuck at level ${result.final.level}`);
  assert.ok(result.final.realm >= 1);
  assert.ok(result.totalFights > 0);
});
