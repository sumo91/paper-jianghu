import assert from "node:assert/strict";
import test from "node:test";
import {
  createFactionEvent,
  npcRelationshipLevel,
  reputationLevel,
  type FactionEventContentV1,
  type FactionEventStateV1,
} from "../src/core/factions-events.ts";
import { FACTION_EVENT_CONTENT } from "../src/data/factions-events-v1.ts";

const service = createFactionEvent(FACTION_EVENT_CONTENT);

function content(): FactionEventContentV1 {
  return structuredClone(FACTION_EVENT_CONTENT) as FactionEventContentV1;
}

function readyState(): FactionEventStateV1 {
  const state = service.createState(3);
  state.balances.silver = 10000;
  state.balances.renown = 5000;
  state.flags.invite_faction_wulin = true;
  state.flags.invite_faction_wudang = true;
  state.flags.invite_faction_shuyuan = true;
  state.flags.invite_faction_caobang = true;
  state.flags.invite_faction_shoumu = true;
  return state;
}

function joined(): FactionEventStateV1 {
  return service.join(readyState(), "faction_wulin", { silver: 100 }).state;
}

test("content validates five factions, 20 NPCs, events, shops and one full region chain", () => {
  const result = service.validateContent(FACTION_EVENT_CONTENT);
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(Object.keys(FACTION_EVENT_CONTENT.factions).length, 5);
  assert.equal(Object.keys(FACTION_EVENT_CONTENT.npcs).length, 20);
  assert.ok(Object.keys(FACTION_EVENT_CONTENT.events).length >= 12);
  assert.ok(FACTION_EVENT_CONTENT.events.ev_zy_end.chainEnd);
  assert.ok(result.warnings.some((warning) => warning.includes("50–60")));
});

test("join requires faction, invite, realm and payment; invalid joins are atomic", () => {
  const base = readyState();
  const missingInvite = structuredClone(base);
  delete missingInvite.flags.invite_faction_wulin;
  const noInvite = service.join(missingInvite, "faction_wulin", { silver: 100 });
  assert.equal(noInvite.ok, false);
  assert.deepEqual(noInvite.state, missingInvite);

  const poor = structuredClone(base);
  poor.balances.silver = 0;
  const noMoney = service.join(poor, "faction_wulin", { silver: 100 });
  assert.equal(noMoney.ok, false);
  assert.deepEqual(noMoney.state, poor);

  const unknown = service.join(base, "faction_nope", { silver: 100 });
  assert.equal(unknown.ok, false);
  assert.deepEqual(unknown.state, base);

  const valid = service.join(base, "faction_wulin", { silver: 100 });
  assert.equal(valid.ok, true);
  assert.equal(valid.state.activeFactionId, "faction_wulin");
  assert.equal(valid.state.ranks.faction_wulin, "entry");
  assert.ok((valid.state.reputations.faction_wulin ?? 0) >= 10);
  assert.equal(valid.state.balances.silver, 9900);
});

test("switching faction resets old rank, lowers old reputation, keeps arts and changes shop access", () => {
  let state = joined();
  state.arts.push("taiji_baihe");
  state.ranks.faction_wulin = "inner";
  state.reputations.faction_wulin = 70;
  const oldShop = service.factionShopStock(state, "faction_wulin").map((shop) => shop.id);
  assert.ok(oldShop.length > 0);

  const switched = service.switchFaction(state, "faction_wudang", { silver: 300 });
  assert.equal(switched.ok, true);
  assert.equal(switched.state.activeFactionId, "faction_wudang");
  assert.equal(switched.state.ranks.faction_wulin, "outsider");
  assert.equal(switched.state.reputations.faction_wulin, 55);
  assert.equal(switched.state.ranks.faction_wudang, "entry");
  assert.ok(switched.state.arts.includes("taiji_baihe"));
  assert.equal(service.factionShopStock(switched.state, "faction_wulin").length, 0);
  assert.ok(service.factionShopStock(switched.state, "faction_wudang").length > 0);
});

test("reputation levels clamp at 0-100 and apply rival deltas", () => {
  const base = service.createState();
  const high = service.applyReputation(base, [{ factionId: "faction_wulin", delta: 200 }]);
  assert.equal(high.state.reputations.faction_wulin, 100);
  assert.equal(high.state.reputations.rival_court, 0);
  const low = service.applyReputation(high.state, [{ factionId: "faction_wulin", delta: -300 }]);
  assert.equal(low.state.reputations.faction_wulin, 0);
  assert.equal(low.state.reputations.rival_court, 50);
  assert.equal(reputationLevel(0), "stranger");
  assert.equal(reputationLevel(20), "acquaintance");
  assert.equal(reputationLevel(40), "friendly");
  assert.equal(reputationLevel(60), "respected");
  assert.equal(reputationLevel(80), "worshipped");
});

test("rival reputation can be changed directly by event choices", () => {
  const state = readyState();
  const result = service.applyChoice(state, "ev_offline_bounty", "take");
  assert.equal(result.ok, true);
  assert.equal(result.state.reputations.rival_court, 5);
  assert.ok((result.state.balances.silver ?? 0) > (state.balances.silver ?? 0));
});

test("NPC relationship levels change dialogue and quests, and persist across faction switches", () => {
  let state = joined();
  assert.equal(service.npcDialogue(state, "npc_lei")?.level, "stranger");
  state.npc.npc_lei = 45;
  const dialogue = service.npcDialogue(state, "npc_lei");
  assert.equal(dialogue?.level, "trust");
  assert.match(dialogue?.text ?? "", /旧事/);
  assert.ok(service.npcQuests(state, "npc_lei").some((quest) => quest.includes("擂台")));
  const switched = service.switchFaction(state, "faction_wudang", { silver: 300 }).state;
  assert.equal(switched.npc.npc_lei, 45);
  assert.equal(npcRelationshipLevel(45), "trust");
});

test("event choice applies all effects atomically; an invalid effect rolls back", () => {
  const state = joined();
  const event = FACTION_EVENT_CONTENT.events.ev_zy_arena;
  const working = structuredClone(state);
  working.flags.zy_arena_helped_wulin = true;
  const applied = service.applyChoice(state, "ev_zy_arena", "wulin");
  assert.equal(applied.ok, true);
  assert.equal(applied.applied, true);
  assert.equal(applied.state.flags.zy_arena_helped_wulin, true);
  assert.ok((applied.state.reputations.faction_wulin ?? 0) > (state.reputations.faction_wulin ?? 0));
  assert.ok((applied.state.npc.npc_lei ?? 0) > 0);
  assert.equal(applied.state.eventLog.length, 1);
  assert.ok(applied.state.inbox.length >= 1);
  assert.ok(event.choices.length >= 1);
  assert.ok(working);

  const badContent = content();
  badContent.events.ev_zy_arena.choices[0].effects.push({ kind: "art", artId: "missing_art" });
  const badService = createFactionEvent(badContent);
  const failed = badService.applyChoice(state, "ev_zy_arena", "wulin");
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.state, state);

  const spendContent = content();
  spendContent.events.ev_zy_arena.choices[0].effects.push({ kind: "currency", currency: "silver", delta: -999999 });
  const spendService = createFactionEvent(spendContent);
  const poor = spendService.applyChoice(state, "ev_zy_arena", "wulin");
  assert.equal(poor.ok, false);
  assert.equal(poor.state.balances.silver, state.balances.silver);
});

test("chain flags gate later events and the full 中原 chain is playable end-to-end", () => {
  let state = joined();
  const gated = service.applyChoice(state, "ev_zy_lei", "spar");
  assert.equal(gated.ok, false);
  assert.match(gated.reason, /条件/);

  state = service.applyChoice(state, "ev_zy_arena", "wulin").state;
  state = service.applyChoice(state, "ev_zy_letter", "deliver").state;
  assert.equal(state.flags.zy_letter_delivered, true);
  state.npc.npc_lei = 45;
  state = service.applyChoice(state, "ev_zy_lei", "spar").state;
  assert.ok(state.arts.includes("pojun_lipi"));
  state = service.applyChoice(state, "ev_zy_plot", "protect").state;
  assert.equal(state.flags.zy_final, true);
  const end = service.applyChoice(state, "ev_zy_end", "accept");
  assert.equal(end.ok, true);
  assert.ok(end.state.titles.includes("中原旧盟"));
  assert.ok(end.state.items.includes("td_luoyang_seal"));
  assert.equal(end.state.eventLog.length, 5);
});

test("random events are seeded, respect the random cooldown, and cap pending events", () => {
  const base = service.createState(3);
  const a = service.randomEvent(base, { kind: "randomTravel", region: "wudang" }, 7);
  const b = service.randomEvent(base, { kind: "randomTravel", region: "wudang" }, 7);
  assert.equal(a.event?.id, b.event?.id);
  assert.ok(a.event);
  assert.equal(a.state.pendingEvents.length, 1);
  const blocked = service.randomEvent(a.state, { kind: "randomTravel", region: "wudang" }, 7);
  assert.equal(blocked.event, undefined);
  assert.match(blocked.reason, /冷却/);
  const resolved = service.applyChoice(a.state, a.event!.id, a.event!.choices[0].id).state;
  const later = service.advanceClock(resolved, 49);
  const next = service.randomEvent(later, { kind: "randomTravel", region: "wudang" }, 9);
  assert.ok(next.event);
  assert.ok(next.state.pendingEvents.length <= 3);
});

test("offline pending events max 3, defer/resolve persists, and reload cannot duplicate a choice", () => {
  let state = service.createState(3);
  const queued = service.queueOfflineEvents(state, 11, 5);
  assert.equal(queued.events.length, 3);
  assert.equal(queued.state.pendingEvents.length, 3);
  const more = service.queueOfflineEvents(queued.state, 12, 3);
  assert.equal(more.events.length, 0);

  const eventId = queued.state.pendingEvents[0];
  const deferred = service.deferPending(queued.state, eventId);
  assert.equal(deferred.state.pendingEvents.includes(eventId), false);
  assert.ok(deferred.state.deferredEvents.includes(eventId));
  const pending = service.pendingOfflineEvents(deferred.state);
  assert.ok(pending.length <= 3);

  const target = pending[0];
  const choice = target.choices[0];
  const resolved = service.applyChoice(deferred.state, target.id, choice.id);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.state.pendingEvents.includes(target.id), false);
  const saved = service.save(resolved.state);
  const loaded = service.load(saved);
  assert.deepEqual(loaded, resolved.state);
  const duplicate = service.applyChoice(loaded, target.id, choice.id);
  assert.equal(duplicate.ok, false);
});

test("faction shop stock is rank-gated, deterministic, and purchases are atomic", () => {
  let state = joined();
  const entry = service.factionShopStock(state, "faction_wulin");
  assert.deepEqual(entry.map((shop) => shop.id), ["shop_wulin_entry"]);
  state.ranks.faction_wulin = "elder";
  const elder = service.factionShopStock(state, "faction_wulin");
  assert.ok(elder.some((shop) => shop.id === "shop_wulin_elder"));
  const beforeStock = state.shopStock.shop_wulin_entry;
  const bought = service.buyFactionShop(state, "shop_wulin_entry");
  assert.equal(bought.ok, true);
  assert.equal(bought.state.shopStock.shop_wulin_entry, beforeStock - 1);
  assert.ok(bought.state.arts.includes("pojun_lipi"));
  const out = service.buyFactionShop({ ...bought.state, shopStock: { ...bought.state.shopStock, shop_wulin_entry: 0 } }, "shop_wulin_entry");
  assert.equal(out.ok, false);
  assert.match(out.reason, /库存/);
});

test("save/load restores faction, reputation, NPC, flags, pending, cooldowns, inbox and shop stock", () => {
  let state = joined();
  state = service.applyChoice(state, "ev_zy_arena", "wulin").state;
  state.npc.npc_yue = 61;
  state.cooldowns.ev_wd_cloud = 99;
  state = service.queueOfflineEvents(state, 3).state;
  const restored = service.load(service.save(state));
  assert.deepEqual(restored, state);
});

test("content validation fails on missing speaker, invalid effect, dead-end chain and unknown art", () => {
  const noSpeaker = content();
  noSpeaker.events.ev_zy_arena.speakerId = "npc_missing";
  assert.equal(service.validateContent(noSpeaker).ok, false);

  const noEffects = content();
  noEffects.events.ev_zy_arena.choices[0].effects = [];
  assert.equal(service.validateContent(noEffects).ok, false);

  const deadEnd = content();
  deadEnd.events.ev_zy_end.chainEnd = false;
  assert.equal(service.validateContent(deadEnd).ok, false);

  const unknownArt = content();
  unknownArt.events.ev_zy_lei.choices[0].effects.push({ kind: "art", artId: "missing_art" });
  assert.equal(service.validateContent(unknownArt).ok, false);
});
