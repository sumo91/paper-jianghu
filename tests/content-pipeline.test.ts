import assert from "node:assert/strict";
import test from "node:test";
import { GAME_CONTENT, type GameContentBundle } from "../src/data/content-bundle.ts";
import { runContentMatrix, validateContent } from "../src/core/content-pipeline.ts";
import { CONTENT_VERSION, SAVE_SCHEMA_VERSION } from "../src/data/content-version.ts";
import { createSaveEnvelope, recoverSave, validateSaveEnvelope } from "../src/core/save-compat.ts";
import type { SaveStateV1 } from "../src/core/save-compat.ts";

function bundle(): GameContentBundle {
  return structuredClone(GAME_CONTENT) as GameContentBundle;
}

test("valid authored content passes every validation layer with a versioned report", () => {
  const report = validateContent(GAME_CONTENT);
  assert.equal(report.ok, true, report.errors.join("; "));
  assert.equal(report.contentVersion, CONTENT_VERSION);
  assert.equal(report.checks.length, 10);
  assert.ok(report.checks.every((entry) => entry.name.length > 0));
  assert.ok(report.warnings.some((warning) => warning.includes("50–60")));
});

test("each invalid fixture fails the correct validation category", () => {
  const combat = bundle();
  combat.starterKits.taiji.loadout.moves[0] = "missing_move";
  const combatReport = validateContent(combat);
  assert.equal(combatReport.ok, false);
  assert.ok(combatReport.checks.find((entry) => entry.name === "combat")?.errors.length);

  const itemization = bundle();
  delete itemization.itemization.sets.set_taiji;
  assert.equal(validateContent(itemization).checks.find((entry) => entry.name === "itemization")?.ok, false);

  const progression = bundle();
  delete progression.progression.artUnlocks.taiji_lanque;
  assert.equal(validateContent(progression).checks.find((entry) => entry.name === "progression")?.ok, false);

  const world = bundle();
  delete world.world.bosses[world.world.maps[0].bossId];
  assert.equal(validateContent(world).checks.find((entry) => entry.name === "world")?.ok, false);

  const economy = bundle();
  economy.economy.currencies.silver.sources = [];
  assert.equal(validateContent(economy).checks.find((entry) => entry.name === "economy")?.ok, false);

  const factions = bundle();
  factions.factions.events.ev_zy_arena.speakerId = "missing_speaker";
  assert.equal(validateContent(factions).checks.find((entry) => entry.name === "factions")?.ok, false);

  const companions = bundle();
  delete (companions.companions.companions.comp_liuqing as unknown as Record<string, unknown>).assist;
  assert.equal(validateContent(companions).checks.find((entry) => entry.name === "companions")?.ok, false);

  const activities = bundle();
  delete activities.activities.mapTags.luoyang;
  assert.equal(validateContent(activities).checks.find((entry) => entry.name === "activities")?.ok, false);

  const endgame = bundle();
  endgame.endgame.codex.push({ ...endgame.endgame.codex[0] });
  assert.equal(validateContent(endgame).checks.find((entry) => entry.name === "endgame")?.ok, false);

  const cross = bundle();
  cross.companions.companions.comp_yushi.npcId = "missing_npc";
  assert.equal(validateContent(cross).checks.find((entry) => entry.name === "cross-references")?.ok, false);
});

test("balance matrix is deterministic, covers 15 maps x 4 builds, and has no unwinnable map", () => {
  const a = runContentMatrix(GAME_CONTENT, 31);
  const b = runContentMatrix(GAME_CONTENT, 31);
  assert.deepEqual(a, b);
  assert.equal(a.rows.length, 60);
  assert.equal(a.hybridValid, true);
  assert.equal(a.unwinnableMaps.length, 0);
  assert.ok(Object.values(a.perBuild).every((entry) => entry.wins > 0));
  assert.ok(a.dominantShare <= 0.6, `dominant share ${a.dominantShare}`);
  assert.ok(a.totalWins > 0);
  assert.ok(a.rows.every((row) => row.rounds >= 1 && row.hpPct >= 0 && row.hpPct <= 1));
});

test("save envelope carries app/content/save versions and seed", () => {
  const state: SaveStateV1 = {
    ownedArts: ["taiji_lanque"],
    companions: ["comp_liuqing"],
    maps: ["luoyang"],
    items: ["taiji_weapon"],
    flags: { flag_a: true },
    rank: 10,
    codex: ["codex_region_zhongyuan"],
  };
  const envelope = createSaveEnvelope(state, 42);
  assert.equal(envelope.contentVersion, CONTENT_VERSION);
  assert.equal(envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(envelope.seed, 42);
  assert.equal(validateSaveEnvelope(envelope).ok, true);
});

test("old save with renamed/missing IDs recovers with migration/quarantine instead of crashing", () => {
  const state: SaveStateV1 = {
    ownedArts: ["taiji_old_siliang", "missing_art"],
    companions: ["comp_old_liuqing", "missing_companion"],
    maps: ["map_heishi_old", "missing_map"],
    items: ["taiji_weapon", "missing_item"],
    flags: { old_flag: true },
    rank: 10,
    codex: ["codex_region_zhongyuan", "missing_codex"],
  };
  const serialized = JSON.stringify(createSaveEnvelope(state, 3));
  const recovery = recoverSave(serialized, GAME_CONTENT);
  assert.equal(recovery.ok, true);
  assert.equal(recovery.recovered, true);
  assert.equal(recovery.state?.ownedArts.includes("taiji_siliang"), true);
  assert.equal(recovery.state?.companions.includes("comp_liuqing"), true);
  assert.equal(recovery.state?.maps.includes("heishi"), true);
  assert.equal(recovery.quarantined.length, 5);
  assert.ok(recovery.migrations.length >= 3);
  assert.equal(recovery.state?.rank, 10);
  assert.equal(recovery.state?.flags.old_flag, true);

  const broken = recoverSave("{not json", GAME_CONTENT);
  assert.equal(broken.ok, false);
  assert.match(broken.errors[0], /JSON/);
});

test("content version mismatch is surfaced as recovery, not a crash", () => {
  const state: SaveStateV1 = { ownedArts: [], companions: [], maps: [], items: [], flags: {}, rank: 500, codex: [] };
  const envelope = createSaveEnvelope(state, 1);
  envelope.contentVersion = "old-content";
  const recovery = recoverSave(JSON.stringify(envelope), GAME_CONTENT);
  assert.equal(recovery.ok, true);
  assert.equal(recovery.recovered, true);
  assert.ok(recovery.errors.some((error) => error.includes("版本")));
});
