import { Rng } from "./rng.ts";

// ---------------------------------------------------------------------------
// Economy & Time Budget v1
//
// One pure seam for quotes, atomic spends, grants, caps and offline settlement.
// ---------------------------------------------------------------------------

export type CurrencyId =
  | "silver"
  | "cultivation"
  | "renown"
  | "factionRep"
  | "tianji"
  | "pages"
  | "annotations"
  | "manuals"
  | "materials"
  | "tokens"
  | "pills";

export const CURRENCY_IDS: CurrencyId[] = [
  "silver",
  "cultivation",
  "renown",
  "factionRep",
  "tianji",
  "pages",
  "annotations",
  "manuals",
  "materials",
  "tokens",
  "pills",
];

export const CURRENCY_NAMES: Record<CurrencyId, string> = {
  silver: "银两",
  cultivation: "修为",
  renown: "名望",
  factionRep: "门派声望",
  tianji: "天机积分",
  pages: "武学残页",
  annotations: "心法注解",
  manuals: "内功秘籍",
  materials: "材料",
  tokens: "同伴信物",
  pills: "丹药",
};

export interface CurrencyMeta {
  id: CurrencyId;
  sources: string[];
  sinks: string[];
  cap: string;
  cosmeticOnly?: boolean;
}

export type EconomyAction =
  | { kind: "refine"; level: number; itemTier: number }
  | { kind: "reforge"; itemTier: number }
  | { kind: "respec"; realm: number }
  | { kind: "potion"; count: number }
  | { kind: "travel"; tier: number }
  | { kind: "breakthrough"; realm: number }
  | { kind: "craft"; materialTier: number }
  | { kind: "shop"; skuId: string };

export interface CostQuote {
  action: EconomyAction;
  costs: Partial<Record<CurrencyId, number>>;
  grants?: Partial<Record<CurrencyId, number>>;
  ok: boolean;
  affordable: boolean;
  reason: string;
}

export interface ShopSku {
  id: string;
  name: string;
  description: string;
  costs: Partial<Record<CurrencyId, number>>;
  grants?: Partial<Record<CurrencyId, number>>;
  stock: number;
  minRenown: number;
  minRealm: number;
}

export interface EconomyContent {
  currencies: Record<CurrencyId, CurrencyMeta>;
  cultivationCaps: number[];
  offline: { rate: number; capHours: number; overflowRate: number };
  shop: Record<string, ShopSku>;
  priceVersion: string;
  salvageFraction: number;
}

export interface EconomyState {
  balances: Record<CurrencyId, number>;
  caps: Partial<Record<CurrencyId, number>>;
  shop: Record<string, { stock: number; purchased: number }>;
  priceVersion: string;
  season: { id: string; tianjiSpent: number; cap: number };
  realm: number;
  pity: Record<string, number>;
  warnings: string[];
}

export interface GrantResult {
  state: EconomyState;
  granted: Partial<Record<CurrencyId, number>>;
  convertedSilver: number;
  warnings: string[];
  ok: boolean;
  reason: string;
}

export interface ApplyResult {
  state: EconomyState;
  applied: boolean;
  quote: CostQuote;
  reason: string;
}

export interface OfflineInput {
  hours: number;
  rewardsPerHour: Partial<Record<CurrencyId, number>>;
  stopAtHours?: number;
  stoppedBy?: string;
}

export interface OfflineResult {
  hoursRequested: number;
  hoursSettled: number;
  effectiveHours: number;
  rate: number;
  capHours: number;
  rewards: Partial<Record<CurrencyId, number>>;
  stoppedBy: string | null;
  warnings: string[];
}

export interface EconomyService {
  quote(state: EconomyState, action: EconomyAction): CostQuote;
  canAfford(state: EconomyState, quote: CostQuote): boolean;
  apply(state: EconomyState, action: EconomyAction): ApplyResult;
  grant(state: EconomyState, rewards: Partial<Record<CurrencyId, number>>): GrantResult;
  capFor(state: EconomyState, currency: CurrencyId): number;
  nearCap(state: EconomyState, currency: CurrencyId, threshold?: number): boolean;
  offline(input: OfflineInput): OfflineResult;
  validateContent(content: EconomyContent): { ok: boolean; errors: string[] };
  save(state: EconomyState): string;
  load(serialized: string): EconomyState;
}

export function emptyBalances(): Record<CurrencyId, number> {
  return {
    silver: 0,
    cultivation: 0,
    renown: 0,
    factionRep: 0,
    tianji: 0,
    pages: 0,
    annotations: 0,
    manuals: 0,
    materials: 0,
    tokens: 0,
    pills: 0,
  };
}

export function createEconomyState(content: EconomyContent): EconomyState {
  const shop: EconomyState["shop"] = {};
  for (const sku of Object.values(content.shop)) {
    shop[sku.id] = { stock: sku.stock, purchased: 0 };
  }
  return {
    balances: emptyBalances(),
    caps: {},
    shop,
    priceVersion: content.priceVersion,
    season: { id: "season-1", tianjiSpent: 0, cap: 5000 },
    realm: 0,
    pity: {},
    warnings: [],
  };
}

function costsPositive(costs: Partial<Record<CurrencyId, number>>): boolean {
  return Object.values(costs).every((value) => typeof value === "number" && value >= 0);
}

export function createEconomy(content: EconomyContent): EconomyService {
  function cultivationCap(realm: number): number {
    const index = Math.max(0, Math.min(content.cultivationCaps.length - 1, realm));
    return content.cultivationCaps[index];
  }

  function capFor(state: EconomyState, currency: CurrencyId): number {
    if (state.caps[currency] !== undefined) return state.caps[currency]!;
    if (currency === "cultivation") return cultivationCap(state.realm);
    if (currency === "silver" || currency === "renown") return Number.POSITIVE_INFINITY;
    if (currency === "tianji") return state.season.cap;
    if (currency === "factionRep") return 10000;
    if (currency === "pages" || currency === "annotations" || currency === "manuals" || currency === "tokens" || currency === "pills") return 99;
    if (currency === "materials") return 999;
    return 9999;
  }

  function shopSku(action: Extract<EconomyAction, { kind: "shop" }>): ShopSku | undefined {
    return content.shop[action.skuId];
  }

  function quote(state: EconomyState, action: EconomyAction): CostQuote {
    let costs: Partial<Record<CurrencyId, number>> = {};
    let grants: Partial<Record<CurrencyId, number>> | undefined;
    let ok = true;
    let reason = "可执行";
    switch (action.kind) {
      case "refine":
        costs = {
          silver: Math.round(80 * Math.pow(1.36, action.level) * (1 + action.itemTier * 0.2)),
          materials: 1 + Math.floor(action.level / 3),
        };
        break;
      case "reforge":
        costs = { silver: 120 + action.itemTier * 40, materials: 1 + action.itemTier };
        break;
      case "respec":
        costs = { silver: 300, pills: 1 };
        break;
      case "potion":
        costs = { silver: 50 * action.count, materials: action.count };
        grants = { pills: action.count };
        break;
      case "travel":
        costs = { silver: 20 * action.tier };
        break;
      case "breakthrough":
        costs = {
          renown: Math.round(100 * Math.pow(2, action.realm)),
          pills: 1,
          materials: 5,
        };
        break;
      case "craft":
        costs = { silver: 100 * action.materialTier, materials: 10 * action.materialTier };
        break;
      case "shop": {
        const sku = shopSku(action);
        if (!sku) {
          ok = false;
          reason = "未知商品";
          break;
        }
        const stock = state.shop[sku.id] ?? { stock: 0, purchased: 0 };
        if (stock.stock <= 0) {
          ok = false;
          reason = "库存不足";
        } else if (state.realm < sku.minRealm) {
          ok = false;
          reason = `境界不足：需要 ${sku.minRealm}`;
        } else if (state.balances.renown < sku.minRenown) {
          ok = false;
          reason = `名望不足：需要 ${sku.minRenown}`;
        }
        costs = { ...sku.costs };
        grants = sku.grants;
        break;
      }
      default:
        ok = false;
        reason = "未知经济动作";
    }
    if (!costsPositive(costs)) {
      ok = false;
      reason = "价格非法";
    }
    const affordable = ok && Object.entries(costs).every(([currency, value]) => (
      state.balances[currency as CurrencyId] >= (value ?? 0)
    ));
    if (ok && !affordable) reason = "资源不足";
    return { action, costs, grants, ok, affordable, reason: ok ? (affordable ? reason : "资源不足") : reason };
  }

  function canAfford(state: EconomyState, quoteResult: CostQuote): boolean {
    return quoteResult.ok && quoteResult.affordable;
  }

  function apply(state: EconomyState, action: EconomyAction): ApplyResult {
    const quoteResult = quote(state, action);
    if (!quoteResult.ok || !quoteResult.affordable) {
      return { state, applied: false, quote: quoteResult, reason: quoteResult.reason };
    }
    const next = structuredClone(state);
    for (const [currency, value] of Object.entries(quoteResult.costs)) {
      next.balances[currency as CurrencyId] -= value ?? 0;
    }
    if (quoteResult.grants) {
      for (const [currency, value] of Object.entries(quoteResult.grants)) {
        next.balances[currency as CurrencyId] += value ?? 0;
      }
    }
    if (action.kind === "shop") {
      const stock = next.shop[action.skuId];
      if (stock) {
        stock.stock = Math.max(0, stock.stock - 1);
        stock.purchased += 1;
      }
    }
    return { state: next, applied: true, quote: quoteResult, reason: "已扣款" };
  }

  function grant(state: EconomyState, rewards: Partial<Record<CurrencyId, number>>): GrantResult {
    const next = structuredClone(state);
    const warnings: string[] = [];
    let convertedSilver = 0;
    let ok = true;
    let reason = "已入账";
    for (const [currency, value] of Object.entries(rewards)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        ok = false;
        reason = `非法货币数量：${currency}`;
        continue;
      }
      const id = currency as CurrencyId;
      const cap = capFor(next, id);
      const before = next.balances[id];
      const after = before + value;
      if (Number.isFinite(cap) && after > cap) {
        const overflow = after - cap;
        next.balances[id] = cap;
        if (id === "cultivation") {
          const silver = Math.floor(overflow * content.offline.overflowRate);
          convertedSilver += silver;
          next.balances.silver += silver;
          warnings.push(`修为达到上限 ${cap}，溢出 ${overflow} 转为 ${silver} 银两`);
        } else if (id === "tianji") {
          next.season.tianjiSpent = Math.min(next.season.cap, next.season.tianjiSpent + overflow);
          warnings.push(`天机积分达到赛季上限 ${cap}，溢出 ${overflow} 不转为战力`);
        } else {
          warnings.push(`${CURRENCY_NAMES[id]}达到上限 ${cap}，溢出 ${overflow}`);
        }
      } else {
        next.balances[id] = after;
      }
    }
    next.warnings = [...next.warnings.slice(-20), ...warnings];
    return { state: next, granted: rewards, convertedSilver, warnings, ok, reason };
  }

  function nearCap(state: EconomyState, currency: CurrencyId, threshold = 0.9): boolean {
    const cap = capFor(state, currency);
    if (!Number.isFinite(cap) || cap <= 0) return false;
    return state.balances[currency] >= cap * threshold;
  }

  function offline(input: OfflineInput): OfflineResult {
    const requested = Math.max(0, input.hours);
    const settled = input.stopAtHours !== undefined
      ? Math.min(requested, Math.max(0, input.stopAtHours))
      : requested;
    const effectiveHours = Math.min(settled, content.offline.capHours) * content.offline.rate;
    const rewards: Partial<Record<CurrencyId, number>> = {};
    const warnings: string[] = [];
    if (settled > content.offline.capHours) {
      warnings.push(`离线收益按 ${content.offline.capHours}h 上限结算`);
    }
    for (const [currency, perHour] of Object.entries(input.rewardsPerHour)) {
      if (typeof perHour !== "number") continue;
      rewards[currency as CurrencyId] = Math.floor(perHour * effectiveHours);
    }
    return {
      hoursRequested: requested,
      hoursSettled: settled,
      effectiveHours,
      rate: content.offline.rate,
      capHours: content.offline.capHours,
      rewards,
      stoppedBy: input.stoppedBy ?? null,
      warnings,
    };
  }

  function validateContent(economy: EconomyContent): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const currency of CURRENCY_IDS) {
      const meta = economy.currencies[currency];
      if (!meta) {
        errors.push(`缺少货币元数据：${currency}`);
        continue;
      }
      if (meta.sources.length === 0) errors.push(`${currency} 没有来源`);
      if (meta.sinks.length === 0) errors.push(`${currency} 没有消耗`);
    }
    if (!(economy.offline.rate > 0 && economy.offline.rate <= 1)) errors.push("离线比例必须在 0–1");
    if (economy.offline.capHours <= 0) errors.push("离线上限必须为正");
    if (!(economy.salvageFraction > 0 && economy.salvageFraction < 1)) errors.push("回收系数必须低于商店价");
    for (const sku of Object.values(economy.shop)) {
      if (!costsPositive(sku.costs)) errors.push(`商店 ${sku.id} 价格非法`);
      if (sku.stock < 0) errors.push(`商店 ${sku.id} 库存非法`);
    }
    return { ok: errors.length === 0, errors };
  }

  function save(state: EconomyState): string {
    return JSON.stringify(state);
  }

  function load(serialized: string): EconomyState {
    return structuredClone(JSON.parse(serialized) as EconomyState);
  }

  return {
    quote,
    canAfford,
    apply,
    grant,
    capFor,
    nearCap,
    offline,
    validateContent,
    save,
    load,
  };
}

export interface EconomyStressPoint {
  hour: number;
  silver: number;
  cultivation: number;
  renown: number;
  materials: number;
  spent: number;
}

export interface EconomyStressResult {
  seed: number;
  hours: number;
  points: EconomyStressPoint[];
  final: EconomyState;
  totalGranted: number;
  totalSpent: number;
  warnings: string[];
  zeroSinkCurrencies: CurrencyId[];
  negativeBalances: CurrencyId[];
  maxSilver: number;
  silverPerHour: number[];
}

/**
 * Seeded long-run economy stress. It exercises grants and every spend action
 * without a combat loop, so 500h conservation checks stay fast and repeatable.
 */
export function stressEconomy(
  economy: EconomyService,
  content: EconomyContent,
  seed: number,
  hours: number,
): EconomyStressResult {
  const rng = new Rng(seed);
  let state = createEconomyState(content);
  const points: EconomyStressPoint[] = [];
  const warnings: string[] = [];
  let totalGranted = 0;
  let totalSpent = 0;
  const startSilver = state.balances.silver;
  for (let hour = 1; hour <= hours; hour += 1) {
    state.realm = Math.min(6, Math.floor(hour / 40));
    const reward = {
      silver: 40 + Math.round(rng.next() * 40),
      cultivation: 30 + Math.round(rng.next() * 30),
      renown: 2 + Math.round(rng.next() * 3),
      materials: rng.chance(0.5) ? 2 : 0,
      pages: rng.chance(0.2) ? 1 : 0,
      annotations: rng.chance(0.15) ? 1 : 0,
      manuals: rng.chance(0.05) ? 1 : 0,
      tokens: rng.chance(0.05) ? 1 : 0,
    };
    totalGranted += reward.silver;
    const granted = economy.grant(state, reward);
    state = granted.state;
    warnings.push(...granted.warnings);
    const actions: EconomyAction[] = [];
    if (hour % 3 === 0) actions.push({ kind: "refine", level: hour % 10, itemTier: Math.min(5, 1 + Math.floor(hour / 100)) });
    if (hour % 16 === 0) actions.push({ kind: "travel", tier: Math.min(6, 1 + Math.floor(hour / 80)) });
    if (hour % 12 === 0) actions.push({ kind: "potion", count: 1 });
    if (hour % 24 === 0) actions.push({ kind: "craft", materialTier: Math.min(5, 1 + Math.floor(hour / 100)) });
    if (hour % 96 === 0) actions.push({ kind: "respec", realm: state.realm });
    if (hour % 192 === 0) actions.push({ kind: "breakthrough", realm: state.realm });
    if (hour % 144 === 0) actions.push({ kind: "shop", skuId: "sku_annotation" });
    for (const action of actions) {
      const applied = economy.apply(state, action);
      if (applied.applied) {
        totalSpent += Object.values(applied.quote.costs).reduce((sum, value) => sum + (value ?? 0), 0);
        state = applied.state;
      }
    }
    if (hour % 10 === 0 || hour === hours) {
      points.push({
        hour,
        silver: state.balances.silver,
        cultivation: state.balances.cultivation,
        renown: state.balances.renown,
        materials: state.balances.materials,
        spent: totalSpent,
      });
    }
  }
  const negativeBalances = CURRENCY_IDS.filter((currency) => state.balances[currency] < 0);
  const zeroSinkCurrencies = CURRENCY_IDS.filter((currency) => content.currencies[currency]?.sinks.length === 0);
  const silverPerHour = points.map((point, index) => {
    const previous = index === 0 ? startSilver : points[index - 1].silver;
    const hoursDelta = index === 0 ? point.hour : point.hour - points[index - 1].hour;
    return (point.silver - previous) / hoursDelta;
  });
  return {
    seed,
    hours,
    points,
    final: state,
    totalGranted,
    totalSpent,
    warnings,
    zeroSinkCurrencies,
    negativeBalances,
    maxSilver: Math.max(...points.map((point) => point.silver)),
    silverPerHour,
  };
}
