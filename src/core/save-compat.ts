import type { GameContentBundle } from "../data/content-bundle.ts";
import { APP_VERSION, CONTENT_VERSION, SAVE_SCHEMA_VERSION } from "../data/content-version.ts";

// ---------------------------------------------------------------------------
// Save envelope + content compatibility
// ---------------------------------------------------------------------------

export interface SaveStateV1 {
  ownedArts: string[];
  companions: string[];
  maps: string[];
  items: string[];
  flags: Record<string, unknown>;
  rank: number;
  codex: string[];
}

export interface SaveEnvelopeV1 {
  appVersion: string;
  contentVersion: string;
  schemaVersion: number;
  seed: number;
  state: SaveStateV1;
}

export interface SaveRecoveryResult {
  ok: boolean;
  recovered: boolean;
  state: SaveStateV1 | null;
  quarantined: string[];
  migrations: string[];
  errors: string[];
  contentVersion: string;
}

export const SAVE_ID_MIGRATIONS: Record<string, string> = {
  taiji_old_siliang: "taiji_siliang",
  pojun_old_wanjun: "pojun_wanjun",
  xuanyin_old_wangu: "xuanyin_wangu",
  map_heishi_old: "heishi",
  comp_old_liuqing: "comp_liuqing",
};

export function createSaveEnvelope(state: SaveStateV1, seed = 1): SaveEnvelopeV1 {
  return {
    appVersion: APP_VERSION,
    contentVersion: CONTENT_VERSION,
    schemaVersion: SAVE_SCHEMA_VERSION,
    seed,
    state: structuredClone(state),
  };
}

export function recoverSave(serialized: string, bundle: GameContentBundle): SaveRecoveryResult {
  const errors: string[] = [];
  let parsed: SaveEnvelopeV1;
  try {
    parsed = JSON.parse(serialized) as SaveEnvelopeV1;
  } catch (error) {
    return {
      ok: false,
      recovered: false,
      state: null,
      quarantined: [],
      migrations: [],
      errors: [`存档不是合法 JSON：${String(error)}`],
      contentVersion: bundle.contentVersion,
    };
  }
  if (!parsed || typeof parsed !== "object" || !parsed.state) {
    return {
      ok: false,
      recovered: false,
      state: null,
      quarantined: [],
      migrations: [],
      errors: ["存档缺少 state"],
      contentVersion: bundle.contentVersion,
    };
  }
  const known = {
    arts: new Set([
      ...Object.keys(bundle.combat.skills),
      ...Object.keys(bundle.combat.innerArts),
      ...Object.keys(bundle.combat.hearts),
      ...Object.keys(bundle.combat.keystones),
    ]),
    companions: new Set(Object.keys(bundle.combat.companions)),
    maps: new Set(bundle.world.maps.map((map) => map.id)),
    items: new Set([
      ...Object.keys(bundle.world.targetDrops),
      ...Object.keys(bundle.starterGear),
    ]),
    codex: new Set(bundle.endgame.codex.map((entry) => entry.id)),
  };
  const migrations: string[] = [];
  const quarantined: string[] = [];
  const migrate = (id: string): string | null => {
    const next = SAVE_ID_MIGRATIONS[id];
    if (next) {
      migrations.push(`${id} -> ${next}`);
      return next;
    }
    return id;
  };
  const recoverList = (list: unknown, set: Set<string>, label: string): string[] => {
    if (!Array.isArray(list)) {
      errors.push(`存档 ${label} 不是数组`);
      return [];
    }
    const result: string[] = [];
    for (const raw of list) {
      if (typeof raw !== "string") continue;
      const id = migrate(raw);
      if (id && set.has(id)) result.push(id);
      else quarantined.push(`${label}:${raw}`);
    }
    return result;
  };
  const state: SaveStateV1 = {
    ownedArts: recoverList(parsed.state.ownedArts, known.arts, "ownedArts"),
    companions: recoverList(parsed.state.companions, known.companions, "companions"),
    maps: recoverList(parsed.state.maps, known.maps, "maps"),
    items: recoverList(parsed.state.items, known.items, "items"),
    flags: typeof parsed.state.flags === "object" && parsed.state.flags ? parsed.state.flags : {},
    rank: typeof parsed.state.rank === "number" ? parsed.state.rank : bundle.endgame.ladderSize,
    codex: recoverList(parsed.state.codex, known.codex, "codex"),
  };
  const versionMismatch = parsed.contentVersion !== bundle.contentVersion || parsed.schemaVersion !== SAVE_SCHEMA_VERSION;
  if (versionMismatch) errors.push(`存档版本 ${parsed.contentVersion}/${parsed.schemaVersion} 与当前 ${bundle.contentVersion}/${SAVE_SCHEMA_VERSION} 不同，已按 ID 迁移/隔离`);
  return {
    ok: true,
    recovered: versionMismatch || migrations.length > 0 || quarantined.length > 0,
    state,
    quarantined,
    migrations,
    errors,
    contentVersion: bundle.contentVersion,
  };
}

export function validateSaveEnvelope(envelope: SaveEnvelopeV1): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (envelope.schemaVersion !== SAVE_SCHEMA_VERSION) errors.push("save schema version 不匹配");
  if (!envelope.contentVersion) errors.push("缺少 content version");
  if (!envelope.state) errors.push("缺少 state");
  return { ok: errors.length === 0, errors };
}
