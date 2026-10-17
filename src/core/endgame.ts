import type { BuildId, RegionId } from "./types.ts";
import type { BattleModifier, BattleResult, Element } from "./combat-v1.ts";
import { Rng } from "./rng.ts";

// ---------------------------------------------------------------------------
// Endgame, Ranks & Seasons v1
//
// NPC-only 天机榜, 8-week soft-reset seasons, 武林大会 rulesets, 江湖志 and
// optional 归隐. All combat is resolved by resolveBattle outside this seam.
// ---------------------------------------------------------------------------

export type LadderStyle = "gang" | "rou" | "kuai" | "gui";
export type CodexCategory =
  | "region"
  | "map"
  | "npc"
  | "martial_art"
  | "inner_art"
  | "heart"
  | "keystone"
  | "monster"
  | "elite"
  | "boss"
  | "event"
  | "companion"
  | "ending";

export interface EndgameRewardV1 {
  tianji?: number;
  title?: string;
  cosmetic?: string;
  codexEntryId?: string;
}

export interface LadderOpponentSeedV1 {
  name: string;
  factionId: string;
  buildId: BuildId;
  style: LadderStyle;
  element: Element;
  title: string;
  barb: string;
}

export interface LadderOpponentV1 extends LadderOpponentSeedV1 {
  id: string;
  rank: number;
  powerBand: number;
  reward: EndgameRewardV1;
  intel: string;
}

export interface CodexEntryDefV1 {
  id: string;
  category: CodexCategory;
  title: string;
  sourceHint: string;
}

export interface TournamentRulesetV1 {
  id: string;
  name: string;
  description: string;
  modifiers: BattleModifier[];
  cosmeticReward: string;
}

export interface SeasonConfigV1 {
  weeks: number;
  softResetPercent: number;
  softResetPlaces: number;
  epochMs: number;
}

export interface RetireConfigV1 {
  requiredRealm: number;
  keepArts: 1;
  keepCompanions: 1;
  keepTitles: 1;
}

export interface EndgameContentV1 {
  ladderSize: number;
  topOpponents: LadderOpponentSeedV1[];
  nameParts: { surnames: string[]; givenNames: string[]; factions: string[]; titles: string[]; barbs: string[] };
  codex: CodexEntryDefV1[];
  tournaments: Record<string, TournamentRulesetV1>;
  season: SeasonConfigV1;
  retire: RetireConfigV1;
  challengeCost: number;
  /** Cosmetic-only currency cap, e.g. 天机积分. */
  tianjiCap: number;
}

export interface LegacyChoiceV1 {
  artId: string;
  companionId: string;
  title: string;
}

export interface EndgameStateV1 {
  seed: number;
  rank: number;
  seasonIndex: number;
  defeated: string[];
  scouting: Record<string, true>;
  titles: string[];
  tianji: number;
  codex: Record<string, true>;
  seasonRewards: string[];
  tournamentScores: Record<string, number>;
  lastChallenge: { opponentId: string; win: boolean; rank: number } | null;
  silver: number;
  realm: number;
  ownedArts: string[];
  companionBonds: Record<string, number>;
  retired: boolean;
  legacy: LegacyChoiceV1 | null;
  challengeDiscount: number;
}

export interface LadderViewV1 {
  rank: number;
  seasonIndex: number;
  next: LadderOpponentV1 | null;
  scoutedNext: boolean;
  challengeCost: number;
  defeated: number;
}

export interface ChallengeResult {
  state: EndgameStateV1;
  ok: boolean;
  win: boolean;
  opponent?: LadderOpponentV1;
  reward?: EndgameRewardV1;
  rank: number;
  reason: string;
}

export interface SeasonViewV1 {
  seasonIndex: number;
  week: number;
  weeks: number;
  startedAt: number;
  endsAt: number;
  softResetAt: string;
}

export interface SeasonResetResult {
  state: EndgameStateV1;
  oldRank: number;
  newRank: number;
  oldSeason: number;
  newSeason: number;
  preserved: string[];
  reset: string[];
}

export interface CodexEntryViewV1 extends CodexEntryDefV1 {
  discovered: boolean;
}

export interface CodexTierV1 {
  category: CodexCategory;
  discovered: number;
  total: number;
  percent: number;
  tier: "empty" | "bronze" | "silver" | "gold" | "complete";
}

export interface CodexViewV1 {
  entries: CodexEntryViewV1[];
  overall: { discovered: number; total: number; percent: number; tier: CodexTierV1["tier"] };
  categories: CodexTierV1[];
}

export interface CodexResult {
  state: EndgameStateV1;
  ok: boolean;
  alreadyDiscovered: boolean;
  entry?: CodexEntryDefV1;
  reason: string;
}

export interface TournamentResult {
  state: EndgameStateV1;
  ok: boolean;
  score: number;
  reward?: EndgameRewardV1;
  ruleset?: TournamentRulesetV1;
  reason: string;
}

export interface RetireResult {
  state: EndgameStateV1;
  ok: boolean;
  kept: LegacyChoiceV1 | null;
  reset: string[];
  reason: string;
}

export interface EndgameValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface EndgameService {
  createState(seed: number, ladderSize?: number): EndgameStateV1;
  ladder(state: EndgameStateV1): LadderViewV1;
  generateLadder(state: EndgameStateV1): LadderOpponentV1[];
  scout(state: EndgameStateV1, opponentId: string): { state: EndgameStateV1; opponent?: LadderOpponentV1; intel: string; reason: string };
  challenge(state: EndgameStateV1, opponentId: string, battle: BattleResult): ChallengeResult;
  seasonState(state: EndgameStateV1, now?: number): SeasonViewV1;
  seasonAt(now: number): number;
  applySeasonReset(state: EndgameStateV1, seasonIndex: number): SeasonResetResult;
  tournamentRules(id: string): TournamentRulesetV1 | null;
  recordTournament(state: EndgameStateV1, tournamentId: string, battle: BattleResult): TournamentResult;
  codexView(state: EndgameStateV1): CodexViewV1;
  recordCodex(state: EndgameStateV1, entryId: string): CodexResult;
  retire(state: EndgameStateV1, legacy: LegacyChoiceV1, confirmed: boolean): RetireResult;
  sectHook(state: EndgameStateV1): { unlocked: boolean; message: string };
  validateContent(content: EndgameContentV1): EndgameValidation;
  save(state: EndgameStateV1): string;
  load(serialized: string): EndgameStateV1;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function addUnique<T>(list: T[], value: T): void {
  if (!list.includes(value)) list.push(value);
}

function completionTier(percent: number): CodexTierV1["tier"] {
  if (percent >= 1) return "complete";
  if (percent >= 0.75) return "gold";
  if (percent >= 0.5) return "silver";
  if (percent > 0) return "bronze";
  return "empty";
}

export function createEndgame(content: EndgameContentV1): EndgameService {
  function createState(seed: number, ladderSize = content.ladderSize): EndgameStateV1 {
    return {
      seed,
      rank: ladderSize,
      seasonIndex: 0,
      defeated: [],
      scouting: {},
      titles: [],
      tianji: 0,
      codex: {},
      seasonRewards: [],
      tournamentScores: {},
      lastChallenge: null,
      silver: 1000,
      realm: 0,
      ownedArts: [],
      companionBonds: {},
      retired: false,
      legacy: null,
      challengeDiscount: 0,
    };
  }

  function generateLadder(state: EndgameStateV1): LadderOpponentV1[] {
    const size = content.ladderSize;
    const top = content.topOpponents.slice(0, Math.min(100, size));
    const usedNames = new Set(top.map((entry) => entry.name));
    const rng = new Rng(state.seed);
    const opponents: LadderOpponentV1[] = top.map((entry, index) => ({
      ...entry,
      id: `ladder_${index + 1}`,
      rank: index + 1,
      powerBand: Math.max(0.2, 1 - index / Math.max(1, size)),
      reward: {
        tianji: 5 + Math.floor((100 - index) / 10),
        title: index < 10 ? `${entry.title}·绝顶` : undefined,
        cosmetic: index < 20 ? `榜帖·${entry.name}` : undefined,
      },
      intel: `${entry.factionId} · ${entry.buildId} · ${entry.style}/${entry.element}`,
    }));
    for (let rank = top.length + 1; rank <= size; rank += 1) {
      const surname = rng.pick(content.nameParts.surnames);
      const given = rng.pick(content.nameParts.givenNames);
      let name = `${surname}${given}`;
      let guard = 0;
      while (usedNames.has(name) && guard < 20) {
        name = `${surname}${given}${String.fromCharCode(0x4e00 + rng.int(0, 200))}`;
        guard += 1;
      }
      usedNames.add(name);
      const factionId = rng.pick(content.nameParts.factions);
      const buildId = rng.pick(["taiji", "pojun", "xuanyin"] as BuildId[]);
      const style = rng.pick(["gang", "rou", "kuai", "gui"] as LadderStyle[]);
      const element = rng.pick(["yin", "yang", "gang", "rou", "taiji"] as Element[]);
      const title = rng.pick(content.nameParts.titles);
      opponents.push({
        id: `ladder_${rank}`,
        rank,
        name,
        factionId,
        buildId,
        style,
        element,
        title,
        barb: rng.pick(content.nameParts.barbs),
        powerBand: Math.max(0.2, 1 - rank / size),
        reward: {
          tianji: 1 + Math.floor((size - rank) / 100),
          cosmetic: rank % 25 === 0 ? `榜帖·${name}` : undefined,
        },
        intel: `${factionId} · ${buildId} · ${style}/${element}`,
      });
    }
    return opponents;
  }

  function ladder(state: EndgameStateV1): LadderViewV1 {
    const opponents = generateLadder(state);
    const next = opponents.find((opponent) => opponent.rank === state.rank - 1) ?? null;
    return {
      rank: state.rank,
      seasonIndex: state.seasonIndex,
      next,
      scoutedNext: Boolean(next && state.scouting[next.id]),
      challengeCost: Math.max(0, content.challengeCost - state.challengeDiscount),
      defeated: state.defeated.length,
    };
  }

  function scout(state: EndgameStateV1, opponentId: string): { state: EndgameStateV1; opponent?: LadderOpponentV1; intel: string; reason: string } {
    const opponent = generateLadder(state).find((entry) => entry.id === opponentId);
    if (!opponent) return { state, intel: "", reason: "未知榜位" };
    if (opponent.rank !== state.rank - 1) return { state, intel: "", reason: "只能侦查下一名" };
    const next = structuredClone(state);
    next.scouting[opponent.id] = true;
    return { state: next, opponent, intel: opponent.intel, reason: "已获得情报" };
  }

  function challenge(state: EndgameStateV1, opponentId: string, battle: BattleResult): ChallengeResult {
    const opponents = generateLadder(state);
    const opponent = opponents.find((entry) => entry.id === opponentId);
    if (!opponent) return { state, ok: false, win: false, rank: state.rank, reason: "未知榜位" };
    if (opponent.rank !== state.rank - 1) return { state, ok: false, win: false, rank: state.rank, reason: "只能挑战下一名" };
    const cost = Math.max(0, content.challengeCost - state.challengeDiscount);
    if (state.silver < cost) return { state, ok: false, win: false, rank: state.rank, reason: "挑战银两不足" };
    const next = structuredClone(state);
    next.silver -= cost;
    next.lastChallenge = { opponentId: opponent.id, win: battle.win, rank: state.rank };
    if (!battle.win) {
      next.scouting[opponent.id] = true;
      next.challengeDiscount = Math.min(content.challengeCost, next.challengeDiscount + 10);
      return {
        state: next,
        ok: true,
        win: false,
        opponent,
        rank: next.rank,
        reason: "挑战失败，保留名次并获得情报；下次挑战费用降低",
      };
    }
    next.rank = opponent.rank;
    next.defeated.push(opponent.id);
    next.challengeDiscount = 0;
    const reward = opponent.reward;
    if (reward.tianji) next.tianji = Math.min(content.tianjiCap, next.tianji + reward.tianji);
    if (reward.title) addUnique(next.titles, reward.title);
    if (reward.cosmetic) addUnique(next.seasonRewards, reward.cosmetic);
    if (reward.codexEntryId) next.codex[reward.codexEntryId] = true;
    return { state: next, ok: true, win: true, opponent, reward, rank: next.rank, reason: `晋级第 ${next.rank} 名` };
  }

  function seasonAt(now: number): number {
    return Math.max(0, Math.floor((now - content.season.epochMs) / (content.season.weeks * WEEK_MS)));
  }

  function seasonState(state: EndgameStateV1, now = Date.now()): SeasonViewV1 {
    const startedAt = content.season.epochMs + state.seasonIndex * content.season.weeks * WEEK_MS;
    return {
      seasonIndex: state.seasonIndex,
      week: Math.max(1, Math.min(content.season.weeks, Math.floor((now - startedAt) / WEEK_MS) + 1)),
      weeks: content.season.weeks,
      startedAt,
      endsAt: startedAt + content.season.weeks * WEEK_MS,
      softResetAt: new Date(startedAt + content.season.weeks * WEEK_MS).toISOString(),
    };
  }

  function applySeasonReset(state: EndgameStateV1, seasonIndex: number): SeasonResetResult {
    const next = structuredClone(state);
    const oldRank = next.rank;
    const drop = Math.max(
      content.season.softResetPlaces,
      Math.floor((content.ladderSize - next.rank) * content.season.softResetPercent),
    );
    next.rank = Math.min(content.ladderSize, next.rank + drop);
    next.seasonIndex = Math.max(next.seasonIndex + 1, seasonIndex);
    next.defeated = [];
    next.scouting = {};
    next.lastChallenge = null;
    next.challengeDiscount = 0;
    // Character/gear/arts/companions/codex/titles/season rewards persist.
    return {
      state: next,
      oldRank,
      newRank: next.rank,
      oldSeason: state.seasonIndex,
      newSeason: next.seasonIndex,
      preserved: ["realm", "ownedArts", "companionBonds", "codex", "titles", "seasonRewards", "tianji"],
      reset: ["rank", "defeated", "scouting", "lastChallenge", "challengeDiscount"],
    };
  }

  function tournamentRules(id: string): TournamentRulesetV1 | null {
    return content.tournaments[id] ?? null;
  }

  function recordTournament(state: EndgameStateV1, tournamentId: string, battle: BattleResult): TournamentResult {
    const ruleset = content.tournaments[tournamentId];
    if (!ruleset) return { state, ok: false, score: 0, reason: "未知武林大会" };
    const next = structuredClone(state);
    const score = battle.win ? 10 + Math.max(0, 30 - battle.rounds) : 2;
    next.tournamentScores[tournamentId] = (next.tournamentScores[tournamentId] ?? 0) + score;
    const reward: EndgameRewardV1 = { tianji: battle.win ? 5 : 1, cosmetic: battle.win ? ruleset.cosmeticReward : undefined };
    next.tianji = Math.min(content.tianjiCap, next.tianji + (reward.tianji ?? 0));
    if (reward.cosmetic) addUnique(next.seasonRewards, reward.cosmetic);
    return { state: next, ok: true, score, reward, ruleset, reason: battle.win ? "武林大会胜出" : "武林大会败北，仍可再来" };
  }

  function codexView(state: EndgameStateV1): CodexViewV1 {
    const entries = content.codex.map((entry) => ({ ...entry, discovered: Boolean(state.codex[entry.id]) }));
    const categories = new Map<CodexCategory, { discovered: number; total: number }>();
    for (const entry of entries) {
      const current = categories.get(entry.category) ?? { discovered: 0, total: 0 };
      current.total += 1;
      if (entry.discovered) current.discovered += 1;
      categories.set(entry.category, current);
    }
    const discovered = entries.filter((entry) => entry.discovered).length;
    const overallPercent = entries.length > 0 ? discovered / entries.length : 0;
    return {
      entries,
      overall: { discovered, total: entries.length, percent: overallPercent, tier: completionTier(overallPercent) },
      categories: [...categories.entries()].map(([category, value]) => {
        const percent = value.total > 0 ? value.discovered / value.total : 0;
        return { category, ...value, percent, tier: completionTier(percent) };
      }),
    };
  }

  function recordCodex(state: EndgameStateV1, entryId: string): CodexResult {
    const entry = content.codex.find((candidate) => candidate.id === entryId);
    if (!entry) return { state, ok: false, alreadyDiscovered: false, reason: "未知江湖志条目" };
    if (state.codex[entryId]) return { state, ok: true, alreadyDiscovered: true, entry, reason: "已收录" };
    const next = structuredClone(state);
    next.codex[entryId] = true;
    return { state: next, ok: true, alreadyDiscovered: false, entry, reason: "江湖志已收录" };
  }

  function retire(state: EndgameStateV1, legacy: LegacyChoiceV1, confirmed: boolean): RetireResult {
    if (!confirmed) return { state, ok: false, kept: null, reset: [], reason: "需要二次确认" };
    if (state.realm < content.retire.requiredRealm) {
      return { state, ok: false, kept: null, reset: [], reason: `需要境界 ${content.retire.requiredRealm}` };
    }
    if (!state.ownedArts.includes(legacy.artId)) return { state, ok: false, kept: null, reset: [], reason: "没有该武学" };
    if (!(legacy.companionId in state.companionBonds)) return { state, ok: false, kept: null, reset: [], reason: "没有该同伴羁绊" };
    if (!state.titles.includes(legacy.title)) return { state, ok: false, kept: null, reset: [], reason: "没有该称号" };
    const next = structuredClone(state);
    const keptBond = next.companionBonds[legacy.companionId];
    next.retired = true;
    next.legacy = { ...legacy };
    next.realm = 1;
    next.rank = content.ladderSize;
    next.defeated = [];
    next.scouting = {};
    next.lastChallenge = null;
    next.challengeDiscount = 0;
    next.ownedArts = [legacy.artId];
    next.companionBonds = { [legacy.companionId]: keptBond };
    next.titles = [legacy.title];
    // Codex, season rewards and tianji are legacy/collection and persist.
    return {
      state: next,
      ok: true,
      kept: { ...legacy },
      reset: ["realm", "rank", "defeated", "scouting", "lastChallenge", "ownedArts", "companionBonds", "titles"],
      reason: "归隐完成，下一世只带走一门绝学、一名同伴与一个称号",
    };
  }

  function sectHook(state: EndgameStateV1): { unlocked: boolean; message: string } {
    return {
      unlocked: state.retired,
      message: state.retired ? "开宗立派接口已解锁；v1 不实现门派经营。" : "归隐后可选择开宗立派（v1 仅接口）。",
    };
  }

  function validateContent(endgame: EndgameContentV1): EndgameValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (endgame.ladderSize < 500 || endgame.ladderSize > 1000) errors.push(`天机榜规模必须 500–1000，当前 ${endgame.ladderSize}`);
    if (endgame.topOpponents.length < 100) errors.push(`top 100 手工榜位不足：${endgame.topOpponents.length}`);
    if (endgame.season.weeks !== 8) errors.push("赛季必须为 8 周");
    if (endgame.retire.requiredRealm < 0) errors.push("归隐境界要求非法");
    const names = new Set<string>();
    const ranks = new Set<number>();
    for (const [index, opponent] of endgame.topOpponents.entries()) {
      if (names.has(opponent.name)) errors.push(`重复榜位名：${opponent.name}`);
      names.add(opponent.name);
      if (!["taiji", "pojun", "xuanyin"].includes(opponent.buildId)) errors.push(`榜位 ${opponent.name} build 非法`);
      if (!["gang", "rou", "kuai", "gui"].includes(opponent.style)) errors.push(`榜位 ${opponent.name} style 非法`);
      ranks.add(index + 1);
    }
    if (ranks.size !== endgame.topOpponents.length) errors.push("榜位 rank 重复");
    if (endgame.codex.length < 150) errors.push(`江湖志至少 150 条，当前 ${endgame.codex.length}`);
    const codexIds = new Set<string>();
    const categories = new Set<CodexCategory>();
    for (const entry of endgame.codex) {
      if (codexIds.has(entry.id)) errors.push(`重复江湖志条目：${entry.id}`);
      codexIds.add(entry.id);
      categories.add(entry.category);
      if (!entry.sourceHint) errors.push(`江湖志 ${entry.id} 缺少来源提示`);
    }
    for (const category of ["region", "map", "npc", "martial_art", "monster", "boss", "event", "companion", "ending"] as CodexCategory[]) {
      if (!categories.has(category)) errors.push(`江湖志缺少分类：${category}`);
    }
    if (Object.keys(endgame.tournaments).length < 2) errors.push("武林大会至少需要 2 套规则");
    for (const tournament of Object.values(endgame.tournaments)) {
      if (tournament.modifiers.length === 0) errors.push(`武林大会 ${tournament.id} 没有规则 modifier`);
      if (!tournament.cosmeticReward) errors.push(`武林大会 ${tournament.id} 缺少外观奖励`);
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  function save(state: EndgameStateV1): string {
    return JSON.stringify(state);
  }

  function load(serialized: string): EndgameStateV1 {
    return structuredClone(JSON.parse(serialized) as EndgameStateV1);
  }

  return {
    createState,
    ladder,
    generateLadder,
    scout,
    challenge,
    seasonState,
    seasonAt,
    applySeasonReset,
    tournamentRules,
    recordTournament,
    codexView,
    recordCodex,
    retire,
    sectHook,
    validateContent,
    save,
    load,
  };
}
