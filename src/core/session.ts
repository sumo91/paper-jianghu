import type { BuildId } from "./types.ts";
import { REALM_NAMES } from "./types.ts";
import { levelToLayer, levelToRealm, xpToNext } from "./stats.ts";
import { Rng } from "./rng.ts";
import type { BattleResult, BattleRoundSnapshot } from "./combat-v1.ts";
import { resolveBattle } from "./combat-v1.ts";
import type { WorldProgressV1 } from "./world-v1.ts";
import {
  canEnterMap,
  createWorldProgress,
  generateEncounter,
  levelForLayer,
  mapProgress,
  recordMapClear,
  recordMapLoss,
  rollTargetsForEncounter,
} from "./world-v1.ts";
import {
  WORLD_CONTENT_V1,
  createEncounterBattle,
  encounterBattleModifiers,
  rewardPctForEncounter,
} from "../data/world-v1.ts";
import {
  COMBAT_CONTENT,
  STARTER_KITS,
  createBattleSheet,
  enemyBattleDef,
  starterLoadoutFor,
} from "../data/combat-v1.ts";
import type { ItemizationState } from "./itemization.ts";
import { createItemization, createItemizationState, dropChance } from "./itemization.ts";
import {
  ITEMIZATION_CONTENT,
  starterGearItems,
  weaponTypesForLoadout,
} from "../data/item-v1.ts";
import type { BuildState } from "./progression.ts";
import { createBuildProgression } from "./progression.ts";
import { BUILD_PROGRESSION_CONTENT, MERIDIAN_NODES_V1 } from "../data/progression-v1.ts";
import type { EconomyState } from "./economy.ts";
import { createEconomy, createEconomyState } from "./economy.ts";
import { ECONOMY_CONTENT } from "../data/economy-v1.ts";
import type { FactionEventStateV1 } from "./factions-events.ts";
import { createFactionEvent } from "./factions-events.ts";
import { FACTION_EVENT_CONTENT } from "../data/factions-events-v1.ts";
import type { CompanionStateV1 } from "./companions.ts";
import { createCompanionService } from "./companions.ts";
import { COMPANION_CONTENT } from "../data/companions-v1.ts";
import type { ActivityStateV1 } from "./activities.ts";
import { createActivityService } from "./activities.ts";
import { ACTIVITY_CONTENT } from "../data/activities-v1.ts";
import { createEndgame } from "./endgame.ts";
import { ENDGAME_CONTENT } from "../data/endgame-v1.ts";
import { CONTENT_VERSION, SAVE_SCHEMA_VERSION } from "../data/content-version.ts";

// ---------------------------------------------------------------------------
// JianghuSession: the single live, headless session seam.
// It owns time/persistence and drives the authored rules; it never redefines
// combat, world, itemization, progression or economy rules.
// ---------------------------------------------------------------------------

export type ActivityMode = "clear" | "survive" | "escort";
export type BattleSpeed = 1 | 2 | 4;

export type JianghuCommand =
  | { type: "newGame"; buildId: BuildId; seed: number; name?: string; mapId?: string; skipTutorial?: boolean }
  | { type: "tutorialStep"; step: string }
  | { type: "skipTutorial" }
  | { type: "learnArt"; artId: string }
  | { type: "setSpeed"; speed: BattleSpeed }
  | { type: "equipArt"; slot: string; artId: string }
  | { type: "equipItem"; itemId: string }
  | { type: "travel"; mapId: string }
  | { type: "setActivity"; mapId: string; layer: number; mode: ActivityMode }
  | { type: "stop" }
  | { type: "resume" };

export interface SessionSnapshotV1 {
  buildId: BuildId;
  playerName: string;
  fixture: boolean;
  tutorial: { completed: string[]; skipped: boolean };
  milestones: Record<string, number>;
  buildName: string;
  seed: number;
  nowMs: number;
  level: number;
  realm: number;
  realmName: string;
  layer: number;
  xp: number;
  xpToNext: number;
  silver: number;
  cultivation: number;
  renown: number;
  mapId: string;
  mapName: string;
  mapLayer: number;
  speed: BattleSpeed;
  mode: ActivityMode;
  active: boolean;
  elapsedHours: number;
  fights: number;
  wins: number;
  losses: number;
  gearScore: number;
  divineItems: number;
  drops: number;
  mapsCleared: number;
  targetDrops: number;
  activity: ActivityStateV1 | null;
  loadout: BuildState["loadout"];
  stats: { hp: number; attack: number; defense: number; speed: number; crit: number; innerMax: number; innerRegen: number };
  gear: Array<{ slot: string; id: string; name: string; rarity: string; refine: number; score: number }>;
  lastBattle: SessionBattleReportV1 | null;
  battlePhase: BattleLifecyclePhase;
  battlePhaseRemainingSeconds: number;
  battlePhaseTotalSeconds: number;
  battlePhaseEndsAtMs: number;
  currentEncounter: { name: string; kind: "normal" | "elite" | "boss" } | null;
  currentFight: SessionBattleReportV1 | null;
  pendingArts: string[];
  ownedMoves: string[];
  ownedUltimates: string[];
  ownedLights: string[];
  bag: Array<{ id: string; name: string; rarity: string; slot: string; score: number; equipped: boolean; refine: number }>;
  lastDrop: { itemId: string; name: string; rarity: string; slot: string; score: number; previousScore: number; upgraded: boolean } | null;
  notice: string | null;
  recentLog: string[];
  recentLoot: string[];
}

export interface SessionBattleReportV1 {
  enemyName: string;
  timeline?: BattleRoundSnapshot[];
  outcome: "win" | "loss" | "timeout";
  rounds: number;
  playerHpPct: number;
  enemyHpPct: number;
  playerFirst?: boolean;
  damageDealt: number;
  damageTaken: number;
  log: string[];
}

export type BattleLifecyclePhase = "searching" | "encounter" | "fighting" | "result";

export interface SessionBattleLifecycleV1 {
  phase: BattleLifecyclePhase;
  remainingSeconds: number;
  phaseTotalSeconds: number;
  encounter: ReturnType<typeof generateEncounter> | null;
  encounterName: string;
  pending: {
    encounter: ReturnType<typeof generateEncounter>;
    battle: BattleResult;
    report: SessionBattleReportV1;
    seconds: number;
  } | null;
}

export interface OfflineReportV1 {
  elapsedHours: number;
  cappedHours: number;
  effectiveHours: number;
  fights: number;
  wins: number;
  losses: number;
  xp: number;
  silver: number;
  renown: number;
  drops: number;
  levels: number;
  loot: string[];
  stoppedBy: string | null;
  currentMapId: string;
  currentMapName: string;
  mode: ActivityMode;
}

export interface AdvanceResultV1 {
  snapshot: SessionSnapshotV1;
  newLogLines: string[];
  offlineReport?: OfflineReportV1;
  saved: boolean;
}

export interface SessionSaveEnvelopeV1 {
  version: 1;
  schemaVersion: number;
  contentVersion: string;
  seed: number;
  savedAtMs: number;
  state: JianghuSessionStateV1;
}

export interface JianghuSessionStateV1 {
  seed: number;
  buildId: BuildId;
  playerName: string;
  fixture: boolean;
  tutorial: { completed: string[]; skipped: boolean };
  milestones: Record<string, number>;
  nowMs: number;
  lastSettledMs: number;
  level: number;
  xp: number;
  mapId: string;
  layer: number;
  speed?: BattleSpeed;
  mode: ActivityMode;
  active: boolean;
  world: WorldProgressV1;
  build: BuildState;
  inventory: ItemizationState;
  economy: EconomyState;
  faction: FactionEventStateV1;
  companions: CompanionStateV1;
  activity: ActivityStateV1 | null;
  fights: number;
  wins: number;
  losses: number;
  timeSeconds: number;
  log: string[];
  loot: string[];
  divine: number;
  drops: number;
  insight: number;
  counter: number;
  lastBattle: SessionBattleReportV1 | null;
  battleLifecycle?: SessionBattleLifecycleV1;
  pendingArts: string[];
  lastDrop: { itemId: string; name: string; rarity: string; slot: string; score: number; previousScore: number; upgraded: boolean } | null;
  notice: string | null;
}

const SESSION_VERSION = 1;
const FIGHT_BASE_SECONDS = 1.0;
const FIGHT_ROUND_SECONDS = 1.0;
const BOSS_EXTRA_SECONDS = 2.0;
const MAX_OFFLINE_HOURS = 8;
const OFFLINE_RATE = 0.5;

function rewardsFor(
  encounter: ReturnType<typeof generateEncounter>,
  rounds: number,
  rewardPct: number,
): { xp: number; silver: number; renown: number } {
  const map = WORLD_CONTENT_V1.maps.find((entry) => entry.id === encounter.mapId)!;
  const sourceMult = encounter.kind === "boss" ? 4.5 : encounter.kind === "elite" ? 1.8 : 1;
  const durationFactor = 1 + 0.004 * Math.max(0, rounds);
  const scale = 1 + rewardPct;
  return {
    xp: Math.round(9 * (1 + 0.22 * map.tier) * (1 + 0.12 * encounter.layer) * sourceMult * durationFactor * scale),
    silver: Math.round(2 * (1 + 0.3 * map.tier) * (1 + 0.1 * encounter.layer) * sourceMult * durationFactor * scale),
    renown: Math.round((encounter.kind === "boss" ? 8 : encounter.layer >= 6 ? 1 : 1) * scale),
  };
}

function fightSeconds(rounds: number, boss: boolean, speed: BattleSpeed = 1): number {
  return (FIGHT_BASE_SECONDS + rounds * FIGHT_ROUND_SECONDS + (boss ? BOSS_EXTRA_SECONDS : 0)) / speed;
}

function nextSearchSeconds(seed: number, counter: number, fights: number, timeSeconds: number): number {
  const rng = new Rng(seed + counter * 2654435761 + fights * 97 + Math.floor(timeSeconds * 1000));
  return 1.8 + rng.next() * 1.8;
}

export class JianghuSession {
  private state: JianghuSessionStateV1;
  private readonly itemization = createItemization(ITEMIZATION_CONTENT);
  private readonly progression = createBuildProgression(COMBAT_CONTENT, BUILD_PROGRESSION_CONTENT);
  private readonly economy = createEconomy(ECONOMY_CONTENT);
  private readonly faction = createFactionEvent(FACTION_EVENT_CONTENT);
  private readonly companions = createCompanionService(COMPANION_CONTENT);
  private readonly activities = createActivityService(ACTIVITY_CONTENT);

  private constructor(state: JianghuSessionStateV1) {
    this.state = state;
    this.state.speed = state.speed === 2 || state.speed === 4 ? state.speed : 1;
    this.ensureBattleLifecycle();
  }

  private ensureBattleLifecycle(): SessionBattleLifecycleV1 {
    const s = this.state;
    if (!s.battleLifecycle) {
      s.battleLifecycle = {
        phase: "searching",
        remainingSeconds: nextSearchSeconds(s.seed, s.counter, s.fights, s.timeSeconds),
        phaseTotalSeconds: nextSearchSeconds(s.seed, s.counter, s.fights, s.timeSeconds),
        encounter: null,
        encounterName: "",
        pending: null,
      };
    }
    return s.battleLifecycle;
  }

  static newGame(
    buildId: BuildId,
    seed: number,
    nowMs = Date.now(),
    options: { playerName?: string; mapId?: string; skipTutorial?: boolean } = {},
  ): JianghuSession {
    const startingMap = options.mapId ?? "luoyang";
    if (!["luoyang", "caoyun"].includes(startingMap)) throw new Error("起始地图必须为洛阳擂台或漕运码头");
    const build = createBuildProgression(COMBAT_CONTENT, BUILD_PROGRESSION_CONTENT).createInitialState(buildId);
    let inventory = createItemizationState();
    const equipContext = {
      buildId,
      requiredWeaponTypes: weaponTypesForLoadout(starterLoadoutFor(buildId)),
      scoreThreshold: 0,
    };
    for (const item of starterGearItems(buildId)) {
      inventory = createItemization(ITEMIZATION_CONTENT).addItem(inventory, item);
      inventory = createItemization(ITEMIZATION_CONTENT).equip(inventory, item.id, equipContext).state;
    }
    const economy = createEconomyState(ECONOMY_CONTENT);
    economy.balances.silver = 200;
    const factionState = createFactionEvent(FACTION_EVENT_CONTENT).createState(0);
    const companionState = createCompanionService(COMPANION_CONTENT).createState(0);
    const state: JianghuSessionStateV1 = {
      seed,
      buildId,
      playerName: (options.playerName ?? "沈砚").slice(0, 8),
      fixture: false,
      tutorial: { completed: [], skipped: Boolean(options.skipTutorial) },
      milestones: {},
      nowMs,
      lastSettledMs: nowMs,
      level: 1,
      xp: 0,
      mapId: startingMap,
      layer: 1,
      speed: 1,
      mode: "clear",
      active: true,
      world: createWorldProgress(WORLD_CONTENT_V1, startingMap),
      build,
      inventory,
      economy,
      faction: factionState,
      companions: companionState,
      activity: null,
      fights: 0,
      wins: 0,
      losses: 0,
      timeSeconds: 0,
      log: [`初入江湖：${WORLD_CONTENT_V1.maps.find((map) => map.id === startingMap)?.name ?? startingMap}。`],
      loot: [],
      divine: 0,
      drops: 0,
      insight: 0,
      counter: 0,
      lastBattle: null,
      battleLifecycle: {
        phase: "searching",
        remainingSeconds: nextSearchSeconds(seed, 0, 0, 0),
        phaseTotalSeconds: nextSearchSeconds(seed, 0, 0, 0),
        encounter: null,
        encounterName: "",
        pending: null,
      },
      pendingArts: [],
      lastDrop: null,
      notice: "挂着就会变强：自动战斗已开始。",
    };
    return new JianghuSession(state);
  }

  static devFixture(nowMs = Date.now()): JianghuSession {
    const session = JianghuSession.newGame("taiji", 42, nowMs, { playerName: "沈砚", skipTutorial: true });
    const s = session.state;
    s.fixture = true;
    s.level = 46;
    s.mapId = "zhumu";
    s.layer = 1;
    s.active = false;
    s.divine = 2;
    s.economy.balances.silver = 12000;
    s.economy.balances.renown = 4000;
    for (const map of WORLD_CONTENT_V1.maps) {
      s.world.maps[map.id] = {
        ...s.world.maps[map.id],
        bossCleared: true,
        firstClearClaimed: true,
        highestClearedLayer: 10,
      };
    }
    s.log.push("开发者 fixture：宗师快照，不写入玩家存档。");
    return session;
  }

  static load(serialized: string, nowMs = Date.now()): JianghuSession {
    let parsed: SessionSaveEnvelopeV1;
    try {
      parsed = JSON.parse(serialized) as SessionSaveEnvelopeV1;
    } catch (error) {
      throw new Error(`存档不是合法 JSON：${String(error)}`);
    }
    if (!parsed || parsed.version !== SESSION_VERSION || !parsed.state) {
      throw new Error("存档版本不受支持，请导出原始存档后开始新一局");
    }
    if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION) {
      throw new Error(`存档 schema ${parsed.schemaVersion} 与当前 ${SAVE_SCHEMA_VERSION} 不兼容`);
    }
    const session = new JianghuSession(structuredClone(parsed.state));
    session.state.nowMs = nowMs;
    return session;
  }

  pullBattleResult(nowMs = Date.now()): (SessionBattleReportV1 & { seconds: number; kind: "normal" | "elite" | "boss" }) | null {
    const s = this.state;
    if (!s.active || s.mode !== "clear" || this.pendingTrial()) return null;
    const life = this.ensureBattleLifecycle();
    this.prepareClearEncounter();
    const encounter = life.encounter!;
    this.beginClearBattle();
    const { report, seconds } = life.pending!;
    this.commitClearBattle();
    // UI owns presentation; reset the session lifecycle to search so a future
    // advanceTo()/offline path still has a sane state.
    life.phase = "searching";
    life.phaseTotalSeconds = nextSearchSeconds(s.seed, s.counter, s.fights, s.timeSeconds);
    life.remainingSeconds = life.phaseTotalSeconds;
    life.encounter = null;
    life.encounterName = "";
    life.pending = null;
    s.timeSeconds += seconds;
    s.nowMs = nowMs;
    s.lastSettledMs = nowMs;
    return { ...report, seconds, kind: encounter.kind };
  }

  snapshot(): SessionSnapshotV1 {
    const s = this.state;
    const map = WORLD_CONTENT_V1.maps.find((entry) => entry.id === s.mapId)!;
    return {
      buildId: s.buildId,
      playerName: s.playerName,
      fixture: s.fixture,
      tutorial: structuredClone(s.tutorial),
      milestones: { ...s.milestones },
      buildName: STARTER_KITS[s.buildId].name,
      seed: s.seed,
      nowMs: s.nowMs,
      level: s.level,
      realm: levelToRealm(s.level),
      realmName: REALM_NAMES[levelToRealm(s.level)],
      layer: levelToLayer(s.level),
      xp: Math.round(s.xp),
      xpToNext: xpToNext(s.level),
      silver: s.economy.balances.silver,
      cultivation: s.economy.balances.cultivation,
      renown: s.economy.balances.renown,
      mapId: s.mapId,
      mapName: map.name,
      mapLayer: s.layer,
      speed: s.speed ?? 1,
      mode: s.mode,
      active: s.active,
      elapsedHours: s.timeSeconds / 3600,
      fights: s.fights,
      wins: s.wins,
      losses: s.losses,
      gearScore: this.gearScore(),
      divineItems: s.divine,
      drops: s.drops,
      mapsCleared: Object.values(s.world.maps).filter((entry) => entry.bossCleared).length,
      targetDrops: Object.values(s.world.maps).reduce((sum, entry) => sum + Object.keys(entry.targetClaimed).length, 0),
      activity: s.activity ? structuredClone(s.activity) : null,
      loadout: structuredClone(s.build.loadout),
      stats: (() => {
        const sheet = this.sheet();
        return {
          hp: Math.round(sheet.primary.hp),
          attack: Math.round(sheet.primary.attack),
          defense: Math.round(sheet.primary.defense),
          speed: Math.round(sheet.primary.speed),
          crit: sheet.secondary.crit,
          innerMax: Math.round(sheet.primary.innerMax),
          innerRegen: sheet.secondary.innerRegen,
        };
      })(),
      gear: Object.entries(s.inventory.equipped)
        .filter(([, id]) => Boolean(id))
        .map(([slot, id]) => {
          const item = s.inventory.inventory[id!];
          return {
            slot,
            id: id!,
            name: item?.name ?? id!,
            rarity: item?.rarity ?? "common",
            refine: item?.refine ?? 0,
            score: item ? this.itemization.score(item, { buildId: s.buildId, requiredWeaponTypes: weaponTypesForLoadout(s.build.loadout) }) : 0,
          };
        }),
      lastBattle: s.lastBattle ? structuredClone(s.lastBattle) : null,
      battlePhase: s.battleLifecycle?.phase ?? "searching",
      battlePhaseRemainingSeconds: Math.max(0, s.battleLifecycle?.remainingSeconds ?? 0),
      battlePhaseTotalSeconds: Math.max(0, s.battleLifecycle?.phaseTotalSeconds ?? 0),
      battlePhaseEndsAtMs: s.nowMs + Math.max(0, s.battleLifecycle?.remainingSeconds ?? 0) * 1000,
      currentEncounter: s.battleLifecycle?.encounter
        ? { name: s.battleLifecycle.encounterName || s.battleLifecycle.encounter.enemyIds.join("、"), kind: s.battleLifecycle.encounter.kind }
        : null,
      currentFight: s.battleLifecycle?.phase === "fighting" && s.battleLifecycle.pending
        ? structuredClone(s.battleLifecycle.pending.report)
        : null,
      pendingArts: [...s.pendingArts],
      ownedMoves: [...s.build.owned.moves],
      ownedUltimates: [...s.build.owned.ultimates],
      ownedLights: [...s.build.owned.lightSkills],
      bag: Object.values(s.inventory.inventory).map((item) => ({
        id: item.id,
        name: item.name,
        rarity: item.rarity,
        slot: item.slot,
        score: this.itemization.score(item, { buildId: s.buildId, requiredWeaponTypes: weaponTypesForLoadout(s.build.loadout) }),
        equipped: Object.values(s.inventory.equipped).includes(item.id),
        refine: item.refine,
      })),
      lastDrop: s.lastDrop ? { ...s.lastDrop } : null,
      notice: s.notice,
      recentLog: s.log.slice(-12),
      recentLoot: s.loot.slice(-8),
    };
  }

  dispatch(command: JianghuCommand): SessionSnapshotV1 {
    switch (command.type) {
      case "newGame": {
        const next = JianghuSession.newGame(command.buildId, command.seed, this.state.nowMs, {
          playerName: command.name,
          mapId: command.mapId,
          skipTutorial: command.skipTutorial,
        });
        this.state = next.state;
        break;
      }
      case "tutorialStep": {
        if (!this.state.tutorial.completed.includes(command.step)) {
          this.state.tutorial.completed.push(command.step);
          this.state.log.push(`引导：${command.step}`);
        }
        break;
      }
      case "skipTutorial":
        this.state.tutorial.skipped = true;
        this.state.log.push("引导已跳过");
        break;
      case "learnArt": {
        const result = this.progression.learn(this.state.build, command.artId, { kind: "boss", id: "idle-first" });
        if (result.ok) {
          this.state.build = result.state;
          this.state.pendingArts = this.state.pendingArts.filter((id) => id !== command.artId);
          this.markMilestone("firstArtLearned");
          this.state.notice = `学会 ${COMBAT_CONTENT.skills[command.artId]?.name ?? command.artId}，去武学页装配`;
          this.state.log.push(this.state.notice);
        } else {
          this.state.notice = `学习失败：${result.reason}`;
        }
        break;
      }
      case "equipArt": {
        const result = this.progression.equip(this.state.build, command.slot, command.artId, {
          weaponType: this.itemization.weaponType(this.state.inventory) ?? undefined,
        });
        if (result.ok) {
          this.state.build = result.state;
          this.markMilestone("firstLoadoutSwap");
          this.state.notice = `已装配 ${COMBAT_CONTENT.skills[command.artId]?.name ?? command.artId}`;
          this.state.log.push(this.state.notice);
        } else {
          this.state.notice = `装配失败：${result.reason}`;
        }
        break;
      }
      case "equipItem": {
        const context = {
          buildId: this.state.buildId,
          requiredWeaponTypes: weaponTypesForLoadout(this.state.build.loadout),
          scoreThreshold: 0,
        };
        const result = this.itemization.equip(this.state.inventory, command.itemId, context);
        if (result.equipped) {
          this.state.inventory = result.state;
          this.state.notice = `已装备 ${result.itemId}`;
          this.state.log.push(this.state.notice);
        } else {
          this.state.notice = `装备失败：${result.reason}`;
        }
        break;
      }
      case "setSpeed": {
        this.state.speed = command.speed === 2 || command.speed === 4 ? command.speed : 1;
        this.state.notice = `战斗速度 ×${this.state.speed}`;
        this.state.log.push(this.state.notice);
        break;
      }
      case "travel": {
        const map = WORLD_CONTENT_V1.maps.find((entry) => entry.id === command.mapId);
        if (!map) throw new Error(`未知地图：${command.mapId}`);
        const unlock = canEnterMap(WORLD_CONTENT_V1, this.state.world, map.id, levelToRealm(this.state.level));
        if (!unlock.ok) throw new Error(unlock.message);
        this.state.mapId = map.id;
        this.state.layer = 1;
        this.state.active = true;
        this.state.mode = "clear";
        this.state.activity = null;
        this.state.lastBattle = null;
        this.state.battleLifecycle = {
          phase: "searching",
          remainingSeconds: nextSearchSeconds(this.state.seed, this.state.counter, this.state.fights, this.state.timeSeconds),
          phaseTotalSeconds: 1.8,
          encounter: null,
          encounterName: "",
          pending: null,
        };
        this.state.notice = `已抵达 ${map.name}，自动行止开始`;
        this.state.log.push(`启程：${map.name}`);
        this.state.lastSettledMs = this.state.nowMs;
        break;
      }
      case "setActivity": {
        const map = WORLD_CONTENT_V1.maps.find((entry) => entry.id === command.mapId);
        if (!map) throw new Error(`未知地图：${command.mapId}`);
        const unlock = canEnterMap(WORLD_CONTENT_V1, this.state.world, map.id, levelToRealm(this.state.level));
        if (!unlock.ok) throw new Error(unlock.message);
        if (!Number.isInteger(command.layer) || command.layer < 1 || command.layer > 10) throw new Error("层数必须为 1–10");
        this.state.mapId = map.id;
        this.state.layer = command.layer;
        this.state.mode = command.mode;
        this.state.active = true;
        this.state.activity = command.mode === "clear" ? null : this.startActivity(command.mode);
        this.state.lastBattle = null;
        this.state.battleLifecycle = {
          phase: "searching",
          remainingSeconds: nextSearchSeconds(this.state.seed, this.state.counter, this.state.fights, this.state.timeSeconds),
          phaseTotalSeconds: 1.8,
          encounter: null,
          encounterName: "",
          pending: null,
        };
        this.state.lastSettledMs = this.state.nowMs;
        this.state.log.push(`行止：${map.name} 第 ${command.layer} 层 · ${command.mode}`);
        break;
      }
      case "stop":
        this.state.active = false;
        this.state.log.push("行止已停止");
        break;
      case "resume":
        this.state.active = true;
        this.state.lastSettledMs = this.state.nowMs;
        this.state.log.push("行止继续");
        break;
    }
    this.trimLog();
    return this.snapshot();
  }

  advanceTo(nowMs: number, options: { offline?: boolean } = {}): AdvanceResultV1 {
    const s = this.state;
    const beforeLog = s.log.length;
    const beforeTimeSeconds = s.timeSeconds;
    const before = {
      xp: s.xp,
      silver: s.economy.balances.silver,
      renown: s.economy.balances.renown,
      wins: s.wins,
      losses: s.losses,
      fights: s.fights,
      drops: s.drops,
      level: s.level,
    };
    const elapsedSeconds = Math.max(0, (nowMs - s.lastSettledMs) / 1000);
    const offline = options.offline ?? elapsedSeconds >= 3600;
    const cappedSeconds = offline ? Math.min(elapsedSeconds, MAX_OFFLINE_HOURS * 3600) : elapsedSeconds;
    const budget = offline ? cappedSeconds * OFFLINE_RATE : cappedSeconds;
    let remaining = budget;
    let stoppedBy: string | null = null;
    const maxFights = 10000;
    let guard = 0;
    while (remaining > 0 && s.active && guard < maxFights) {
      guard += 1;
      if (this.pendingTrial()) {
        const seconds = this.attemptTrial();
        remaining -= seconds;
        s.timeSeconds += seconds;
        continue;
      }
      if (s.mode !== "clear") {
        if (remaining < FIGHT_BASE_SECONDS / (s.speed ?? 1)) break;
        const result = this.stepActivity();
        if (!result) {
          stoppedBy = "activity-ended";
          break;
        }
        remaining -= result.seconds;
        s.timeSeconds += result.seconds;
        if (result.fatal) {
          stoppedBy = result.reason;
          break;
        }
        continue;
      }
      const used = this.advanceClearLifecycle(remaining);
      if (used <= 0) break;
      remaining -= used;
      s.timeSeconds += used;
    }
    s.nowMs = nowMs;
    const progressed = s.timeSeconds > beforeTimeSeconds;
    if (!(s.active && !progressed && elapsedSeconds > 0)) {
      s.lastSettledMs = nowMs;
    }
    this.trimLog();
    const newLogLines = s.log.slice(beforeLog);
    const offlineReport: OfflineReportV1 | undefined = offline
      ? {
          elapsedHours: elapsedSeconds / 3600,
          cappedHours: Math.min(elapsedSeconds / 3600, MAX_OFFLINE_HOURS),
          effectiveHours: budget / 3600,
          fights: s.fights - before.fights,
          wins: s.wins - before.wins,
          losses: s.losses - before.losses,
          xp: Math.round(s.xp - before.xp),
          silver: Math.round(s.economy.balances.silver - before.silver),
          renown: Math.round(s.economy.balances.renown - before.renown),
          drops: s.drops - before.drops,
          levels: s.level - before.level,
          loot: s.loot.slice(-6),
          stoppedBy,
          currentMapId: s.mapId,
          currentMapName: WORLD_CONTENT_V1.maps.find((entry) => entry.id === s.mapId)?.name ?? s.mapId,
          mode: s.mode,
        }
      : undefined;
    return { snapshot: this.snapshot(), newLogLines, offlineReport, saved: true };
  }

  save(): string {
    const envelope: SessionSaveEnvelopeV1 = {
      version: SESSION_VERSION,
      schemaVersion: SAVE_SCHEMA_VERSION,
      contentVersion: CONTENT_VERSION,
      seed: this.state.seed,
      savedAtMs: this.state.nowMs,
      state: structuredClone(this.state),
    };
    return JSON.stringify(envelope);
  }

  private startActivity(mode: ActivityMode): ActivityStateV1 {
    if (mode === "survive") return this.activities.startSurvival(this.state.mapId, this.state.seed + this.state.counter);
    if (mode === "escort") return this.activities.startEscort(this.state.mapId, this.state.seed + this.state.counter);
    throw new Error(`未知活动模式：${mode}`);
  }

  private sheet() {
    const s = this.state;
    const innerId = s.build.loadout.innerArtId;
    return createBattleSheet(s.buildId, {
      level: s.level,
      gear: [],
      hearts: [],
      keystones: [],
      innerArtId: innerId,
      innerArtLevel: s.build.innerLevels[innerId] ?? 1,
      extraMods: {
        ...this.itemization.gearMods(s.inventory),
        ...this.progression.masteryMods(s.build),
        ...this.progression.heartMods(s.build),
        ...this.progression.meridianMods(s.build),
      },
      weaponType: this.itemization.weaponType(s.inventory) ?? undefined,
    });
  }

  private queueArt(artId: string): void {
    const owned = this.state.build.owned.moves.includes(artId)
      || this.state.build.owned.ultimates.includes(artId)
      || this.state.build.owned.lightSkills.includes(artId);
    if (!owned && !this.state.pendingArts.includes(artId)) {
      this.state.pendingArts.push(artId);
      this.markMilestone("firstArtDrop");
      this.state.notice = `获得招式：${COMBAT_CONTENT.skills[artId]?.name ?? artId}，可学习`;
      this.state.log.push(this.state.notice);
    }
  }

  private markMilestone(key: string): void {
    if (this.state.milestones[key] === undefined) this.state.milestones[key] = this.state.fights;
  }

  private pendingTrial(): boolean {
    const s = this.state;
    return s.level < 63 && levelToLayer(s.level) === 9 && s.xp >= xpToNext(s.level);
  }

  private attemptTrial(): number {
    const s = this.state;
    const map = WORLD_CONTENT_V1.maps.find((entry) => entry.id === s.mapId)!;
    const base = createEncounterBattle(generateEncounter(WORLD_CONTENT_V1, map.id, 10, s.seed + s.counter));
    const trial = {
      ...base,
      name: `${base.name}·试炼`,
      primary: {
        ...base.primary,
        hp: base.primary.hp * Math.max(0.45, 0.72 - 0.06 * s.insight),
        attack: base.primary.attack * Math.max(0.55, 0.85 - 0.05 * s.insight),
        defense: base.primary.defense * 0.9,
      },
      reflectPct: 0,
      damageCapPct: 0.3,
    };
    const battle = resolveBattle({
      player: { sheet: this.sheet(), loadout: s.build.loadout, content: COMBAT_CONTENT },
      enemy: trial,
      objective: "clear",
      maxRounds: 30,
      seed: s.seed + s.counter + 77,
      captureEvents: false,
    });
    s.counter += 1;
    const seconds = fightSeconds(battle.rounds, true, s.speed ?? 1);
    if (battle.win) {
      s.level += 1;
      s.xp = 0;
      s.insight = 0;
      s.log.push(`突破成功：${REALM_NAMES[levelToRealm(s.level)]}`);
    } else {
      s.insight = Math.min(5, s.insight + 1);
      s.xp = Math.min(s.xp, xpToNext(s.level));
      s.log.push(`突破失败：感悟 ${s.insight}/5，下次试炼更易`);
    }
    return seconds;
  }

  private prepareClearEncounter(): void {
    const s = this.state;
    const life = this.ensureBattleLifecycle();
    s.counter += 1;
    const encounter = generateEncounter(WORLD_CONTENT_V1, s.mapId, s.layer, s.seed + s.counter, s.world);
    if (s.fights < 30 && encounter.enemyIds.length > 2) {
      encounter.enemyIds = encounter.enemyIds.slice(0, 2);
    }
    if (encounter.kind === "elite") this.queueArt("common_liuhe");
    if (encounter.kind === "boss") this.queueArt("common_guixi");
    const enemy = createEncounterBattle(encounter);
    life.encounter = encounter;
    life.encounterName = enemy.name;
    life.pending = null;
    life.phase = "encounter";
    life.phaseTotalSeconds = 0.8;
    life.remainingSeconds = 0.8;
  }

  private beginClearBattle(): void {
    const s = this.state;
    const life = this.ensureBattleLifecycle();
    const encounter = life.encounter!;
    const enemy = createEncounterBattle(encounter);
    if (s.fights === 0) {
      enemy.primary.attack *= 0.65;
      enemy.primary.hp *= 0.8;
    }
    if (s.fights < 30) {
      enemy.primary.attack *= 0.82;
      enemy.primary.hp *= 0.94;
    }
    const battle = resolveBattle({
      player: { sheet: this.sheet(), loadout: s.build.loadout, content: COMBAT_CONTENT },
      enemy,
      objective: "clear",
      maxRounds: 30,
      seed: s.seed + s.counter + 17,
      modifiers: encounterBattleModifiers(encounter),
      captureEvents: false,
    });
    const seconds = fightSeconds(battle.rounds, encounter.kind === "boss", s.speed ?? 1);
    const report: SessionBattleReportV1 = {
      enemyName: battle.enemyName,
      outcome: battle.outcome,
      rounds: battle.rounds,
      playerHpPct: battle.playerHpPct,
      enemyHpPct: battle.enemyHpPct,
      playerFirst: battle.playerFirst,
      timeline: battle.roundSnapshots ?? [],
      damageDealt: battle.damageDealt,
      damageTaken: battle.damageTaken,
      log: battle.log.slice(-12),
    };
    life.pending = { encounter, battle, report, seconds };
    life.phase = "fighting";
    life.phaseTotalSeconds = seconds;
    life.remainingSeconds = seconds;
  }

  private commitClearBattle(): void {
    const s = this.state;
    const life = this.ensureBattleLifecycle();
    const pending = life.pending!;
    const { battle, encounter, report } = pending;
    s.lastBattle = report;
    s.fights += 1;
    this.markMilestone("firstFight");
    const map = WORLD_CONTENT_V1.maps.find((entry) => entry.id === s.mapId)!;
    if (encounter.kind === "boss") this.markMilestone("firstBossAttempt");
    if (encounter.kind === "elite") this.markMilestone("firstElite");
    if (battle.win) {
      s.wins += 1;
      this.markMilestone("firstWin");
      const rewardPct = rewardPctForEncounter(encounter);
      const reward = rewardsFor(encounter, battle.rounds, rewardPct);
      this.gainXp(reward.xp);
      const grant = this.economy.grant(s.economy, {
        silver: reward.silver,
        renown: reward.renown,
        cultivation: Math.round(reward.xp * 0.6),
      });
      s.economy = grant.state;
      s.build.cultivation += Math.round(reward.xp * 0.6);
      s.build.silver = s.economy.balances.silver;
      s.build.renown = s.economy.balances.renown;
      const source = encounter.kind === "boss" ? "boss" : encounter.kind === "elite" ? "elite" : "normal";
      const targetRoll = rollTargetsForEncounter(WORLD_CONTENT_V1, s.world, s.mapId, source, s.seed + s.counter + 31);
      s.world = targetRoll.progress;
      for (const drop of targetRoll.awarded) s.loot.push(`目标：${drop.name}`);
      if (s.fights % 2 === 0) this.gainGear(encounter, source);
      if (encounter.kind === "boss") {
        this.markMilestone("firstBossKill");
        const clear = recordMapClear(WORLD_CONTENT_V1, s.world, s.mapId, 10);
        s.world = clear.progress;
        if (clear.granted) {
          this.markMilestone("firstMapClear");
          s.loot.push(`首通：${map.name}`);
          const grant2 = this.economy.grant(s.economy, { silver: clear.reward?.silver ?? 0, renown: clear.reward?.renown ?? 0 });
          s.economy = grant2.state;
          if (map.tier >= 5) this.gainDivine(map.tier);
          this.chooseNextMap();
        } else if (!this.chooseNextMap()) {
          s.layer = 9;
        }
      } else if (s.layer < 10) {
        s.layer += 1;
      }
      this.maybeSpend();
    } else {
      s.losses += 1;
      this.markMilestone("firstLoss");
      const consolation = Math.max(1, Math.round(3 * (1 + 0.22 * map.tier) * (1 + 0.12 * s.layer)));
      this.gainXp(consolation);
      s.world = recordMapLoss(s.world, s.mapId, s.layer);
      if (s.layer > 1) s.layer -= 1;
      s.log.push(`第 ${s.layer + 1} 层失利（修为 +${consolation}）`);
    }
    life.pending = null;
    life.encounter = null;
    life.encounterName = "";
    life.phase = "result";
    life.phaseTotalSeconds = 1.6;
    life.remainingSeconds = 1.6;
    this.trimLog();
  }

  private advanceClearLifecycle(maxSeconds: number): number {
    const life = this.ensureBattleLifecycle();
    // Advance at most one phase per call so the outer loop can check a pending
    // realm trial between fights instead of swallowing hours inside the loop.
    if (life.remainingSeconds > 0) {
      const step = Math.min(maxSeconds, life.remainingSeconds);
      life.remainingSeconds -= step;
      if (life.remainingSeconds > 1e-6) return step;
      if (life.phase === "searching") this.prepareClearEncounter();
      else if (life.phase === "encounter") this.beginClearBattle();
      else if (life.phase === "fighting") this.commitClearBattle();
      else {
        life.phase = "searching";
        life.phaseTotalSeconds = nextSearchSeconds(this.state.seed, this.state.counter, this.state.fights, this.state.timeSeconds);
        life.remainingSeconds = life.phaseTotalSeconds;
      }
      return step;
    }
    if (life.phase === "searching") this.prepareClearEncounter();
    else if (life.phase === "encounter") this.beginClearBattle();
    else if (life.phase === "fighting") this.commitClearBattle();
    else {
      life.phase = "searching";
      life.phaseTotalSeconds = nextSearchSeconds(this.state.seed, this.state.counter, this.state.fights, this.state.timeSeconds);
      life.remainingSeconds = life.phaseTotalSeconds;
    }
    return 0;
  }

  private stepActivity(): { seconds: number; fatal: boolean; reason: string } | null {
    const s = this.state;
    if (!s.activity || s.activity.status !== "active") {
      s.active = false;
      return null;
    }
    const spec = this.activities.nextBattle(s.activity);
    if (!spec) {
      s.active = false;
      return null;
    }
    const level = Math.max(1, levelForLayer(WORLD_CONTENT_V1.maps.find((entry) => entry.id === s.mapId)!, Math.min(10, s.layer)) + spec.levelOffset);
    const enemy = enemyBattleDef({
      id: `activity_${spec.kind}_${s.counter}`, name: spec.kind === "survival" ? "守关者" : "伏击者", style: "gang", element: "gang", level,
      hp: 380 * (1 + 0.12 * (level - 1)) * spec.pressure,
      attack: 48 * (1 + 0.09 * (level - 1)) * spec.pressure,
      defense: (20 + 2.2 * (level - 1)) * spec.pressure,
      speed: 42 + level,
      pattern: [{ id: "e_heavy", name: "劈", type: "shi", element: "gang", coefficient: 1.15, effect: "heavy" }],
    });
    if (spec.objective === "survive") enemy.primary.hp = 1_000_000_000;
    const battle = resolveBattle({
      player: { sheet: this.sheet(), loadout: s.build.loadout, content: COMBAT_CONTENT },
      enemy,
      objective: spec.objective,
      maxRounds: 30,
      surviveRounds: spec.surviveRounds,
      seed: spec.enemySeed,
      captureEvents: false,
    });
    const seconds = fightSeconds(battle.rounds, false, s.speed ?? 1);
    s.lastBattle = {
      enemyName: battle.enemyName,
      outcome: battle.outcome,
      rounds: battle.rounds,
      playerHpPct: battle.playerHpPct,
      enemyHpPct: battle.enemyHpPct,
      playerFirst: battle.playerFirst,
      timeline: battle.roundSnapshots ?? [],
      damageDealt: battle.damageDealt,
      damageTaken: battle.damageTaken,
      log: battle.log.slice(-12),
    };
    s.fights += 1;
    const advanced = this.activities.advance(s.activity, battle);
    s.activity = advanced.state;
    s.wins += battle.win ? 1 : 0;
    s.losses += battle.win ? 0 : 1;
    if (advanced.state.status === "completed") {
      const reward = advanced.state.rewards;
      s.economy = this.economy.grant(s.economy, { silver: reward.silver, renown: reward.renown, materials: reward.materials }).state;
      s.build.silver = s.economy.balances.silver;
      s.build.renown = s.economy.balances.renown;
      s.log.push(`活动完成：${advanced.state.reason}`);
      this.maybeSpend();
    } else if (advanced.state.status === "failed") {
      const reward = advanced.state.rewards;
      s.economy = this.economy.grant(s.economy, { silver: reward.silver, renown: reward.renown, materials: reward.materials }).state;
      s.build.silver = s.economy.balances.silver;
      s.build.renown = s.economy.balances.renown;
      s.log.push(`活动失败：${advanced.state.reason}`);
      s.active = false;
    }
    this.trimLog();
    return { seconds, fatal: false, reason: "" };
  }

  private gainXp(amount: number): void {
    const s = this.state;
    s.xp += amount;
    let guard = 0;
    while (s.level < 63 && levelToLayer(s.level) < 9 && s.xp >= xpToNext(s.level) && guard < 60) {
      s.xp -= xpToNext(s.level);
      s.level += 1;
      this.markMilestone("firstLevel");
      s.notice = `升级！Lv.${s.level} ${REALM_NAMES[levelToRealm(s.level)]}`;
      guard += 1;
    }
    if (s.level < 63 && levelToLayer(s.level) === 9 && s.xp > xpToNext(s.level)) {
      s.xp = xpToNext(s.level);
    }
  }

  private chooseNextMap(): boolean {
    const s = this.state;
    const map = WORLD_CONTENT_V1.maps.find((entry) => entry.id === s.mapId)!;
    if (map.firstClear.unlockMapId) {
      const unlock = canEnterMap(WORLD_CONTENT_V1, s.world, map.firstClear.unlockMapId, levelToRealm(s.level));
      if (unlock.ok) {
        s.mapId = map.firstClear.unlockMapId;
        s.layer = 1;
        s.log.push(`解锁：${s.mapId}`);
        return true;
      }
    }
    for (const candidate of WORLD_CONTENT_V1.maps) {
      if (mapProgress(s.world, candidate.id).bossCleared) continue;
      const unlock = canEnterMap(WORLD_CONTENT_V1, s.world, candidate.id, levelToRealm(s.level));
      if (unlock.ok) {
        s.mapId = candidate.id;
        s.layer = Math.max(1, mapProgress(s.world, candidate.id).highestClearedLayer || 1);
        return true;
      }
    }
    return false;
  }

  private gainGear(encounter: ReturnType<typeof generateEncounter>, source: "normal" | "elite" | "boss"): void {
    const s = this.state;
    const rng = new Rng(s.seed + s.counter);
    const firstHourBonus = s.fights <= 60 ? 0.35 : 0;
    const forcedFirstHour = s.fights <= 20 && s.drops < 5;
    if (!forcedFirstHour && !rng.chance(dropChance(source) + firstHourBonus)) return;
    const map = WORLD_CONTENT_V1.maps.find((entry) => entry.id === s.mapId)!;
    const item = this.itemization.roll({
      seed: s.seed + s.counter + 5,
      source,
      mapTier: map.tier,
      layer: encounter.layer,
      buildId: s.buildId,
      allowDivine: false,
    });
    const context = {
      buildId: s.buildId,
      requiredWeaponTypes: weaponTypesForLoadout(s.build.loadout),
      scoreThreshold: 0,
    };
    const received = this.itemization.receive(s.inventory, item, context);
    s.inventory = received.state;
    if (received.stored) {
      s.drops += 1;
      this.markMilestone("firstDrop");
      const previousId = s.inventory.equipped[item.slot];
      const previousScore = previousId && s.inventory.inventory[previousId]
        ? this.itemization.score(s.inventory.inventory[previousId], context)
        : 0;
      const equipped = this.itemization.applyEquipPolicy(s.inventory, item, "upgradeUnlocked", context);
      s.inventory = equipped.state;
      const score = this.itemization.score(item, context);
      s.lastDrop = {
        itemId: item.id,
        name: item.name,
        rarity: item.rarity,
        slot: item.slot,
        score,
        previousScore,
        upgraded: equipped.equipped,
      };
      s.notice = equipped.equipped ? `换装：${item.name}（+${Math.max(0, Math.round(score - previousScore))} 评分）` : `掉落：${item.name}`;
      if (equipped.equipped) s.loot.push(`换装：${item.name}`);
      else s.loot.push(`掉落：${item.name}`);
    }
  }

  private gainDivine(tier: number): void {
    const s = this.state;
    if (s.divine >= 2) return;
    const item = this.itemization.roll({
      seed: s.seed + s.counter + 99,
      source: "boss",
      mapTier: tier,
      layer: 10,
      buildId: s.buildId,
      allowDivine: true,
      rarity: "divine",
    });
    const context = {
      buildId: s.buildId,
      requiredWeaponTypes: weaponTypesForLoadout(s.build.loadout),
      scoreThreshold: 0,
    };
    const received = this.itemization.receive(s.inventory, item, context);
    s.inventory = received.state;
    if (received.stored) {
      s.inventory = this.itemization.applyEquipPolicy(s.inventory, item, "upgradeUnlocked", context).state;
      s.divine += 1;
      s.drops += 1;
      s.loot.push(`神装：${item.name}`);
    }
  }

  private maybeSpend(): void {
    const s = this.state;
    s.build.cultivation = Math.max(s.build.cultivation, s.economy.balances.cultivation);
    for (const id of [...s.build.loadout.moves, s.build.loadout.ultimateId, s.build.loadout.lightSkillId]) {
      let guard = 0;
      while ((s.build.mastery[id] ?? 1) < 7 && guard < 10) {
        const result = this.progression.upgradeMastery(s.build, id);
        if (!result.ok) break;
        s.build = result.state;
        guard += 1;
      }
    }
    for (const node of Object.values(MERIDIAN_NODES_V1)) {
      if (s.build.meridian.spent.length >= 18) break;
      const result = this.progression.spendMeridian(s.build, node.id);
      if (result.ok) s.build = result.state;
    }
  }

  private gearScore(): number {
    const s = this.state;
    let total = 0;
    for (const id of Object.values(s.inventory.equipped)) {
      if (!id) continue;
      const item = s.inventory.inventory[id];
      if (item) total += this.itemization.score(item, { buildId: s.buildId, requiredWeaponTypes: weaponTypesForLoadout(s.build.loadout) });
    }
    return Math.round(total);
  }

  private trimLog(): void {
    if (this.state.log.length > 80) this.state.log = this.state.log.slice(-80);
    if (this.state.loot.length > 50) this.state.loot = this.state.loot.slice(-50);
  }
}

export function sessionSnapshot(session: JianghuSession): SessionSnapshotV1 {
  return session.snapshot();
}
