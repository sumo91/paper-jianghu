import assert from "node:assert/strict";
import test from "node:test";
import type { GearSlot } from "../src/core/types.ts";
import { GEAR_SLOTS } from "../src/core/types.ts";
import type { BuildId } from "../src/core/types.ts";
import type { WeaponType } from "../src/core/combat-v1.ts";
import {
  AFFIX_COUNT,
  createItemization,
  createItemizationState,
  dropChance,
  itemTierFor,
  maxAffixTier,
  rarityRank,
  rollRarity,
  type ItemizationState,
} from "../src/core/itemization.ts";
import { Rng } from "../src/core/rng.ts";
import {
  AFFIXES_V1,
  ITEMIZATION_CONTENT,
  LEGENDARIES_V1,
  SETS_V1,
  starterGearItems,
  weaponTypesForLoadout,
} from "../src/data/item-v1.ts";
import { STARTER_KITS, starterLoadoutFor } from "../src/data/combat-v1.ts";

const service = createItemization(ITEMIZATION_CONTENT);

function context(buildId: BuildId = "taiji", requiredWeaponTypes: WeaponType[] = ["sword", "fist"]) {
  return { buildId, requiredWeaponTypes };
}

function stateWithStarter(buildId: BuildId): ItemizationState {
  let state = createItemizationState();
  const equipContext = context(buildId, weaponTypesForLoadout(starterLoadoutFor(buildId)));
  for (const item of starterGearItems(buildId)) {
    state = service.addItem(state, item);
    state = service.equip(state, item.id, equipContext).state;
  }
  return state;
}

function roll(seed: number, options: Partial<Parameters<typeof service.roll>[0]> = {}) {
  return service.roll({
    seed,
    source: "boss",
    mapTier: 3,
    layer: 6,
    ...options,
  });
}

test("rarity determines exact affix count; rolls never duplicate or use illegal stats", () => {
  for (const rarity of ["common", "fine", "superb", "peerless", "divine"] as const) {
    const item = roll(100 + rarityRank(rarity), { rarity, allowDivine: rarity === "divine" });
    assert.equal(item.affixes.length, AFFIX_COUNT[rarity], `${rarity} affix count`);
    assert.equal(new Set(item.affixes.map((affix) => affix.defId)).size, item.affixes.length);
    assert.equal(new Set(item.affixes.map((affix) => affix.stat)).size, item.affixes.length);
    assert.ok(item.tier >= 1 && item.tier <= 5);
    assert.ok(item.mainStat.value > 0);
    for (const affix of item.affixes) {
      const def = AFFIXES_V1.find((entry) => entry.id === affix.defId);
      assert.ok(def, `unknown affix ${affix.defId}`);
      assert.ok(def.slots.includes(item.slot), `${affix.defId} not legal for ${item.slot}`);
      assert.ok(affix.tier >= 1 && affix.tier <= maxAffixTier(3, 6));
      assert.ok(Number.isFinite(affix.value));
      assert.ok(affix.value > 0);
    }
  }
});

test("affix tiers/values scale with map tier and layer; item tier is bounded", () => {
  const low = roll(1, { source: "normal", mapTier: 1, layer: 1 });
  const high = roll(2, { source: "boss", mapTier: 6, layer: 10, rarity: "peerless" });
  assert.ok(high.itemLevel > low.itemLevel);
  assert.ok(high.tier >= low.tier);
  assert.ok(maxAffixTier(6, 10) >= maxAffixTier(1, 1));
  assert.ok(maxAffixTier(6, 10) <= 5);
  assert.equal(itemTierFor(1, 1), 1);
  assert.equal(itemTierFor(6, 10), 5);
  for (const item of [low, high]) {
    for (const affix of item.affixes) {
      assert.ok(affix.tier <= maxAffixTier(item.tier >= 5 ? 6 : 1, item.tier >= 5 ? 10 : 1));
    }
  }
});

test("weapon type compatibility rejects an invalid loadout and accepts a valid one", () => {
  let state = stateWithStarter("taiji");
  const equipContext = context();
  const blade = roll(11, { slot: "weapon", weaponType: "blade", rarity: "peerless", mapTier: 5 });
  state = service.addItem(state, blade);
  const rejected = service.equip(state, blade.id, equipContext);
  assert.equal(rejected.equipped, false);
  assert.ok(rejected.flagged.some((flag) => flag.includes("不兼容")));

  const sword = roll(12, { slot: "weapon", weaponType: "sword", rarity: "peerless", mapTier: 5 });
  state = service.addItem(state, sword);
  const accepted = service.equip(state, sword.id, equipContext);
  assert.equal(accepted.equipped, true);
});

test("auto-equip manual/emptyOnly/upgradeUnlocked behave as specified; locks are never replaced", () => {
  let state = createItemizationState();
  const equipContext = context();
  const low = roll(21, { slot: "weapon", weaponType: "sword", mapTier: 1, rarity: "fine" });
  const high = roll(22, { slot: "weapon", weaponType: "sword", mapTier: 5, rarity: "peerless" });
  state = service.addItem(state, low);
  state = service.addItem(state, high);

  assert.equal(service.applyEquipPolicy(state, low, "manual", equipContext).equipped, false);
  assert.equal(service.applyEquipPolicy(state, low, "emptyOnly", equipContext).equipped, true);
  state = service.applyEquipPolicy(state, low, "emptyOnly", equipContext).state;
  assert.equal(service.applyEquipPolicy(state, high, "emptyOnly", equipContext).equipped, false);
  const upgrade = service.applyEquipPolicy(state, high, "upgradeUnlocked", equipContext);
  assert.equal(upgrade.equipped, true);
  state = upgrade.state;
  assert.equal(state.equipped.weapon, high.id);

  state = service.addItem(state, low);
  const lockedSlot = structuredClone(state);
  lockedSlot.slotLocks.weapon = true;
  assert.equal(service.applyEquipPolicy(lockedSlot, low, "upgradeUnlocked", equipContext).equipped, false);

  const lockedItem = structuredClone(state);
  lockedItem.inventory[low.id].locked = true;
  const lockedEquipped = structuredClone(lockedItem);
  lockedEquipped.equipped.weapon = null;
  assert.equal(service.applyEquipPolicy(lockedEquipped, lockedItem.inventory[low.id], "emptyOnly", equipContext).equipped, false);
});

test("preset restore flags missing/incompatible gear and restores valid gear exactly", () => {
  const state = stateWithStarter("taiji");
  const stored = { ...state.equipped };
  const emptied = service.unequip(service.unequip(service.unequip(service.unequip(service.unequip(service.unequip(state, "weapon"), "head"), "body"), "wrist"), "feet"), "jade");
  const restored = service.restoreEquipped(emptied, stored, context());
  assert.equal(restored.complete, true);
  assert.deepEqual(restored.state.equipped, stored);

  const missing = structuredClone(stored);
  missing.weapon = "missing-id";
  const flagged = service.restoreEquipped(emptied, missing, context());
  assert.equal(flagged.complete, false);
  assert.ok(flagged.flagged.some((flag) => flag.includes("缺失")));
  assert.equal(flagged.state.equipped.weapon, null);
});

test("bag full stops activity without silently destroying locked/divine items; autosalvage respects floors", () => {
  let state = createItemizationState();
  state.bagCapacity = 1;
  state.salvageFilter.rarityFloor = "superb";
  const common = roll(31, { slot: "head", rarity: "common", source: "normal", mapTier: 1 });
  const common2 = roll(32, { slot: "head", rarity: "common", source: "normal", mapTier: 1 });
  const divine = roll(33, { slot: "jade", rarity: "divine", allowDivine: true, mapTier: 5 });
  state = service.addItem(state, common2);
  const auto = service.receive(state, common, context());
  assert.equal(auto.salvaged, true);
  assert.equal(auto.stored, false);

  const protectedCommon = { ...common, id: "locked_common", locked: true };
  const protectedState = { ...state, salvageFilter: { ...state.salvageFilter, rarityFloor: "superb" as const } };
  const storedLocked = service.receive(protectedState, protectedCommon, context());
  assert.equal(storedLocked.bagFull, true);
  assert.equal(storedLocked.stored, true);
  assert.ok(storedLocked.state.inventory["locked_common"]);

  const storedDivine = service.receive(state, divine, context());
  assert.equal(storedDivine.bagFull, true);
  assert.equal(storedDivine.stored, true);
  assert.ok(storedDivine.state.inventory[divine.id]);
  assert.ok(storedDivine.state.overflow.includes(divine.id));
});

test("salvage requires confirmation for locks/divines; refine never destroys; reforge is deterministic and can keep the old roll", () => {
  let state = createItemizationState();
  const item = roll(41, { slot: "weapon", weaponType: "sword", rarity: "peerless", mapTier: 5 });
  state = service.addItem(state, item);
  state.inventory[item.id].locked = true;
  const locked = service.salvage(state, item.id, false);
  assert.equal(locked.salvaged, false);
  const confirmed = service.salvage(state, item.id, true);
  assert.equal(confirmed.salvaged, true);
  assert.ok(confirmed.materials > 0);
  assert.equal(confirmed.state.inventory[item.id], undefined);

  state = createItemizationState();
  const refineItem = roll(42, { slot: "weapon", weaponType: "sword", rarity: "superb", mapTier: 3 });
  state = service.addItem(state, refineItem);
  let lastCost = 0;
  for (let i = 0; i < 20; i += 1) {
    const result = service.refine(state, refineItem.id);
    if (!result.refined) break;
    lastCost = result.cost.materials;
    state = result.state;
  }
  const refined = state.inventory[refineItem.id];
  assert.ok(refined.refine > 0);
  assert.ok(refined.refine <= Math.min(10, 5 + refined.tier));
  assert.ok(lastCost > 0);

  const reforgeItem = roll(43, { slot: "weapon", weaponType: "sword", rarity: "superb", mapTier: 3 });
  state = service.addItem(state, reforgeItem);
  const affixId = state.inventory[reforgeItem.id].affixes[0].defId;
  const a = service.reforge(state, reforgeItem.id, affixId, 7, true);
  const b = service.reforge(state, reforgeItem.id, affixId, 7, true);
  assert.deepEqual(a.newAffix, b.newAffix);
  const kept = service.reforge(state, reforgeItem.id, affixId, 8, false);
  assert.equal(kept.reforged, false);
  assert.equal(kept.state.inventory[reforgeItem.id].affixes[0].value, state.inventory[reforgeItem.id].affixes[0].value);
  assert.ok(kept.state.reforgePity[reforgeItem.id] > 0);
});

test("item score is stable and gear score/set bonuses come from equipped items", () => {
  const state = stateWithStarter("taiji");
  const item = state.inventory[state.equipped.weapon!];
  const a = service.score(item, { buildId: "taiji", requiredWeaponTypes: ["sword", "fist"] });
  const b = service.score(item, { buildId: "taiji", requiredWeaponTypes: ["sword", "fist"] });
  assert.equal(a, b);
  assert.ok(a > 0);
  const mods = service.gearMods(state);
  assert.ok((mods.attackPct ?? 0) > 0);
  assert.ok((mods.guardReduction ?? 0) >= 0);
});

test("save/load round-trip restores inventory, equipped gear, locks, filters, pity and refine levels", () => {
  let state = stateWithStarter("pojun");
  const item = roll(51, { slot: "weapon", weaponType: "blade", rarity: "peerless", mapTier: 5 });
  state = service.addItem(state, item);
  state.inventory[item.id].locked = true;
  state.itemLocks[item.id] = true;
  state.slotLocks.feet = true;
  state.salvageFilter.rarityFloor = "fine";
  state.salvageFilter.affixBlacklist = ["hpPct"];
  state.reforgePity[item.id] = 3;
  state = service.refine(state, item.id).state;
  const serialized = service.save(state);
  const restored = service.load(serialized);
  assert.deepEqual(restored, state);
});

test("drop distribution by source/tier stays in the designed bands over a large seeded sample", () => {
  const counts = {
    normal: {} as Record<string, number>,
    elite: {} as Record<string, number>,
    boss: {} as Record<string, number>,
  };
  for (const source of ["normal", "elite", "boss"] as const) {
    for (let seed = 1; seed <= 1500; seed += 1) {
      const item = roll(seed, { source, mapTier: 3, layer: 5, allowDivine: true });
      counts[source][item.rarity] = (counts[source][item.rarity] ?? 0) + 1;
    }
  }
  assert.ok(counts.normal.common + counts.normal.fine >= 1400);
  assert.equal(counts.normal.peerless ?? 0, 0);
  assert.equal(counts.normal.divine ?? 0, 0);
  assert.ok((counts.boss.superb ?? 0) + (counts.boss.peerless ?? 0) + (counts.boss.divine ?? 0) === 1500);
  assert.equal(counts.boss.common ?? 0, 0);
  assert.equal(counts.boss.fine ?? 0, 0);
  assert.ok((counts.elite.superb ?? 0) > 0);
  assert.ok((counts.elite.peerless ?? 0) > 0);
  assert.ok(dropChance("boss") > dropChance("elite"));
  assert.ok(dropChance("elite") > dropChance("normal"));
});

test("divine rolls are deterministic, gated by allowDivine, and carry a legendary rule", () => {
  const denied = roll(61, { source: "boss", mapTier: 5, layer: 10, rarity: "divine", allowDivine: false });
  assert.equal(denied.rarity, "peerless");
  const a = roll(61, { source: "boss", mapTier: 5, layer: 10, rarity: "divine", allowDivine: true });
  const b = roll(61, { source: "boss", mapTier: 5, layer: 10, rarity: "divine", allowDivine: true });
  assert.deepEqual(a, b);
  assert.equal(a.rarity, "divine");
  assert.ok(a.legendaryId);
  assert.ok(LEGENDARIES_V1[a.legendaryId!]);
  assert.ok(Object.keys(SETS_V1).length === 8);
  assert.equal(Object.keys(LEGENDARIES_V1).length, 15);
  for (const legendary of Object.values(LEGENDARIES_V1)) {
    assert.ok(legendary.rule);
    assert.ok(Object.keys(legendary.effect).length > 0);
    assert.ok(legendary.description.length > 0);
  }
  for (const set of Object.values(SETS_V1)) {
    assert.ok(Object.keys(set.two).length > 0);
    assert.ok(Object.keys(set.four).length > 0);
  }
});

test("starter gear is itemized for all kits and covers all six slots", () => {
  for (const buildId of ["taiji", "pojun", "xuanyin"] as BuildId[]) {
    const items = starterGearItems(buildId);
    assert.equal(items.length, 6);
    assert.deepEqual(items.map((item) => item.slot).sort(), [...GEAR_SLOTS].sort());
    const state = stateWithStarter(buildId);
    assert.equal(Object.values(state.equipped).filter(Boolean).length, 6);
    assert.ok(weaponTypesForLoadout(starterLoadoutFor(buildId)).includes(state.inventory[state.equipped.weapon!].weaponType!));
    assert.equal(STARTER_KITS[buildId].loadout.gear.weapon, state.equipped.weapon);
  }
});
