import assert from "node:assert/strict";
import test from "node:test";
import { CURRENCY_IDS, createEconomy, createEconomyState, stressEconomy, type EconomyState } from "../src/core/economy.ts";
import { ECONOMY_CONTENT } from "../src/data/economy-v1.ts";
import { createItemization, createItemizationState } from "../src/core/itemization.ts";
import { ITEMIZATION_CONTENT, starterGearItems } from "../src/data/item-v1.ts";

const economy = createEconomy(ECONOMY_CONTENT);

function rich(seed = 1): EconomyState {
  let state = createEconomyState(ECONOMY_CONTENT);
  state.realm = 5;
  state = economy.grant(state, {
    silver: 100000,
    cultivation: 1000,
    renown: 1000,
    factionRep: 1000,
    tianji: 1000,
    pages: 10,
    annotations: 10,
    manuals: 10,
    materials: 100,
    tokens: 10,
    pills: 10,
  }).state;
  return state;
}

test("economy content validates: every currency has source and sink, 50%/8h, no paid power", () => {
  const result = economy.validateContent(ECONOMY_CONTENT);
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(ECONOMY_CONTENT.offline.rate, 0.5);
  assert.equal(ECONOMY_CONTENT.offline.capHours, 8);
  assert.ok(ECONOMY_CONTENT.salvageFraction < 1);
  for (const id of CURRENCY_IDS) {
    assert.ok(ECONOMY_CONTENT.currencies[id].sources.length > 0);
    assert.ok(ECONOMY_CONTENT.currencies[id].sinks.length > 0);
  }
  assert.equal(ECONOMY_CONTENT.currencies.tianji.cosmeticOnly, true);
});

test("grant/spend updates balances exactly; failed transactions leave state unchanged", () => {
  let state = createEconomyState(ECONOMY_CONTENT);
  state = economy.grant(state, { silver: 500, cultivation: 100, materials: 10 }).state;
  assert.equal(state.balances.silver, 500);
  assert.equal(state.balances.cultivation, 100);
  assert.equal(state.balances.materials, 10);

  const refine = economy.quote(state, { kind: "refine", level: 0, itemTier: 1 });
  assert.equal(refine.ok, true);
  assert.equal(refine.costs.silver, 96);
  assert.equal(refine.costs.materials, 1);
  const applied = economy.apply(state, { kind: "refine", level: 0, itemTier: 1 });
  assert.equal(applied.applied, true);
  assert.equal(applied.state.balances.silver, 404);
  assert.equal(applied.state.balances.materials, 9);

  const poor = economy.apply(state, { kind: "respec", realm: 5 });
  assert.equal(poor.applied, false);
  assert.equal(poor.state, state);
  assert.deepEqual(poor.state.balances, state.balances);
});

test("cultivation cap stops at cap, converts overflow to silver, and warns near cap", () => {
  let state = createEconomyState(ECONOMY_CONTENT);
  state.realm = 0;
  state = economy.grant(state, { cultivation: 900 }).state;
  assert.equal(state.balances.cultivation, 800);
  assert.equal(state.balances.silver, 20);
  assert.ok(state.warnings.some((warning) => warning.includes("修为达到上限")));
  assert.equal(economy.nearCap(state, "cultivation"), true);

  state = economy.grant(state, { cultivation: 1000 }).state;
  assert.equal(state.balances.cultivation, 800);
  assert.equal(state.balances.silver, 220);
});

test("secondary resources cap and overflow with explicit warnings; no silent deletion", () => {
  let state = createEconomyState(ECONOMY_CONTENT);
  state = economy.grant(state, { pages: 200, annotations: 200, manuals: 200, materials: 2000, tokens: 200, pills: 200 }).state;
  assert.equal(state.balances.pages, 99);
  assert.equal(state.balances.annotations, 99);
  assert.equal(state.balances.manuals, 99);
  assert.equal(state.balances.materials, 999);
  assert.equal(state.balances.tokens, 99);
  assert.equal(state.balances.pills, 99);
  assert.ok(state.warnings.length >= 6);
});

test("offline 8h at 50% is half of online, 9h is capped, stop condition shortens settlement", () => {
  const eight = economy.offline({ hours: 8, rewardsPerHour: { silver: 100, cultivation: 50 } });
  assert.equal(eight.effectiveHours, 4);
  assert.equal(eight.rewards.silver, 400);
  assert.equal(eight.rewards.cultivation, 200);
  const nine = economy.offline({ hours: 9, rewardsPerHour: { silver: 100 } });
  assert.equal(nine.effectiveHours, 4);
  assert.equal(nine.rewards.silver, 400);
  assert.ok(nine.warnings.some((warning) => warning.includes("上限")));
  const stopped = economy.offline({ hours: 8, rewardsPerHour: { silver: 100 }, stopAtHours: 2, stoppedBy: "bossFailure" });
  assert.equal(stopped.hoursSettled, 2);
  assert.equal(stopped.effectiveHours, 1);
  assert.equal(stopped.rewards.silver, 100);
  assert.equal(stopped.stoppedBy, "bossFailure");
  assert.equal("mapId" in stopped, false);
  assert.equal("loadout" in stopped, false);
});

test("refine/reforge/respec are quoted and deducted atomically; respec has the configured cost", () => {
  const state = rich();
  const respec = economy.quote(state, { kind: "respec", realm: 5 });
  assert.deepEqual(respec.costs, { silver: 300, pills: 1 });
  const applied = economy.apply(state, { kind: "respec", realm: 5 });
  assert.equal(applied.applied, true);
  assert.equal(applied.state.balances.silver, state.balances.silver - 300);
  assert.equal(applied.state.balances.pills, state.balances.pills - 1);
  const broke = structuredClone(state);
  broke.balances.pills = 0;
  const failed = economy.apply(broke, { kind: "respec", realm: 5 });
  assert.equal(failed.applied, false);
  assert.deepEqual(failed.state.balances, broke.balances);

  const reforge = economy.quote(state, { kind: "reforge", itemTier: 3 });
  assert.deepEqual(reforge.costs, { silver: 240, materials: 4 });
  const reforged = economy.apply(state, { kind: "reforge", itemTier: 3 });
  assert.equal(reforged.state.balances.silver, state.balances.silver - 240);
  assert.equal(reforged.state.balances.materials, state.balances.materials - 4);
});

test("shop stock is deterministic and gated by realm/renown; buying removes stock and marks purchased", () => {
  let state = createEconomyState(ECONOMY_CONTENT);
  state.realm = 1;
  state = economy.grant(state, { silver: 10000, renown: 200, materials: 100 }).state;

  const page = economy.quote(state, { kind: "shop", skuId: "sku_page" });
  assert.equal(page.ok, true);
  assert.equal(page.affordable, true);
  const bought = economy.apply(state, { kind: "shop", skuId: "sku_page" });
  assert.equal(bought.applied, true);
  assert.equal(bought.state.shop.sku_page.stock, 7);
  assert.equal(bought.state.shop.sku_page.purchased, 1);
  assert.equal(bought.state.balances.pages, 1);

  const gate = economy.quote({ ...state, realm: 2, balances: { ...state.balances, renown: 0 } }, { kind: "shop", skuId: "sku_manual" });
  assert.equal(gate.ok, false);
  assert.match(gate.reason, /名望不足/);
  const realmGate = economy.quote({ ...state, realm: 1 }, { kind: "shop", skuId: "sku_manual" });
  assert.equal(realmGate.ok, false);
  assert.match(realmGate.reason, /境界不足/);

  const empty = structuredClone(state);
  empty.shop.sku_page.stock = 0;
  const out = economy.quote(empty, { kind: "shop", skuId: "sku_page" });
  assert.equal(out.ok, false);
  assert.match(out.reason, /库存不足/);
});

test("tianji buys only cosmetics/titles; no combat power grant", () => {
  let state = rich();
  const title = ECONOMY_CONTENT.shop.sku_title;
  assert.deepEqual(title.grants, undefined);
  assert.deepEqual(title.costs, { tianji: 500 });
  const bought = economy.apply(state, { kind: "shop", skuId: "sku_title" });
  assert.equal(bought.applied, true);
  assert.equal(bought.state.balances.tianji, 500);
  assert.deepEqual(bought.quote.grants, undefined);
});

test("salvage value is below shop value; no buy/sell arbitrage", () => {
  const itemization = createItemization(ITEMIZATION_CONTENT);
  let inventory = createItemizationState();
  const item = starterGearItems("taiji")[0];
  inventory = itemization.addItem(inventory, item);
  const salvage = itemization.salvage(inventory, item.id, true);
  assert.ok(salvage.silver > 0);
  assert.ok(salvage.silver < (ECONOMY_CONTENT.shop.sku_material.costs.silver ?? 0));
  assert.ok(ECONOMY_CONTENT.salvageFraction < 1);
});

test("same seed/activity produces the same grants; 500h stress has no negative balances, zero sinks or runaway silver", () => {
  const a = stressEconomy(economy, ECONOMY_CONTENT, 7, 500);
  const b = stressEconomy(economy, ECONOMY_CONTENT, 7, 500);
  assert.deepEqual(a.final.balances, b.final.balances);
  assert.deepEqual(a.points, b.points);
  assert.equal(a.negativeBalances.length, 0);
  assert.equal(a.zeroSinkCurrencies.length, 0);
  assert.ok(a.maxSilver < 1_000_000, `max silver ${a.maxSilver}`);
  assert.ok(a.totalGranted > 0);
  assert.ok(a.totalSpent > 0);
  for (const currency of CURRENCY_IDS) {
    assert.ok(Number.isFinite(a.final.balances[currency]));
    assert.ok(a.final.balances[currency] >= 0);
  }
  const c = stressEconomy(economy, ECONOMY_CONTENT, 8, 500);
  assert.notDeepEqual(a.final.balances, c.final.balances);
});

test("save/load restores balances, caps, shop stock, season and warnings", () => {
  let state = rich();
  state.caps = { cultivation: 1234 };
  state.season.tianjiSpent = 77;
  state.pity.target_page = 4;
  state = economy.apply(state, { kind: "shop", skuId: "sku_page" }).state;
  const serialized = economy.save(state);
  const restored = economy.load(serialized);
  assert.deepEqual(restored, state);
  const quote = economy.quote(restored, { kind: "shop", skuId: "sku_page" });
  assert.equal(quote.ok, true);
});
