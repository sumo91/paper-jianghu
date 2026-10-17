import type { BuildId } from "./types.ts";
import { REALM_NAMES } from "./types.ts";
import { levelToLayer, levelToRealm, xpToNext } from "./stats.ts";
import { Rng } from "./rng.ts";
import type { BattleResult } from "./combat-v1.ts";
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

export type JianghuCommand =
  | { type: "newGame"; buildId: BuildId; seed: number }
  | { type: "travel"; mapId: string }
  | { type: "setActivity"; mapId: string; layer: number; mode: ActivityMode }
  | { type: "stop" }
  | { type: "resume" };

export interface SessionSnapshotV1 {
  buildId: BuildId;
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
  mode: ActivityMode;
  active: boolean;
  elapsedHours: number;
  fights: number;
  wins: number;
  losses: number;
  gearScore: number;
  divineItems: number;
  mapsCleared: number;
  targetDrops: number;
  activity: ActivityStateV1 | null;
  loadout: BuildState["loadout"];
  stats: { hp: number; attack: number; defense: number; speed: number; crit: number; innerMax: number; innerRegen: number };
  gear: Array<{ slot: string; id: string; name: string; rarity: string; refine: number; score: number }>;
  lastBattle: SessionBattleReportV1 | null;
  recentLog: string[];
  recentLoot: string[];
}

export interface SessionBattleReportV1 {
  enemyName: string;
  outcome: "win" | "loss" | "timeout";
  rounds: number;
  playerHpPct: number;
  damageDealt: number;
  damageTaken: number;
  log: string[];
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
  nowMs: number;
  lastSettledMs: number;
  level: number;
  xp: number;
  mapId: string;
  layer: number;
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
  insight: number;
  counter: number;
  lastBattle: SessionBattleReportV1 | null;
}

const SESSION_VERSION = 1;
const FIGHT_BASE_SECONDS = 18;
const FIGHT_ROUND_SECONDS = 2;
const BOSS_EXTRA_SECONDS = 24;
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

function fightSeconds(rounds: number, boss: boolean): number {
  return FIGHT_BASE_SECONDS + rounds * FIGHT_ROUND_SECONDS + (boss ? BOSS_EXTRA_SECONDS : 0);
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
  }

  static newGame(buildId: BuildId, seed: number, nowMs = Date.now()): JianghuSession {
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
    const factionState = createFactionEvent(FACTION_EVENT_CONTENT).createState(0);
    const companionState = createCompanionService(COMPANION_CONTENT).createState(0);
    const state: JianghuSessionStateV1 = {
      seed,
      buildId,
      nowMs,
      lastSettledMs: nowMs,
      level: 1,
      xp: 0,
      mapId: "luoyang",
      layer: 1,
      mode: "clear",
      active: true,
      world: createWorldProgress(WORLD_CONTENT_V1, "luoyang"),
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
      log: ["初入江湖：洛阳擂台。"],
      loot: [],
      divine: 0,
      insight: 0,
      counter: 0,
      lastBattle: null,
    };
    return new JianghuSession(state);
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

  snapshot(): SessionSnapshotV1 {
    const s = this.state;
    const map = WORLD_CONTENT_V1.maps.find((entry) => entry.id === s.mapId)!;
    return {
      buildId: s.buildId,
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
      mode: s.mode,
      active: s.active,
      elapsedHours: s.timeSeconds / 3600,
      fights: s.fights,
      wins: s.wins,
      losses: s.losses,
      gearScore: this.gearScore(),
      divineItems: s.divine,
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
      recentLog: s.log.slice(-12),
      recentLoot: s.loot.slice(-8),
    };
  }

  dispatch(command: JianghuCommand): SessionSnapshotV1 {
    switch (command.type) {
      case "newGame": {
        const next = JianghuSession.newGame(command.buildId, command.seed, this.state.nowMs);
        this.state = next.state;
        break;
      }
      case "travel": {
        const map = WORLD_CONTENT_V1.maps.find((entry) => entry.id === command.mapId);
        if (!map) throw new Error(`未知地图：${command.mapId}`);
        const unlock = canEnterMap(WORLD_CONTENT_V1, this.state.world, map.id, levelToRealm(this.state.level));
        if (!unlock.ok) throw new Error(unlock.message);
        this.state.mapId = map.id;
        this.state.layer = 1;
        this.state.active = false;
        this.state.activity = null;
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
    };
    const elapsedSeconds = Math.max(0, (nowMs - s.lastSettledMs) / 1000);
    const offline = options.offline ?? elapsedSeconds >= 3600;
    const cappedSeconds = offline ? Math.min(elapsedSeconds, MAX_OFFLINE_HOURS * 3600) : elapsedSeconds;
    const budget = offline ? cappedSeconds * OFFLINE_RATE : cappedSeconds;
    let remaining = budget;
    let stoppedBy: string | null = null;
    const maxFights = 2000;
    let guard = 0;
    while (remaining >= FIGHT_BASE_SECONDS && s.active && guard < maxFights) {
      guard += 1;
      if (this.pendingTrial()) {
        const seconds = this.attemptTrial();
        remaining -= seconds;
        s.timeSeconds += seconds;
        continue;
      }
      const result = s.mode === "clear" ? this.stepClear() : this.stepActivity();
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
    const seconds = fightSeconds(battle.rounds, true);
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

  private stepClear(): { seconds: number; fatal: boolean; reason: string } | null {
    const s = this.state;
    s.counter += 1;
    const encounter = generateEncounter(WORLD_CONTENT_V1, s.mapId, s.layer, s.seed + s.counter, s.world);
    const enemy = createEncounterBattle(encounter);
    const battle = resolveBattle({
      player: { sheet: this.sheet(), loadout: s.build.loadout, content: COMBAT_CONTENT },
      enemy,
      objective: "clear",
      maxRounds: 30,
      seed: s.seed + s.counter + 17,
      modifiers: encounterBattleModifiers(encounter),
      captureEvents: false,
    });
    const seconds = fightSeconds(battle.rounds, encounter.kind === "boss");
    s.lastBattle = {
      enemyName: battle.enemyName,
      outcome: battle.outcome,
      rounds: battle.rounds,
      playerHpPct: battle.playerHpPct,
      damageDealt: battle.damageDealt,
      damageTaken: battle.damageTaken,
      log: battle.log.slice(-12),
    };
    s.fights += 1;
    const map = WORLD_CONTENT_V1.maps.find((entry) => entry.id === s.mapId)!;
    if (battle.win) {
      s.wins += 1;
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
      if (this.state.fights % 3 === 0) this.gainGear(encounter, source);
      if (encounter.kind === "boss") {
        const clear = recordMapClear(WORLD_CONTENT_V1, s.world, s.mapId, 10);
        s.world = clear.progress;
        if (clear.granted) {
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
      s.world = recordMapLoss(s.world, s.mapId, s.layer);
      if (s.layer > 1) s.layer -= 1;
      s.log.push(`第 ${s.layer + 1} 层失利`);
    }
    this.trimLog();
    return { seconds, fatal: false, reason: "" };
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
    const seconds = fightSeconds(battle.rounds, false);
    s.lastBattle = {
      enemyName: battle.enemyName,
      outcome: battle.outcome,
      rounds: battle.rounds,
      playerHpPct: battle.playerHpPct,
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
    if (!rng.chance(dropChance(source))) return;
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
      const equipped = this.itemization.applyEquipPolicy(s.inventory, item, "upgradeUnlocked", context);
      s.inventory = equipped.state;
      if (equipped.equipped) {
        s.loot.push(`换装：${item.name}`);
        s.log.push(`换装：${item.name}`);
      }
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
