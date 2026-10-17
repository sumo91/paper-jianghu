import assert from "node:assert/strict";
import test from "node:test";
import { JianghuSession } from "../src/core/session.ts";
import { SAVE_SCHEMA_VERSION } from "../src/data/content-version.ts";

function withState(session: JianghuSession, mutate: (state: Record<string, any>) => void): JianghuSession {
  const envelope = JSON.parse(session.save());
  mutate(envelope.state);
  return JianghuSession.load(JSON.stringify(envelope), envelope.state.nowMs);
}

test("new game starts at level 1 with the chosen starter kit and a readable snapshot", () => {
  const session = JianghuSession.newGame("taiji", 1, 0);
  const snapshot = session.snapshot();
  assert.equal(snapshot.level, 1);
  assert.equal(snapshot.realm, 0);
  assert.equal(snapshot.buildId, "taiji");
  assert.equal(snapshot.mapId, "luoyang");
  assert.equal(snapshot.active, true);
  assert.equal(snapshot.fights, 0);
  assert.ok(snapshot.loadout.moves.length === 4);
  assert.equal(snapshot.loadout.lightSkillId, "light_taiji_tiyun");
  assert.ok(snapshot.gearScore > 0);
});

test("advancing 10 minutes produces fights, resources and progression", () => {
  const session = JianghuSession.newGame("taiji", 1, 0);
  const result = session.advanceTo(10 * 60 * 1000, { offline: false });
  assert.ok(result.snapshot.fights > 0);
  assert.ok(result.snapshot.wins > 0);
  assert.ok(result.snapshot.silver > 0);
  assert.ok(result.snapshot.xp > 0 || result.snapshot.level > 1);
  assert.ok(result.snapshot.level > 1);
  assert.ok(result.snapshot.gearScore >= 100);
  assert.ok(result.newLogLines.length > 0);
  assert.equal(result.offlineReport, undefined);
});

test("8h offline at 50% settles once; 12h does not exceed the cap; same timestamp is idempotent", () => {
  const eight = JianghuSession.newGame("taiji", 1, 0);
  const first = eight.advanceTo(8 * 3600 * 1000);
  assert.ok(first.offlineReport);
  assert.equal(first.offlineReport?.effectiveHours, 4);
  assert.ok((first.offlineReport?.fights ?? 0) > 0);
  const fightsAfter = first.snapshot.fights;
  const again = eight.advanceTo(8 * 3600 * 1000);
  assert.equal(again.snapshot.fights, fightsAfter);
  assert.equal(again.offlineReport, undefined);

  const twelve = JianghuSession.newGame("taiji", 1, 0);
  const capped = twelve.advanceTo(12 * 3600 * 1000);
  assert.equal(capped.offlineReport?.effectiveHours, 4);
  assert.equal(capped.offlineReport?.cappedHours, 8);
  assert.ok((capped.offlineReport?.fights ?? 0) > 0);
});

test("travel clears the active activity and updates the map; stop/resume do not duplicate progress", () => {
  let session = JianghuSession.newGame("taiji", 1, 0);
  session.dispatch({ type: "setActivity", mapId: "luoyang", layer: 1, mode: "survive" });
  assert.equal(session.snapshot().activity?.kind, "survival");
  assert.equal(session.snapshot().active, true);

  session.dispatch({ type: "travel", mapId: "caoyun" });
  assert.equal(session.snapshot().mapId, "caoyun");
  assert.equal(session.snapshot().active, false);
  assert.equal(session.snapshot().activity, null);

  session.dispatch({ type: "setActivity", mapId: "caoyun", layer: 1, mode: "clear" });
  const beforeStop = session.advanceTo(5 * 60 * 1000, { offline: false }).snapshot.fights;
  session.dispatch({ type: "stop" });
  const afterStop = session.advanceTo(10 * 60 * 1000, { offline: false }).snapshot;
  assert.equal(afterStop.fights, beforeStop);
  assert.equal(afterStop.active, false);
  session.dispatch({ type: "resume" });
  const afterResume = session.advanceTo(15 * 60 * 1000, { offline: false }).snapshot;
  assert.ok(afterResume.fights > beforeStop);
});

test("realm cap blocks leveling until a trial; failure grants insight, success advances realm", () => {
  let session = JianghuSession.newGame("taiji", 1, 0);
  const state = JSON.parse(session.save()).state;
  const xp = 100;
  state.level = 9;
  state.xp = xp;
  state.world = state.world;
  session = JianghuSession.load(JSON.stringify({ ...JSON.parse(session.save()), state }), 0);
  const result = session.advanceTo(2 * 3600 * 1000, { offline: false });
  const snapshot = result.snapshot;
  assert.ok(snapshot.level >= 9);
  if (snapshot.level === 9) {
    assert.ok(snapshot.recentLog.some((line) => line.includes("突破失败")));
  } else {
    assert.ok(snapshot.level >= 10);
    assert.ok(snapshot.realm >= 1);
  }
});

test("high-tier first clear grants a deterministic divine item exactly once", () => {
  let session = JianghuSession.newGame("taiji", 1, 0);
  const envelope = JSON.parse(session.save());
  const state = envelope.state;
  state.level = 55;
  state.xp = 0;
  state.mapId = "digong";
  state.layer = 10;
  state.divine = 0;
  state.world.maps.digong = { ...state.world.maps.digong, highestClearedLayer: 9, bossCleared: false };
  state.world.maps.mudao = { ...state.world.maps.mudao, bossCleared: true, highestClearedLayer: 10 };
  session = JianghuSession.load(JSON.stringify(envelope), 0);
  const result = session.advanceTo(3 * 3600 * 1000, { offline: false });
  assert.ok(result.snapshot.divineItems >= 1);
  const count = result.snapshot.divineItems;
  const again = session.advanceTo(3 * 3600 * 1000 + 1, { offline: false });
  assert.ok(again.snapshot.divineItems >= count);
  assert.ok(again.snapshot.divineItems <= 2);
});

test("auto-equip changes the sheet and gear score over time", () => {
  const session = JianghuSession.newGame("pojun", 1, 0);
  const before = session.snapshot().gearScore;
  const result = session.advanceTo(6 * 3600 * 1000, { offline: false });
  assert.ok(result.snapshot.gearScore >= before);
  assert.ok(result.snapshot.gearScore > 0);
  assert.ok(result.snapshot.recentLoot.length > 0 || result.snapshot.gearScore > before);
});

test("save/load round-trip restores the session, RNG-derived state, last-seen time and activity", () => {
  let session = JianghuSession.newGame("xuanyin", 5, 1000);
  session.dispatch({ type: "setActivity", mapId: "luoyang", layer: 2, mode: "clear" });
  session = withState(session, (state) => { state.lastSettledMs = 1000; });
  const result = session.advanceTo(2 * 3600 * 1000, { offline: false });
  const saved = session.save();
  const loaded = JianghuSession.load(saved, 2 * 3600 * 1000);
  assert.deepEqual(loaded.snapshot(), result.snapshot);
  assert.deepEqual(loaded.snapshot().loadout, result.snapshot.loadout);
  assert.equal(loaded.snapshot().fights, result.snapshot.fights);
  assert.equal(loaded.snapshot().mapId, result.snapshot.mapId);
});

test("malformed or old saves fail safely instead of silently overwriting", () => {
  assert.throws(() => JianghuSession.load("{not json", 0), /JSON/);
  assert.throws(() => JianghuSession.load(JSON.stringify({ version: 0, state: {} }), 0), /版本/);
  const envelope = JSON.parse(JianghuSession.newGame("taiji", 1, 0).save());
  envelope.schemaVersion = SAVE_SCHEMA_VERSION - 1;
  assert.throws(() => JianghuSession.load(JSON.stringify(envelope), 0), /schema/);
});

test("same seed and clock sequence produce an identical session", () => {
  const a = JianghuSession.newGame("pojun", 9, 0);
  const b = JianghuSession.newGame("pojun", 9, 0);
  let now = 0;
  for (let i = 0; i < 5; i += 1) {
    now += 30 * 60 * 1000;
    a.advanceTo(now, { offline: false });
    b.advanceTo(now, { offline: false });
  }
  assert.deepEqual(a.snapshot(), b.snapshot());
});

test("100h headless session acceptance: all starter kits reach 宗师, level spread <=5%, time spread <=12h, 15 maps", () => {
  const results = (["taiji", "pojun", "xuanyin"] as const).map((buildId) => {
    const session = JianghuSession.newGame(buildId, 1, 0);
    let now = 0;
    let realm5At: number | null = null;
    let last = session.snapshot();
    for (let hour = 1; hour <= 100; hour += 1) {
      now += 3600 * 1000;
      const result = session.advanceTo(now, { offline: false });
      last = result.snapshot;
      if (realm5At === null && last.realm >= 5) realm5At = hour;
    }
    return { buildId, last, realm5At };
  });
  for (const result of results) {
    assert.ok(result.last.realm >= 5, `${result.buildId} realm ${result.last.realm}`);
    assert.ok(result.realm5At !== null, `${result.buildId} missing 宗师 time`);
    assert.equal(result.last.mapsCleared, 15, `${result.buildId} maps ${result.last.mapsCleared}/15`);
  }
  const levels = results.map((result) => result.last.level);
  const spread = (Math.max(...levels) - Math.min(...levels)) / Math.max(...levels);
  assert.ok(spread <= 0.05, `level spread ${spread}`);
  const times = results.map((result) => result.realm5At as number);
  assert.ok(Math.max(...times) - Math.min(...times) <= 12, `realm time spread ${Math.max(...times) - Math.min(...times)}h`);
});
