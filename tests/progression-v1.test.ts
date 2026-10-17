import assert from "node:assert/strict";
import test from "node:test";
import type { BuildId } from "../src/core/types.ts";
import type { WeaponType } from "../src/core/combat-v1.ts";
import { createBuildProgression, meridianPointsForRealmLayer } from "../src/core/progression.ts";
import { COMBAT_CONTENT } from "../src/data/combat-v1.ts";
import { BUILD_PROGRESSION_CONTENT, ART_UNLOCKS_V1, MASTERY_VARIANTS_V1, MERIDIAN_NODES_V1 } from "../src/data/progression-v1.ts";

const progression = createBuildProgression(COMBAT_CONTENT, BUILD_PROGRESSION_CONTENT);

function starter(buildId: BuildId = "taiji") {
  return progression.createInitialState(buildId);
}

const WEAPONS: Record<BuildId, WeaponType> = { taiji: "sword", pojun: "blade", xuanyin: "fist" };

test("starter kits produce valid loadouts and can start a fight", () => {
  for (const buildId of ["taiji", "pojun", "xuanyin"] as BuildId[]) {
    const state = starter(buildId);
    const validation = progression.validate(state, { weaponType: WEAPONS[buildId] });
    assert.equal(validation.ok, true, `${buildId}: ${validation.errors.join("; ")}`);
    assert.equal(validation.canStart, true);
    assert.equal(state.loadout.moves.length, 4);
    assert.equal(state.loadout.hearts.length, 4);
    assert.equal(Object.keys(state.loadout.gear).length, 6);
    assert.ok(state.presets.filter(Boolean).length === 3);
    assert.equal(state.priorityPresets.length, 3);
  }
});

test("incompatible weapon makes the loadout invalid; swapping the weapon fixes it", () => {
  const state = starter("taiji");
  const bad = progression.validate(state, { weaponType: "blade" });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((error) => error.includes("不兼容")));
  const good = progression.validate(state, { weaponType: "sword" });
  assert.equal(good.ok, true);
});

test("learning requires the right source and prerequisites; duplicate learning is idempotent", () => {
  let state = starter("taiji");
  assert.equal(state.owned.moves.includes("xuanyin_zhi"), false);
  const wrongSource = progression.learn(state, "xuanyin_zhi", { kind: "trainer", id: "t" });
  assert.equal(wrongSource.ok, false);
  assert.match(wrongSource.reason, /来源不符/);

  const gated = progression.learn(state, "comp_heiqiu", { kind: "trainer", id: "t" });
  assert.equal(gated.ok, false);
  assert.match(gated.reason, /境界不足/);

  const learned = progression.learn(state, "xuanyin_zhi", { kind: "event", id: "e" });
  assert.equal(learned.ok, true);
  assert.equal(learned.alreadyOwned, false);
  assert.ok(learned.state.owned.moves.includes("xuanyin_zhi"));
  const again = progression.learn(learned.state, "xuanyin_zhi", { kind: "event", id: "e" });
  assert.equal(again.ok, true);
  assert.equal(again.alreadyOwned, true);

  state = learned.state;
  state.realm = 2;
  state.renown = 80;
  const companion = progression.learn(state, "comp_heiqiu", { kind: "trainer", id: "t" });
  assert.equal(companion.ok, true);
});

test("page pity guarantees a missing page; combining learns the art; duplicates convert to essence", () => {
  let state = starter("taiji");
  let pages = 0;
  let guaranteedSeen = false;
  for (let i = 0; i < 9; i += 1) {
    const result = progression.addPage(state, "xuanyin_zhi", 0);
    state = result.state;
    pages += result.page ? 1 : 0;
    guaranteedSeen = guaranteedSeen || result.guaranteed;
  }
  assert.equal(guaranteedSeen, true);
  assert.equal(pages, 3);
  assert.equal(state.pages.xuanyin_zhi, 3);
  const combined = progression.combinePages(state, "xuanyin_zhi");
  assert.equal(combined.ok, true);
  assert.equal(combined.learned, true);
  assert.ok(combined.state.owned.moves.includes("xuanyin_zhi"));
  assert.equal(combined.state.pages.xuanyin_zhi, 0);

  const duplicate = progression.addPage(combined.state, "xuanyin_zhi", 1);
  assert.equal(duplicate.duplicate, true);
  assert.ok(duplicate.state.essence > 0);
});

test("mastery thresholds unlock variants and persist across preset switches", () => {
  let state = starter("pojun");
  state.cultivation = 100000;
  const artId = state.loadout.moves[0];
  assert.equal(state.mastery[artId], 1);
  for (let i = 0; i < 2; i += 1) {
    const upgraded = progression.upgradeMastery(state, artId);
    assert.equal(upgraded.ok, true);
    state = upgraded.state;
  }
  assert.equal(state.mastery[artId], 3);
  const variant = progression.masteryVariant(artId, 3);
  assert.ok(variant);
  assert.ok(Object.keys(variant.mods).length > 0);
  const mods = progression.masteryMods(state);
  assert.ok(Object.keys(mods).length > 0);

  state = progression.savePreset(state, 1).state;
  state = progression.equip(state, "move0", state.loadout.moves[1], { weaponType: "blade" }).state;
  const loaded = progression.loadPreset(state, 1, { weaponType: "blade" });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.mastery[artId], 3);
});

test("heart attachment is one-to-one; replacing a move clears its binding", () => {
  let state = starter("taiji");
  state.loadout.heartTargets = [null, null, null, null];
  const heartA = state.loadout.hearts[0];
  const heartB = state.loadout.hearts[1];
  const moveA = state.loadout.moves[0];
  const moveB = state.loadout.moves[1];

  const first = progression.attachHeart(state, heartA, moveA, 0);
  assert.equal(first.ok, true);
  state = first.state;
  const duplicateTarget = progression.attachHeart(state, heartB, moveA, 1);
  assert.equal(duplicateTarget.ok, false);
  assert.match(duplicateTarget.reason, /已绑定/);

  const second = progression.attachHeart(state, heartB, moveB, 1);
  assert.equal(second.ok, true);
  state = second.state;
  assert.equal(state.loadout.heartTargets?.[0], moveA);
  assert.equal(state.loadout.heartTargets?.[1], moveB);

  const learned = progression.learn(state, "xuanyin_zhi", { kind: "event", id: "e" });
  assert.equal(learned.ok, true);
  state = learned.state;
  const replaced = progression.equip(state, "move0", "xuanyin_zhi", { weaponType: "fist" });
  assert.equal(replaced.ok, true);
  assert.equal(replaced.state.loadout.heartTargets?.[0], null);
});

test("meridian point totals match realm/layer grants; respec refunds all points and charges the configured cost", () => {
  let state = starter("taiji");
  state = progression.syncRealm(state, 5, 9);
  assert.equal(state.meridian.earned, meridianPointsForRealmLayer(5, 9));
  assert.equal(state.meridian.points, state.meridian.earned);
  assert.ok(state.meridian.points > 0);

  let spentCost = 0;
  const nodeIds = Object.keys(MERIDIAN_NODES_V1).slice(0, 5);
  for (const id of nodeIds) {
    const result = progression.spendMeridian(state, id);
    if (result.ok) {
      spentCost += MERIDIAN_NODES_V1[id].cost;
      state = result.state;
    }
  }
  assert.equal(state.meridian.spent.length, 5);
  assert.equal(state.meridian.points, state.meridian.earned - spentCost);
  assert.ok(Object.keys(progression.meridianMods(state)).length > 0);

  const poor = progressWithRespecResources(progression, state, 0, 0);
  const failed = progression.respecMeridian(poor);
  assert.equal(failed.ok, false);
  assert.equal(failed.state.meridian.spent.length, state.meridian.spent.length);

  const rich = progressWithRespecResources(progression, state, 10000, 1);
  const respec = progression.respecMeridian(rich);
  assert.equal(respec.ok, true);
  assert.equal(respec.refunded, spentCost);
  assert.equal(respec.state.meridian.points, respec.state.meridian.earned);
  assert.equal(respec.state.meridian.spent.length, 0);
  assert.deepEqual(respec.state.meridian.branches, { gongfa: 0, guben: 0, shenfa: 0 });
  assert.equal(respec.state.silver, 10000 - BUILD_PROGRESSION_CONTENT.respecCost.silver);
  assert.equal(respec.state.respecs, 1);
});

function progressWithRespecResources(
  service: typeof progression,
  state: ReturnType<typeof starter>,
  silver: number,
  pills: number,
) {
  const copy = structuredClone(state);
  copy.silver = silver;
  copy.pills = pills;
  return copy;
}

test("invalid presets are flagged and block start; valid presets restore exactly", () => {
  let state = starter("pojun");
  state = progression.savePreset(state, 0).state;
  const original = structuredClone(state.presets[0]!.loadout);
  state = progression.equip(state, "move0", state.loadout.moves[1], { weaponType: "blade" }).state;
  const valid = progression.loadPreset(state, 0, { weaponType: "blade" });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.state.loadout, original);

  const invalid = structuredClone(state);
  invalid.presets[0]!.loadout.gear.weapon = "missing-weapon";
  const failed = progression.loadPreset(invalid, 0, { weaponType: "blade" });
  assert.equal(failed.ok, false);
  assert.ok(failed.reason.length > 0);
  assert.equal(progression.validate(failed.state, { weaponType: "blade" }).canStart, false);
});

test("cross-kit hybrid validates with a fist weapon and is rejected with a sword", () => {
  let state = starter("taiji");
  const learned = progression.learn(state, "xuanyin_zhi", { kind: "event", id: "e" });
  assert.equal(learned.ok, true);
  state = progression.equip(learned.state, "move3", "xuanyin_zhi", { weaponType: "fist" }).state;
  const hybrid = progression.validate(state, { weaponType: "fist" });
  assert.equal(hybrid.ok, true, hybrid.errors.join("; "));
  const sword = progression.validate(state, { weaponType: "sword" });
  assert.equal(sword.ok, false);
  assert.ok(sword.errors.some((error) => error.includes("不兼容")));
});

test("inner and heart upgrades reach breakpoints and persist", () => {
  let state = starter("taiji");
  state.cultivation = 10000;
  state.annotations = 100;
  const innerId = state.loadout.innerArtId;
  for (let i = 0; i < 2; i += 1) state = progression.upgradeInner(state, innerId).state;
  assert.equal(state.innerLevels[innerId], 3);
  assert.ok(progression.innerEffect(innerId, 3));

  const heartId = state.loadout.hearts[0];
  for (let i = 0; i < 2; i += 1) state = progression.upgradeHeart(state, heartId).state;
  assert.equal(state.heartLevels[heartId], 3);
  assert.ok(Object.keys(progression.heartMods(state)).length > 0);
});

test("save/load restores library, mastery, loadout, presets, meridian and pages", () => {
  let state = starter("xuanyin");
  state.cultivation = 1000;
  state.realm = 5;
  state.layer = 9;
  state = progression.syncRealm(state, 5, 9);
  state = progression.upgradeMastery(state, state.loadout.moves[0]).state;
  state = progression.spendMeridian(state, "mer_shenfa_1").state;
  state = progression.addPage(state, "xuanyin_zhi", 1).state;
  state = progression.savePreset(state, 2).state;
  const serialized = progression.save(state);
  const restored = progression.load(serialized);
  assert.deepEqual(restored, state);
});

test("codex lists all arts with sources, prerequisites and ownership", () => {
  const state = starter("taiji");
  const entries = progression.codex(state);
  assert.equal(entries.length, Object.keys(ART_UNLOCKS_V1).length);
  const xuanyin = entries.find((entry) => entry.artId === "xuanyin_zhi");
  assert.ok(xuanyin);
  assert.equal(xuanyin.owned, false);
  assert.deepEqual(xuanyin.sources, ["boss", "event", "pages"]);
  assert.ok(xuanyin.pagesRequired > 0);
  const starterMove = entries.find((entry) => entry.artId === "taiji_yunshou");
  assert.ok(starterMove?.owned);
  for (const [artId, variants] of Object.entries(MASTERY_VARIANTS_V1)) {
    assert.ok(variants.length >= 3, `${artId} needs 3 mastery breakpoints`);
    assert.deepEqual(variants.map((variant) => variant.level), [3, 6, 9]);
  }
  assert.equal(Object.keys(MERIDIAN_NODES_V1).length, 36);
  assert.equal(Object.values(MERIDIAN_NODES_V1).filter((node) => node.branch === "gongfa").length, 12);
  assert.equal(Object.values(MERIDIAN_NODES_V1).filter((node) => node.branch === "guben").length, 12);
  assert.equal(Object.values(MERIDIAN_NODES_V1).filter((node) => node.branch === "shenfa").length, 12);
});
