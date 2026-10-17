import assert from "node:assert/strict";
import test from "node:test";
import { simulate } from "../src/core/sim.ts";

test("v0.6 balance acceptance: all builds reach 宗师, spread <=5%, gap <=12h, divine source works", () => {
  const results = ["taiji", "pojun", "xuanyin"].map((buildId) =>
    simulate({ buildId, seed: 1, hours: 100, aggressive: true, snapshotHours: [100] }),
  );
  for (const result of results) {
    assert.ok(result.final.realm >= 5, `${result.buildId} realm ${result.final.realm}`);
    assert.ok(result.realmTimes["5"] !== null, `${result.buildId} missing 宗师 time`);
    assert.ok(Object.values(result.gear).some((slot) => slot.includes("神")), `${result.buildId} has no divine gear`);
  }
  const levels = results.map((r) => r.final.level);
  const spread = (Math.max(...levels) - Math.min(...levels)) / Math.max(...levels);
  assert.ok(spread <= 0.05, `level spread ${spread}`);
  const times = results.map((r) => r.realmTimes["5"] as number);
  assert.ok(Math.max(...times) - Math.min(...times) <= 12, `realm time spread ${Math.max(...times) - Math.min(...times)}`);
});
