import type { RegionId } from "./types.ts";
import type { CurrencyId } from "./economy.ts";
import { Rng } from "./rng.ts";

// ---------------------------------------------------------------------------
// Factions, NPCs & Events v1
//
// One pure seam: FactionEventService. It owns faction, reputation, NPC,
// event, chain, pending-offline and inbox state transitions.
// ---------------------------------------------------------------------------

export type FactionRank = "outsider" | "entry" | "inner" | "true" | "elder" | "master";
export const FACTION_RANK_ORDER: FactionRank[] = ["outsider", "entry", "inner", "true", "elder", "master"];
export const FACTION_RANK_NAMES: Record<FactionRank, string> = {
  outsider: "门外",
  entry: "入门",
  inner: "内门",
  true: "真传",
  elder: "长老",
  master: "掌门",
};

export type ReputationLevel = "stranger" | "acquaintance" | "friendly" | "respected" | "worshipped";
export const REPUTATION_LEVELS: ReputationLevel[] = ["stranger", "acquaintance", "friendly", "respected", "worshipped"];
export const REPUTATION_NAMES: Record<ReputationLevel, string> = {
  stranger: "陌生",
  acquaintance: "相识",
  friendly: "友善",
  respected: "敬重",
  worshipped: "崇拜",
};

export type NpcRelationshipLevel = "stranger" | "acquaintance" | "trust" | "confidant" | "lifeDeath";
export const NPC_LEVELS: NpcRelationshipLevel[] = ["stranger", "acquaintance", "trust", "confidant", "lifeDeath"];
export const NPC_LEVEL_NAMES: Record<NpcRelationshipLevel, string> = {
  stranger: "陌生",
  acquaintance: "相识",
  trust: "信任",
  confidant: "知己",
  lifeDeath: "生死",
};

export interface FactionDefV1 {
  id: string;
  name: string;
  region: RegionId;
  stance: string;
  specialty: string;
  rivalId: string;
  rivalName: string;
  minRealm: number;
  inviteFlag: string;
  exclusiveRewards: string[];
  shopIds: string[];
}

export interface NpcDefV1 {
  id: string;
  name: string;
  region: RegionId;
  factionId: string;
  role: string;
  mapId: string;
  personalThread: string;
  gifts: string[];
  dialogue: Partial<Record<NpcRelationshipLevel, string>>;
}

export interface FactionShopSkuV1 {
  id: string;
  factionId: string;
  rank: FactionRank;
  name: string;
  description: string;
  price: Partial<Record<CurrencyId, number>>;
  artId?: string;
  itemId?: string;
  stock: number;
}

export type EventTrigger =
  | { kind: "regionEntry"; region: RegionId }
  | { kind: "mapFirstClear"; mapId: string }
  | { kind: "bossFirstClear"; mapId: string }
  | { kind: "factionRank"; factionId: string; rank: FactionRank }
  | { kind: "npcRelationship"; npcId: string; level: NpcRelationshipLevel }
  | { kind: "offlineReturn" }
  | { kind: "randomTravel"; region?: RegionId }
  | { kind: "randomFight"; region?: RegionId }
  | { kind: "seasonWeekly"; week: number };

export type EventCondition =
  | { kind: "faction"; factionId: string }
  | { kind: "rankAtLeast"; factionId: string; rank: FactionRank }
  | { kind: "reputationAtLeast"; factionId: string; value: number }
  | { kind: "npcAtLeast"; npcId: string; level: NpcRelationshipLevel }
  | { kind: "realmAtLeast"; realm: number }
  | { kind: "flag"; flag: string }
  | { kind: "notFlag"; flag: string }
  | { kind: "ownsArt"; artId: string }
  | { kind: "mapCleared"; mapId: string };

export type EventEffect =
  | { kind: "reputation"; factionId: string; delta: number; rival?: boolean }
  | { kind: "npcRelationship"; npcId: string; delta: number }
  | { kind: "currency"; currency: CurrencyId; delta: number }
  | { kind: "art"; artId: string }
  | { kind: "item"; itemId: string }
  | { kind: "flag"; flag: string }
  | { kind: "clearFlag"; flag: string }
  | { kind: "title"; title: string }
  | { kind: "shopUnlock"; shopId: string }
  | { kind: "mapUnlock"; mapId: string }
  | { kind: "companionHook"; companionId: string };

export interface EventChoiceV1 {
  id: string;
  text: string;
  effects: EventEffect[];
}

export interface EventDefV1 {
  id: string;
  title: string;
  speakerId: string;
  locationMapId: string;
  region: RegionId;
  trigger: EventTrigger;
  conditions: EventCondition[];
  choices: EventChoiceV1[];
  chainId?: string;
  chainStep?: number;
  chainEnd?: boolean;
  cooldownHours?: number;
  once?: boolean;
  weight?: number;
  text: string;
}

export interface FactionEventContentV1 {
  factions: Record<string, FactionDefV1>;
  npcs: Record<string, NpcDefV1>;
  events: Record<string, EventDefV1>;
  shops: Record<string, FactionShopSkuV1>;
  catalog: {
    arts: string[];
    items: string[];
    maps: string[];
    companions: string[];
  };
}

export interface InboxItemV1 {
  id: string;
  kind: "event" | "faction" | "offline" | "system";
  title: string;
  body: string;
  clock: number;
  read: boolean;
  eventId?: string;
}

export interface EventLogEntryV1 {
  eventId: string;
  choiceId: string;
  title: string;
  text: string;
  clock: number;
}

export interface FactionEventStateV1 {
  activeFactionId: string | null;
  realm: number;
  ranks: Record<string, FactionRank>;
  reputations: Record<string, number>;
  npc: Record<string, number>;
  flags: Record<string, true>;
  titles: string[];
  arts: string[];
  items: string[];
  unlockedShops: string[];
  unlockedMaps: string[];
  companionHooks: string[];
  balances: Partial<Record<CurrencyId, number>>;
  pendingEvents: string[];
  deferredEvents: string[];
  firedEvents: string[];
  cooldowns: Record<string, number>;
  randomCooldownUntil: number;
  clock: number;
  shopStock: Record<string, number>;
  inbox: InboxItemV1[];
  eventLog: EventLogEntryV1[];
}

export interface JoinResult {
  state: FactionEventStateV1;
  ok: boolean;
  reason: string;
}

export interface SwitchResult {
  state: FactionEventStateV1;
  ok: boolean;
  reason: string;
}

export interface ReputationDelta {
  factionId: string;
  delta: number;
  rival?: boolean;
}

export interface ReputationResult {
  state: FactionEventStateV1;
  ok: boolean;
  reason: string;
}

export interface EventResult {
  state: FactionEventStateV1;
  ok: boolean;
  applied: boolean;
  reason: string;
  log?: EventLogEntryV1;
}

export interface PendingResult {
  state: FactionEventStateV1;
  events: EventDefV1[];
}

export interface RandomEventResult {
  state: FactionEventStateV1;
  event?: EventDefV1;
  reason: string;
}

export interface ShopResult {
  state: FactionEventStateV1;
  ok: boolean;
  reason: string;
}

export interface FactionValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface FactionEventService {
  createState(realm?: number): FactionEventStateV1;
  join(state: FactionEventStateV1, factionId: string, payment: Partial<Record<CurrencyId, number>>): JoinResult;
  switchFaction(state: FactionEventStateV1, factionId: string, payment: Partial<Record<CurrencyId, number>>): SwitchResult;
  applyReputation(state: FactionEventStateV1, deltas: ReputationDelta[]): ReputationResult;
  applyChoice(state: FactionEventStateV1, eventId: string, choiceId: string): EventResult;
  pendingOfflineEvents(state: FactionEventStateV1): EventDefV1[];
  queueOfflineEvents(state: FactionEventStateV1, seed: number, max?: number): PendingResult;
  deferPending(state: FactionEventStateV1, eventId: string): PendingResult;
  randomEvent(state: FactionEventStateV1, trigger: EventTrigger, seed: number): RandomEventResult;
  advanceClock(state: FactionEventStateV1, hours: number): FactionEventStateV1;
  factionShopStock(state: FactionEventStateV1, factionId: string): FactionShopSkuV1[];
  buyFactionShop(state: FactionEventStateV1, skuId: string): ShopResult;
  npcDialogue(state: FactionEventStateV1, npcId: string): { level: NpcRelationshipLevel; text: string } | null;
  npcQuests(state: FactionEventStateV1, npcId: string): string[];
  validateContent(content: FactionEventContentV1): FactionValidation;
  save(state: FactionEventStateV1): string;
  load(serialized: string): FactionEventStateV1;
}

export function reputationLevel(value: number): ReputationLevel {
  if (value >= 80) return "worshipped";
  if (value >= 60) return "respected";
  if (value >= 40) return "friendly";
  if (value >= 20) return "acquaintance";
  return "stranger";
}

export function npcRelationshipLevel(value: number): NpcRelationshipLevel {
  if (value >= 80) return "lifeDeath";
  if (value >= 60) return "confidant";
  if (value >= 40) return "trust";
  if (value >= 20) return "acquaintance";
  return "stranger";
}

function clampRelationship(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function rankAtLeast(rank: FactionRank, required: FactionRank): boolean {
  return FACTION_RANK_ORDER.indexOf(rank) >= FACTION_RANK_ORDER.indexOf(required);
}

function addUnique<T>(list: T[], value: T): void {
  if (!list.includes(value)) list.push(value);
}

function balanceOf(state: FactionEventStateV1, currency: CurrencyId): number {
  return state.balances[currency] ?? 0;
}

function canPay(state: FactionEventStateV1, payment: Partial<Record<CurrencyId, number>>): boolean {
  return Object.entries(payment).every(([currency, value]) => balanceOf(state, currency as CurrencyId) >= (value ?? 0));
}

function pay(state: FactionEventStateV1, payment: Partial<Record<CurrencyId, number>>): void {
  for (const [currency, value] of Object.entries(payment)) {
    state.balances[currency as CurrencyId] = balanceOf(state, currency as CurrencyId) - (value ?? 0);
  }
}

function gain(state: FactionEventStateV1, currency: CurrencyId, delta: number): void {
  state.balances[currency] = Math.max(0, balanceOf(state, currency) + delta);
}

export function createFactionEvent(content: FactionEventContentV1): FactionEventService {
  function createState(realm = 0): FactionEventStateV1 {
    const shopStock: Record<string, number> = {};
    for (const shop of Object.values(content.shops)) shopStock[shop.id] = shop.stock;
    return {
      activeFactionId: null,
      realm,
      ranks: {},
      reputations: {},
      npc: {},
      flags: {},
      titles: [],
      arts: [],
      items: [],
      unlockedShops: [],
      unlockedMaps: [],
      companionHooks: [],
      balances: { silver: 500, renown: 100 },
      pendingEvents: [],
      deferredEvents: [],
      firedEvents: [],
      cooldowns: {},
      randomCooldownUntil: 0,
      clock: 0,
      shopStock,
      inbox: [],
      eventLog: [],
    };
  }

  function inboxMood(state: FactionEventStateV1, item: Omit<InboxItemV1, "id" | "clock" | "read">): void {
    state.inbox.push({
      ...item,
      id: `inbox_${state.clock}_${state.inbox.length}`,
      clock: state.clock,
      read: false,
    });
    if (state.inbox.length > 60) state.inbox.shift();
  }

  function join(
    state: FactionEventStateV1,
    factionId: string,
    payment: Partial<Record<CurrencyId, number>>,
  ): JoinResult {
    const faction = content.factions[factionId];
    if (!faction) return { state, ok: false, reason: "未知门派" };
    if (state.activeFactionId) return { state, ok: false, reason: "已经加入门派，需要先改换" };
    if (state.realm < faction.minRealm) return { state, ok: false, reason: `境界不足：需要 ${faction.minRealm}` };
    if (faction.inviteFlag && !state.flags[faction.inviteFlag]) {
      return { state, ok: false, reason: "缺少门派邀请" };
    }
    if (!canPay(state, payment)) return { state, ok: false, reason: "入门费用不足" };
    const next = structuredClone(state);
    pay(next, payment);
    next.activeFactionId = faction.id;
    next.ranks[faction.id] = "entry";
    next.reputations[faction.id] = Math.max(10, next.reputations[faction.id] ?? 0);
    inboxMood(next, {
      kind: "faction",
      title: `加入 ${faction.name}`,
      body: `${faction.name}记下了你的名字。门派商店与任务已开放。`,
    });
    return { state: next, ok: true, reason: "已入门" };
  }

  function switchFaction(
    state: FactionEventStateV1,
    factionId: string,
    payment: Partial<Record<CurrencyId, number>>,
  ): SwitchResult {
    const faction = content.factions[factionId];
    if (!faction) return { state, ok: false, reason: "未知门派" };
    if (!state.activeFactionId) return { state, ok: false, reason: "尚未加入门派" };
    if (state.activeFactionId === factionId) return { state, ok: false, reason: "已经在该门派" };
    if (state.realm < faction.minRealm) return { state, ok: false, reason: `境界不足：需要 ${faction.minRealm}` };
    if (!canPay(state, payment)) return { state, ok: false, reason: "改换门派费用不足" };
    const next = structuredClone(state);
    pay(next, payment);
    const oldFactionId = next.activeFactionId!;
    next.reputations[oldFactionId] = clampRelationship((next.reputations[oldFactionId] ?? 0) - 15);
    next.ranks[oldFactionId] = "outsider";
    next.activeFactionId = faction.id;
    next.ranks[faction.id] = "entry";
    next.reputations[faction.id] = Math.max(10, next.reputations[faction.id] ?? 0);
    // Learned arts, items, keystones and personal NPC relationships are retained.
    inboxMood(next, {
      kind: "faction",
      title: `改投 ${faction.name}`,
      body: `旧门派声望下降，${faction.name}的 rank 重新从入门开始；已学武学保留。`,
    });
    return { state: next, ok: true, reason: "已改换门派" };
  }

  function applyReputation(state: FactionEventStateV1, deltas: ReputationDelta[]): ReputationResult {
    const next = structuredClone(state);
    for (const entry of deltas) {
      const faction = content.factions[entry.factionId];
      const before = next.reputations[entry.factionId] ?? 0;
      const after = clampRelationship(before + entry.delta);
      next.reputations[entry.factionId] = after;
      if (entry.rival !== false && faction?.rivalId) {
        const rivalDelta = -Math.round((after - before) / 2);
        next.reputations[faction.rivalId] = clampRelationship((next.reputations[faction.rivalId] ?? 0) + rivalDelta);
      }
    }
    return { state: next, ok: true, reason: "声望已更新" };
  }

  function cond(state: FactionEventStateV1, condition: EventCondition): boolean {
    switch (condition.kind) {
      case "faction":
        return state.activeFactionId === condition.factionId;
      case "rankAtLeast":
        return rankAtLeast(state.ranks[condition.factionId] ?? "outsider", condition.rank);
      case "reputationAtLeast":
        return (state.reputations[condition.factionId] ?? 0) >= condition.value;
      case "npcAtLeast":
        return npcRelationshipLevel(state.npc[condition.npcId] ?? 0) === condition.level
          || NPC_LEVELS.indexOf(npcRelationshipLevel(state.npc[condition.npcId] ?? 0)) >= NPC_LEVELS.indexOf(condition.level);
      case "realmAtLeast":
        return state.realm >= condition.realm;
      case "flag":
        return Boolean(state.flags[condition.flag]);
      case "notFlag":
        return !state.flags[condition.flag];
      case "ownsArt":
        return state.arts.includes(condition.artId);
      case "mapCleared":
        return state.unlockedMaps.includes(condition.mapId);
      default:
        return false;
    }
  }

  function conditionsMet(state: FactionEventStateV1, event: EventDefV1): boolean {
    return event.conditions.every((condition) => cond(state, condition));
  }

  function validateEffects(state: FactionEventStateV1, event: EventDefV1, choice: EventChoiceV1): string | null {
    for (const effect of choice.effects) {
      if (effect.kind === "reputation") {
        const known = content.factions[effect.factionId]
          || Object.values(content.factions).some((faction) => faction.rivalId === effect.factionId);
        if (!known) return `事件 ${event.id} 引用未知声望对象 ${effect.factionId}`;
      } else if (effect.kind === "npcRelationship") {
        if (!content.npcs[effect.npcId]) return `事件 ${event.id} 引用未知 NPC ${effect.npcId}`;
      } else if (effect.kind === "currency") {
        if (effect.delta < 0 && balanceOf(state, effect.currency) < -effect.delta) {
          return "资源不足";
        }
      } else if (effect.kind === "art") {
        if (!content.catalog.arts.includes(effect.artId)) return `事件 ${event.id} 引用未知武学 ${effect.artId}`;
      } else if (effect.kind === "item") {
        if (!content.catalog.items.includes(effect.itemId)) return `事件 ${event.id} 引用未知物品 ${effect.itemId}`;
      } else if (effect.kind === "shopUnlock") {
        if (!content.shops[effect.shopId]) return `事件 ${event.id} 引用未知商店 ${effect.shopId}`;
      } else if (effect.kind === "mapUnlock") {
        if (!content.catalog.maps.includes(effect.mapId)) return `事件 ${event.id} 引用未知地图 ${effect.mapId}`;
      } else if (effect.kind === "companionHook") {
        if (!content.catalog.companions.includes(effect.companionId)) return `事件 ${event.id} 引用未知同伴 ${effect.companionId}`;
      }
    }
    return null;
  }

  function applyEffects(next: FactionEventStateV1, effects: EventEffect[]): void {
    for (const effect of effects) {
      switch (effect.kind) {
        case "reputation": {
          const faction = content.factions[effect.factionId];
          const before = next.reputations[effect.factionId] ?? 0;
          const after = clampRelationship(before + effect.delta);
          next.reputations[effect.factionId] = after;
          if (effect.rival !== false && faction?.rivalId) {
            next.reputations[faction.rivalId] = clampRelationship((next.reputations[faction.rivalId] ?? 0) - Math.round((after - before) / 2));
          }
          break;
        }
        case "npcRelationship":
          next.npc[effect.npcId] = clampRelationship((next.npc[effect.npcId] ?? 0) + effect.delta);
          break;
        case "currency":
          if (effect.delta >= 0) gain(next, effect.currency, effect.delta);
          else next.balances[effect.currency] = balanceOf(next, effect.currency) + effect.delta;
          break;
        case "art":
          addUnique(next.arts, effect.artId);
          break;
        case "item":
          addUnique(next.items, effect.itemId);
          break;
        case "flag":
          next.flags[effect.flag] = true;
          break;
        case "clearFlag":
          delete next.flags[effect.flag];
          break;
        case "title":
          addUnique(next.titles, effect.title);
          break;
        case "shopUnlock":
          addUnique(next.unlockedShops, effect.shopId);
          break;
        case "mapUnlock":
          addUnique(next.unlockedMaps, effect.mapId);
          break;
        case "companionHook":
          addUnique(next.companionHooks, effect.companionId);
          break;
      }
    }
  }

  function applyChoice(state: FactionEventStateV1, eventId: string, choiceId: string): EventResult {
    const event = content.events[eventId];
    if (!event) return { state, ok: false, applied: false, reason: "未知事件" };
    if (event.once && state.firedEvents.includes(event.id)) {
      return { state, ok: false, applied: false, reason: "该事件已结束" };
    }
    if (!conditionsMet(state, event)) return { state, ok: false, applied: false, reason: "事件条件未满足" };
    const choice = event.choices.find((entry) => entry.id === choiceId);
    if (!choice) return { state, ok: false, applied: false, reason: "未知选项" };
    const invalid = validateEffects(state, event, choice);
    if (invalid) return { state, ok: false, applied: false, reason: invalid };
    const next = structuredClone(state);
    applyEffects(next, choice.effects);
    next.pendingEvents = next.pendingEvents.filter((id) => id !== event.id);
    next.deferredEvents = next.deferredEvents.filter((id) => id !== event.id);
    if (event.once) addUnique(next.firedEvents, event.id);
    if (event.cooldownHours) next.cooldowns[event.id] = next.clock + event.cooldownHours;
    const log: EventLogEntryV1 = {
      eventId: event.id,
      choiceId: choice.id,
      title: event.title,
      text: choice.text,
      clock: next.clock,
    };
    next.eventLog.push(log);
    if (next.eventLog.length > 80) next.eventLog.shift();
    inboxMood(next, {
      kind: "event",
      title: event.title,
      body: choice.text,
      eventId: event.id,
    });
    return { state: next, ok: true, applied: true, reason: "选择已记录", log };
  }

  function eligible(state: FactionEventStateV1, event: EventDefV1, triggerMatcher?: (trigger: EventTrigger) => boolean): boolean {
    if (event.once && state.firedEvents.includes(event.id)) return false;
    if (state.pendingEvents.includes(event.id) || state.deferredEvents.includes(event.id)) return false;
    if ((state.cooldowns[event.id] ?? 0) > state.clock) return false;
    if (!conditionsMet(state, event)) return false;
    return triggerMatcher ? triggerMatcher(event.trigger) : true;
  }

  function queueOfflineEvents(state: FactionEventStateV1, seed: number, max = 3): PendingResult {
    const slots = Math.max(0, Math.min(3, max) - state.pendingEvents.length);
    if (slots === 0) return { state, events: [] };
    const candidates = Object.values(content.events)
      .filter((event) => event.trigger.kind === "offlineReturn" && eligible(state, event))
      .sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1) || a.id.localeCompare(b.id));
    const rng = new Rng(seed);
    const chosen = rng.shuffle(candidates).slice(0, slots);
    const next = structuredClone(state);
    next.pendingEvents.push(...chosen.map((event) => event.id));
    return { state: next, events: chosen };
  }

  function pendingOfflineEvents(state: FactionEventStateV1): EventDefV1[] {
    return state.pendingEvents.map((id) => content.events[id]).filter((event): event is EventDefV1 => Boolean(event));
  }

  function deferPending(state: FactionEventStateV1, eventId: string): PendingResult {
    if (!state.pendingEvents.includes(eventId)) return { state, events: pendingOfflineEvents(state) };
    const next = structuredClone(state);
    next.pendingEvents = next.pendingEvents.filter((id) => id !== eventId);
    addUnique(next.deferredEvents, eventId);
    inboxMood(next, {
      kind: "event",
      title: "江湖帖暂存",
      body: "你把这件事记在江湖帖里，稍后再决断。",
      eventId,
    });
    return { state: next, events: pendingOfflineEvents(next) };
  }

  function randomEvent(state: FactionEventStateV1, trigger: EventTrigger, seed: number): RandomEventResult {
    if (state.pendingEvents.length >= 3) return { state, reason: "江湖帖已有 3 个待决事件" };
    if (state.clock < state.randomCooldownUntil) return { state, reason: "随机事件冷却中" };
    const candidates = Object.values(content.events)
      .filter((event) => event.trigger.kind === trigger.kind && eligible(state, event))
      .filter((event) => {
        if (trigger.kind === "randomTravel" || trigger.kind === "randomFight") {
          if (trigger.region && event.region !== trigger.region) return false;
        }
        return true;
      });
    if (candidates.length === 0) return { state, reason: "没有可触发事件" };
    const rng = new Rng(seed);
    const event = rng.weighted(candidates, candidates.map((entry) => entry.weight ?? 1));
    const next = structuredClone(state);
    next.pendingEvents.push(event.id);
    next.randomCooldownUntil = next.clock + 4;
    next.cooldowns[event.id] = next.clock + (event.cooldownHours ?? 24);
    return { state: next, event, reason: "触发事件" };
  }

  function advanceClock(state: FactionEventStateV1, hours: number): FactionEventStateV1 {
    const next = structuredClone(state);
    next.clock += Math.max(0, hours);
    for (const id of Object.keys(next.cooldowns)) {
      if (next.cooldowns[id] <= next.clock) delete next.cooldowns[id];
    }
    return next;
  }

  function factionShopStock(state: FactionEventStateV1, factionId: string): FactionShopSkuV1[] {
    if (state.activeFactionId !== factionId) return [];
    const rank = state.ranks[factionId] ?? "outsider";
    return Object.values(content.shops)
      .filter((shop) => shop.factionId === factionId && rankAtLeast(rank, shop.rank))
      .filter((shop) => (state.shopStock[shop.id] ?? shop.stock) > 0);
  }

  function buyFactionShop(state: FactionEventStateV1, skuId: string): ShopResult {
    const shop = content.shops[skuId];
    if (!shop) return { state, ok: false, reason: "未知门派商品" };
    if (state.activeFactionId !== shop.factionId) return { state, ok: false, reason: "不在该门派" };
    if (!rankAtLeast(state.ranks[shop.factionId] ?? "outsider", shop.rank)) {
      return { state, ok: false, reason: "门派 rank 不足" };
    }
    if ((state.shopStock[shop.id] ?? shop.stock) <= 0) return { state, ok: false, reason: "库存不足" };
    if (!canPay(state, shop.price)) return { state, ok: false, reason: "资源不足" };
    const next = structuredClone(state);
    pay(next, shop.price);
    next.shopStock[shop.id] = (next.shopStock[shop.id] ?? shop.stock) - 1;
    if (shop.artId) addUnique(next.arts, shop.artId);
    if (shop.itemId) addUnique(next.items, shop.itemId);
    addUnique(next.unlockedShops, shop.id);
    return { state: next, ok: true, reason: "已购买" };
  }

  function npcDialogue(state: FactionEventStateV1, npcId: string): { level: NpcRelationshipLevel; text: string } | null {
    const npc = content.npcs[npcId];
    if (!npc) return null;
    const level = npcRelationshipLevel(state.npc[npcId] ?? 0);
    const keys = NPC_LEVELS.filter((key) => npc.dialogue[key]);
    let text = npc.dialogue.stranger ?? `${npc.name}看了你一眼，没有说话。`;
    for (const key of keys) {
      if (NPC_LEVELS.indexOf(key) <= NPC_LEVELS.indexOf(level)) text = npc.dialogue[key]!;
    }
    return { level, text };
  }

  function npcQuests(state: FactionEventStateV1, npcId: string): string[] {
    const npc = content.npcs[npcId];
    if (!npc) return [];
    const level = npcRelationshipLevel(state.npc[npcId] ?? 0);
    const quests: string[] = [];
    if (NPC_LEVELS.indexOf(level) >= NPC_LEVELS.indexOf("acquaintance")) quests.push(`${npc.name}·相识`);
    if (NPC_LEVELS.indexOf(level) >= NPC_LEVELS.indexOf("trust")) quests.push(npc.personalThread);
    if (NPC_LEVELS.indexOf(level) >= NPC_LEVELS.indexOf("confidant")) quests.push(`${npc.name}·知己之托`);
    return quests;
  }

  function validateContent(factionContent: FactionEventContentV1): FactionValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (Object.keys(factionContent.factions).length !== 5) errors.push("必须恰好 5 个门派");
    if (Object.keys(factionContent.npcs).length < 20) errors.push("至少需要 20 名主要 NPC");
    if (Object.keys(factionContent.events).length < 12) errors.push("至少需要 12 个事件");
    if (Object.keys(factionContent.events).length < 50) warnings.push("事件数量低于 50–60 的目标，但 v1 允许较小验证集");
    const factionIds = new Set(Object.keys(factionContent.factions));
    const reputationIds = new Set([...factionIds, ...Object.values(factionContent.factions).map((faction) => faction.rivalId)]);
    for (const faction of Object.values(factionContent.factions)) {
      if (!faction.stance || !faction.specialty) errors.push(`门派 ${faction.id} 缺少立场/专长`);
      if (!faction.inviteFlag) errors.push(`门派 ${faction.id} 缺少邀请 flag`);
      for (const shopId of faction.shopIds) {
        if (!factionContent.shops[shopId]) errors.push(`门派 ${faction.id} 引用未知商店 ${shopId}`);
      }
    }
    const npcIds = new Set(Object.keys(factionContent.npcs));
    for (const npc of Object.values(factionContent.npcs)) {
      if (!npcIds.has(npc.id)) errors.push(`未知 NPC ${npc.id}`);
      if (!factionContent.catalog.maps.includes(npc.mapId)) errors.push(`NPC ${npc.id} 的位置不存在：${npc.mapId}`);
      if (!npc.personalThread) errors.push(`NPC ${npc.id} 缺少个人线`);
    }
    const chainEvents = new Map<string, EventDefV1[]>();
    for (const event of Object.values(factionContent.events)) {
      if (!npcIds.has(event.speakerId)) errors.push(`事件 ${event.id} 的 speaker 不存在：${event.speakerId}`);
      if (!factionContent.catalog.maps.includes(event.locationMapId)) errors.push(`事件 ${event.id} 的 location 不存在`);
      if (event.choices.length < 1 || event.choices.length > 3) errors.push(`事件 ${event.id} 必须有 1–3 个选项`);
      if (!event.text || event.text.length < 20) warnings.push(`事件 ${event.id} 文本过短`);
      if (event.trigger.kind === "regionEntry" && !event.region) errors.push(`事件 ${event.id} 缺少地区`);
      let systemic = false;
      for (const choice of event.choices) {
        if (choice.effects.length === 0) errors.push(`事件 ${event.id} 的选项 ${choice.id} 没有系统效果`);
        else systemic = true;
        const grantedArts = choice.effects.filter((effect) => effect.kind === "art").map((effect) => effect.artId);
        if (new Set(grantedArts).size !== grantedArts.length) errors.push(`事件 ${event.id} 的选项 ${choice.id} 重复发同一武学`);
        for (const effect of choice.effects) {
          if (effect.kind === "art" && !factionContent.catalog.arts.includes(effect.artId)) {
            errors.push(`事件 ${event.id} 引用未知武学 ${effect.artId}`);
          }
          if (effect.kind === "item" && !factionContent.catalog.items.includes(effect.itemId)) {
            errors.push(`事件 ${event.id} 引用未知物品 ${effect.itemId}`);
          }
          if (effect.kind === "shopUnlock" && !factionContent.shops[effect.shopId]) {
            errors.push(`事件 ${event.id} 引用未知商店 ${effect.shopId}`);
          }
          if (effect.kind === "mapUnlock" && !factionContent.catalog.maps.includes(effect.mapId)) {
            errors.push(`事件 ${event.id} 引用未知地图 ${effect.mapId}`);
          }
          if (effect.kind === "companionHook" && !factionContent.catalog.companions.includes(effect.companionId)) {
            errors.push(`事件 ${event.id} 引用未知同伴 ${effect.companionId}`);
          }
          if (effect.kind === "reputation" && !reputationIds.has(effect.factionId)) {
            errors.push(`事件 ${event.id} 引用未知声望对象 ${effect.factionId}`);
          }
          if (effect.kind === "npcRelationship" && !npcIds.has(effect.npcId)) {
            errors.push(`事件 ${event.id} 引用未知 NPC ${effect.npcId}`);
          }
        }
      }
      if (!systemic) errors.push(`事件 ${event.id} 没有系统效果`);
      if (event.chainId) {
        const list = chainEvents.get(event.chainId) ?? [];
        list.push(event);
        chainEvents.set(event.chainId, list);
      }
    }
    for (const [chainId, events] of chainEvents) {
      if (!events.some((event) => event.chainEnd)) errors.push(`事件链 ${chainId} 没有可达的结局/放弃事件`);
      if (events.length < 2) warnings.push(`事件链 ${chainId} 只有 1 个事件`);
    }
    const offlineEvents = Object.values(factionContent.events).filter((event) => event.trigger.kind === "offlineReturn");
    if (offlineEvents.length === 0) errors.push("至少需要一个离线事件");
    for (const shop of Object.values(factionContent.shops)) {
      if (!factionIds.has(shop.factionId)) errors.push(`商店 ${shop.id} 引用未知门派`);
      if (shop.stock < 0) errors.push(`商店 ${shop.id} 库存非法`);
      if (shop.artId && !factionContent.catalog.arts.includes(shop.artId)) errors.push(`商店 ${shop.id} 引用未知武学`);
      if (shop.itemId && !factionContent.catalog.items.includes(shop.itemId)) errors.push(`商店 ${shop.id} 引用未知物品`);
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  function save(state: FactionEventStateV1): string {
    return JSON.stringify(state);
  }

  function load(serialized: string): FactionEventStateV1 {
    return structuredClone(JSON.parse(serialized) as FactionEventStateV1);
  }

  return {
    createState,
    join,
    switchFaction,
    applyReputation,
    applyChoice,
    pendingOfflineEvents,
    queueOfflineEvents,
    deferPending,
    randomEvent,
    advanceClock,
    factionShopStock,
    buyFactionShop,
    npcDialogue,
    npcQuests,
    validateContent,
    save,
    load,
  };
}
